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

  const params = new URLSearchParams({
    base: trimmedBase,
    proc: "usp_mobile_get_mst_code",
    param1: trimmedParam,
  });

  const res = await fetch(`/api/r2-json?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `코드 목록 요청 실패 (${res.status})`;
    try {
      const err = (await res.json()) as { error?: string };
      if (typeof err.error === "string" && err.error.length > 0) {
        message = err.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const json: unknown = await res.json();
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
