import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  defaultAttendanceFormColors,
  mergeAttendanceFormColors,
  type AttendanceFormColors,
} from "@/features/attendance/lib/attendance-form-colors";

type AttendanceFormColorsState = AttendanceFormColors & {
  setColors: (colors: Partial<AttendanceFormColors>) => void;
  resetToDefault: () => void;
};

export const useAttendanceFormColorsStore = create<AttendanceFormColorsState>()(
  persist(
    (set) => ({
      ...defaultAttendanceFormColors,
      setColors: (colors) => {
        set((prev) => mergeAttendanceFormColors({ ...prev, ...colors }));
      },
      resetToDefault: () => {
        set(defaultAttendanceFormColors);
      },
    }),
    {
      name: "attendance-form-colors",
      version: 2,
      skipHydration: true,
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === "object") {
          const legacy = persisted as {
            titleColor?: string;
            disabledCellColor?: string;
          };
          return {
            disabledCellColor: legacy.disabledCellColor,
          };
        }
        return persisted as AttendanceFormColorsState;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<AttendanceFormColorsState> | undefined;
        const merged = mergeAttendanceFormColors(p);
        return { ...current, ...merged };
      },
    },
  ),
);
