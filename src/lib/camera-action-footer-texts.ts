export const CAMERA_ACTION_FOOTER_TEXTS_STORAGE_KEY = "cameraActionFooterTexts";

export type CameraActionFooterTexts = {
  bodyKo: string;
  bodyEn: string;
};

export const defaultCameraActionFooterTexts: CameraActionFooterTexts = {
  bodyKo: "",
  bodyEn: "",
};

export function mergeCameraActionFooterTexts(
  incoming?: Partial<CameraActionFooterTexts>,
): CameraActionFooterTexts {
  return {
    ...defaultCameraActionFooterTexts,
    ...incoming,
  };
}

export function parseCameraActionFooterTexts(
  raw: string | null,
): CameraActionFooterTexts | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CameraActionFooterTexts>;
    return mergeCameraActionFooterTexts(parsed);
  } catch {
    return null;
  }
}

export function readCameraActionFooterTexts(): CameraActionFooterTexts {
  if (typeof window === "undefined") {
    return defaultCameraActionFooterTexts;
  }
  const parsed = parseCameraActionFooterTexts(
    window.localStorage.getItem(CAMERA_ACTION_FOOTER_TEXTS_STORAGE_KEY),
  );
  return parsed ?? defaultCameraActionFooterTexts;
}

export function writeCameraActionFooterTexts(
  texts: CameraActionFooterTexts,
): CameraActionFooterTexts {
  const normalized: CameraActionFooterTexts = {
    bodyKo: texts.bodyKo,
    bodyEn: texts.bodyEn,
  };
  window.localStorage.setItem(
    CAMERA_ACTION_FOOTER_TEXTS_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}
