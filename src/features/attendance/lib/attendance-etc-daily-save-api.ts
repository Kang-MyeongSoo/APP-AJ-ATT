import type { AttImageUploadFileInfo } from "@/features/attendance/lib/att-image-upload-api";
import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import { resolveWorkInOutKind } from "@/features/attendance/lib/etc-form-input-kind";
import { isAspProxyError, proxyAttEtcDailySave } from "@/lib/asp-remote-client";
import { encodeAspUtf8JsonField } from "@/lib/legacy-asp-json-body";

export const ATT_ETC_DAILY_SAVE_USER_ID = "DesktopApp";

export type AttEtcDailySaveBody = {
  p_att_date: string;
  p_etc_idno: string;
  p_att_corp_code: string;
  p_etc_name: string;
  p_cel_no: string;
  p_gender: string;
  p_att_dn_flag: string;
  p_work_in_out: string;
  /** ATT_ETC_FORM 08 출근/퇴근 구분 (예: 1=출근, 2=퇴근) */
  p_ter_mode: string;
  p_work_start: string;
  p_work_end: string;
  p_over_time: string;
  p_dinner_yn: string;
  p_dpt_work: string;
  p_user_id: string;
  /** 사진 없을 때도 키는 빈 문자열로 항상 전송 */
  p_file_name: string;
  p_file_path: string;
};

export type AttEtcDailySaveApiJson = {
  ok: boolean;
  status: number;
  data: unknown;
};

function pickErrorMessageFromUnknown(data: unknown): string | null {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.trim();
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const preferredKeys = ["error", "message", "MSG", "msg", "raw"];
  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function formatAttDate(workDate: string): string {
  return workDate.replace(/\D/g, "").slice(0, 8);
}

/** `HH:mm` 또는 `HHmm` → `HHmm` */
function formatWorkTimeHm(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 4) return digits;
  return digits;
}

function formatPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function resolveDinnerYnForSave(
  values: AttendanceFormValues,
  workInOutOptions: ReadonlyArray<{ label: string; value: string }>,
): string {
  if (resolveWorkInOutKind(values.workInOut, workInOutOptions) !== "out") {
    return "";
  }
  return values.dinner.trim().toUpperCase() === "Y" ? "Y" : "N";
}

export function buildAttEtcDailySaveBody(
  values: AttendanceFormValues,
  fileInfo?: AttImageUploadFileInfo,
  workInOutOptions: ReadonlyArray<{ label: string; value: string }> = [],
): AttEtcDailySaveBody {
  const body: AttEtcDailySaveBody = {
    p_att_date: formatAttDate(values.workDate),
    p_etc_idno: values.regNumber.trim(),
    p_att_corp_code: values.companyName.trim(),
    p_etc_name: encodeAspUtf8JsonField(values.fullName),
    p_cel_no: formatPhoneDigits(values.phone.trim()),
    p_gender: values.gender.trim(),
    p_att_dn_flag: values.shift.trim(),
    p_work_in_out: values.workInOut.trim(),
    p_ter_mode: values.workInOut.trim(),
    p_work_start: formatWorkTimeHm(values.startTime),
    p_work_end: formatWorkTimeHm(values.endTime),
    p_over_time: String(values.overtimeMinutes),
    p_dinner_yn: resolveDinnerYnForSave(values, workInOutOptions),
    p_dpt_work: values.department.trim(),
    p_user_id: ATT_ETC_DAILY_SAVE_USER_ID,
    p_file_name: fileInfo
      ? encodeAspUtf8JsonField(fileInfo.file_name)
      : "",
    p_file_path: fileInfo ? fileInfo.file_path.trim() : "",
  };

  return body;
}

export async function postAttEtcDailySave(
  serverBaseUrl: string,
  values: AttendanceFormValues,
  fileInfo?: AttImageUploadFileInfo,
  workInOutOptions: ReadonlyArray<{ label: string; value: string }> = [],
): Promise<AttEtcDailySaveApiJson | { error: string }> {
  const base = serverBaseUrl.trim();
  if (!base) {
    return { error: "설정에서 서버 연결 URL을 먼저 저장해 주세요." };
  }

  const payload = buildAttEtcDailySaveBody(values, fileInfo, workInOutOptions);
  console.log("[att-etc-daily-save] IPC → ASP", payload);

  const proxy = await proxyAttEtcDailySave({ base, payload });

  if (isAspProxyError(proxy)) {
    return { error: proxy.error };
  }

  if (!proxy.ok) {
    const message =
      pickErrorMessageFromUnknown(proxy.data) ??
      `근태 데이터 전송에 실패했습니다. (HTTP ${proxy.status})`;
    return { error: message };
  }

  return {
    ok: proxy.ok,
    status: proxy.status,
    data: proxy.data,
  };
}
