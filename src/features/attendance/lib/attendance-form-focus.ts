export function focusAttendanceFormField(
  container: HTMLElement | null,
  fieldName: string,
): boolean {
  if (!container) return false;

  const host = container.querySelector<HTMLElement>(
    `[data-attendance-focus="${fieldName}"]`,
  );
  if (host) {
    const focusable = host.querySelector<HTMLElement>(
      [
        'input:not([disabled]):not([type="hidden"])',
        'button[role="combobox"]:not([disabled])',
        "select:not([disabled])",
        "textarea:not([disabled])",
      ].join(", "),
    );
    if (focusable) {
      focusable.focus();
      if (
        focusable instanceof HTMLInputElement &&
        focusable.type !== "radio" &&
        focusable.type !== "date"
      ) {
        focusable.select();
      }
      return true;
    }
  }

  const named = container.querySelector<HTMLElement>(
    `input[name="${fieldName}"]:not([disabled])`,
  );
  if (named) {
    named.focus();
    if (named instanceof HTMLInputElement && named.type !== "radio") {
      named.select();
    }
    return true;
  }

  return false;
}
