import { parseFlagValue } from "@/lib/r2-flag-msg-response";

export type ImageSendUpstreamResult = {
  flag: number;
  file_name: string;
  file_path: string;
  msg?: string;
};

function pickNonEmptyString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unwrapRecord(parsed: unknown): Record<string, unknown> | null {
  if (Array.isArray(parsed) && parsed.length > 0) {
    return unwrapRecord(parsed[0]);
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  return parsed as Record<string, unknown>;
}

/** `R2JsonProc_image_send.aspx` 마지막 청크 JSON 응답 파싱 */
export function parseImageSendUpstreamResponse(
  text: string,
): ImageSendUpstreamResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  const record = unwrapRecord(parsed);
  if (!record) return null;

  const flag = parseFlagValue(record.Flag);
  const file_name = pickNonEmptyString(record, "file_name");
  const file_path = pickNonEmptyString(record, "file_path");
  if (flag === null || !file_name || !file_path) return null;

  const msg = pickNonEmptyString(record, "MSG") ?? undefined;
  return { flag, file_name, file_path, msg };
}
