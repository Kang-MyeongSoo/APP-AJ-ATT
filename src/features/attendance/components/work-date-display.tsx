"use client";

import { lockedFieldDisplayClass } from "@/features/attendance/lib/attendance-locked-field-input";
import { formatWorkDateDisplay } from "@/features/attendance/lib/etc-form-input-kind";
import { cn } from "@/lib/utils";

type WorkDateDisplayProps = {
  value: string;
  className: string;
  ariaLabel?: string;
};

/** 근무일자 표시 전용(요일 포함). 폼/API 저장값은 `yyyy-MM-dd` 유지 */
export function WorkDateDisplay({
  value,
  className,
  ariaLabel = "날짜",
}: WorkDateDisplayProps) {
  return (
    <div inert className="w-full" data-attendance-skip-focus="">
      <div
        role="textbox"
        aria-readonly
        aria-label={ariaLabel}
        tabIndex={-1}
        className={lockedFieldDisplayClass(
          cn(className, "flex h-10 items-center whitespace-nowrap"),
        )}
      >
        {formatWorkDateDisplay(value)}
      </div>
    </div>
  );
}
