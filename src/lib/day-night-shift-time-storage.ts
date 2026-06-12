import {
  isDayShift,
  isNightShift,
} from "@/features/attendance/lib/etc-form-input-kind";

export const DAY_NIGHT_SHIFT_TIME_STORAGE_KEY = "dayNightShiftTimeSettings";

export type DayNightShiftTimeSettings = {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
};

export const DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS: DayNightShiftTimeSettings =
  {
    dayStart: "08:30",
    dayEnd: "20:29",
    nightStart: "20:30",
    nightEnd: "08:29",
  };

export type ShiftOption = {
  label: string;
  value: string;
};

export type ShiftKind = "day" | "night";

function normalizeHmInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 4) return "";
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  if (Number(hh) > 23 || Number(mm) > 59) return "";
  return `${hh}:${mm}`;
}

export function isValidHmTime(value: string): boolean {
  return normalizeHmInput(value).length === 5;
}

export function parseHmToMinutes(value: string): number | null {
  const normalized = normalizeHmInput(value);
  if (!normalized) return null;
  const [hh, mm] = normalized.split(":");
  return Number(hh) * 60 + Number(mm);
}

function isMinuteInInclusiveRange(
  minute: number,
  start: number,
  end: number,
): boolean {
  if (start <= end) {
    return minute >= start && minute <= end;
  }
  return minute >= start || minute <= end;
}

export function mergeDayNightShiftTimeSettings(
  incoming?: Partial<DayNightShiftTimeSettings>,
): DayNightShiftTimeSettings {
  return {
    dayStart:
      incoming?.dayStart?.trim() || DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS.dayStart,
    dayEnd:
      incoming?.dayEnd?.trim() || DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS.dayEnd,
    nightStart:
      incoming?.nightStart?.trim() ||
      DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS.nightStart,
    nightEnd:
      incoming?.nightEnd?.trim() || DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS.nightEnd,
  };
}

export function parseDayNightShiftTimeSettings(
  raw: string | null,
): DayNightShiftTimeSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DayNightShiftTimeSettings>;
    const merged = mergeDayNightShiftTimeSettings(parsed);
    if (
      !isValidHmTime(merged.dayStart) ||
      !isValidHmTime(merged.dayEnd) ||
      !isValidHmTime(merged.nightStart) ||
      !isValidHmTime(merged.nightEnd)
    ) {
      return null;
    }
    return merged;
  } catch {
    return null;
  }
}

/** 클라이언트에서만 사용. 저장된 주간/야간 구분 시간을 반환합니다. */
export function readDayNightShiftTimeSettings(): DayNightShiftTimeSettings {
  if (typeof window === "undefined") {
    return DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS;
  }
  const parsed = parseDayNightShiftTimeSettings(
    window.localStorage.getItem(DAY_NIGHT_SHIFT_TIME_STORAGE_KEY),
  );
  return parsed ?? DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS;
}

export function writeDayNightShiftTimeSettings(
  value: DayNightShiftTimeSettings,
): DayNightShiftTimeSettings | null {
  const normalized = {
    dayStart: normalizeHmInput(value.dayStart),
    dayEnd: normalizeHmInput(value.dayEnd),
    nightStart: normalizeHmInput(value.nightStart),
    nightEnd: normalizeHmInput(value.nightEnd),
  };
  if (
    !isValidHmTime(normalized.dayStart) ||
    !isValidHmTime(normalized.dayEnd) ||
    !isValidHmTime(normalized.nightStart) ||
    !isValidHmTime(normalized.nightEnd)
  ) {
    return null;
  }
  window.localStorage.setItem(
    DAY_NIGHT_SHIFT_TIME_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
}

export function resolveShiftKindFromTime(
  now: Date = new Date(),
  settings: DayNightShiftTimeSettings = readDayNightShiftTimeSettings(),
): ShiftKind {
  const minute = now.getHours() * 60 + now.getMinutes();
  const dayStart = parseHmToMinutes(settings.dayStart);
  const dayEnd = parseHmToMinutes(settings.dayEnd);

  if (
    dayStart !== null &&
    dayEnd !== null &&
    isMinuteInInclusiveRange(minute, dayStart, dayEnd)
  ) {
    return "day";
  }

  return "night";
}

export function mapShiftKindToOptionValue(
  kind: ShiftKind,
  options: ShiftOption[],
): string {
  if (options.length > 0) {
    const found = options.find((opt) =>
      kind === "night"
        ? isNightShift(opt.value) || isNightShift(opt.label)
        : isDayShift(opt.value) || isDayShift(opt.label),
    );
    if (found) return found.value;
  }
  return kind === "night" ? "N" : "D";
}

export function resolveShiftValueFromTimeSettings(
  options: ShiftOption[] = [],
  now: Date = new Date(),
  settings?: DayNightShiftTimeSettings,
): string {
  const resolvedSettings = settings ?? readDayNightShiftTimeSettings();
  const kind = resolveShiftKindFromTime(now, resolvedSettings);
  return mapShiftKindToOptionValue(kind, options);
}

