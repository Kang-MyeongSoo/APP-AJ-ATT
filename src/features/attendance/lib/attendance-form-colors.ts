export const ATTENDANCE_FORM_TITLE_HEADER_BG_VAR =
  "--attendance-form-title-header-bg";
export const ATTENDANCE_FORM_DISABLED_CELL_COLOR_VAR =
  "--attendance-form-disabled-cell-color";

export const DEFAULT_ATTENDANCE_FORM_TITLE_HEADER_BG = "#d4d4d8";
export const DEFAULT_ATTENDANCE_FORM_DISABLED_CELL_COLOR = "#e4e4e7";

export type AttendanceFormColors = {
  titleHeaderBackgroundColor: string;
  disabledCellColor: string;
};

export const defaultAttendanceFormColors: AttendanceFormColors = {
  titleHeaderBackgroundColor: DEFAULT_ATTENDANCE_FORM_TITLE_HEADER_BG,
  disabledCellColor: DEFAULT_ATTENDANCE_FORM_DISABLED_CELL_COLOR,
};

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const short = trimmed.match(/^#([0-9A-Fa-f]{3})$/);
  if (!short) return null;
  const [r, g, b] = short[1].split("");
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}

export function mergeAttendanceFormColors(
  incoming?: Partial<AttendanceFormColors>,
): AttendanceFormColors {
  const titleHeaderBackgroundColor =
    incoming?.titleHeaderBackgroundColor !== undefined
      ? (normalizeHexColor(incoming.titleHeaderBackgroundColor) ??
        defaultAttendanceFormColors.titleHeaderBackgroundColor)
      : defaultAttendanceFormColors.titleHeaderBackgroundColor;
  const disabledCellColor =
    incoming?.disabledCellColor !== undefined
      ? (normalizeHexColor(incoming.disabledCellColor) ??
        defaultAttendanceFormColors.disabledCellColor)
      : defaultAttendanceFormColors.disabledCellColor;

  return { titleHeaderBackgroundColor, disabledCellColor };
}

export function attendanceFormColorStyle(
  colors: AttendanceFormColors,
): Record<string, string> {
  return {
    [ATTENDANCE_FORM_TITLE_HEADER_BG_VAR]: colors.titleHeaderBackgroundColor,
    [ATTENDANCE_FORM_DISABLED_CELL_COLOR_VAR]: colors.disabledCellColor,
  };
}

export const attendanceFormTitleHeaderBgClass =
  "bg-[var(--attendance-form-title-header-bg,#d4d4d8)]";
