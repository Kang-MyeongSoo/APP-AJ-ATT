import type { EtcAttr2Option } from "@/features/attendance/hooks/use-etc-attr2-options";
import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import type { UseFormSetValue } from "react-hook-form";

/**
 * 주민·외국인등록번호 7번째 자리(성별·세기 구분).
 * 1·3·5·7·9 → 남, 0·2·4·6·8 → 여.
 */
export function isMaleFromRegNumberGenderDigit(digit: number): boolean {
  return digit % 2 === 1;
}

export function getRegNumberSeventhDigit(regNumber: string): number | null {
  const digits = regNumber.replace(/\D/g, "").slice(0, 13);
  if (digits.length !== 13) return null;
  const digit = Number.parseInt(digits.charAt(6), 10);
  return Number.isNaN(digit) ? null : digit;
}

function findMaleGenderOption(
  opts: ReadonlyArray<EtcAttr2Option>,
): EtcAttr2Option | undefined {
  const byValue = opts.find((o) => /^m$/i.test(o.value.trim()));
  if (byValue) return byValue;
  return opts.find((o) => /남|муж|male/i.test(o.label));
}

function findFemaleGenderOption(
  opts: ReadonlyArray<EtcAttr2Option>,
): EtcAttr2Option | undefined {
  const byValue = opts.find((o) => /^[wf]$/i.test(o.value.trim()));
  if (byValue) return byValue;
  return opts.find((o) => /여|жен|female/i.test(o.label));
}

export function resolveGenderFromRegNumber(
  regNumber: string,
  genderOpts: ReadonlyArray<EtcAttr2Option>,
): string | null {
  const seventh = getRegNumberSeventhDigit(regNumber);
  if (seventh === null) return null;

  const isMale = isMaleFromRegNumberGenderDigit(seventh);

  if (genderOpts.length > 0) {
    const matched = isMale
      ? findMaleGenderOption(genderOpts)
      : findFemaleGenderOption(genderOpts);
    return matched?.value ?? null;
  }

  return isMale ? "M" : "W";
}

export function applyGenderFromRegNumber(
  regNumber: string,
  setValue: UseFormSetValue<AttendanceFormValues>,
  genderOpts: ReadonlyArray<EtcAttr2Option>,
): boolean {
  const gender = resolveGenderFromRegNumber(regNumber, genderOpts);
  if (!gender) return false;

  setValue("gender", gender, { shouldValidate: true, shouldDirty: true });
  return true;
}
