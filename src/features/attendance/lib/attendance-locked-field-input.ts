import { cn } from "@/lib/utils";

/** 날짜·출퇴근시간 등 자동/잠금 입력란 공통 표시 */
export const LOCKED_FIELD_INPUT_APPEARANCE =
  "pointer-events-none bg-[var(--attendance-form-disabled-cell-color,#e4e4e7)] text-zinc-700";

export function lockedFieldInputClass(baseClass: string): string {
  return cn(baseClass, LOCKED_FIELD_INPUT_APPEARANCE);
}

/** 잠금 입력란 공통 외곽(콤보·라디오·날짜 등 동일 패딩·모서리) */
export const LOCKED_FIELD_SHELL_CLASS =
  "w-full rounded-md border border-zinc-300 px-3";

/** 날짜·텍스트 표시형 잠금 입력란 */
export function lockedFieldDisplayClass(extraClass?: string): string {
  return lockedFieldInputClass(
    cn(LOCKED_FIELD_SHELL_CLASS, "text-sm", extraClass),
  );
}

export function lockedRadioGroupClass(optionCount: number): string {
  return lockedFieldInputClass(
    cn(
      LOCKED_FIELD_SHELL_CLASS,
      "flex items-center bg-white py-2",
      optionCount <= 3 ? "flex-nowrap gap-4" : "flex-wrap gap-6",
    ),
  );
}

/** SelectTrigger는 `disabled` 시 opacity 50%가 적용되므로, 잠금 콤보는 disabled 없이 이 클래스만 사용 */
export function lockedSelectTriggerClass(baseClass: string): string {
  return lockedFieldInputClass(cn(baseClass, "opacity-100"));
}
