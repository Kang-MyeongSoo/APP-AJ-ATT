import { format } from "date-fns";

export type EtcInputKind = "text" | "radio" | "date" | "time" | "combo";

const WORK_TIME_HM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function hasCompleteWorkTime(value: string): boolean {
  return WORK_TIME_HM_REGEX.test(String(value ?? "").trim());
}

/** 출근·퇴근시간 상호 배타 입력: 한 글자라도 입력되면 다른 쪽 잠금 */
export function hasWorkTimeInput(value: string): boolean {
  return String(value ?? "").trim().length > 0;
}

export function normalizeEtcInputKind(raw: string): EtcInputKind {
  const t = raw.trim().toLowerCase();
  if (t === "radio") return "radio";
  if (t === "date") return "date";
  if (t === "time") return "time";
  if (t === "combo") return "combo";
  return "text";
}

const CID_MST_REF_PATTERN = /^C_ID\s*=\s*['"]([^'"]+)['"]\s*$/i;

/** `c_attr2` 예: `C_ID='HRM_ATT_CORP'` → `HRM_ATT_CORP` */
export function parseCidMstParam(c_attr2: string): string | null {
  const match = CID_MST_REF_PATTERN.exec(c_attr2.trim());
  const param = match?.[1]?.trim();
  return param && param.length > 0 ? param : null;
}

export function isCidMstReference(c_attr2: string): boolean {
  return parseCidMstParam(c_attr2) !== null;
}

/**
 * `c_attr2` 예: `남(M),여(W)` → 표시 남/여, 저장값 M/W
 */
export function parseEtcAttr2Options(c_attr2: string): Array<{
  label: string;
  value: string;
}> {
  if (isCidMstReference(c_attr2)) return [];
  const s = c_attr2.trim();
  if (!s) return [];
  return s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(.+?)\(([^)]+)\)\s*$/.exec(part);
      if (!m) {
        return { label: part, value: part };
      }
      return { label: m[1].trim(), value: m[2].trim() };
    });
}

export function isNightShift(shift: string): boolean {
  const v = shift.trim().toLowerCase();
  if (v === "night" || v === "n" || v === "2") return true;
  if (v.includes("야간") || v.includes("ноч")) return true;
  return false;
}

export function isDayShift(shift: string): boolean {
  const v = shift.trim().toLowerCase();
  if (v === "day" || v === "d" || v === "1") return true;
  if (v.includes("주간") || v.includes("днев")) return true;
  return false;
}

export type WorkInOutKind = "in" | "out";

/** 다음 분 0초까지 남은 ms (시스템 시계 기준) */
export function msUntilNextMinuteBoundary(now: Date = new Date()): number {
  return (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
}

/**
 * 매 분 경계(초=0)마다 `onTick` 호출. 매번 `new Date()`로 읽어 setInterval 누적 오차를 피함.
 * 탭/창 포커스 복귀 시에도 즉시 한 번 동기화.
 */
export function subscribeLiveAttendanceClockSync(onTick: () => void): () => void {
  if (typeof window === "undefined") {
    onTick();
    return () => {};
  }

  let timeoutId: number | undefined;

  const scheduleNext = () => {
    timeoutId = window.setTimeout(() => {
      onTick();
      scheduleNext();
    }, msUntilNextMinuteBoundary());
  };

  const resync = () => {
    onTick();
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    scheduleNext();
  };

  onTick();
  scheduleNext();

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      resync();
    }
  };

  window.addEventListener("focus", resync);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    window.removeEventListener("focus", resync);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function formatCurrentWorkTimeHm(now: Date = new Date()): string {
  return format(now, "HH:mm");
}

/** 마스터 `c_attr3` 등에 적힌 형식 안내 문자열 (실제 시각 아님) */
export function isWorkTimeFormatHint(value: string): boolean {
  const normalized = value.trim().replace(/\s/g, "").toUpperCase();
  return normalized === "HH:MM" || normalized === "HHMM";
}

export function sanitizeWorkTimeValue(value: string): string {
  if (isWorkTimeFormatHint(value)) return "";
  return value.trim();
}

const KO_WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatCurrentWorkDate(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

function parseWorkDateValue(workDate: string): Date | null {
  const trimmed = workDate.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(`${trimmed.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dotted = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/.exec(trimmed);
  if (dotted) {
    const y = dotted[1];
    const m = dotted[2].padStart(2, "0");
    const d = dotted[3].padStart(2, "0");
    const parsed = new Date(`${y}-${m}-${d}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8) {
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    const parsed = new Date(`${y}-${m}-${d}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/** 폼/API 저장용 `yyyy-MM-dd` */
export function normalizeWorkDateStorage(workDate: string, now: Date = new Date()): string {
  const parsed = parseWorkDateValue(workDate);
  if (!parsed) return formatCurrentWorkDate(now);
  return format(parsed, "yyyy-MM-dd");
}

/** 근무일자 입력란 표시용 (예: `2026. 05. 20 (수)`). 저장/API 값은 `yyyy-MM-dd` 유지 */
export function formatWorkDateDisplay(workDate: string): string {
  const trimmed = workDate.trim();
  if (!trimmed) return "";

  if (/\([월화수목금토일]\)\s*$/.test(trimmed)) {
    return trimmed;
  }

  const date = parseWorkDateValue(trimmed);
  if (!date) return trimmed;

  const yyyy = format(date, "yyyy");
  const MM = format(date, "MM");
  const dd = format(date, "dd");
  const dow = KO_WEEKDAY_SHORT[date.getDay()];
  return `${yyyy}. ${MM}. ${dd} (${dow})`;
}

type LiveWorkDateSetValue = (
  name: "workDate",
  value: string,
  options?: { shouldValidate?: boolean },
) => void;

/** 오늘 날짜(yyyy-MM-dd)를 근무일자에 반영 */
export function applyCurrentWorkDateSync({
  setValue,
  canSet,
}: {
  setValue: LiveWorkDateSetValue;
  canSet: boolean;
}): void {
  if (!canSet) return;
  setValue("workDate", formatCurrentWorkDate(), { shouldValidate: true });
}

/** ATT_ETC_FORM 08 `c_attr2` 옵션·저장값으로 출근/퇴근 구분 */
export function resolveWorkInOutKind(
  workInOut: string,
  options: Array<{ label: string; value: string }>,
): WorkInOutKind | null {
  const trimmed = workInOut.trim();
  if (!trimmed) return null;

  const matched =
    options.find((o) => o.value === trimmed) ??
    options.find((o) => o.value.toLowerCase() === trimmed.toLowerCase());

  const label = matched?.label ?? trimmed;
  const value = matched?.value ?? trimmed;
  const text = `${label}${value}`.toLowerCase();

  /** ATT_ETC_FORM 08 / `p_ter_mode` 저장값 (1=출근, 2=퇴근) */
  if (value === "2") return "out";
  if (value === "1") return "in";

  if (
    text.includes("퇴근") ||
    value.toLowerCase() === "o" ||
    value.toLowerCase() === "out"
  ) {
    return "out";
  }
  if (
    text.includes("출근") ||
    value.toLowerCase() === "i" ||
    value.toLowerCase() === "in"
  ) {
    return "in";
  }

  return null;
}

type WorkTimeSetValue = (
  name: "startTime" | "endTime",
  value: string,
  options?: { shouldValidate?: boolean },
) => void;

/** 출근/퇴근 선택에 따라 한쪽 시간만 채우고 반대쪽은 비움 */
export function applyWorkInOutTimeSync({
  workInOutKind,
  setValue,
  canSetStart,
  canSetEnd,
}: {
  workInOutKind: WorkInOutKind;
  setValue: WorkTimeSetValue;
  canSetStart: boolean;
  canSetEnd: boolean;
}): void {
  const now = formatCurrentWorkTimeHm();
  if (workInOutKind === "in") {
    if (canSetStart) setValue("startTime", now, { shouldValidate: true });
    if (canSetEnd) setValue("endTime", "", { shouldValidate: true });
    return;
  }
  if (canSetStart) setValue("startTime", "", { shouldValidate: true });
  if (canSetEnd) setValue("endTime", now, { shouldValidate: true });
}

/** 출근/퇴근 선택 시 반대편 시간 입력 잠금 (미선택 시 기존 상호 배타 규칙) */
export function isPeerWorkTimeInputDisabled(
  field: "start" | "end",
  workInOutKind: WorkInOutKind | null,
  peerTime: string,
): boolean {
  if (workInOutKind === "in") return field === "end";
  if (workInOutKind === "out") return field === "start";
  return hasWorkTimeInput(peerTime);
}

export function coerceInitialWorkDate(
  c_attr3: string,
  today: Date = new Date(),
): string {
  const t = c_attr3.trim();
  if (!t) return format(today, "yyyy-MM-dd");
  const lower = t.toLowerCase().replace(/\s/g, "");
  if (lower === "curdate()" || lower === "curdate") {
    return format(today, "yyyy-MM-dd");
  }
  const normalized = normalizeWorkDateStorage(t, today);
  if (parseWorkDateValue(t)) return normalized;
  return format(today, "yyyy-MM-dd");
}

/** `0830` 또는 `08:30` → 입력용 `HH:mm` */
export function coerceInitialTimeDisplay(c_attr3: string): string {
  const digits = c_attr3.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
