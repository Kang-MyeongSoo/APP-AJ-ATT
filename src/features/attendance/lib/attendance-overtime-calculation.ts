import type { PlusMinusTimeRule } from "@/features/attendance/lib/attendance-plus-minus-time-api";
import { OVERTIME_MINUTE_OPTIONS } from "@/features/attendance/lib/attendance-form-schema";

const MINUTES_PER_DAY = 24 * 60;

export function formatOvertimeLabel(minutes: number): string {
  if (minutes === 0) return "없음 (0분)";
  const h = minutes / 60;
  if (h === Math.floor(h)) return `${h}시간`;
  return `${h}시간`;
}

/** 30분 단위 옵션에 맞게 내림(29분→0, 30~59분→30)·상한 */
export function snapOvertimeMinutesToOption(minutes: number): number {
  const snapped = Math.floor(minutes / 30) * 30;
  const capped = Math.min(12 * 60, Math.max(0, snapped));
  if (OVERTIME_MINUTE_OPTIONS.includes(capped)) return capped;
  const fallback = OVERTIME_MINUTE_OPTIONS.filter((m) => m <= capped).at(-1);
  return fallback ?? 0;
}

function parseHmToMinutes(value: string): number | null {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 4) return null;
  const hh = Number.parseInt(digits.slice(0, 2), 10);
  const mm = Number.parseInt(digits.slice(2, 4), 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

function isOvertimeSegment(rule: PlusMinusTimeRule): boolean {
  return rule.over_time_yn === "Y";
}

function isRegularWorkSegment(rule: PlusMinusTimeRule): boolean {
  return rule.calc_type === "1" && rule.over_time_yn !== "Y";
}

/** 자정을 넘는 구간은 당일 [beg,1440) + [0,end] 로 펼침 */
function expandSegmentIntervals(begMin: number, endMin: number): Array<[number, number]> {
  if (begMin <= endMin) return [[begMin, endMin]];
  return [
    [begMin, MINUTES_PER_DAY],
    [0, endMin],
  ];
}

function overlapRange(
  segStart: number,
  segEnd: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  const start = Math.max(segStart, rangeStart);
  const end = Math.min(segEnd, rangeEnd);
  return Math.max(0, end - start);
}

function overlapSegmentWithRanges(
  begMin: number,
  endMin: number,
  ranges: Array<[number, number]>,
): number {
  let total = 0;
  for (const [segStart, segEnd] of expandSegmentIntervals(begMin, endMin)) {
    for (const [rangeStart, rangeEnd] of ranges) {
      total += overlapRange(segStart, segEnd, rangeStart, rangeEnd);
    }
  }
  return total;
}

/**
 * 정규 근무 종료 시각을 지났는지 (야간 20:30~05:30 → 05:30 이후 퇴근만 잔업).
 */
function hasPassedRegularEnd(
  clockOutMin: number,
  regularBegMin: number,
  regularEndMin: number,
): boolean {
  if (regularBegMin <= regularEndMin) {
    return clockOutMin > regularEndMin;
  }
  return clockOutMin > regularEndMin && clockOutMin < regularBegMin;
}

/** 정규 근무 종료 ~ 퇴근 시각 구간 (잔업 산정용) */
function buildWorkedPastRegularEndRanges(
  clockOutMin: number,
  regularBegMin: number,
  regularEndMin: number,
): Array<[number, number]> {
  if (!hasPassedRegularEnd(clockOutMin, regularBegMin, regularEndMin)) {
    return [];
  }

  if (regularBegMin <= regularEndMin) {
    return [[regularEndMin, clockOutMin]];
  }

  return [[regularEndMin, clockOutMin]];
}

function findPrimaryRegularRule(
  rules: PlusMinusTimeRule[],
): PlusMinusTimeRule | null {
  const regularRules = rules.filter(isRegularWorkSegment);
  if (regularRules.length === 0) return null;
  return regularRules[0] ?? null;
}

/**
 * 퇴근 시각·석식 여부·서버 규칙으로 잔업(분) 계산.
 * - calc_type 1 + over_time_yn Y: 정규 종료 이후 ~ 퇴근과 겹치는 분만 가산
 * - calc_type 2: 위 잔업 구간과 겹치면 공제 (plus_yn=Y 이고 석식 N이면 공제하지 않음)
 */
export function calculateOvertimeMinutesFromRules(
  rules: PlusMinusTimeRule[],
  endTimeHm: string,
  dinnerYn: string,
): number {
  const clockOutMin = parseHmToMinutes(endTimeHm);
  if (clockOutMin == null || rules.length === 0) return 0;

  const overtimeWorkRules = rules.filter(
    (r) => r.calc_type === "1" && isOvertimeSegment(r),
  );
  if (overtimeWorkRules.length === 0) return 0;

  const regularRule = findPrimaryRegularRule(rules);
  if (!regularRule) return 0;

  const regularBegMin = parseHmToMinutes(regularRule.beg_time);
  const regularEndMin = parseHmToMinutes(regularRule.end_time);
  if (regularBegMin == null || regularEndMin == null) return 0;

  const workedRanges = buildWorkedPastRegularEndRanges(
    clockOutMin,
    regularBegMin,
    regularEndMin,
  );
  if (workedRanges.length === 0) return 0;

  let workMinutes = 0;
  for (const rule of overtimeWorkRules) {
    const begMin = parseHmToMinutes(rule.beg_time);
    const segEndMin = parseHmToMinutes(rule.end_time);
    if (begMin == null || segEndMin == null) continue;
    workMinutes += overlapSegmentWithRanges(begMin, segEndMin, workedRanges);
  }

  const skipPlusDeduction = dinnerYn.trim().toUpperCase() === "N";
  let deductMinutes = 0;
  for (const rule of rules.filter((r) => r.calc_type === "2")) {
    if (rule.plus_yn === "Y" && skipPlusDeduction) continue;
    const begMin = parseHmToMinutes(rule.beg_time);
    const endMin = parseHmToMinutes(rule.end_time);
    if (begMin == null || endMin == null) continue;
    deductMinutes += overlapSegmentWithRanges(begMin, endMin, workedRanges);
  }

  return Math.max(0, workMinutes - deductMinutes);
}
