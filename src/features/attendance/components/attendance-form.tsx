"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyClockOutLookupFields,
  ensureClockInExistsForClockOut,
} from "@/features/attendance/lib/attendance-clock-out-validation";
import { resolveShiftValueFromTimeSettings } from "@/lib/day-night-shift-time-storage";
import { readServerBaseUrl } from "@/lib/server-connection-storage";
import { buildR2ApiErrorDialogContent } from "@/lib/r2-flag-msg-response";
import type { R2FlagMsgDialogContent } from "@/lib/r2-flag-msg-response";
import { cn } from "@/lib/utils";
import { useElectronDevSession } from "@/hooks/use-electron-dev-session";

import {
  fetchDepartmentWorkOptions,
  type DepartmentWorkOption,
} from "../lib/attendance-mst-code";
import {
  attendanceFormSchema,
  type AttendanceFormValues,
} from "../lib/attendance-form-schema";
import { fetchPlusMinusTimeRules } from "../lib/attendance-plus-minus-time-api";
import {
  calculateOvertimeMinutesFromRules,
  snapOvertimeToConfigCode,
} from "../lib/attendance-overtime-calculation";
import {
  defaultAttendanceFormTexts,
  mergeAttendanceFormTexts,
  type AttendanceFormTexts,
} from "../lib/attendance-form-texts";
import {
  fetchEtcFormMstRows,
  type EtcFormMstRow,
} from "../lib/attendance-etc-form-mst-api";
import { RegNumberMaskedInput } from "./reg-number-masked-input";
import { useEtcAttr2Options } from "../hooks/use-etc-attr2-options";
import { useRegNumberLookup } from "../hooks/use-reg-number-lookup";
import { handleAttendanceFormEnterKeyDown } from "../lib/attendance-form-enter-navigation";
import {
  ATTENDANCE_FIELD_CODES_ORDERED,
  normalizeAttendanceFieldCode,
  validateAttendanceDinnerWhenClockOut,
  validateAttendancePhoneWhenVisible,
} from "../lib/attendance-field-codes";
import {
  applyCaseWhenDrivenFormFields,
  buildAttendanceFieldValuesByCode,
  buildAttendanceFormResetValues,
  collectCaseWhenDependencyFormNames,
  createDefaultAttendanceFormValues,
  isCaseWhenInitialValue,
  resolveEtcAttr3Initial,
  resolveEtcComboInitialValue,
} from "../lib/attendance-initial-value";
import {
  applyCurrentWorkDateSync,
  applyWorkInOutTimeSync,
  isNightShift,
  isPeerWorkTimeInputDisabled,
  isWorkTimeFormatHint,
  normalizeEtcInputKind,
  parseEtcAttr2Options,
  isDinnerFieldEnabled,
  resolveWorkInOutKind,
  sanitizeWorkTimeValue,
  subscribeLiveAttendanceClockSync,
} from "../lib/etc-form-input-kind";
import {
  lockedFieldInputClass,
  lockedRadioGroupClass,
} from "../lib/attendance-locked-field-input";
import {
  attendanceFormColorStyle,
  attendanceFormTitleHeaderBgClass,
  DEFAULT_ATTENDANCE_FORM_DISABLED_CELL_COLOR,
  DEFAULT_ATTENDANCE_FORM_TITLE_HEADER_BG,
  mergeAttendanceFormColors,
  type AttendanceFormColors,
} from "@/features/attendance/lib/attendance-form-colors";
import {
  ATTENDANCE_FORM_FONT_SCALE_DEFAULT,
  ATTENDANCE_FORM_FONT_SCALE_MAX,
  ATTENDANCE_FORM_FONT_SCALE_MIN,
  formatAttendanceFormFontScaleLabel,
  useAttendanceFormFontScaleStore,
} from "@/features/attendance/stores/attendance-form-font-scale-store";
import { useAttendanceFormColorsStore } from "@/features/attendance/stores/attendance-form-colors-store";
import { Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { AttendanceFormEtcDynamicRows } from "./attendance-form-etc-dynamic-rows";
import { OvertimeMinutesField } from "./overtime-minutes-field";
import { WorkDateDisplay } from "./work-date-display";

const floatingToolbarButtonClass =
  "pointer-events-auto rounded-full border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100";

const inputClass =
  "h-10 border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400";
const selectContentClass =
  "max-h-56 border-zinc-200 bg-white text-sm text-zinc-900";
const selectTriggerClass = cn(
  "h-10 min-h-10 border-zinc-300 bg-white text-sm text-zinc-900",
);

const tdL =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-middle whitespace-pre-wrap text-sm text-zinc-800";
const tdM =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-top min-w-[13rem]";
const tdR =
  "border-b border-zinc-200 bg-white px-2 py-2 align-middle text-xs leading-snug text-zinc-600 sm:text-sm";
const thL = cn(tdL, attendanceFormTitleHeaderBgClass, "text-zinc-900");
const thM = cn(tdM, attendanceFormTitleHeaderBgClass, "text-zinc-900");
const thR = cn(tdR, attendanceFormTitleHeaderBgClass, "text-zinc-800");
const tdLLast = cn(tdL, "border-b-0");
const tdMLast = cn(tdM, "border-b-0");
const tdRLast = cn(tdR, "border-b-0");

const ru = (t: ReactNode) => <>{t}</>;

function radioGroupClass(optionCount: number): string {
  return cn(
    "flex items-center rounded-md border border-zinc-300 bg-white px-3 py-2",
    optionCount <= 3 ? "flex-nowrap gap-4" : "flex-wrap gap-6",
  );
}

const EMPTY_DEPARTMENT_OPTIONS: DepartmentWorkOption[] = [];
const EMPTY_ETC_FORM_ROWS: EtcFormMstRow[] = [];

function formatTimeWithColon(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidPartialTimeHm(value: string): boolean {
  if (!/^\d{0,2}(:\d{0,2})?$/.test(value)) return false;
  const [hh, mm] = value.split(":");
  if (hh.length === 2 && Number(hh) > 23) return false;
  if (mm == null) return true;
  if (mm.length >= 1 && Number(mm[0]) > 5) return false;
  if (mm.length === 2 && Number(mm) > 59) return false;
  return true;
}

function normalizeMasterMultiline(value: string): string {
  return value.replaceAll("\\n", "\n");
}

type AttendanceFormProps = {
  className?: string;
  formId?: string;
  texts?: Partial<AttendanceFormTexts>;
  textRenderer?: (key: keyof AttendanceFormTexts, value: string) => ReactNode;
  onAttendanceAlert?: (content: R2FlagMsgDialogContent) => void;
  /** 설정 미리보기 등 저장 전 색상을 즉시 반영할 때 사용 */
  colorsOverride?: Partial<AttendanceFormColors>;
};

export type AttendanceFormValidationResult =
  | { ok: true; values: AttendanceFormValues }
  | { ok: false; message: string }
  | { ok: false; dialog: R2FlagMsgDialogContent };

export type AttendanceFormHandle = {
  getValidatedValues: () => Promise<AttendanceFormValidationResult>;
  validateBeforeSend: () => Promise<AttendanceFormValidationResult>;
  resetAfterSuccessfulSubmit: () => void;
};

function firstFormErrorMessage(
  errors: FieldErrors<AttendanceFormValues>,
): string | null {
  for (const err of Object.values(errors)) {
    if (err && typeof err.message === "string" && err.message.length > 0) {
      return err.message;
    }
  }
  return null;
}

export const AttendanceForm = forwardRef<
  AttendanceFormHandle,
  AttendanceFormProps
>(function AttendanceForm(
  {
    className,
    formId = "attendance",
    texts,
    textRenderer,
    onAttendanceAlert,
    colorsOverride,
  },
  ref,
) {
  const attendanceFormRef = useRef<HTMLFormElement>(null);
  const [fontScaleHydrated, setFontScaleHydrated] = useState(false);
  const [colorsHydrated, setColorsHydrated] = useState(false);
  const fontScale = useAttendanceFormFontScaleStore((s) => s.scale);
  const decreaseFontScale = useAttendanceFormFontScaleStore((s) => s.decrease);
  const increaseFontScale = useAttendanceFormFontScaleStore((s) => s.increase);
  const titleHeaderBackgroundColor = useAttendanceFormColorsStore(
    (s) => s.titleHeaderBackgroundColor,
  );
  const disabledCellColor = useAttendanceFormColorsStore(
    (s) => s.disabledCellColor,
  );
  const effectiveFontScale = fontScaleHydrated
    ? fontScale
    : ATTENDANCE_FORM_FONT_SCALE_DEFAULT;
  const storedFormColors = colorsHydrated
    ? { titleHeaderBackgroundColor, disabledCellColor }
    : {
        titleHeaderBackgroundColor: DEFAULT_ATTENDANCE_FORM_TITLE_HEADER_BG,
        disabledCellColor: DEFAULT_ATTENDANCE_FORM_DISABLED_CELL_COLOR,
      };
  const effectiveFormColors = colorsOverride
    ? mergeAttendanceFormColors({ ...storedFormColors, ...colorsOverride })
    : storedFormColors;

  useEffect(() => {
    void useAttendanceFormFontScaleStore.persist.rehydrate();
    void useAttendanceFormColorsStore.persist.rehydrate();
    setFontScaleHydrated(true);
    setColorsHydrated(true);
  }, []);
  const canDecreaseFontScale =
    effectiveFontScale > ATTENDANCE_FORM_FONT_SCALE_MIN;
  const canIncreaseFontScale =
    effectiveFontScale < ATTENDANCE_FORM_FONT_SCALE_MAX;
  const formTexts = mergeAttendanceFormTexts(
    texts ?? defaultAttendanceFormTexts,
  );
  const renderText = (key: keyof AttendanceFormTexts): ReactNode =>
    textRenderer ? textRenderer(key, formTexts[key]) : formTexts[key];

  const queryClient = useQueryClient();
  const [serverBaseUrl, setServerBaseUrl] = useState("");
  useEffect(() => {
    const sync = () => setServerBaseUrl(readServerBaseUrl());
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const deptQuery = useQuery({
    queryKey: ["attendance-mst-code", "ATT_DPT_WORK", serverBaseUrl],
    queryFn: () => fetchDepartmentWorkOptions(serverBaseUrl),
    enabled: serverBaseUrl.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const etcFormQuery = useQuery({
    queryKey: ["attendance-mst-code2", "ATT_ETC_FORM", serverBaseUrl],
    queryFn: () => fetchEtcFormMstRows(serverBaseUrl),
    enabled: serverBaseUrl.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const etcAttr2Fetching = useIsFetching({ queryKey: ["etcAttr2Options"] });

  const masterRefetching =
    etcFormQuery.isFetching || deptQuery.isFetching || etcAttr2Fetching > 0;

  const departmentOptions = useMemo(
    () => deptQuery.data ?? EMPTY_DEPARTMENT_OPTIONS,
    [deptQuery.data],
  );
  const etcFormRows = useMemo(
    () => etcFormQuery.data ?? EMPTY_ETC_FORM_ROWS,
    [etcFormQuery.data],
  );
  const headerRow = useMemo(
    () =>
      etcFormRows.find((row) => row.c_code.trim().toLowerCase() === "title"),
    [etcFormRows],
  );
  const tableHeaderCategory = headerRow?.c_name
    ? normalizeMasterMultiline(headerRow.c_name)
    : renderText("tableHeaderCategory");
  const tableHeaderContent =
    headerRow?.c_attr1 || renderText("tableHeaderContent");
  const tableHeaderNote = headerRow?.c_attr4
    ? normalizeMasterMultiline(headerRow.c_attr4)
    : renderText("tableHeaderNote");
  const sortedEnabledRows = useMemo(
    () =>
      etcFormRows
        .filter(
          (row) =>
            row.c_code.trim().toLowerCase() !== "title" && row.use_flag === "Y",
        )
        .sort((a, b) => {
          const ao = a.c_order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.c_order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.c_code.localeCompare(b.c_code, "ko");
        }),
    [etcFormRows],
  );

  const useServerLayout =
    serverBaseUrl.trim().length > 0 &&
    etcFormQuery.isSuccess &&
    sortedEnabledRows.length > 0;

  const useServerEmptyNotice =
    serverBaseUrl.trim().length > 0 &&
    etcFormQuery.isSuccess &&
    sortedEnabledRows.length === 0;

  const visibleFieldCodes = useMemo((): ReadonlySet<string> | null => {
    if (!useServerLayout) return null;
    return new Set(
      sortedEnabledRows
        .map((r) => normalizeAttendanceFieldCode(r.c_code))
        .filter((c): c is string => c != null),
    );
  }, [useServerLayout, sortedEnabledRows]);

  const staticFirstColumnSpecs: ReadonlyArray<{
    fieldCode: string;
    fallbackKey: keyof AttendanceFormTexts;
  }> = [
    { fieldCode: "01", fallbackKey: "regNumberLabel" },
    { fieldCode: "02", fallbackKey: "companyLabel" },
    { fieldCode: "03", fallbackKey: "nameLabel" },
    { fieldCode: "04", fallbackKey: "phoneLabel" },
    { fieldCode: "05", fallbackKey: "genderLabel" },
    { fieldCode: "06", fallbackKey: "dateLabel" },
    { fieldCode: "07", fallbackKey: "shiftLabel" },
    { fieldCode: "08", fallbackKey: "workInOutLabel" },
    { fieldCode: "09", fallbackKey: "startTimeLabel" },
    { fieldCode: "10", fallbackKey: "endTimeLabel" },
    { fieldCode: "11", fallbackKey: "overtimeLabel" },
    { fieldCode: "12", fallbackKey: "dinnerLabel" },
    { fieldCode: "13", fallbackKey: "departmentLabel" },
  ];

  const getFirstColumnForFieldCode = (
    fieldCode: string,
    fallbackKey: keyof AttendanceFormTexts,
  ): ReactNode => {
    const hit = etcFormRows.find(
      (row) =>
        normalizeAttendanceFieldCode(row.c_code) === fieldCode &&
        row.use_flag === "Y",
    );
    if (hit?.c_name.trim()) return normalizeMasterMultiline(hit.c_name);
    return renderText(fallbackKey);
  };

  const getFirstColumnLabel = (index: number): ReactNode => {
    const spec = staticFirstColumnSpecs[index];
    if (!spec) return null;
    return getFirstColumnForFieldCode(spec.fieldCode, spec.fallbackKey);
  };

  const staticFieldOpts05 = useMemo(() => {
    const row = etcFormRows.find(
      (r) =>
        normalizeAttendanceFieldCode(r.c_code) === "05" && r.use_flag === "Y",
    );
    return row ? parseEtcAttr2Options(row.c_attr2) : [];
  }, [etcFormRows]);

  const staticFieldOpts07 = useMemo(() => {
    const row = etcFormRows.find(
      (r) =>
        normalizeAttendanceFieldCode(r.c_code) === "07" && r.use_flag === "Y",
    );
    return row ? parseEtcAttr2Options(row.c_attr2) : [];
  }, [etcFormRows]);

  const workInOutRow08 = useMemo(
    () =>
      etcFormRows.find(
        (r) =>
          normalizeAttendanceFieldCode(r.c_code) === "08" && r.use_flag === "Y",
      ),
    [etcFormRows],
  );

  const overtimeRow11 = useMemo(
    () =>
      etcFormRows.find(
        (r) =>
          normalizeAttendanceFieldCode(r.c_code) === "11" && r.use_flag === "Y",
      ),
    [etcFormRows],
  );

  const overtimeOptions = useMemo(() => {
    if (!overtimeRow11) return [];
    return parseEtcAttr2Options(overtimeRow11.c_attr2);
  }, [overtimeRow11]);

  const workInOutOptions = useMemo(() => {
    if (!workInOutRow08) return [];
    return parseEtcAttr2Options(workInOutRow08.c_attr2);
  }, [workInOutRow08]);

  const { opts: workInOutOptsFromMaster } = useEtcAttr2Options(
    workInOutRow08?.c_attr2 ?? "",
    serverBaseUrl,
  );

  const workInOutValidationOptions = useMemo(() => {
    if (workInOutOptsFromMaster.length > 0) return workInOutOptsFromMaster;
    return workInOutOptions;
  }, [workInOutOptsFromMaster, workInOutOptions]);

  const staticFieldOpts08 = workInOutValidationOptions;

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(
      attendanceFormSchema,
    ) as Resolver<AttendanceFormValues>,
    defaultValues: createDefaultAttendanceFormValues(),
    mode: "onChange",
  });

  const { control, setValue, getValues, trigger, reset } = form;

  const { onRegNumberKeyDown, hrmManagedFullNameRef } = useRegNumberLookup({
    serverBaseUrl,
    sortedEnabledRows,
    setValue,
    getValues,
    formRef: attendanceFormRef,
  });

  const resetAfterSuccessfulSubmit = useCallback(() => {
    hrmManagedFullNameRef.current = null;
    const nextValues = useServerLayout
      ? buildAttendanceFormResetValues(sortedEnabledRows, departmentOptions)
      : createDefaultAttendanceFormValues();
    nextValues.shift = resolveShiftValueFromTimeSettings(staticFieldOpts07);
    reset(nextValues, { keepDefaultValues: false });
  }, [
    reset,
    useServerLayout,
    sortedEnabledRows,
    departmentOptions,
    staticFieldOpts07,
    hrmManagedFullNameRef,
  ]);

  const validateClockOutCheckIn = useCallback(
    async (
      values: AttendanceFormValues,
    ): Promise<AttendanceFormValidationResult | null> => {
      const base = readServerBaseUrl().trim();
      if (!base) {
        return {
          ok: false,
          message: "설정에서 서버 연결 URL을 먼저 저장해 주세요.",
        };
      }

      const clockOutCheck = await ensureClockInExistsForClockOut({
        serverBaseUrl: base,
        regNumber: values.regNumber,
        workDate: values.workDate,
        workInOut: values.workInOut,
        workInOutOptions: workInOutValidationOptions,
      });

      if (clockOutCheck.ok === false) {
        return {
          ok: false,
          message: clockOutCheck.error,
        };
      }

      if (clockOutCheck.lookup) {
        applyClockOutLookupFields(clockOutCheck.lookup, setValue);
      }

      return null;
    },
    [setValue, workInOutValidationOptions],
  );

  const runClockOutPresenceCheck = useCallback(
    async (workInOutValue: string) => {
      const base = readServerBaseUrl().trim();
      if (!base || !onAttendanceAlert) return;

      const regDigits = getValues("regNumber").replace(/\D/g, "").slice(0, 13);
      if (regDigits.length !== 13) return;

      const clockOutCheck = await ensureClockInExistsForClockOut({
        serverBaseUrl: base,
        regNumber: regDigits,
        workDate: getValues("workDate"),
        workInOut: workInOutValue,
        workInOutOptions: workInOutValidationOptions,
      });

      if (clockOutCheck.ok === false) {
        onAttendanceAlert(
          buildR2ApiErrorDialogContent(clockOutCheck.error),
        );
        return;
      }

      if (clockOutCheck.lookup) {
        applyClockOutLookupFields(clockOutCheck.lookup, setValue);
      }
    },
    [getValues, onAttendanceAlert, setValue, workInOutValidationOptions],
  );

  useImperativeHandle(
    ref,
    () => ({
      getValidatedValues: async () => {
        const valid = await trigger();
        if (!valid) {
          const message =
            firstFormErrorMessage(form.formState.errors) ??
            "양식 입력값을 확인해 주세요.";
          return { ok: false, message };
        }
        const values = getValues();
        const phoneMessage = validateAttendancePhoneWhenVisible(
          values,
          visibleFieldCodes,
        );
        if (phoneMessage) {
          return { ok: false, message: phoneMessage };
        }
        const dinnerMessage = validateAttendanceDinnerWhenClockOut(
          values,
          workInOutValidationOptions,
          visibleFieldCodes,
        );
        if (dinnerMessage) {
          return { ok: false, message: dinnerMessage };
        }
        return { ok: true, values };
      },
      validateBeforeSend: async () => {
        const valid = await trigger();
        if (!valid) {
          const message =
            firstFormErrorMessage(form.formState.errors) ??
            "양식 입력값을 확인해 주세요.";
          return { ok: false, message };
        }
        const values = getValues();
        const phoneMessage = validateAttendancePhoneWhenVisible(
          values,
          visibleFieldCodes,
        );
        if (phoneMessage) {
          return { ok: false, message: phoneMessage };
        }
        const dinnerMessage = validateAttendanceDinnerWhenClockOut(
          values,
          workInOutValidationOptions,
          visibleFieldCodes,
        );
        if (dinnerMessage) {
          return { ok: false, message: dinnerMessage };
        }
        const clockOutIssue = await validateClockOutCheckIn(values);
        if (clockOutIssue) return clockOutIssue;
        return { ok: true, values };
      },
      resetAfterSuccessfulSubmit,
    }),
    [
      form,
      trigger,
      getValues,
      resetAfterSuccessfulSubmit,
      validateClockOutCheckIn,
      visibleFieldCodes,
      workInOutValidationOptions,
    ],
  );

  useEffect(() => {
    if (!departmentOptions.length) return;
    const current = getValues("department").trim();
    if (!current) return;
    const valid = departmentOptions.some((o) => o.c_code === current);
    if (!valid) {
      setValue("department", "", { shouldValidate: true });
    }
  }, [departmentOptions, getValues, setValue]);
  useWatch({ control, name: "workDate" });
  const shift = useWatch({ control, name: "shift" });

  const plusMinusTimeQuery = useQuery({
    queryKey: ["plus-minus-time", serverBaseUrl, shift],
    queryFn: async () => {
      const result = await fetchPlusMinusTimeRules(serverBaseUrl, shift);
      if (result.ok === false) throw new Error(result.error);
      return result.items;
    },
    enabled: serverBaseUrl.trim().length > 0 && shift.trim().length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const handleReloadAttendanceMaster = () => {
    resetAfterSuccessfulSubmit();
    void Promise.all([
      etcFormQuery.refetch(),
      deptQuery.refetch(),
      plusMinusTimeQuery.refetch(),
      queryClient.refetchQueries({ queryKey: ["etcAttr2Options"] }),
    ]);
  };

  const caseWhenDependencyNames = useMemo(
    () => collectCaseWhenDependencyFormNames(sortedEnabledRows),
    [sortedEnabledRows],
  );
  const caseWhenDependencyValues = useWatch({
    control,
    name: caseWhenDependencyNames,
  });
  const watchedWorkInOut = useWatch({ control, name: "workInOut" }) ?? "";
  const watchedStartTime = useWatch({ control, name: "startTime" }) ?? "";
  const watchedEndTime = useWatch({ control, name: "endTime" }) ?? "";
  const watchedDinner = useWatch({ control, name: "dinner" }) ?? "";
  const workInOutKind = useMemo(
    () =>
      resolveWorkInOutKind(
        String(watchedWorkInOut),
        workInOutValidationOptions,
      ),
    [watchedWorkInOut, workInOutValidationOptions],
  );
  const workTimeAutoOnly = workInOutValidationOptions.length > 0;
  const isElectronDevSession = useElectronDevSession();
  const allowDevEndTimeEdit = isElectronDevSession && workInOutKind === "out";
  const startTimeInputDisabled =
    workTimeAutoOnly ||
    isPeerWorkTimeInputDisabled("start", workInOutKind, String(watchedEndTime));
  const endTimeInputDisabled =
    (workTimeAutoOnly && !allowDevEndTimeEdit) ||
    isPeerWorkTimeInputDisabled("end", workInOutKind, String(watchedStartTime));

  const enabledFieldCodes = useMemo(
    () =>
      new Set(
        sortedEnabledRows
          .map((r) => normalizeAttendanceFieldCode(r.c_code))
          .filter((c): c is string => c != null),
      ),
    [sortedEnabledRows],
  );

  const canSetWorkDate = !useServerLayout || enabledFieldCodes.has("06");
  const canSetStartTime = !useServerLayout || enabledFieldCodes.has("09");
  const canSetEndTime = !useServerLayout || enabledFieldCodes.has("10");
  const liveWorkDateEnabled = canSetWorkDate;
  const liveTimeSyncEnabled =
    workTimeAutoOnly && (canSetStartTime || canSetEndTime);

  const syncWorkInOutTime = useCallback(
    (options?: { syncEndTime?: boolean }) => {
      if (workInOutValidationOptions.length === 0 || !workInOutKind) return;
      const syncEndTime = options?.syncEndTime ?? true;
      applyWorkInOutTimeSync({
        workInOutKind,
        setValue,
        canSetStart: canSetStartTime,
        canSetEnd: canSetEndTime && syncEndTime,
      });
    },
    [
      workInOutKind,
      workInOutValidationOptions.length,
      setValue,
      canSetStartTime,
      canSetEndTime,
    ],
  );

  const syncLiveWorkDate = useCallback(() => {
    applyCurrentWorkDateSync({ setValue, canSet: liveWorkDateEnabled });
  }, [liveWorkDateEnabled, setValue]);

  const syncLiveAttendanceFields = useCallback(() => {
    syncLiveWorkDate();
    syncWorkInOutTime({ syncEndTime: true });
  }, [syncLiveWorkDate, syncWorkInOutTime]);

  const syncLiveAttendanceFieldsOnClockTick = useCallback(() => {
    syncLiveWorkDate();
    syncWorkInOutTime({ syncEndTime: true });
  }, [syncLiveWorkDate, syncWorkInOutTime]);

  const handleWorkInOutSelected = useCallback(
    (workInOutValue: string) => {
      const kind = resolveWorkInOutKind(
        workInOutValue,
        workInOutValidationOptions,
      );
      if (kind && workInOutValidationOptions.length > 0) {
        applyWorkInOutTimeSync({
          workInOutKind: kind,
          setValue,
          canSetStart: canSetStartTime,
          canSetEnd: canSetEndTime,
        });
      }
      void runClockOutPresenceCheck(workInOutValue);
    },
    [
      workInOutValidationOptions,
      setValue,
      canSetStartTime,
      canSetEndTime,
      runClockOutPresenceCheck,
    ],
  );

  const isClockOutMode = workInOutKind === "out";
  const isDinnerEnabled = isDinnerFieldEnabled(workInOutKind);

  useEffect(() => {
    if (!liveTimeSyncEnabled || !workInOutKind) return;
    syncWorkInOutTime({ syncEndTime: true });
  }, [liveTimeSyncEnabled, workInOutKind, syncWorkInOutTime]);

  useEffect(() => {
    if (isDinnerEnabled) return;
    if (getValues("dinner") !== "") {
      setValue("dinner", "", { shouldValidate: true });
    }
  }, [isDinnerEnabled, getValues, setValue]);

  useEffect(() => {
    if (!isClockOutMode) {
      if (getValues("overtimeMinutes") !== 0) {
        setValue("overtimeMinutes", 0, { shouldValidate: true });
      }
      return;
    }

    const endTime = String(watchedEndTime).trim();
    if (endTime.length < 5) return;

    const rules = plusMinusTimeQuery.data;
    if (!rules?.length) return;

    const snapped = snapOvertimeToConfigCode(
      calculateOvertimeMinutesFromRules(rules, endTime, String(watchedDinner)),
      overtimeOptions,
    );
    if (getValues("overtimeMinutes") !== snapped) {
      setValue("overtimeMinutes", snapped, { shouldValidate: true });
    }
  }, [
    isClockOutMode,
    watchedEndTime,
    watchedDinner,
    plusMinusTimeQuery.data,
    overtimeOptions,
    getValues,
    setValue,
  ]);

  useEffect(() => {
    if (isWorkTimeFormatHint(String(watchedStartTime))) {
      setValue("startTime", "", { shouldValidate: true });
    }
    if (isWorkTimeFormatHint(String(watchedEndTime))) {
      setValue("endTime", "", { shouldValidate: true });
    }
  }, [watchedStartTime, watchedEndTime, setValue]);

  useEffect(() => {
    if (useServerLayout) return;
    if (!shift.trim()) {
      const initialShift = resolveShiftValueFromTimeSettings(staticFieldOpts07);
      setValue("shift", initialShift, { shouldValidate: true });
      return;
    }
    if (isNightShift(shift)) {
      setValue("startTime", "20:30", { shouldValidate: true });
      setValue("endTime", "05:30", { shouldValidate: true });
      return;
    }

    setValue("startTime", "08:30", { shouldValidate: true });
    setValue("endTime", "17:30", { shouldValidate: true });
  }, [setValue, shift, useServerLayout, staticFieldOpts07]);

  useEffect(() => {
    if (!useServerLayout) return;
    const visible = new Set(
      sortedEnabledRows
        .map((r) => normalizeAttendanceFieldCode(r.c_code))
        .filter((c): c is string => c != null),
    );
    if (!visible.has("01")) {
      setValue("regNumber", "0000000000000", { shouldValidate: true });
    }
    if (!visible.has("02")) {
      setValue("companyName", "-", { shouldValidate: true });
    }
    if (!visible.has("03")) {
      setValue("fullName", "-", { shouldValidate: true });
    }
    if (!visible.has("04")) {
      setValue("phone", "", { shouldValidate: true });
    }
    if (!visible.has("09")) {
      setValue("startTime", "", { shouldValidate: true });
    }
    if (!visible.has("10")) {
      setValue("endTime", "", { shouldValidate: true });
    }
    if (!visible.has("05") && !getValues("gender").trim()) {
      setValue("gender", "M", { shouldValidate: true });
    }
    if (!visible.has("07") && !getValues("shift").trim()) {
      setValue("shift", resolveShiftValueFromTimeSettings(), {
        shouldValidate: true,
      });
    }
    if (!visible.has("11")) {
      setValue("overtimeMinutes", 0, { shouldValidate: true });
    }
    if (!visible.has("12")) {
      setValue("dinner", "N", { shouldValidate: true });
    }
    if (!visible.has("13") && departmentOptions[0]?.c_code) {
      setValue("department", departmentOptions[0].c_code, {
        shouldValidate: true,
      });
    }
  }, [
    useServerLayout,
    sortedEnabledRows,
    setValue,
    departmentOptions,
    getValues,
  ]);

  useLayoutEffect(() => {
    if (!useServerLayout) return;
    const byCode = new Map(
      sortedEnabledRows
        .map((r) => {
          const c = normalizeAttendanceFieldCode(r.c_code);
          return c ? ([c, r] as const) : null;
        })
        .filter((e): e is readonly [string, EtcFormMstRow] => e != null),
    );

    const fieldValuesByCode = buildAttendanceFieldValuesByCode(getValues());

    for (const code of ATTENDANCE_FIELD_CODES_ORDERED) {
      const row = byCode.get(code);
      if (!row) continue;
      const init = row.c_attr3?.trim() ?? "";
      const kind = normalizeEtcInputKind(row.c_attr1);

      switch (code) {
        case "01":
          if (init && !isCaseWhenInitialValue(init)) {
            const v = init.replace(/\D/g, "").slice(0, 13);
            setValue("regNumber", v, { shouldValidate: true });
            fieldValuesByCode["01"] = v;
          }
          break;
        case "02": {
          const opts = parseEtcAttr2Options(row.c_attr2);
          if (kind === "combo" && opts.length > 0) {
            const v = resolveEtcComboInitialValue(row);
            if (v) {
              setValue("companyName", v, { shouldValidate: true });
              fieldValuesByCode["02"] = v;
            }
          } else if (init && !isCaseWhenInitialValue(init)) {
            setValue("companyName", init, { shouldValidate: true });
            fieldValuesByCode["02"] = init;
          }
          break;
        }
        case "03":
          if (
            init &&
            !isCaseWhenInitialValue(init) &&
            !hrmManagedFullNameRef.current
          ) {
            setValue("fullName", init, { shouldValidate: true });
            fieldValuesByCode["03"] = init;
          }
          break;
        case "04":
          if (init && !isCaseWhenInitialValue(init)) {
            const v = init.replace(/\D/g, "").slice(0, 11);
            setValue("phone", v, { shouldValidate: true });
            fieldValuesByCode["04"] = v;
          }
          break;
        case "05": {
          const opts = parseEtcAttr2Options(row.c_attr2);
          if (opts.length > 0) {
            const v = resolveEtcComboInitialValue(row);
            if (v) {
              setValue("gender", v, { shouldValidate: true });
              fieldValuesByCode["05"] = v;
            }
          } else if (init && !isCaseWhenInitialValue(init)) {
            setValue("gender", init, { shouldValidate: true });
            fieldValuesByCode["05"] = init;
          }
          break;
        }
        case "06":
          if (!liveWorkDateEnabled && init) {
            const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
              inputKind: kind,
            });
            setValue("workDate", v, { shouldValidate: true });
            fieldValuesByCode["06"] = v;
          }
          break;
        case "07": {
          const currentShift = getValues("shift").trim();
          const opts = parseEtcAttr2Options(row.c_attr2);
          if (!currentShift) {
            let shiftValue: string | null = null;
            if (opts.length > 0) {
              shiftValue = resolveEtcComboInitialValue(row);
            } else if (init && !isCaseWhenInitialValue(init)) {
              shiftValue = init;
            } else if (init && isCaseWhenInitialValue(init)) {
              shiftValue = resolveEtcAttr3Initial(init, fieldValuesByCode, {
                inputKind: kind,
                excludeFieldCode: "07",
              });
            }
            if (!shiftValue) {
              shiftValue = resolveShiftValueFromTimeSettings(opts);
            }
            setValue("shift", shiftValue, { shouldValidate: true });
            fieldValuesByCode["07"] = shiftValue;
          } else {
            fieldValuesByCode["07"] = currentShift;
          }
          break;
        }
        case "08": {
          const currentWorkInOut = getValues("workInOut").trim();
          if (workTimeAutoOnly && currentWorkInOut) {
            fieldValuesByCode["08"] = currentWorkInOut;
            break;
          }
          const opts = parseEtcAttr2Options(row.c_attr2);
          if (opts.length > 0) {
            const v = resolveEtcComboInitialValue(row);
            if (v) {
              setValue("workInOut", v, { shouldValidate: true });
              fieldValuesByCode["08"] = v;
            }
          } else if (init && !isCaseWhenInitialValue(init)) {
            setValue("workInOut", init, { shouldValidate: true });
            fieldValuesByCode["08"] = init;
          }
          break;
        }
        case "09": {
          if (!workTimeAutoOnly) {
            const v = sanitizeWorkTimeValue(
              resolveEtcAttr3Initial(init, fieldValuesByCode, {
                inputKind: kind,
                excludeFieldCode: "09",
              }),
            );
            setValue("startTime", v, { shouldValidate: true });
            fieldValuesByCode["09"] = v;
          }
          break;
        }
        case "10": {
          if (!workTimeAutoOnly) {
            const v = sanitizeWorkTimeValue(
              resolveEtcAttr3Initial(init, fieldValuesByCode, {
                inputKind: kind,
                excludeFieldCode: "10",
              }),
            );
            setValue("endTime", v, { shouldValidate: true });
            fieldValuesByCode["10"] = v;
          }
          break;
        }
        case "11":
          break;
        case "12":
          if (kind === "combo") {
            const v = resolveEtcComboInitialValue(row);
            if (v === "Y" || v === "N") {
              setValue("dinner", v, { shouldValidate: true });
            }
          } else if (init) {
            setValue("dinner", init.toUpperCase() === "Y" ? "Y" : "N", {
              shouldValidate: true,
            });
          }
          break;
        case "13":
          if (kind === "combo") {
            const v = resolveEtcComboInitialValue(row);
            if (v) setValue("department", v, { shouldValidate: true });
          } else if (init) {
            setValue("department", init, { shouldValidate: true });
          }
          break;
        default:
          break;
      }
    }

    applyCaseWhenDrivenFormFields(
      byCode,
      buildAttendanceFieldValuesByCode(getValues()),
      getValues,
      setValue,
      {
        managedByWorkInOut: workTimeAutoOnly,
        managedLiveDate: liveWorkDateEnabled,
        managedFullName: Boolean(hrmManagedFullNameRef.current),
      },
    );
    syncLiveAttendanceFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 출퇴근 선택 시 layout 재실행으로 주간/야간이 덮이지 않도록 동기화 콜백은 deps 제외
  }, [
    useServerLayout,
    sortedEnabledRows,
    setValue,
    getValues,
    workTimeAutoOnly,
    liveWorkDateEnabled,
    hrmManagedFullNameRef,
  ]);

  useEffect(() => {
    if (!useServerLayout) return;

    const byCode = new Map(
      sortedEnabledRows
        .map((r) => {
          const c = normalizeAttendanceFieldCode(r.c_code);
          return c ? ([c, r] as const) : null;
        })
        .filter((e): e is readonly [string, EtcFormMstRow] => e != null),
    );

    if (caseWhenDependencyNames.length === 0) {
      syncLiveAttendanceFields();
      return;
    }

    applyCaseWhenDrivenFormFields(
      byCode,
      buildAttendanceFieldValuesByCode(getValues()),
      getValues,
      setValue,
      {
        managedByWorkInOut: workTimeAutoOnly,
        managedLiveDate: liveWorkDateEnabled,
        managedFullName: Boolean(hrmManagedFullNameRef.current),
      },
    );
    syncLiveAttendanceFields();
  }, [
    useServerLayout,
    sortedEnabledRows,
    caseWhenDependencyNames,
    caseWhenDependencyValues,
    getValues,
    setValue,
    workTimeAutoOnly,
    liveWorkDateEnabled,
    syncLiveAttendanceFields,
    hrmManagedFullNameRef,
  ]);

  useEffect(() => {
    if (!liveWorkDateEnabled && !liveTimeSyncEnabled) return;
    return subscribeLiveAttendanceClockSync(
      syncLiveAttendanceFieldsOnClockTick,
    );
  }, [
    liveWorkDateEnabled,
    liveTimeSyncEnabled,
    syncLiveAttendanceFieldsOnClockTick,
  ]);

  return (
    <Card
      className={cn(
        "border-zinc-200 bg-white text-base text-zinc-900",
        "flex max-h-[calc(100vh-4.5rem)] min-h-0 flex-col",
        className,
      )}
    >
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {serverBaseUrl.trim().length > 0 && (
          <div className="pointer-events-none fixed right-28 top-4 z-50 flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={floatingToolbarButtonClass}
              onClick={decreaseFontScale}
              disabled={!canDecreaseFontScale}
              aria-label={`글씨 크기 줄이기 (현재 ${formatAttendanceFormFontScaleLabel(effectiveFontScale)})`}
            >
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={floatingToolbarButtonClass}
              onClick={increaseFontScale}
              disabled={!canIncreaseFontScale}
              aria-label={`글씨 크기 키우기 (현재 ${formatAttendanceFormFontScaleLabel(effectiveFontScale)})`}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={floatingToolbarButtonClass}
              onClick={handleReloadAttendanceMaster}
              disabled={masterRefetching}
              aria-label="양식 다시 불러오기"
            >
              {masterRefetching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        )}
        <Form {...form}>
          <form
            ref={attendanceFormRef}
            id={formId}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e) =>
              handleAttendanceFormEnterKeyDown(e, attendanceFormRef.current)
            }
          >
            <div
              className="min-h-0 flex-1 overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch]"
              style={{
                zoom: effectiveFontScale,
                ...attendanceFormColorStyle(effectiveFormColors),
              }}
            >
              <table
                className={cn(
                  "w-full min-w-[26rem] table-fixed border-collapse sm:min-w-[28rem]",
                  "border border-zinc-200 text-sm [word-break:keep-all]",
                )}
              >
                <colgroup>
                  <col className="w-[22%] sm:w-[20%]" />
                  <col className="w-[46%] sm:w-[48%]" />
                  <col className="w-[32%] sm:w-[32%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={thL}>
                      <span className="whitespace-pre-wrap">
                        {tableHeaderCategory}
                      </span>
                    </th>
                    <th scope="col" className={thM}>
                      <span className="whitespace-pre-wrap">
                        {tableHeaderContent}
                      </span>
                    </th>
                    <th scope="col" className={thR}>
                      <span className="whitespace-pre-wrap">
                        {tableHeaderNote}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {useServerLayout ? (
                    <AttendanceFormEtcDynamicRows
                      sortedEnabledRows={sortedEnabledRows}
                      control={control}
                      serverBaseUrl={serverBaseUrl}
                      deptQuery={deptQuery}
                      departmentOptions={departmentOptions}
                      workInOutKind={workInOutKind}
                      workTimeAutoOnly={workTimeAutoOnly}
                      allowDevEndTimeEdit={allowDevEndTimeEdit}
                      onRegNumberKeyDown={onRegNumberKeyDown}
                      onWorkInOutSelected={handleWorkInOutSelected}
                    />
                  ) : useServerEmptyNotice ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="border-b border-zinc-200 bg-white px-3 py-10 text-center text-sm text-zinc-600"
                      >
                        사용구분이 Y인 입력 항목이 없습니다. ATT_ETC_FORM
                        마스터를 확인해 주세요.
                      </td>
                    </tr>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="regNumber"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(0)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  생년월일(외국인등록번호 13자리)
                                </FormLabel>
                                <FormControl>
                                  <RegNumberMaskedInput
                                    ref={field.ref}
                                    name={field.name}
                                    value={String(field.value ?? "")}
                                    onBlur={field.onBlur}
                                    onChange={field.onChange}
                                    className={inputClass}
                                    onKeyDown={(e) =>
                                      onRegNumberKeyDown(
                                        e,
                                        String(field.value ?? ""),
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              외국인등록번호 13자리
                              <br />
                              {ru(
                                "(Основано на регистрационном номере иностранца, 13 цифр)",
                              )}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(1)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  업체명
                                </FormLabel>
                                <FormControl data-attendance-focus="companyName">
                                  <Input
                                    {...field}
                                    className={inputClass}
                                    autoComplete="organization"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>JPOL</td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(2)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">이름</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className={inputClass}
                                    autoComplete="name"
                                    placeholder="외국인등록증 기준"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              외국인등록증 기준
                              <br />
                              {ru(
                                "(Согласно иностранной регистрационной карте)",
                              )}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(3)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  휴대폰
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="tel"
                                    className={inputClass}
                                    autoComplete="tel"
                                    inputMode="numeric"
                                    maxLength={11}
                                    onChange={(e) => {
                                      const v = e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 11);
                                      field.onChange(v);
                                    }}
                                    value={field.value}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              휴대폰번호
                              <br />
                              {ru("(Номер мобильного телефона)")}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(4)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">성별</FormLabel>
                                <FormControl>
                                  {staticFieldOpts05.length > 0 ? (
                                    <div
                                      inert
                                      className="w-full"
                                      data-attendance-skip-focus=""
                                    >
                                      <div
                                        role="radiogroup"
                                        aria-label="성별"
                                        aria-disabled
                                        className={lockedRadioGroupClass(
                                          staticFieldOpts05.length,
                                        )}
                                      >
                                        {staticFieldOpts05.map((opt, idx) => (
                                          <label
                                            key={opt.value}
                                            className="flex cursor-not-allowed items-center gap-2 text-sm text-zinc-900"
                                          >
                                            <input
                                              type="radio"
                                              name={field.name}
                                              value={opt.value}
                                              checked={
                                                String(field.value) === opt.value
                                              }
                                              onBlur={field.onBlur}
                                              ref={
                                                idx === 0 ? field.ref : undefined
                                              }
                                              className="h-4 w-4 accent-zinc-900"
                                            />
                                            {opt.label}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-zinc-500">
                                      ATT_ETC_FORM 05번 항목에 옵션(c_attr2)을
                                      설정하고 사용(Y) 처리하세요.
                                    </p>
                                  )}
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              남/여
                              <br />
                              {ru("(Муж/Жен)")}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="workDate"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(5)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">날짜</FormLabel>
                                <FormControl>
                                  <WorkDateDisplay
                                    value={String(field.value ?? "")}
                                    className={inputClass}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              ****년 **월 **일 (*요일) (* день недели)
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="shift"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(6)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  주간/야간
                                </FormLabel>
                                <FormControl data-attendance-focus="shift">
                                  {staticFieldOpts07.length > 0 ? (
                                    <div
                                      inert
                                      className="w-full"
                                      data-attendance-skip-focus=""
                                    >
                                      <div
                                        role="radiogroup"
                                        aria-label="주간/야간"
                                        aria-disabled
                                        className={lockedRadioGroupClass(
                                          staticFieldOpts07.length,
                                        )}
                                      >
                                        {staticFieldOpts07.map((opt, idx) => (
                                          <label
                                            key={opt.value}
                                            className="flex cursor-not-allowed items-center gap-2 text-sm text-zinc-900"
                                          >
                                            <input
                                              type="radio"
                                              name={field.name}
                                              value={opt.value}
                                              checked={
                                                String(field.value) === opt.value
                                              }
                                              onBlur={field.onBlur}
                                              ref={
                                                idx === 0 ? field.ref : undefined
                                              }
                                              className="h-4 w-4 accent-zinc-900"
                                            />
                                            {opt.label}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-zinc-500">
                                      ATT_ETC_FORM 07번 항목에 옵션(c_attr2)을
                                      설정하고 사용(Y) 처리하세요.
                                    </p>
                                  )}
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>{renderText("shiftLabel")}</td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="workInOut"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(7)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  출근/퇴근
                                </FormLabel>
                                <FormControl>
                                  {staticFieldOpts08.length > 0 ? (
                                    <div
                                      inert
                                      className="w-full"
                                      data-attendance-skip-focus=""
                                    >
                                      <div
                                        role="radiogroup"
                                        aria-label="출근/퇴근"
                                        aria-disabled
                                        className={lockedRadioGroupClass(
                                          staticFieldOpts08.length,
                                        )}
                                      >
                                        {staticFieldOpts08.map((opt, idx) => (
                                          <label
                                            key={opt.value}
                                            className="flex cursor-not-allowed items-center gap-2 text-sm text-zinc-900"
                                          >
                                            <input
                                              type="radio"
                                              name={field.name}
                                              value={opt.value}
                                              checked={
                                                String(field.value) === opt.value
                                              }
                                              onBlur={field.onBlur}
                                              ref={
                                                idx === 0 ? field.ref : undefined
                                              }
                                              className="h-4 w-4 accent-zinc-900"
                                            />
                                            {opt.label}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-zinc-500">
                                      ATT_ETC_FORM 08번 항목에 옵션(c_attr2)을
                                      설정하고 사용(Y) 처리하세요.
                                    </p>
                                  )}
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              {renderText("workInOutLabel")}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(8)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  출근시간
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="text"
                                    className={
                                      startTimeInputDisabled
                                        ? lockedFieldInputClass(inputClass)
                                        : inputClass
                                    }
                                    inputMode="numeric"
                                    maxLength={5}
                                    placeholder=""
                                    readOnly={startTimeInputDisabled}
                                    aria-readonly={startTimeInputDisabled}
                                    value={formatTimeWithColon(
                                      sanitizeWorkTimeValue(
                                        String(field.value ?? ""),
                                      ),
                                    )}
                                    onChange={(e) => {
                                      const next = formatTimeWithColon(
                                        e.target.value,
                                      );
                                      if (isValidPartialTimeHm(next)) {
                                        field.onChange(next);
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              주간 기본 8:30 / 야간 기본 20:30
                              <br />
                              {ru("(Основное дневное 8:30 / Ночное 20:30)")}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(9)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  퇴근시간
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="text"
                                    placeholder=""
                                    value={formatTimeWithColon(
                                      sanitizeWorkTimeValue(
                                        String(field.value ?? ""),
                                      ),
                                    )}
                                    onChange={(e) => {
                                      const next = formatTimeWithColon(
                                        e.target.value,
                                      );
                                      if (isValidPartialTimeHm(next)) {
                                        field.onChange(next);
                                      }
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    className={
                                      endTimeInputDisabled
                                        ? lockedFieldInputClass(inputClass)
                                        : inputClass
                                    }
                                    inputMode="numeric"
                                    maxLength={5}
                                    readOnly={endTimeInputDisabled}
                                    aria-readonly={endTimeInputDisabled}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>&nbsp;</td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="overtimeMinutes"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(10)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  잔업시간
                                </FormLabel>
                                <FormControl>
                                  <OvertimeMinutesField
                                    value={Number(field.value) || 0}
                                    inputClass={inputClass}
                                    options={overtimeOptions}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>
                              30분 단위
                              <br />
                              {ru("(По 30 минут)")}
                            </td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dinner"
                        render={({ field }) => (
                          <tr>
                            <td className={tdL}>{getFirstColumnLabel(11)}</td>
                            <td className={tdM}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  석식여부
                                </FormLabel>
                                <FormControl data-attendance-focus="dinner">
                                  <div
                                    role="radiogroup"
                                    aria-label="석식여부"
                                    aria-disabled={!isDinnerEnabled}
                                    className={cn(
                                      "flex items-center gap-6 rounded-md border border-zinc-300 px-3 py-2",
                                      isDinnerEnabled
                                        ? "bg-white"
                                        : lockedFieldInputClass("bg-white"),
                                    )}
                                  >
                                    <label
                                      className={cn(
                                        "flex items-center gap-2 text-sm text-zinc-900",
                                        isDinnerEnabled
                                          ? "cursor-pointer"
                                          : "cursor-not-allowed",
                                      )}
                                    >
                                      <input
                                        type="radio"
                                        name={field.name}
                                        value="Y"
                                        checked={field.value === "Y"}
                                        disabled={!isDinnerEnabled}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        ref={field.ref}
                                        className="h-4 w-4 accent-zinc-900 disabled:cursor-not-allowed"
                                      />
                                      Y
                                    </label>
                                    <label
                                      className={cn(
                                        "flex items-center gap-2 text-sm text-zinc-900",
                                        isDinnerEnabled
                                          ? "cursor-pointer"
                                          : "cursor-not-allowed",
                                      )}
                                    >
                                      <input
                                        type="radio"
                                        name={field.name}
                                        value="N"
                                        checked={field.value === "N"}
                                        disabled={!isDinnerEnabled}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        className="h-4 w-4 accent-zinc-900 disabled:cursor-not-allowed"
                                      />
                                      N
                                    </label>
                                  </div>
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            </td>
                            <td className={tdR}>Y/N</td>
                          </tr>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <tr>
                            <td className={tdLLast}>
                              {getFirstColumnLabel(12)}
                            </td>
                            <td className={tdMLast}>
                              <FormItem className="space-y-0.5">
                                <FormLabel className="sr-only">
                                  근무부서
                                </FormLabel>
                                <FormControl>
                                  {!serverBaseUrl.trim() ? (
                                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                      설정에서 서버 Base URL(Mobile까지)을
                                      등록해주세요.
                                    </p>
                                  ) : deptQuery.isPending ? (
                                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                                      근무부서 목록 불러오는 중…
                                    </p>
                                  ) : deptQuery.isError ? (
                                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                      {deptQuery.error instanceof Error
                                        ? deptQuery.error.message
                                        : "목록을 불러오지 못했습니다."}
                                    </p>
                                  ) : departmentOptions.length === 0 ? (
                                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                                      등록된 근무부서 코드가 없습니다.
                                    </p>
                                  ) : (
                                    <div
                                      role="radiogroup"
                                      aria-label="근무부서"
                                      className={radioGroupClass(
                                        departmentOptions.length,
                                      )}
                                    >
                                      {departmentOptions.map((opt, idx) => (
                                        <label
                                          key={opt.c_code}
                                          className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900"
                                        >
                                          <input
                                            type="radio"
                                            name={field.name}
                                            value={opt.c_code}
                                            checked={field.value === opt.c_code}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            ref={
                                              idx === 0 ? field.ref : undefined
                                            }
                                            className="h-4 w-4 accent-zinc-900"
                                          />
                                          {opt.c_name}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </FormControl>
                                {!deptQuery.isPending &&
                                  departmentOptions.length > 0 && (
                                    <FormMessage className="text-xs sm:text-sm" />
                                  )}
                              </FormItem>
                            </td>
                            <td className={tdRLast}>
                              생산/물류/기타
                              <br />
                              {ru("(Производство/Логистика/Другое)")}
                            </td>
                          </tr>
                        )}
                      />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
});
