export const SERVER_BASE_URL_STORAGE_KEY = "serverBaseUrl";

/** 클라이언트에서만 사용. 저장된 base URL(없으면 빈 문자열). */
export function readServerBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SERVER_BASE_URL_STORAGE_KEY) ?? "";
}

/** 빈 문자열이면 항목 제거, 아니면 trim 후 저장 */
export function writeServerBaseUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed === "") {
    window.localStorage.removeItem(SERVER_BASE_URL_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SERVER_BASE_URL_STORAGE_KEY, trimmed);
}
