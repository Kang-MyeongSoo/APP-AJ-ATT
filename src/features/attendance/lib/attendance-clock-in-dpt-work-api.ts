import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

const clockInDptWorkResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z
    .array(
      z.object({
        dpt_work: z.union([z.string(), z.number()]).transform(String),
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

export type FetchClockInDptWorkResult =
  | { ok: true; dptWork: string }
  | { ok: false; error: string };

/**
 * `usp_mobile_select_att_etc_dpt_work` — 당일 출근 시 등록된 근무부서 조회.
 * param1: 등록번호 13자리, param2: 근무일 yyyyMMdd
 */
export async function fetchClockInDepartmentWork(
  serverBaseUrl: string,
  regNumber: string,
  workDate: string,
): Promise<FetchClockInDptWorkResult> {
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
    proc: "usp_mobile_select_att_etc_dpt_work",
    param1: idno,
    param2: attDate,
  });

  if (isAspProxyError(proxy)) {
    return {
      ok: false,
      error: proxy.error || `출근 근무부서 조회 실패 (${proxy.status})`,
    };
  }

  if (!proxy.ok) {
    return {
      ok: false,
      error: `출근 근무부서 조회 실패 (HTTP ${proxy.status})`,
    };
  }

  const parsed = clockInDptWorkResponseSchema.safeParse(proxy.data);
  if (!parsed.success) {
    return { ok: false, error: "출근 근무부서 응답 형식이 올바르지 않습니다." };
  }

  if (!isSuccessFlag(parsed.data.Flag)) {
    const msg = String(parsed.data.MSG ?? "").trim();
    return {
      ok: false,
      error: msg || "출근 근무부서 조회에 실패했습니다.",
    };
  }

  const dptWork = parsed.data.items?.[0]?.dpt_work?.trim() ?? "";
  if (!dptWork) {
    return { ok: false, error: "출근 근무부서 데이터가 없습니다." };
  }

  return { ok: true, dptWork };
}
