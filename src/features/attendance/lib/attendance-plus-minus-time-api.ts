import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import {
  isDayShift,
  isNightShift,
} from "@/features/attendance/lib/etc-form-input-kind";
import { z } from "zod";

const plusMinusTimeItemSchema = z.object({
  calc_type: z.union([z.string(), z.number()]).transform(String),
  beg_time: z.union([z.string(), z.number()]).transform(String),
  end_time: z.union([z.string(), z.number()]).transform(String),
  plus_yn: z.union([z.string(), z.number()]).transform(String),
  over_time_yn: z.union([z.string(), z.number()]).transform(String),
});

const plusMinusTimeResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z.array(plusMinusTimeItemSchema).optional(),
});

export type PlusMinusTimeRule = {
  calc_type: string;
  beg_time: string;
  end_time: string;
  plus_yn: string;
  /** Y = 잔업 산정 구간, N = 일반 근무·공제 */
  over_time_yn: string;
};

function isSuccessFlag(flag: string | number | undefined): boolean {
  return String(flag ?? "").trim() === "0";
}

/** 주간/야간 폼값 → `usp_mobile_get_plus_minus_time` param1 (D/N) */
export function resolvePlusMinusShiftParam(shift: string): string {
  if (isNightShift(shift)) return "N";
  if (isDayShift(shift)) return "D";
  return "D";
}

export type FetchPlusMinusTimeResult =
  | { ok: true; items: PlusMinusTimeRule[] }
  | { ok: false; error: string };

/**
 * `usp_mobile_get_plus_minus_time` — 근무·공제 시간대 마스터.
 * param1: 주간 D / 야간 N
 */
export async function fetchPlusMinusTimeRules(
  serverBaseUrl: string,
  shift: string,
): Promise<FetchPlusMinusTimeResult> {
  const trimmedBase = serverBaseUrl.trim();
  if (!trimmedBase) {
    return { ok: false, error: "설정에서 서버 연결 URL을 먼저 저장해 주세요." };
  }

  const proxy = await proxyR2JsonGet({
    base: trimmedBase,
    proc: "usp_mobile_get_plus_minus_time",
    param1: resolvePlusMinusShiftParam(shift),
  });

  if (isAspProxyError(proxy)) {
    return {
      ok: false,
      error: proxy.error || `잔업 규칙 조회 실패 (${proxy.status})`,
    };
  }

  if (!proxy.ok) {
    return {
      ok: false,
      error: `잔업 규칙 조회 실패 (HTTP ${proxy.status})`,
    };
  }

  const parsed = plusMinusTimeResponseSchema.safeParse(proxy.data);
  if (!parsed.success) {
    return { ok: false, error: "잔업 규칙 응답 형식이 올바르지 않습니다." };
  }

  if (!isSuccessFlag(parsed.data.Flag)) {
    const msg = String(parsed.data.MSG ?? "").trim();
    return { ok: false, error: msg || "잔업 규칙 조회에 실패했습니다." };
  }

  const items = (parsed.data.items ?? []).map((item) => ({
    calc_type: item.calc_type.trim(),
    beg_time: item.beg_time.replace(/\D/g, "").slice(0, 4),
    end_time: item.end_time.replace(/\D/g, "").slice(0, 4),
    plus_yn: item.plus_yn.trim().toUpperCase(),
    over_time_yn: item.over_time_yn.trim().toUpperCase(),
  }));

  return { ok: true, items };
}
