import { isAspProxyError, proxyR2JsonGet } from "@/lib/asp-remote-client";
import { z } from "zod";

/** R2Json `usp_mobile_get_mst_code2` + param1 ATT_ETC_FORM 행 타입 */
export type EtcFormMstRow = {
  c_code: string;
  c_order: number | null;
  c_name: string;
  use_flag: "Y" | "N";
  c_attr1: string;
  c_attr2: string;
  c_attr3: string;
  c_attr4: string;
};

const rawItemSchema = z
  .object({
    c_code: z.union([z.string(), z.number()]).transform(String),
    c_order: z.unknown(),
    c_name: z.unknown(),
    use_flag: z.unknown(),
    c_attr1: z.unknown(),
    c_attr2: z.unknown(),
    c_attr3: z.unknown(),
    c_attr4: z.unknown(),
  })
  .passthrough();

const responseSchema = z.object({
  Flag: z.union([z.string(), z.number()]).optional(),
  MSG: z.string().optional(),
  items: z.array(rawItemSchema).optional(),
});

function asTrimmedText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeUseFlag(value: unknown): "Y" | "N" {
  const v = asTrimmedText(value).toUpperCase();
  return v === "N" ? "N" : "Y";
}

function normalizeOrder(value: unknown): number | null {
  const text = asTrimmedText(value);
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return n;
}

function rawItemToRow(raw: z.infer<typeof rawItemSchema>): EtcFormMstRow {
  return {
    c_code: asTrimmedText(raw.c_code),
    c_order: normalizeOrder(raw.c_order),
    c_name: asTrimmedText(raw.c_name),
    use_flag: normalizeUseFlag(raw.use_flag),
    c_attr1: asTrimmedText(raw.c_attr1),
    c_attr2: asTrimmedText(raw.c_attr2),
    c_attr3: asTrimmedText(raw.c_attr3),
    c_attr4: asTrimmedText(raw.c_attr4),
  };
}

/** 코드가 비어 있는 행만 제외합니다. (`title` 행 포함 전체 표시) */
export function filterEtcFormGridRows(rows: EtcFormMstRow[]): EtcFormMstRow[] {
  return rows.filter((r) => r.c_code.trim().length > 0);
}

export async function fetchEtcFormMstRows(
  serverBaseUrl: string,
): Promise<EtcFormMstRow[]> {
  const trimmed = serverBaseUrl.trim();
  if (!trimmed) {
    return [];
  }

  const proxy = await proxyR2JsonGet({
    base: trimmed,
    proc: "usp_mobile_get_mst_code2",
    param1: "ATT_ETC_FORM",
  });

  if (isAspProxyError(proxy)) {
    throw new Error(proxy.error || `입력폼 코드 요청 실패 (${proxy.status})`);
  }

  const json: unknown = proxy.data;
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("입력폼 코드 응답 형식이 올바르지 않습니다.");
  }

  const items = parsed.data.items ?? [];
  return filterEtcFormGridRows(items.map(rawItemToRow));
}
