"use client";

import { Input } from "@/components/ui/input";
import { formatOvertimeLabel } from "@/features/attendance/lib/attendance-overtime-calculation";
import { lockedFieldInputClass } from "@/features/attendance/lib/attendance-locked-field-input";

type OvertimeMinutesFieldProps = {
  value: number;
  inputClass: string;
};

/** 잔업시간 — 자동 계산값만 표시(수동 입력 불가) */
export function OvertimeMinutesField({
  value,
  inputClass,
}: OvertimeMinutesFieldProps) {
  return (
    <Input
      readOnly
      aria-readonly
      tabIndex={-1}
      value={formatOvertimeLabel(Number(value) || 0)}
      className={lockedFieldInputClass(inputClass)}
    />
  );
}
