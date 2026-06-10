import { fetchClockInDepartmentWork } from "@/features/attendance/lib/attendance-clock-in-dpt-work-api";
import { resolveWorkInOutKind } from "@/features/attendance/lib/etc-form-input-kind";

export type ClockOutLookupFields = {
  terMode: "1" | "2";
  dptWork?: string;
  attDnFlag?: string;
};

export type ClockOutLookupSetValue = (
  name: "workInOut" | "department" | "shift",
  value: string,
  options?: { shouldValidate?: boolean },
) => void;

export function applyClockOutLookupFields(
  lookup: ClockOutLookupFields,
  setValue: ClockOutLookupSetValue,
): void {
  if (lookup.terMode === "1") {
    setValue("workInOut", "1", { shouldValidate: true });
    return;
  }

  setValue("workInOut", "2", { shouldValidate: true });

  const dptWork = lookup.dptWork?.trim();
  if (dptWork) {
    setValue("department", dptWork, { shouldValidate: true });
  }

  const attDnFlag = lookup.attDnFlag?.trim();
  if (attDnFlag) {
    setValue("shift", attDnFlag, { shouldValidate: true });
  }
}

export type ClockOutCheckInValidationResult =
  | { ok: true; lookup?: ClockOutLookupFields }
  | { ok: false; error: string };

export function isClockOutSelection(
  workInOut: string,
  options: Array<{ label: string; value: string }>,
): boolean {
  return resolveWorkInOutKind(workInOut, options) === "out";
}

export function mapDptWorkResult(
  result: Awaited<ReturnType<typeof fetchClockInDepartmentWork>>,
): ClockOutCheckInValidationResult {
  if (result.ok === false) {
    return { ok: false, error: result.error };
  }

  if (result.terMode === "1") {
    return { ok: true, lookup: { terMode: "1" } };
  }

  return {
    ok: true,
    lookup: {
      terMode: "2",
      dptWork: result.dptWork,
      attDnFlag: result.attDnFlag || undefined,
    },
  };
}

export async function ensureClockInExistsForClockOut(params: {
  serverBaseUrl: string;
  regNumber: string;
  workDate: string;
  workInOut: string;
  workInOutOptions: Array<{ label: string; value: string }>;
}): Promise<ClockOutCheckInValidationResult> {
  if (!isClockOutSelection(params.workInOut, params.workInOutOptions)) {
    return { ok: true };
  }

  const dptResult = await fetchClockInDepartmentWork(
    params.serverBaseUrl,
    params.regNumber,
    params.workDate,
  );

  return mapDptWorkResult(dptResult);
}
