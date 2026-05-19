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
  return v === "night" || v === "n";
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
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  return format(today, "yyyy-MM-dd");
}

/** `0830` 또는 `08:30` → 입력용 `HH:mm` */
export function coerceInitialTimeDisplay(c_attr3: string): string {
  const digits = c_attr3.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
