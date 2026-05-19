import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import { format } from "date-fns";

export type AttImageUploadFileInfo = {
  file_name: string;
  file_path: string;
};

export type AttImageUploadResult =
  | ({ success: true; remoteName: string } & AttImageUploadFileInfo)
  | { success: false; error: string };

function sanitizePathSegment(value: string): string {
  return value.replace(/[^0-9A-Za-z가-힣_.-]/g, "_");
}

export function buildAttRemoteImageName(values: AttendanceFormValues): string {
  const attDate = values.workDate.replace(/\D/g, "").slice(0, 8);
  const idno = sanitizePathSegment(values.regNumber.trim());
  const name = sanitizePathSegment(values.fullName.trim());
  const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
  return `att_etc/${attDate}/${idno}_${name}_${timestamp}.jpg`;
}

export async function uploadAttImage(
  serverBaseUrl: string,
  values: AttendanceFormValues,
  base64: string,
): Promise<AttImageUploadResult> {
  const base = serverBaseUrl.trim();
  if (!base) {
    return { success: false, error: "설정에서 서버 연결 URL을 먼저 저장해 주세요." };
  }

  const remoteName = buildAttRemoteImageName(values);

  const res = await fetch("/api/att-image-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base, remoteName, base64 }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    remoteName?: string;
    file_name?: string;
    file_path?: string;
    error?: string;
  };

  if (
    !res.ok ||
    !data.success ||
    !data.remoteName ||
    !data.file_name?.trim() ||
    !data.file_path?.trim()
  ) {
    return {
      success: false,
      error: data.error ?? "이미지 업로드 중 오류가 발생했습니다.",
    };
  }

  return {
    success: true,
    remoteName: data.remoteName,
    file_name: data.file_name.trim(),
    file_path: data.file_path.trim(),
  };
}
