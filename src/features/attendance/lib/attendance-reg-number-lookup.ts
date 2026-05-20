import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import type { HrmAttEtcInfo } from "@/features/attendance/lib/attendance-hrm-etc-info-api";
import type { EtcAttr2Option } from "@/features/attendance/hooks/use-etc-attr2-options";

function resolveOptionValue(
  raw: string,
  opts: ReadonlyArray<EtcAttr2Option>,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (opts.length === 0) return trimmed;

  const exact = opts.find((o) => o.value === trimmed);
  if (exact) return exact.value;

  const ci = opts.find((o) => o.value.toLowerCase() === trimmed.toLowerCase());
  if (ci) return ci.value;

  const byLabel = opts.find(
    (o) =>
      o.label === trimmed || o.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return byLabel?.value ?? trimmed;
}

export function applyHrmAttEtcInfoToForm(
  info: HrmAttEtcInfo,
  setValue: (
    name: keyof AttendanceFormValues,
    value: AttendanceFormValues[keyof AttendanceFormValues],
    options?: { shouldValidate?: boolean; shouldDirty?: boolean },
  ) => void,
  options?: {
    companyOpts?: ReadonlyArray<EtcAttr2Option>;
    genderOpts?: ReadonlyArray<EtcAttr2Option>;
  },
): void {
  const company = resolveOptionValue(
    info.att_corp_code,
    options?.companyOpts ?? [],
  );
  const gender = resolveOptionValue(info.gender, options?.genderOpts ?? []);

  if (company) {
    setValue("companyName", company, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  if (info.etc_name) {
    setValue("fullName", info.etc_name, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  if (info.cel_no) {
    setValue("phone", info.cel_no, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  if (gender) {
    setValue("gender", gender, { shouldValidate: true, shouldDirty: true });
  }
}
