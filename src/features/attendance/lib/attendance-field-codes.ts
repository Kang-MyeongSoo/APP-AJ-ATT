import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";

export const MAX_ATTENDANCE_FIELD_CODE = 13;

export const ATTENDANCE_FIELD_CODES_ORDERED = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
] as const;

/** ATT_ETC_FORM `c_code` → 양식 필드 코드 "01" … "13" */
export function normalizeAttendanceFieldCode(c_code: string): string | null {
  const t = c_code.trim();
  if (!t || t.toLowerCase() === "title") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_ATTENDANCE_FIELD_CODE) {
    return null;
  }
  return String(n).padStart(2, "0");
}

export function normalizeCaseWhenFieldCode(code: string): string {
  const n = Number.parseInt(code.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > MAX_ATTENDANCE_FIELD_CODE) {
    return code.trim();
  }
  return String(n).padStart(2, "0");
}

export const ATTENDANCE_FIELD_CODE_TO_FORM_KEY: Record<
  string,
  keyof AttendanceFormValues
> = {
  "01": "regNumber",
  "02": "companyName",
  "03": "fullName",
  "04": "phone",
  "05": "gender",
  "06": "workDate",
  "07": "shift",
  "08": "workInOut",
  "09": "startTime",
  "10": "endTime",
  "11": "overtimeMinutes",
  "12": "dinner",
  "13": "department",
};
