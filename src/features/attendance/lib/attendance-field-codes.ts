import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import { resolveWorkInOutKind } from "@/features/attendance/lib/etc-form-input-kind";

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

/** 서버 마스터 레이아웃 기준 04(휴대폰) 표시 여부. `null`이면 정적 양식(항목 표시). */
export function isAttendancePhoneFieldVisible(
  visibleFieldCodes: ReadonlySet<string> | null,
): boolean {
  return visibleFieldCodes === null || visibleFieldCodes.has("04");
}

export function validateAttendancePhoneWhenVisible(
  values: AttendanceFormValues,
  visibleFieldCodes: ReadonlySet<string> | null,
): string | null {
  if (!isAttendancePhoneFieldVisible(visibleFieldCodes)) return null;
  if (!values.phone.trim()) {
    return "휴대폰 번호를 입력해 주세요.";
  }
  return null;
}

/** 12번 표시 + 퇴근 선택 시 석식 Y/N 필수 */
export function validateAttendanceDinnerWhenClockOut(
  values: AttendanceFormValues,
  workInOutOptions: ReadonlyArray<{ label: string; value: string }>,
  visibleFieldCodes: ReadonlySet<string> | null,
): string | null {
  if (visibleFieldCodes !== null && !visibleFieldCodes.has("12")) return null;
  if (resolveWorkInOutKind(values.workInOut, workInOutOptions) !== "out") {
    return null;
  }
  if (values.dinner !== "Y" && values.dinner !== "N") {
    return "석식여부를 선택해 주세요.";
  }
  return null;
}

/** 성별·주간/야간·출근/퇴근 — 자동 반영 전용(사용자 직접 입력 불가) */
export const USER_INPUT_LOCKED_ATTENDANCE_FIELD_CODES = new Set([
  "05",
  "07",
  "08",
]);

export function isUserInputLockedAttendanceFieldCode(code: string): boolean {
  return USER_INPUT_LOCKED_ATTENDANCE_FIELD_CODES.has(code);
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
