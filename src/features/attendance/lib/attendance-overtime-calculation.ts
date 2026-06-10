import type { PlusMinusTimeRule } from "@/features/attendance/lib/attendance-plus-minus-time-api";

const MINUTES_PER_DAY = 24 * 60;

export type OvertimeConfigOption = {
  label: string;
  value: string;
};

/** `c_attr2` 괄호 안 코드값(시간 단위) 파싱 — 예: `0`, `0.5`, `4` */
export function parseOvertimeCodeHours(value: string): number | null {
  const n = Number.parseFloat(value.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatOvertimeHoursFallback(hours: number): string {
  if (hours === 0) return "없음";
  if (hours === Math.floor(hours)) return `${hours}시간`;
  return `${hours}시간`;
}

/** 폼·저장값(시간 단위 코드)에 맞는 표시 라벨 */
export function formatOvertimeLabel(
  codeHours: number,
  options: ReadonlyArray<OvertimeConfigOption> = [],
): string {
  const matched = options.find(
    (o) => parseOvertimeCodeHours(o.value) === codeHours,
  );
  if (matched) return matched.label;
  return formatOvertimeHoursFallback(codeHours);
}

/**
 * 계산된 잔업(분)을 `c_attr2` 구성값 코드(시간)에 맞춤.
 * - 정확히 일치하는 코드가 있으면 해당 값
 * - 없으면 계산 시간 이하이면서 가장 가까운(최대) 코드값
 */
export function snapOvertimeToConfigCode(
  calculatedMinutes: number,
  options: ReadonlyArray<OvertimeConfigOption>,
): number {
  const calculatedHours = Math.max(0, calculatedMinutes) / 60;
  const codeHours = options
    .map((o) => parseOvertimeCodeHours(o.value))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (codeHours.length === 0) return 0;

  const exact = codeHours.find((h) => h === calculatedHours);
  if (exact !== undefined) return exact;

  const fallback = codeHours.filter((h) => h <= calculatedHours).at(-1);
  return fallback ?? codeHours[0] ?? 0;
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
