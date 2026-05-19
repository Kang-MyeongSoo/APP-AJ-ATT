import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

export type MstCodeOption = {
  c_code: string;
  c_name: string;
};

export type DepartmentWorkOption = MstCodeOption;

const mstItemSchema = z.object({
  c_code: z.union([z.string(), z.number()]).transform(String),
  c_name: z.union([z.string(), z.number()]).transform(String),
});

const mstCodeResponseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z.array(mstItemSchema).optional(),
});

export async function fetchMstCodeOptions(
  serverBaseUrl: string,
  param1: string,
): Promise<MstCodeOption[]> {
  const trimmedBase = serverBaseUrl.trim();
  const trimmedParam = param1.trim();
  if (!trimmedBase || !trimmedParam) {
    return [];
  }

  const proxy = await proxyR2JsonGet({
    base: trimmedBase,
    proc: "usp_mobile_get_mst_code",
    param1: trimmedParam,
  });

  if (isAspProxyError(proxy)) {
    throw new Error(proxy.error || `코드 목록 요청 실패 (${proxy.status})`);
  }

  const json: unknown = proxy.data;
  const parsed = mstCodeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("코드 목록 응답 형식이 올바르지 않습니다.");
  }

  const items = parsed.data.items ?? [];
  return items.map((row) => ({
    c_code: row.c_code.trim(),
    c_name: row.c_name.trim(),
  }));
}

export async function fetchDepartmentWorkOptions(
  serverBaseUrl: string,
): Promise<DepartmentWorkOption[]> {
  return fetchMstCodeOptions(serverBaseUrl, "ATT_DPT_WORK");
}
