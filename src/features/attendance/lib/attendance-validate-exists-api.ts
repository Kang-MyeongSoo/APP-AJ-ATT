import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

const validateExistsResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z
    .array(
      z.object({
        EXIST_YN: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
});

function isSuccessFlag(flag: string | number | undefined): boolean {
  return String(flag ?? "").trim() === "0";
}

function formatAttDate(workDate: string): string {
  return workDate.replace(/\D/g, "").slice(0, 8);
}

function formatRegNumberDigits(regNumber: string): string {
  return regNumber.replace(/\D/g, "").slice(0, 13);
}

export type ValidateAttendanceExistsResult =
  | { ok: true; exists: boolean }
  | { ok: false; error: string };

/**
 * `usp_mobile_validate_attendance_exists` — 당일 출근 기록 존재 여부.
 * param3 `1` = 출근 데이터 확인 (퇴근 전 검증용).
 */
export async function validateMobileAttendanceExists(
  serverBaseUrl: string,
  regNumber: string,
  workDate: string
): Promise<ValidateAttendanceExistsResult> {
  const trimmedBase = serverBaseUrl.trim();
  if (!trimmedBase) {
    return { ok: false, error: "설정에서 서버 연결 URL을 먼저 저장해 주세요." };
  }

  const idno = formatRegNumberDigits(regNumber);
  const attDate = formatAttDate(workDate);
  if (idno.length !== 13) {
    return { ok: false, error: "등록번호 13자리를 입력해 주세요." };
  }
  if (attDate.length !== 8) {
    return { ok: false, error: "근무일자를 확인해 주세요." };
  }

  const proxy = await proxyR2JsonGet({
    base: trimmedBase,
    proc: "usp_mobile_validate_attendance_exists",
    param1: idno,
    param2: attDate
  });

  if (isAspProxyError(proxy)) {
    return {
      ok: false,
      error: proxy.error || `출근 확인 요청 실패 (${proxy.status})`,
    };
  }

  if (!proxy.ok) {
    return {
      ok: false,
      error: `출근 확인 요청 실패 (HTTP ${proxy.status})`,
    };
  }

  const parsed = validateExistsResponseSchema.safeParse(proxy.data);
  if (!parsed.success) {
    return { ok: false, error: "출근 확인 응답 형식이 올바르지 않습니다." };
  }

  if (!isSuccessFlag(parsed.data.Flag)) {
    const msg = String(parsed.data.MSG ?? "").trim();
    return {
      ok: false,
      error: msg || "출근 확인에 실패했습니다.",
    };
  }

  const existYn = String(parsed.data.items?.[0]?.EXIST_YN ?? "")
    .trim()
    .toUpperCase();
  return { ok: true, exists: existYn === "Y" };
}
