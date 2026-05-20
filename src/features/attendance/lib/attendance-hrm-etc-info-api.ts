import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

export type HrmAttEtcInfo = {
  att_corp_code: string;
  etc_name: string;
  cel_no: string;
  gender: string;
};

const hrmEtcInfoItemSchema = z.object({
  att_corp_code: z.union([z.string(), z.number()]).transform(String),
  etc_name: z.union([z.string(), z.number()]).transform(String),
  cel_no: z.union([z.string(), z.number()]).transform(String),
  gender: z.union([z.string(), z.number()]).transform(String),
});

const hrmEtcInfoResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z.array(hrmEtcInfoItemSchema).optional(),
});

function isSuccessFlag(flag: string | number | undefined): boolean {
  return String(flag ?? "").trim() === "0";
}

/**
 * `usp_mobile_get_hrm_att_etc_info` — 등록번호로 일용직 기본정보 조회.
 * 데이터 없음(Flag -1)이면 `null`, 오류 시 예외.
 */
export async function fetchHrmAttEtcInfo(
  serverBaseUrl: string,
  regNumber: string,
): Promise<HrmAttEtcInfo | null> {
  const trimmedBase = serverBaseUrl.trim();
  const idno = regNumber.replace(/\D/g, "").slice(0, 13);
  if (!trimmedBase || idno.length !== 13) {
    return null;
  }

  const proxy = await proxyR2JsonGet({
    base: trimmedBase,
    proc: "usp_mobile_get_hrm_att_etc_info",
    param1: idno,
  });

  if (isAspProxyError(proxy)) {
    throw new Error(proxy.error || `일용직 정보 조회 실패 (${proxy.status})`);
  }

  const parsed = hrmEtcInfoResponseSchema.safeParse(proxy.data);
  if (!parsed.success) {
    throw new Error("일용직 정보 응답 형식이 올바르지 않습니다.");
  }

  if (!isSuccessFlag(parsed.data.Flag)) {
    return null;
  }

  const first = parsed.data.items?.[0];
  if (!first) return null;

  return {
    att_corp_code: first.att_corp_code.trim(),
    etc_name: first.etc_name.trim(),
    cel_no: first.cel_no.replace(/\D/g, "").slice(0, 11),
    gender: first.gender.trim(),
  };
}
