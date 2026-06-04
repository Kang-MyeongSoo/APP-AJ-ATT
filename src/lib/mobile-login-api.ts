import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import {
  isSettingsAdminLoginId,
  verifySettingsAdminPassword,
} from "@/lib/settings-session-storage";
import { z } from "zod";

export type MobileLoginUser = {
  corp_code: string;
  dpt_code: string;
  dpt_name: string;
  emp_code: string;
  emp_name: string;
};

const loginUserSchema = z
  .object({
    corp_code: z.unknown(),
    dpt_code: z.unknown(),
    dpt_name: z.unknown(),
    emp_code: z.unknown(),
    emp_name: z.unknown(),
  })
  .passthrough();

const loginResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.union([z.string(), z.null()]).optional(),
  items: z.array(loginUserSchema).optional(),
});

function asTrimmedText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseFlagValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rawItemToUser(raw: z.infer<typeof loginUserSchema>): MobileLoginUser {
  return {
    corp_code: asTrimmedText(raw.corp_code),
    dpt_code: asTrimmedText(raw.dpt_code),
    dpt_name: asTrimmedText(raw.dpt_name),
    emp_code: asTrimmedText(raw.emp_code),
    emp_name: asTrimmedText(raw.emp_name),
  };
}

export type MobileLoginVerifyResult =
  | { ok: true; user: MobileLoginUser }
  | { ok: false; message: string };

const SETTINGS_ADMIN_USER: MobileLoginUser = {
  corp_code: "",
  dpt_code: "",
  dpt_name: "",
  emp_code: "admin",
  emp_name: "admin",
};

/** 설정 화면 로그인 — admin 은 로컬 비밀번호 검증, 그 외는 `usp_mobile_login` */
export async function verifySettingsLogin(
  serverBaseUrl: string,
  userId: string,
  password: string,
): Promise<MobileLoginVerifyResult> {
  if (isSettingsAdminLoginId(userId)) {
    if (!password) {
      return { ok: false, message: "비밀번호를 입력해 주세요." };
    }
    if (!verifySettingsAdminPassword(password)) {
      return { ok: false, message: "비밀번호가 올바르지 않습니다." };
    }
    return { ok: true, user: SETTINGS_ADMIN_USER };
  }
  return verifyMobileLogin(serverBaseUrl, userId, password);
}

/** `usp_mobile_login` — Flag 0 이면 성공, -1 이면 MSG 로 실패 */
export async function verifyMobileLogin(
  serverBaseUrl: string,
  userId: string,
  password: string,
): Promise<MobileLoginVerifyResult> {
  const trimmedBase = serverBaseUrl.trim();
  if (!trimmedBase) {
    return {
      ok: false,
      message: "설정에서 서버 연결 URL을 먼저 저장해 주세요.",
    };
  }

  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return { ok: false, message: "아이디를 입력해 주세요." };
  }
  if (!password) {
    return { ok: false, message: "비밀번호를 입력해 주세요." };
  }

  const proxy = await proxyR2JsonGet({
    base: trimmedBase,
    proc: "usp_mobile_login",
    param1: trimmedUserId,
    param2: password,
    param3: "Y",
  });

  if (isAspProxyError(proxy)) {
    return {
      ok: false,
      message: proxy.error || `로그인 요청 실패 (${proxy.status})`,
    };
  }

  const json = proxy.data;

  const parsed = loginResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: "서버 응답 형식이 올바르지 않습니다." };
  }

  const flag = parseFlagValue(parsed.data.Flag);
  if (flag === 0) {
    const first = parsed.data.items?.[0];
    if (!first) {
      return { ok: false, message: "로그인 정보를 받지 못했습니다." };
    }
    return { ok: true, user: rawItemToUser(first) };
  }

  if (flag === -1) {
    const msg = asTrimmedText(parsed.data.MSG);
    return {
      ok: false,
      message: msg || "로그인에 실패했습니다.",
    };
  }

  const fallbackMsg = asTrimmedText(parsed.data.MSG);
  return {
    ok: false,
    message: fallbackMsg || "로그인에 실패했습니다.",
  };
}
