const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'button[role="combobox"]:not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(", ");

function focusAttendanceControl(
  focusable: HTMLElement,
): void {
  focusable.focus();
  if (
    focusable instanceof HTMLInputElement &&
    focusable.type !== "radio" &&
    focusable.type !== "date"
  ) {
    focusable.select();
  }
}

function resolveFocusableFromHost(host: HTMLElement): HTMLElement | null {
  if (host.matches(FOCUSABLE_SELECTOR)) {
    return host;
  }
  return host.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}

export function focusAttendanceFormField(
  container: HTMLElement | null,
  fieldName: string,
): boolean {
  if (!container) return false;

  const host = container.querySelector<HTMLElement>(
    `[data-attendance-focus="${fieldName}"]`,
  );
  if (host) {
    const focusable = resolveFocusableFromHost(host);
    if (focusable) {
      focusAttendanceControl(focusable);
      return true;
    }
  }

  const named = container.querySelector<HTMLElement>(
    `input[name="${fieldName}"]:not([disabled])`,
  );
  if (named) {
    focusAttendanceControl(named);
    return true;
  }

  return false;
}

/** setValue 등으로 DOM이 갱신된 뒤 포커스를 시도합니다. */
export function scheduleFocusAttendanceFormField(
  container: HTMLElement | null,
  fieldName: string,
  options?: {
    fromTarget?: HTMLElement | null;
    focusNextFromTarget?: (
      form: HTMLElement,
      target: HTMLElement,
    ) => boolean;
  },
): void {
  if (!container) return;

  const attempt = () => {
    if (focusAttendanceFormField(container, fieldName)) return;
    const from = options?.fromTarget;
    if (from && options?.focusNextFromTarget?.(container, from)) return;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(attempt);
  });
}
