import { cn } from "@/lib/utils";

/** 날짜·출퇴근시간 등 자동/잠금 입력란 공통 표시 */
export const LOCKED_FIELD_INPUT_APPEARANCE =
  "pointer-events-none bg-[var(--attendance-form-disabled-cell-color,#e4e4e7)] text-zinc-700";

export function lockedFieldInputClass(baseClass: string): string {
  return cn(baseClass, LOCKED_FIELD_INPUT_APPEARANCE);
}
