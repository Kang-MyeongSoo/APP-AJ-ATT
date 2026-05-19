export const ASP_JSON_CHARSET = "utf-8";

/**
 * JSON 필드 값용 UTF-8 percent-encoding.
 * ASP 쪽에서 `Server.URLDecode` 등으로 복원하는 한글 필드에 사용.
 */
export function encodeAspUtf8JsonField(value: string): string {
  return encodeURIComponent(value.trim());
}

export function serializeJsonBodyForAsp(payload: unknown): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

export function aspJsonRequestContentType(): string {
  return `application/json; charset=${ASP_JSON_CHARSET}`;
}
