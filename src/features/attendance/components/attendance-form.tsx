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
import { useForm, useWatch, type FieldErrors } from "react-hook-form";

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
import { readServerBaseUrl } from "@/lib/server-connection-storage";
import { cn } from "@/lib/utils";

import {
  fetchDepartmentWorkOptions,
  type DepartmentWorkOption,
} from "../lib/attendance-mst-code";
import {
  attendanceFormSchema,
  OVERTIME_MINUTE_OPTIONS,
  type AttendanceFormValues,
} from "../lib/attendance-form-schema";
import {
  defaultAttendanceFormTexts,
  mergeAttendanceFormTexts,
  type AttendanceFormTexts,
} from "../lib/attendance-form-texts";
import {
  fetchEtcFormMstRows,
  type EtcFormMstRow,
} from "../lib/attendance-etc-form-mst-api";
import { handleAttendanceFormEnterKeyDown } from "../lib/attendance-form-enter-navigation";
import {
  applyCaseWhenDrivenFormFields,
  buildAttendanceFieldValuesByCode,
  buildAttendanceFormResetValues,
  collectCaseWhenDependencyFormNames,
  createDefaultAttendanceFormValues,
  isCaseWhenInitialValue,
  resolveEtcAttr3Initial,
} from "../lib/attendance-initial-value";
import {
  hasWorkTimeInput,
  isNightShift,
  normalizeEtcInputKind,
  parseEtcAttr2Options,
} from "../lib/etc-form-input-kind";
import { Loader2, RefreshCw } from "lucide-react";
import { AttendanceFormEtcDynamicRows } from "./attendance-form-etc-dynamic-rows";

const inputClass =
  "h-10 border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400";
const selectContentClass =
  "max-h-56 border-zinc-200 bg-white text-sm text-zinc-900";
const selectTriggerClass = cn(
  "h-10 min-h-10 border-zinc-300 bg-white text-sm text-zinc-900",
);

const tdL =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-top whitespace-pre-wrap text-sm text-zinc-800";
const tdM =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-top min-w-0";
const tdR =
  "border-b border-zinc-200 bg-white px-2 py-2 align-top text-xs leading-snug text-zinc-600 sm:text-sm";
const thL = cn(tdL, "bg-zinc-100 text-zinc-900");
const thM = cn(tdM, "bg-zinc-100 text-zinc-900");
const thR = cn(tdR, "bg-zinc-100 text-zinc-800");
const tdLLast = cn(tdL, "border-b-0");
const tdMLast = cn(tdM, "border-b-0");
const tdRLast = cn(tdR, "border-b-0");

const ru = (t: ReactNode) => <>{t}</>;

const EMPTY_DEPARTMENT_OPTIONS: DepartmentWorkOption[] = [];
const EMPTY_ETC_FORM_ROWS: EtcFormMstRow[] = [];

/** ATT_ETC_FORM `c_code` → 양식 필드 코드 "01" … "12" */
function normalizeAttendanceFieldCode(c_code: string): string | null {
  const t = c_code.trim();
  if (!t || t.toLowerCase() === "title") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return String(n).padStart(2, "0");
}

function formatOvertimeLabel(minutes: number): string {
  if (minutes === 0) return "없음 (0분)";
  const h = minutes / 60;
  if (h === Math.floor(h)) return `${h}시간`;
  return `${h}시간`;
}

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
};

export type AttendanceFormValidationResult =
  | { ok: true; values: AttendanceFormValues }
  | { ok: false; message: string };

export type AttendanceFormHandle = {
  getValidatedValues: () => Promise<AttendanceFormValidationResult>;
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
  { className, formId = "attendance", texts, textRenderer },
  ref,
) {
  const attendanceFormRef = useRef<HTMLFormElement>(null);
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
    etcFormQuery.isFetching ||
    deptQuery.isFetching ||
    etcAttr2Fetching > 0;

  const handleReloadAttendanceMaster = () => {
    void Promise.all([
      etcFormQuery.refetch(),
      deptQuery.refetch(),
      queryClient.refetchQueries({ queryKey: ["etcAttr2Options"] }),
    ]);
  };

  const departmentOptions = useMemo(
    () => deptQuery.data ?? EMPTY_DEPARTMENT_OPTIONS,
    [deptQuery.data],
  );
  const etcFormRows = useMemo(
    () => etcFormQuery.data ?? EMPTY_ETC_FORM_ROWS,
    [etcFormQuery.data],
  );
  const headerRow = useMemo(
    () => etcFormRows.find((row) => row.c_code.trim().toLowerCase() === "title"),
    [etcFormRows],
  );
  const tableHeaderCategory = headerRow?.c_name
    ? normalizeMasterMultiline(headerRow.c_name)
    : renderText("tableHeaderCategory");
  const tableHeaderContent = headerRow?.c_attr1 || renderText("tableHeaderContent");
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

  const staticFirstColumnSpecs: ReadonlyArray<{
    fieldCode: string;
    fallbackKey: keyof AttendanceFormTexts;
  }> = [
    { fieldCode: "01", fallbackKey: "companyLabel" },
    { fieldCode: "02", fallbackKey: "nameLabel" },
    { fieldCode: "03", fallbackKey: "regNumberLabel" },
    { fieldCode: "04", fallbackKey: "phoneLabel" },
    { fieldCode: "05", fallbackKey: "genderLabel" },
    { fieldCode: "06", fallbackKey: "dateLabel" },
    { fieldCode: "07", fallbackKey: "shiftLabel" },
    { fieldCode: "08", fallbackKey: "startTimeLabel" },
    { fieldCode: "09", fallbackKey: "endTimeLabel" },
    { fieldCode: "10", fallbackKey: "overtimeLabel" },
    { fieldCode: "11", fallbackKey: "dinnerLabel" },
    { fieldCode: "12", fallbackKey: "departmentLabel" },
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
        normalizeAttendanceFieldCode(r.c_code) === "05" &&
        r.use_flag === "Y",
    );
    return row ? parseEtcAttr2Options(row.c_attr2) : [];
  }, [etcFormRows]);

  const staticFieldOpts07 = useMemo(() => {
    const row = etcFormRows.find(
      (r) =>
        normalizeAttendanceFieldCode(r.c_code) === "07" &&
        r.use_flag === "Y",
    );
    return row ? parseEtcAttr2Options(row.c_attr2) : [];
  }, [etcFormRows]);

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: createDefaultAttendanceFormValues(),
    mode: "onChange",
  });

  const { control, setValue, getValues, trigger, reset } = form;

  const resetAfterSuccessfulSubmit = useCallback(() => {
    const nextValues = useServerLayout
      ? buildAttendanceFormResetValues(
          sortedEnabledRows,
          departmentOptions,
        )
      : createDefaultAttendanceFormValues();
    reset(nextValues, { keepDefaultValues: false });
  }, [reset, useServerLayout, sortedEnabledRows, departmentOptions]);

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
        return { ok: true, values: getValues() };
      },
      resetAfterSuccessfulSubmit,
    }),
    [form, trigger, getValues, resetAfterSuccessfulSubmit],
  );

  useEffect(() => {
    if (!departmentOptions.length) return;
    const current = getValues("department");
    const valid = departmentOptions.some((o) => o.c_code === current);
    if (!current || !valid) {
      setValue("department", departmentOptions[0].c_code, {
        shouldValidate: true,
      });
    }
  }, [departmentOptions, getValues, setValue]);
  useWatch({ control, name: "workDate" });
  const shift = useWatch({ control, name: "shift" });

  const caseWhenDependencyNames = useMemo(
    () => collectCaseWhenDependencyFormNames(sortedEnabledRows),
    [sortedEnabledRows],
  );
  const caseWhenDependencyValues = useWatch({
    control,
    name: caseWhenDependencyNames,
  });
  const watchedStartTime = useWatch({ control, name: "startTime" }) ?? "";
  const watchedEndTime = useWatch({ control, name: "endTime" }) ?? "";
  const startTimeInputDisabled = hasWorkTimeInput(String(watchedEndTime));
  const endTimeInputDisabled = hasWorkTimeInput(String(watchedStartTime));

  useEffect(() => {
    if (useServerLayout) return;
    if (!shift.trim()) return;
    if (isNightShift(shift)) {
      setValue("startTime", "20:30", { shouldValidate: true });
      setValue("endTime", "05:30", { shouldValidate: true });
      return;
    }

    setValue("startTime", "08:30", { shouldValidate: true });
    setValue("endTime", "17:30", { shouldValidate: true });
  }, [setValue, shift, useServerLayout]);

  useEffect(() => {
    if (!useServerLayout) return;
    const visible = new Set(
      sortedEnabledRows
        .map((r) => normalizeAttendanceFieldCode(r.c_code))
        .filter((c): c is string => c != null),
    );
    if (!visible.has("01")) {
      setValue("companyName", "-", { shouldValidate: true });
    }
    if (!visible.has("02")) {
      setValue("fullName", "-", { shouldValidate: true });
    }
    if (!visible.has("03")) {
      setValue("regNumber", "0000000000000", { shouldValidate: true });
    }
    if (!visible.has("04")) {
      setValue("phone", "01000000000", { shouldValidate: true });
    }
    if (!visible.has("08")) {
      setValue("startTime", "", { shouldValidate: true });
    }
    if (!visible.has("09")) {
      setValue("endTime", "", { shouldValidate: true });
    }
    if (!visible.has("05") && !getValues("gender").trim()) {
      setValue("gender", "M", { shouldValidate: true });
    }
    if (!visible.has("07") && !getValues("shift").trim()) {
      setValue("shift", "D", { shouldValidate: true });
    }
    if (!visible.has("10")) {
      setValue("overtimeMinutes", 0, { shouldValidate: true });
    }
    if (!visible.has("11")) {
      setValue("dinner", "N", { shouldValidate: true });
    }
    if (!visible.has("12") && departmentOptions[0]?.c_code) {
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

    const pickComboString = (row: EtcFormMstRow): string | undefined => {
      const opts = parseEtcAttr2Options(row.c_attr2);
      if (opts.length === 0) return undefined;
      const raw = row.c_attr3?.trim() ?? "";
      if (!raw || isCaseWhenInitialValue(raw)) return opts[0]?.value;
      const exact = opts.find((o) => o.value === raw);
      if (exact) return exact.value;
      const ci = opts.find(
        (o) => o.value.toLowerCase() === raw.toLowerCase(),
      );
      return ci?.value ?? opts[0]?.value;
    };

    const fieldValuesByCode = buildAttendanceFieldValuesByCode(getValues());

    const ordered = [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ] as const;
    for (const code of ordered) {
      const row = byCode.get(code);
      if (!row) continue;
      const init = row.c_attr3?.trim() ?? "";
      const kind = normalizeEtcInputKind(row.c_attr1);

      switch (code) {
        case "01":
          if (init && !isCaseWhenInitialValue(init)) {
            setValue("companyName", init, { shouldValidate: true });
            fieldValuesByCode["01"] = init;
          }
          break;
        case "02":
          if (init && !isCaseWhenInitialValue(init)) {
            setValue("fullName", init, { shouldValidate: true });
            fieldValuesByCode["02"] = init;
          }
          break;
        case "03":
          if (init && !isCaseWhenInitialValue(init)) {
            const v = init.replace(/\D/g, "").slice(0, 13);
            setValue("regNumber", v, { shouldValidate: true });
            fieldValuesByCode["03"] = v;
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
            const v = pickComboString(row);
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
          if (init) {
            const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
              inputKind: kind,
            });
            setValue("workDate", v, { shouldValidate: true });
            fieldValuesByCode["06"] = v;
          }
          break;
        case "07": {
          const opts = parseEtcAttr2Options(row.c_attr2);
          if (opts.length > 0) {
            const v = pickComboString(row);
            if (v) {
              setValue("shift", v, { shouldValidate: true });
              fieldValuesByCode["07"] = v;
            }
          } else if (init && !isCaseWhenInitialValue(init)) {
            setValue("shift", init, { shouldValidate: true });
            fieldValuesByCode["07"] = init;
          }
          break;
        }
        case "08": {
          const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
            inputKind: kind,
            excludeFieldCode: "08",
          });
          setValue("startTime", v, { shouldValidate: true });
          fieldValuesByCode["08"] = v;
          break;
        }
        case "09": {
          const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
            inputKind: kind,
            excludeFieldCode: "09",
          });
          setValue("endTime", v, { shouldValidate: true });
          fieldValuesByCode["09"] = v;
          break;
        }
        case "10":
          if (kind === "combo") {
            const v = pickComboString(row);
            if (v) {
              const n = Number.parseInt(v, 10);
              if (Number.isFinite(n)) {
                setValue("overtimeMinutes", n, { shouldValidate: true });
              }
            }
          } else if (init) {
            const n = Number.parseInt(init, 10);
            if (Number.isFinite(n)) {
              setValue("overtimeMinutes", n, { shouldValidate: true });
            }
          }
          break;
        case "11":
          if (kind === "combo") {
            const v = pickComboString(row);
            if (v === "Y" || v === "N") {
              setValue("dinner", v, { shouldValidate: true });
            }
          } else if (init) {
            setValue("dinner", init.toUpperCase() === "Y" ? "Y" : "N", {
              shouldValidate: true,
            });
          }
          break;
        case "12":
          if (kind === "combo") {
            const v = pickComboString(row);
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
    );
  }, [useServerLayout, sortedEnabledRows, setValue, getValues]);

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

    if (caseWhenDependencyNames.length === 0) return;

    applyCaseWhenDrivenFormFields(
      byCode,
      buildAttendanceFieldValuesByCode(getValues()),
      getValues,
      setValue,
    );
  }, [
    useServerLayout,
    sortedEnabledRows,
    caseWhenDependencyNames,
    caseWhenDependencyValues,
    getValues,
    setValue,
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
          <div className="pointer-events-none fixed right-28 top-4 z-50">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="pointer-events-auto rounded-full border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
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
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch]">
              <table
                className={cn(
                  "w-full min-w-[20rem] table-fixed border-collapse sm:min-w-0",
                  "border border-zinc-200 text-sm [word-break:keep-all]",
                )}
              >
                <colgroup>
                  <col className="w-[29%] sm:w-[27%]" />
                  <col className="w-[31%] sm:w-[33%]" />
                  <col className="w-[40%]" />
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
                    name="companyName"
                    render={({ field }) => (
                      <tr>
                        <td className={tdL}>
                          {getFirstColumnLabel(0)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">업체명</FormLabel>
                            <FormControl>
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
                        <td className={tdL}>
                          {getFirstColumnLabel(1)}
                        </td>
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
                          {ru("(Согласно иностранной регистрационной карте)")}
                        </td>
                      </tr>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="regNumber"
                    render={({ field }) => (
                      <tr>
                        <td className={tdL}>
                          {getFirstColumnLabel(2)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">
                              생년월일(외국인등록번호 13자리)
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className={inputClass}
                                inputMode="numeric"
                                maxLength={13}
                                placeholder="13자리"
                                onChange={(e) => {
                                  const v = e.target.value
                                    .replace(/\D/g, "")
                                    .slice(0, 13);
                                  field.onChange(v);
                                }}
                                value={field.value}
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
                    name="phone"
                    render={({ field }) => (
                      <tr>
                        <td className={tdL}>
                          {getFirstColumnLabel(3)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">휴대폰</FormLabel>
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
                        <td className={tdL}>
                          {getFirstColumnLabel(4)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">성별</FormLabel>
                            <FormControl>
                              {staticFieldOpts05.length > 0 ? (
                                <div
                                  role="radiogroup"
                                  aria-label="성별"
                                  className="flex flex-wrap items-center gap-6 rounded-md border border-zinc-300 bg-white px-3 py-2"
                                >
                                  {staticFieldOpts05.map((opt, idx) => (
                                    <label
                                      key={opt.value}
                                      className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900"
                                    >
                                      <input
                                        type="radio"
                                        name={field.name}
                                        value={opt.value}
                                        checked={String(field.value) === opt.value}
                                        onChange={() => field.onChange(opt.value)}
                                        onBlur={field.onBlur}
                                        ref={idx === 0 ? field.ref : undefined}
                                        className="h-4 w-4 accent-zinc-900"
                                      />
                                      {opt.label}
                                    </label>
                                  ))}
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
                        <td className={tdL}>
                          {getFirstColumnLabel(5)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">날짜</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
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
                        <td className={tdL}>
                          {getFirstColumnLabel(6)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">주간/야간</FormLabel>
                            <FormControl>
                              {staticFieldOpts07.length > 0 ? (
                                <div
                                  role="radiogroup"
                                  aria-label="주간/야간"
                                  className="flex flex-wrap items-center gap-6 rounded-md border border-zinc-300 bg-white px-3 py-2"
                                >
                                  {staticFieldOpts07.map((opt, idx) => (
                                    <label
                                      key={opt.value}
                                      className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900"
                                    >
                                      <input
                                        type="radio"
                                        name={field.name}
                                        value={opt.value}
                                        checked={String(field.value) === opt.value}
                                        onChange={() => field.onChange(opt.value)}
                                        onBlur={field.onBlur}
                                        ref={idx === 0 ? field.ref : undefined}
                                        className="h-4 w-4 accent-zinc-900"
                                      />
                                      {opt.label}
                                    </label>
                                  ))}
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
                    name="startTime"
                    render={({ field }) => (
                      <tr>
                        <td className={tdL}>
                          {getFirstColumnLabel(7)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">출근시간</FormLabel>
                            <FormControl>
                              <div className="space-y-1">
                                {startTimeInputDisabled ? (
                                  <p className="text-xs text-zinc-500">
                                    퇴근시간이 입력되어 출근시간을 수정할 수
                                    없습니다.
                                  </p>
                                ) : null}
                                <Input
                                  {...field}
                                  type="text"
                                  className={inputClass}
                                  inputMode="numeric"
                                  maxLength={5}
                                  placeholder="HH:MM"
                                  disabled={startTimeInputDisabled}
                                  onChange={(e) => {
                                    const next = formatTimeWithColon(
                                      e.target.value,
                                    );
                                    if (isValidPartialTimeHm(next)) {
                                      field.onChange(next);
                                    }
                                  }}
                                  value={field.value}
                                />
                              </div>
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
                        <td className={tdL}>
                          {getFirstColumnLabel(8)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">퇴근시간</FormLabel>
                            <FormControl>
                              <div className="space-y-1">
                                {endTimeInputDisabled ? (
                                  <p className="text-xs text-zinc-500">
                                    출근시간이 입력되어 퇴근시간을 수정할 수
                                    없습니다.
                                  </p>
                                ) : null}
                                <Input
                                  type="text"
                                  value={field.value}
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
                                  className={inputClass}
                                  inputMode="numeric"
                                  maxLength={5}
                                  placeholder="HH:MM"
                                  disabled={endTimeInputDisabled}
                                />
                              </div>
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
                        <td className={tdL}>
                          {getFirstColumnLabel(9)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">잔업시간</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={String(field.value)}
                            >
                              <FormControl>
                                <SelectTrigger className={selectTriggerClass}>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className={selectContentClass}>
                                {OVERTIME_MINUTE_OPTIONS.map((m) => (
                                  <SelectItem key={m} value={String(m)}>
                                    {formatOvertimeLabel(m)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                        <td className={tdL}>
                          {getFirstColumnLabel(10)}
                        </td>
                        <td className={tdM}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">석식여부</FormLabel>
                            <FormControl>
                              <div
                                role="radiogroup"
                                aria-label="석식여부"
                                className="flex items-center gap-6 rounded-md border border-zinc-300 bg-white px-3 py-2"
                              >
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900">
                                  <input
                                    type="radio"
                                    name={field.name}
                                    value="Y"
                                    checked={field.value === "Y"}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    className="h-4 w-4 accent-zinc-900"
                                  />
                                  Y
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900">
                                  <input
                                    type="radio"
                                    name={field.name}
                                    value="N"
                                    checked={field.value === "N"}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    className="h-4 w-4 accent-zinc-900"
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
                          {getFirstColumnLabel(11)}
                        </td>
                        <td className={tdMLast}>
                          <FormItem className="space-y-0.5">
                            <FormLabel className="sr-only">근무부서</FormLabel>
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
                                  className="flex flex-wrap items-center gap-6 rounded-md border border-zinc-300 bg-white px-3 py-2"
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
                                        ref={idx === 0 ? field.ref : undefined}
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
