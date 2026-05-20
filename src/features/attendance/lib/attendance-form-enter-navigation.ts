import type { KeyboardEvent } from "react";

const FOCUSABLE_TEXT_INPUT_SELECTOR = [
  'input:not([disabled]):not([readonly]):not([tabindex="-1"]):not([data-attendance-skip-focus])',
  ':not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="date"])',
].join("");

function getRowFocusTarget(row: Element): HTMLElement | null {
  const textLike = row.querySelector<HTMLElement>(
    [FOCUSABLE_TEXT_INPUT_SELECTOR, "textarea:not([disabled])"].join(", "),
  );
  if (textLike) return textLike;

  const combo = row.querySelector<HTMLElement>(
    'button[role="combobox"]:not([disabled])',
  );
  if (combo) return combo;

  const radio = row.querySelector<HTMLInputElement>(
    'input[type="radio"]:not([disabled])',
  );
  return radio;
}

function getAttendanceTableBodyRows(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("tbody tr")).filter((row) =>
    Boolean(getRowFocusTarget(row)),
  );
}

export function shouldHandleAttendanceEnterNavigation(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) {
    if (target.disabled || target.readOnly || target.tabIndex < 0) return false;
    if (target.dataset.attendanceSkipFocus !== undefined) return false;
    const type = target.type;
    if (
      type === "hidden" ||
      type === "checkbox" ||
      type === "submit" ||
      type === "date"
    ) {
      return false;
    }
    return true;
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled;
  }
  return false;
}

export function focusNextAttendanceField(
  container: HTMLElement,
  currentTarget: HTMLElement,
): boolean {
  const rows = getAttendanceTableBodyRows(container);
  const currentRowIndex = rows.findIndex((row) => row.contains(currentTarget));
  if (currentRowIndex < 0) return false;

  for (let i = currentRowIndex + 1; i < rows.length; i += 1) {
    const next = getRowFocusTarget(rows[i]);
    if (next) {
      next.focus();
      if (
        next instanceof HTMLInputElement &&
        next.type !== "radio" &&
        next.type !== "date"
      ) {
        next.select();
      }
      return true;
    }
  }

  return false;
}

export function handleAttendanceFormEnterKeyDown(
  event: KeyboardEvent<HTMLFormElement>,
  formElement: HTMLFormElement | null,
): void {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

  const target = event.target;
  if (!shouldHandleAttendanceEnterNavigation(target)) return;
  if (!(target instanceof HTMLElement) || !formElement) return;

  event.preventDefault();
  focusNextAttendanceField(formElement, target);
}
