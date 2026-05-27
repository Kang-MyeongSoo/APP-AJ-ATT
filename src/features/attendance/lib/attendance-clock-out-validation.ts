import { validateMobileAttendanceExists } from "@/features/attendance/lib/attendance-validate-exists-api";
import { resolveWorkInOutKind } from "@/features/attendance/lib/etc-form-input-kind";
import type { R2FlagMsgDialogContent } from "@/lib/r2-flag-msg-response";

export const CLOCK_OUT_NO_CHECK_IN_DIALOG: R2FlagMsgDialogContent = {
  title: "퇴근 불가",
  message:
    "출근 데이터가 없어 퇴근 처리할 수 없습니다.\n\nCannot process clock-out because no clock-in record exists for today.",
  tone: "error",
};

export type ClockOutCheckInValidationResult =
  | { ok: true }
  | { ok: false; dialog: R2FlagMsgDialogContent }
  | { ok: false; error: string };

export function isClockOutSelection(
  workInOut: string,
  options: Array<{ label: string; value: string }>,
): boolean {
  return resolveWorkInOutKind(workInOut, options) === "out";
}

export async function ensureClockInExistsForClockOut(params: {
  serverBaseUrl: string;
  regNumber: string;
  workDate: string;
  workInOut: string;
  workInOutOptions: Array<{ label: string; value: string }>;
}): Promise<ClockOutCheckInValidationResult> {
  if (!isClockOutSelection(params.workInOut, params.workInOutOptions)) {
    return { ok: true };
  }

  const api = await validateMobileAttendanceExists(
    params.serverBaseUrl,
    params.regNumber,
    params.workDate,
  );

  if (api.ok === false) {
    return { ok: false, error: api.error };
  }

  if (!api.exists) {
    return { ok: false, dialog: CLOCK_OUT_NO_CHECK_IN_DIALOG };
  }

  return { ok: true };
}
