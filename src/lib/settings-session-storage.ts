export const SETTINGS_SESSION_LOGIN_ID_KEY = "settingsSessionLoginId";

const SETTINGS_ADMIN_PASSWORD = "Future04!";

export function isSettingsAdminLoginId(loginId: string): boolean {
  return loginId.trim().toLowerCase() === "admin";
}

export function verifySettingsAdminPassword(password: string): boolean {
  return password === SETTINGS_ADMIN_PASSWORD;
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
