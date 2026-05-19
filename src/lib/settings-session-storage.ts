export const SETTINGS_SESSION_LOGIN_ID_KEY = "settingsSessionLoginId";

export function isSettingsAdminLoginId(loginId: string): boolean {
  return loginId.trim().toLowerCase() === "admin";
}

export function writeSettingsSessionLoginId(loginId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SETTINGS_SESSION_LOGIN_ID_KEY, loginId.trim());
}

export function readSettingsSessionLoginId(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(SETTINGS_SESSION_LOGIN_ID_KEY)?.trim() ?? "";
}

export function hasSettingsAdminSession(): boolean {
  return isSettingsAdminLoginId(readSettingsSessionLoginId());
}
