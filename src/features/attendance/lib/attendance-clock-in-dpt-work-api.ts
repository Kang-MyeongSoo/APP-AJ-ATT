import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

const clockInDptWorkResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z
    .array(
      z.object({
        dpt_work: z.union([z.string(), z.number()]).transform(String).optional(),
        att_dn_flag: z
          .union([z.string(), z.number()])
          .transform(String)
          .optional(),
        ter_mode: z.union([z.string(), z.number()]).transform(String).optional(),
      }),
    )
    .optional(),
});

function normalizeResponseFlag(flag: string | number | undefined): string {
  return String(flag ?? "").trim();
}

function isSuccessFlag(flag: string | number | undefined): boolean {
  return normalizeResponseFlag(flag) === "0";
}

function isNoDataFlag(flag: string | number | undefined): boolean {
  return normalizeResponseFlag(flag) === "-1";
}

function formatAttDate(workDate: string): string {
  return workDate.replace(/\D/g, "").slice(0, 8);
}

function formatRegNumberDigits(regNumber: string): string {
  return regNumber.replace(/\D/g, "").slice(0, 13);
}

export type FetchClockInDptWorkResult =
  | { ok: true; responseFlag: "-1"; terMode: "1" }
  | { ok: true; responseFlag: "0"; terMode: "1" }
  | { ok: true; responseFlag: "0"; terMode: "2"; dptWork: string; attDnFlag: string }
  | { ok: false; error: string };

/**
 * `usp_mobile_select_att_etc_dpt_work` — 당일 출퇴근·근무부서·주간야간 조회.
 * Flag `-1`: 출근 데이터 없음 → 출근(1).
 * Flag `0`: `ter_mode` 1=출근, 2=퇴근. 퇴근 시 `dpt_work`·`att_dn_flag` 반영.
 * param1: 등록번호 13자리, param2: 근무일 yyyyMMdd
 */
export async function fetchClockInDepartmentWork(
  serverBaseUrl: string,
  regNumber: string,
  workDate: string,
  shift?: string,
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
    param3: shift ?? "",
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

  if (isNoDataFlag(parsed.data.Flag)) {
    return { ok: true, responseFlag: "-1", terMode: "1" };
  }

  if (!isSuccessFlag(parsed.data.Flag)) {
    const msg = String(parsed.data.MSG ?? "").trim();
    return {
      ok: false,
      error: msg || "출퇴근 근무부서 조회에 실패했습니다.",
    };
  }

  const item = parsed.data.items?.[0];
  const terMode = item?.ter_mode?.trim() ?? "";
  const dptWork = item?.dpt_work?.trim() ?? "";
  const attDnFlag = item?.att_dn_flag?.trim() ?? "";

  if (terMode === "1") {
    return { ok: true, responseFlag: "0", terMode: "1" };
  }

  if (terMode === "2") {
    if (!dptWork) {
      return { ok: false, error: "근무부서 데이터가 없습니다." };
    }
    return { ok: true, responseFlag: "0", terMode: "2", dptWork, attDnFlag };
  }

  return {
    ok: false,
    error: "출퇴근 구분(ter_mode) 응답이 올바르지 않습니다.",
  };
}
