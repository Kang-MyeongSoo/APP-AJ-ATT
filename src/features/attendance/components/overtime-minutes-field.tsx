"use client";

import { Input } from "@/components/ui/input";
import {
  formatOvertimeLabel,
  type OvertimeConfigOption,
} from "@/features/attendance/lib/attendance-overtime-calculation";
import { lockedFieldInputClass } from "@/features/attendance/lib/attendance-locked-field-input";

type OvertimeMinutesFieldProps = {
  value: number;
  inputClass: string;
  options?: ReadonlyArray<OvertimeConfigOption>;
};

/** 잔업시간 — 자동 계산값만 표시(수동 입력 불가) */
export function OvertimeMinutesField({
  value,
  inputClass,
  options = [],
}: OvertimeMinutesFieldProps) {
  return (
    <Input
      readOnly
      aria-readonly
      tabIndex={-1}
      value={formatOvertimeLabel(Number(value) || 0, options)}
      className={lockedFieldInputClass(inputClass)}
    />
  );
}
