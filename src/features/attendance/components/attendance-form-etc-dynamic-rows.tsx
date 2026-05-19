"use client";

import {
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
import type { EtcFormMstRow } from "@/features/attendance/lib/attendance-etc-form-mst-api";
import {
  OVERTIME_MINUTE_OPTIONS,
  type AttendanceFormValues,
} from "@/features/attendance/lib/attendance-form-schema";
import { useEtcAttr2Options } from "@/features/attendance/hooks/use-etc-attr2-options";
import { getCaseWhenInitialValueIssue } from "@/features/attendance/lib/attendance-initial-value";
import {
  hasWorkTimeInput,
  normalizeEtcInputKind,
} from "@/features/attendance/lib/etc-form-input-kind";
import type { DepartmentWorkOption } from "@/features/attendance/lib/attendance-mst-code";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo } from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldPath,
} from "react-hook-form";
import { useWatch } from "react-hook-form";
import { match } from "ts-pattern";

const inputClass =
  "h-10 border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400";
const selectContentClass =
  "max-h-56 border-zinc-200 bg-white text-sm text-zinc-900";
const selectTriggerClass =
  "h-10 min-h-10 border-zinc-300 bg-white text-sm text-zinc-900";

const tdL =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-top whitespace-pre-wrap text-sm text-zinc-800";
const tdM =
  "border-b border-r border-zinc-200 bg-white px-2 py-2 align-top min-w-0";
const tdR =
  "border-b border-zinc-200 bg-white px-2 py-2 align-top text-xs leading-snug text-zinc-600 sm:text-sm";
const tdLLast = `${tdL} border-b-0`;
const tdMLast = `${tdM} border-b-0`;
const tdRLast = `${tdR} border-b-0`;

const ru = (t: ReactNode) => <>{t}</>;

function normalizeAttendanceFieldCode(c_code: string): string | null {
  const t = c_code.trim();
  if (!t || t.toLowerCase() === "title") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return String(n).padStart(2, "0");
}

function noteFromRow(row: EtcFormMstRow, fallback: ReactNode): ReactNode {
  return row.c_attr4.trim() ? (
    <span className="whitespace-pre-wrap">{row.c_attr4}</span>
  ) : (
    fallback
  );
}

function normalizeMasterMultiline(value: string): string {
  return value.replaceAll("\\n", "\n");
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

type FieldType = ControllerRenderProps<
  AttendanceFormValues,
  FieldPath<AttendanceFormValues>
>;

function EtcFieldMiddle({
  code,
  row,
  field,
  ariaLabel,
  extras,
}: {
  code: string;
  row: EtcFormMstRow;
  field: FieldType;
  ariaLabel: string;
  extras: {
    serverBaseUrl: string;
    deptQuery: UseQueryResult<DepartmentWorkOption[], Error>;
    departmentOptions: DepartmentWorkOption[];
    peerStartTime: string;
    peerEndTime: string;
  };
}) {
  const kind = normalizeEtcInputKind(row.c_attr1);
  const caseWhenIssue = getCaseWhenInitialValueIssue(row.c_attr3 ?? "");
  const isStartField = code === "08";
  const isEndField = code === "09";
  const timeInputDisabled =
    (isStartField && hasWorkTimeInput(extras.peerEndTime)) ||
    (isEndField && hasWorkTimeInput(extras.peerStartTime));
  const { opts, isCidReference, isPending, isError, error } =
    useEtcAttr2Options(row.c_attr2, extras.serverBaseUrl);

  useEffect(() => {
    if (kind !== "combo" && kind !== "radio") return;
    if (opts.length === 0) return;

    const current = String(field.value ?? "");
    if (current && opts.some((o) => o.value === current)) return;

    const init = row.c_attr3?.trim() ?? "";
    if (init) {
      const exact = opts.find((o) => o.value === init);
      if (exact) {
        field.onChange(exact.value);
        return;
      }
      const ci = opts.find(
        (o) => o.value.toLowerCase() === init.toLowerCase(),
      );
      if (ci) {
        field.onChange(ci.value);
        return;
      }
    }

    if (!current && opts[0]) {
      field.onChange(opts[0].value);
    }
  }, [kind, opts, row.c_attr3, field.value, field.onChange]);

  const optionLoadState = (): ReactNode | null => {
    if (!isCidReference) return null;
    if (!extras.serverBaseUrl.trim()) {
      return (
        <span className="text-sm text-amber-800">
          서버 주소를 설정하면 콤보 옵션을 불러올 수 있습니다.
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          옵션 불러오는 중…
        </span>
      );
    }
    if (isError) {
      return (
        <span className="text-sm text-red-700">
          {error instanceof Error
            ? error.message
            : "콤보 옵션을 불러오지 못했습니다."}
        </span>
      );
    }
    return null;
  };

  const radioFromMaster = (pairs: Array<{ label: string; value: string }>) => (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-6 rounded-md border border-zinc-300 bg-white px-3 py-2"
    >
      {pairs.map((opt, idx) => (
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
  );

  const comboFromOpts = (valueAsNumber: boolean) => (
    <Select
      onValueChange={(v) =>
        field.onChange(valueAsNumber ? Number(v) : v)
      }
      value={String(field.value ?? "")}
    >
      <SelectTrigger className={selectTriggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={selectContentClass}>
        {opts.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const dateInput = () => (
    <Input type="date" {...field} className={inputClass} />
  );

  const timeHmInput = () => {
    const value = formatTimeWithColon(String(field.value ?? ""));
    return (
      <Input
        type="text"
        inputMode="numeric"
        maxLength={5}
        className={inputClass}
        placeholder="HH:MM"
        value={value}
        disabled={timeInputDisabled}
        aria-disabled={timeInputDisabled}
        onChange={(e) => {
          const next = formatTimeWithColon(e.target.value);
          if (isValidPartialTimeHm(next)) {
            field.onChange(next);
          }
        }}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
      />
    );
  };

  const timeLooseInput = (placeholder: string) => (
    <Input
      {...field}
      type="text"
      className={inputClass}
      inputMode="numeric"
      maxLength={5}
      placeholder={placeholder}
      disabled={timeInputDisabled}
      aria-disabled={timeInputDisabled}
      onChange={(e) => {
        const next = formatTimeWithColon(e.target.value);
        if (isValidPartialTimeHm(next)) {
          field.onChange(next);
        }
      }}
      value={field.value}
    />
  );

  if (kind === "combo") {
    const loadState = optionLoadState();
    if (loadState) return loadState;
    if (opts.length === 0) {
      return (
        <span className="text-sm text-zinc-500">
          콤보 옵션(c_attr2)이 비어 있습니다.
        </span>
      );
    }
    return comboFromOpts(code === "10");
  }

  if (kind === "radio") {
    const loadState = optionLoadState();
    if (loadState) return loadState;
    if (opts.length === 0) {
      return (
        <span className="text-sm text-zinc-500">
          라디오 옵션(c_attr2)이 비어 있습니다.
        </span>
      );
    }
    return radioFromMaster(opts);
  }

  if (kind === "date") {
    return dateInput();
  }

  if (kind === "time") {
    return (
      <div className="space-y-1">
        {caseWhenIssue ? (
          <p className="text-xs text-amber-800">{caseWhenIssue}</p>
        ) : null}
        {timeInputDisabled ? (
          <p className="text-xs text-zinc-500">
            {isStartField
              ? "퇴근시간이 입력되어 출근시간을 입력할 수 없습니다."
              : "출근시간이 입력되어 퇴근시간을 입력할 수 없습니다."}
          </p>
        ) : null}
        {timeHmInput()}
      </div>
    );
  }

  if (kind === "text") {
    switch (code) {
      case "01":
        return (
          <Input
            {...field}
            className={inputClass}
            autoComplete="organization"
          />
        );
      case "02":
        return (
          <Input
            {...field}
            className={inputClass}
            autoComplete="name"
            placeholder="외국인등록증 기준"
          />
        );
      case "03":
        return (
          <Input
            {...field}
            className={inputClass}
            inputMode="numeric"
            maxLength={13}
            placeholder="13자리"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 13);
              field.onChange(v);
            }}
            value={field.value}
          />
        );
      case "04":
        return (
          <Input
            {...field}
            type="tel"
            className={inputClass}
            autoComplete="tel"
            inputMode="numeric"
            maxLength={11}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 11);
              field.onChange(v);
            }}
            value={field.value}
          />
        );
      case "10":
        return (
          <Input
            className={inputClass}
            inputMode="numeric"
            value={String(field.value ?? "")}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              const n = Number.parseInt(raw, 10);
              field.onChange(Number.isFinite(n) ? n : 0);
            }}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        );
      case "08":
      case "09":
        return timeLooseInput("HH:MM");
      default:
        return <Input {...field} className={inputClass} />;
    }
  }

  switch (code) {
    case "01":
      return (
        <Input
          {...field}
          className={inputClass}
          autoComplete="organization"
        />
      );
    case "02":
      return (
        <Input
          {...field}
          className={inputClass}
          autoComplete="name"
          placeholder="외국인등록증 기준"
        />
      );
    case "03":
      return (
        <Input
          {...field}
          className={inputClass}
          inputMode="numeric"
          maxLength={13}
          placeholder="13자리"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 13);
            field.onChange(v);
          }}
          value={field.value}
        />
      );
    case "04":
      return (
        <Input
          {...field}
          type="tel"
          className={inputClass}
          autoComplete="tel"
          inputMode="numeric"
          maxLength={11}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 11);
            field.onChange(v);
          }}
          value={field.value}
        />
      );
    case "05":
      return radioFromMaster(opts);
    case "06":
      return dateInput();
    case "07":
      return radioFromMaster(opts);
    case "08":
    case "09":
      return timeLooseInput("HH:MM");
    case "10":
      return (
        <Select
          onValueChange={(v) => field.onChange(Number(v))}
          value={String(field.value)}
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {OVERTIME_MINUTE_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {formatOvertimeLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "11":
      return (
        <div
          role="radiogroup"
          aria-label={ariaLabel}
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
      );
    case "12": {
      const { serverBaseUrl, deptQuery, departmentOptions } = extras;
      return (
        <>
          {!serverBaseUrl.trim() ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              설정에서 서버 Base URL(Mobile까지)을 등록해주세요.
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
              aria-label={ariaLabel}
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
        </>
      );
    }
    default:
      return <Input {...field} className={inputClass} />;
  }
}

type Props = {
  sortedEnabledRows: EtcFormMstRow[];
  control: Control<AttendanceFormValues>;
  serverBaseUrl: string;
  deptQuery: UseQueryResult<DepartmentWorkOption[], Error>;
  departmentOptions: DepartmentWorkOption[];
};

export function AttendanceFormEtcDynamicRows({
  sortedEnabledRows,
  control,
  serverBaseUrl,
  deptQuery,
  departmentOptions,
}: Props) {
  const normalizedRows = useMemo(
    () =>
      sortedEnabledRows.map((row) => ({
        ...row,
        c_name: normalizeMasterMultiline(row.c_name),
        c_attr4: normalizeMasterMultiline(row.c_attr4),
      })),
    [sortedEnabledRows],
  );
  const peerStartTime = useWatch({ control, name: "startTime" }) ?? "";
  const peerEndTime = useWatch({ control, name: "endTime" }) ?? "";
  const extras = {
    serverBaseUrl,
    deptQuery,
    departmentOptions,
    peerStartTime: String(peerStartTime),
    peerEndTime: String(peerEndTime),
  };

  return (
    <>
      {normalizedRows.map((row, rowIndex) => {
        const code = normalizeAttendanceFieldCode(row.c_code);
        if (!code) return null;
        const isLast = rowIndex === normalizedRows.length - 1;
        const L = isLast ? tdLLast : tdL;
        const M = isLast ? tdMLast : tdM;
        const R = isLast ? tdRLast : tdR;

        return (
          <Fragment key={`${row.c_code}-${String(rowIndex)}`}>
            {match(code)
              .with("01", () => (
                <FormField
                  control={control}
                  name="companyName"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">업체명</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle
                              code="01"
                              row={row}
                              field={field}
                              ariaLabel="업체명"
                              extras={extras}
                            />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>{noteFromRow(row, "JPOL")}</td>
                    </tr>
                  )}
                />
              ))
              .with("02", () => (
                <FormField
                  control={control}
                  name="fullName"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">이름</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="02" row={row} field={field} ariaLabel="이름" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            외국인등록증 기준
                            <br />
                            {ru("(Согласно иностранной регистрационной карте)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("03", () => (
                <FormField
                  control={control}
                  name="regNumber"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">
                            생년월일(외국인등록번호 13자리)
                          </FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="03" row={row} field={field} ariaLabel="생년월일(등록번호)" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            외국인등록번호 13자리
                            <br />
                            {ru(
                              "(Основано на регистрационном номере иностранца, 13 цифр)",
                            )}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("04", () => (
                <FormField
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">휴대폰</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="04" row={row} field={field} ariaLabel="휴대폰" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            휴대폰번호
                            <br />
                            {ru("(Номер мобильного телефона)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("05", () => (
                <FormField
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">성별</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="05" row={row} field={field} ariaLabel="성별" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            남/여
                            <br />
                            {ru("(Муж/Жен)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("06", () => (
                <FormField
                  control={control}
                  name="workDate"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">날짜</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="06" row={row} field={field} ariaLabel="날짜" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>****년 **월 **일 (*요일) (* день недели)</>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("07", () => (
                <FormField
                  control={control}
                  name="shift"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">주간/야간</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="07" row={row} field={field} ariaLabel="주간/야간" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(row, "주간/야간(Дневное/Ночное)")}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("08", () => (
                <FormField
                  control={control}
                  name="startTime"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">출근시간</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="08" row={row} field={field} ariaLabel="출근시간" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            주간 기본 8:30 / 야간 기본 20:30
                            <br />
                            {ru("(Основное дневное 8:30 / Ночное 20:30)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("09", () => (
                <FormField
                  control={control}
                  name="endTime"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">퇴근시간</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="09" row={row} field={field} ariaLabel="퇴근시간" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>{noteFromRow(row, "\u00a0")}</td>
                    </tr>
                  )}
                />
              ))
              .with("10", () => (
                <FormField
                  control={control}
                  name="overtimeMinutes"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">잔업시간</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="10" row={row} field={field} ariaLabel="잔업시간" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            30분 단위
                            <br />
                            {ru("(По 30 минут)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .with("11", () => (
                <FormField
                  control={control}
                  name="dinner"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">석식여부</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="11" row={row} field={field} ariaLabel="석식여부" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>{noteFromRow(row, "Y/N")}</td>
                    </tr>
                  )}
                />
              ))
              .with("12", () => (
                <FormField
                  control={control}
                  name="department"
                  render={({ field }) => (
                    <tr>
                      <td className={L}>{row.c_name}</td>
                      <td className={M}>
                        <FormItem className="space-y-0.5">
                          <FormLabel className="sr-only">근무부서</FormLabel>
                          <FormControl>
                            <EtcFieldMiddle code="12" row={row} field={field} ariaLabel="근무부서" extras={extras} />
                          </FormControl>
                          <FormMessage className="text-xs sm:text-sm" />
                        </FormItem>
                      </td>
                      <td className={R}>
                        {noteFromRow(
                          row,
                          <>
                            생산/물류/기타
                            <br />
                            {ru("(Производство/Логистика/Другое)")}
                          </>,
                        )}
                      </td>
                    </tr>
                  )}
                />
              ))
              .otherwise(() => null)}
          </Fragment>
        );
      })}
    </>
  );
}
