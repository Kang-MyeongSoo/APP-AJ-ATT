"use client";

import type { EtcFormMstRow } from "@/features/attendance/lib/attendance-etc-form-mst-api";
import { scheduleFocusAttendanceFormField } from "@/features/attendance/lib/attendance-form-focus";
import {
  focusNextAttendanceField,
  shouldHandleAttendanceEnterNavigation,
} from "@/features/attendance/lib/attendance-form-enter-navigation";
import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import { fetchClockInDepartmentWork } from "@/features/attendance/lib/attendance-clock-in-dpt-work-api";
import {
  applyClockOutLookupFields,
  mapDptWorkResult,
} from "@/features/attendance/lib/attendance-clock-out-validation";
import { fetchHrmAttEtcInfo } from "@/features/attendance/lib/attendance-hrm-etc-info-api";
import { normalizeAttendanceFieldCode } from "@/features/attendance/lib/attendance-field-codes";
import { applyGenderFromRegNumber } from "@/features/attendance/lib/attendance-reg-number-gender";
import { applyHrmAttEtcInfoToForm } from "@/features/attendance/lib/attendance-reg-number-lookup";
import { parseEtcAttr2Options } from "@/features/attendance/lib/etc-form-input-kind";
import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useRef } from "react";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";

type RegNumberLookupResult = {
  hrmFound: boolean;
  hasAttendanceData: boolean;
};

function resolveFocusAfterRegNumberLookup(result: RegNumberLookupResult): string {
  if (result.hasAttendanceData) return "dinner";
  if (result.hrmFound) return "shift";
  return "companyName";
}

function getStaticAttr2Options(
  rows: EtcFormMstRow[],
  fieldCode: string,
): ReturnType<typeof parseEtcAttr2Options> {
  const row = rows.find(
    (r) => normalizeAttendanceFieldCode(r.c_code) === fieldCode,
  );
  if (!row) return [];
  return parseEtcAttr2Options(row.c_attr2);
}

type Params = {
  serverBaseUrl: string;
  sortedEnabledRows: EtcFormMstRow[];
  setValue: UseFormSetValue<AttendanceFormValues>;
  getValues: UseFormGetValues<AttendanceFormValues>;
  formRef: RefObject<HTMLFormElement | null>;
};

export function useRegNumberLookup({
  serverBaseUrl,
  sortedEnabledRows,
  setValue,
  getValues,
  formRef,
}: Params) {
  const lookupInFlightRef = useRef(false);
  const pendingFocusAfterLookupRef = useRef(false);

  const lookupAndApply = useCallback(
    async (regNumber: string): Promise<RegNumberLookupResult> => {
      const idno = regNumber.replace(/\D/g, "").slice(0, 13);
      if (idno.length !== 13) {
        return { hrmFound: false, hasAttendanceData: false };
      }

      const trimmedBase = serverBaseUrl.trim();
      if (!trimmedBase) {
        return { hrmFound: false, hasAttendanceData: false };
      }

      const info = await fetchHrmAttEtcInfo(trimmedBase, idno);
      let hrmFound = false;
      if (info) {
        applyHrmAttEtcInfoToForm(info, setValue, {
          companyOpts: getStaticAttr2Options(sortedEnabledRows, "02"),
          genderOpts: getStaticAttr2Options(sortedEnabledRows, "05"),
        });
        hrmFound = true;
      }

      let hasAttendanceData = false;
      const dptResult = await fetchClockInDepartmentWork(
        trimmedBase,
        idno,
        getValues("workDate"),
      );
      if (dptResult.ok) {
        hasAttendanceData = dptResult.responseFlag === "0";
        const mapped = mapDptWorkResult(dptResult);
        if (mapped.ok && mapped.lookup) {
          applyClockOutLookupFields(mapped.lookup, setValue);
        }
      }

      return { hrmFound, hasAttendanceData };
    },
    [getValues, serverBaseUrl, setValue, sortedEnabledRows],
  );

  const onRegNumberKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, regNumber: string) => {
      if (event.key !== "Enter" && event.key !== "Tab") return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      if (event.nativeEvent.isComposing) return;
      if (!shouldHandleAttendanceEnterNavigation(event.target)) return;

      const idno = regNumber.replace(/\D/g, "").slice(0, 13);
      if (idno.length !== 13) return;

      event.preventDefault();
      event.stopPropagation();

      applyGenderFromRegNumber(
        regNumber,
        setValue,
        getStaticAttr2Options(sortedEnabledRows, "05"),
      );

      const focusTarget = event.target instanceof HTMLElement ? event.target : null;

      const moveFocusAfterLookup = (result: RegNumberLookupResult) => {
        const formEl = formRef.current;
        if (!formEl) return;

        scheduleFocusAttendanceFormField(
          formEl,
          resolveFocusAfterRegNumberLookup(result),
          {
            fromTarget: focusTarget,
            focusNextFromTarget: focusNextAttendanceField,
          },
        );
      };

      if (lookupInFlightRef.current) {
        pendingFocusAfterLookupRef.current = true;
        return;
      }
      lookupInFlightRef.current = true;

      void (async () => {
        let result: RegNumberLookupResult = {
          hrmFound: false,
          hasAttendanceData: false,
        };
        try {
          result = await lookupAndApply(regNumber);
          moveFocusAfterLookup(result);
        } catch {
          moveFocusAfterLookup(result);
        } finally {
          lookupInFlightRef.current = false;
          if (pendingFocusAfterLookupRef.current) {
            pendingFocusAfterLookupRef.current = false;
            moveFocusAfterLookup(result);
          }
        }
      })();
    },
    [formRef, lookupAndApply, setValue, sortedEnabledRows],
  );

  return { onRegNumberKeyDown };
}
