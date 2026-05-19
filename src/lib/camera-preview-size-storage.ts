export const CAMERA_PREVIEW_WIDTH_STORAGE_KEY = "cameraPreviewWidthPx";

export const CAMERA_PREVIEW_WIDTH_MIN = 180;
export const CAMERA_PREVIEW_WIDTH_MAX = 420;
export const CAMERA_PREVIEW_WIDTH_DEFAULT = 320;

export function clampCameraPreviewWidth(value: number): number {
  if (!Number.isFinite(value)) return CAMERA_PREVIEW_WIDTH_DEFAULT;
  return Math.min(
    CAMERA_PREVIEW_WIDTH_MAX,
    Math.max(CAMERA_PREVIEW_WIDTH_MIN, Math.round(value)),
  );
}

/** 클라이언트에서만 사용. 저장된 카메라 프리뷰 폭(px)을 반환합니다. */
export function readCameraPreviewWidth(): number {
  if (typeof window === "undefined") return CAMERA_PREVIEW_WIDTH_DEFAULT;
  const raw = window.localStorage.getItem(CAMERA_PREVIEW_WIDTH_STORAGE_KEY);
  if (!raw) return CAMERA_PREVIEW_WIDTH_DEFAULT;
  const parsed = Number(raw);
  return clampCameraPreviewWidth(parsed);
}

/** 카메라 프리뷰 폭(px)을 보정 후 저장합니다. */
export function writeCameraPreviewWidth(value: number): number {
  const normalized = clampCameraPreviewWidth(value);
  window.localStorage.setItem(
    CAMERA_PREVIEW_WIDTH_STORAGE_KEY,
    String(normalized),
  );
  return normalized;
}
