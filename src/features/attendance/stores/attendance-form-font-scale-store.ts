import { create } from "zustand";
import { persist } from "zustand/middleware";

export const ATTENDANCE_FORM_FONT_SCALE_MIN = 0.9;
export const ATTENDANCE_FORM_FONT_SCALE_MAX = 1.2;
export const ATTENDANCE_FORM_FONT_SCALE_STEP = 0.05;
export const ATTENDANCE_FORM_FONT_SCALE_DEFAULT = 1;

type AttendanceFormFontScaleState = {
  scale: number;
  decrease: () => void;
  increase: () => void;
};

function clampScale(value: number): number {
  return Math.min(
    ATTENDANCE_FORM_FONT_SCALE_MAX,
    Math.max(ATTENDANCE_FORM_FONT_SCALE_MIN, value),
  );
}

function roundScale(value: number): number {
  const steps = Math.round(
    (value - ATTENDANCE_FORM_FONT_SCALE_MIN) /
      ATTENDANCE_FORM_FONT_SCALE_STEP,
  );
  return clampScale(
    ATTENDANCE_FORM_FONT_SCALE_MIN +
      steps * ATTENDANCE_FORM_FONT_SCALE_STEP,
  );
}

export const useAttendanceFormFontScaleStore =
  create<AttendanceFormFontScaleState>()(
    persist(
      (set, get) => ({
        scale: ATTENDANCE_FORM_FONT_SCALE_DEFAULT,
        decrease: () => {
          const next = roundScale(get().scale - ATTENDANCE_FORM_FONT_SCALE_STEP);
          set({ scale: next });
        },
        increase: () => {
          const next = roundScale(get().scale + ATTENDANCE_FORM_FONT_SCALE_STEP);
          set({ scale: next });
        },
      }),
      {
        name: "attendance-form-font-scale",
        version: 1,
        merge: (persisted, current) => {
          const p = persisted as Partial<AttendanceFormFontScaleState> | undefined;
          const scale =
            typeof p?.scale === "number"
              ? roundScale(p.scale)
              : current.scale;
          return { ...current, scale };
        },
      },
    ),
  );

export function formatAttendanceFormFontScaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
