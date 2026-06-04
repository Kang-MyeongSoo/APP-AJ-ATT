export const SERVER_BASE_URL_STORAGE_KEY = "serverBaseUrl";

/** 최초 설치 시 localStorage에 자동 저장되는 기본 서버 주소 */
export const DEFAULT_SERVER_BASE_URL =
  "http://133.186.251.89:14283/AJCC/Mobile";

/** 클라이언트에서만 사용. 저장된 base URL(없으면 빈 문자열). 최초 설치 시 기본 URL을 저장한다. */
export function readServerBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(SERVER_BASE_URL_STORAGE_KEY);
  if (stored === null) {
    writeServerBaseUrl(DEFAULT_SERVER_BASE_URL);
    return DEFAULT_SERVER_BASE_URL;
  }
  return stored.trim();
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
