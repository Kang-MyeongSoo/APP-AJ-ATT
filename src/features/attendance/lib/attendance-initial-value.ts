import type { AttendanceFormValues } from "@/features/attendance/lib/attendance-form-schema";
import type { EtcFormMstRow } from "@/features/attendance/lib/attendance-etc-form-mst-api";
import type { DepartmentWorkOption } from "@/features/attendance/lib/attendance-mst-code";
import { format } from "date-fns";
import {
  coerceInitialTimeDisplay,
  coerceInitialWorkDate,
  normalizeEtcInputKind,
  parseEtcAttr2Options,
  type EtcInputKind,
} from "@/features/attendance/lib/etc-form-input-kind";

export function createDefaultAttendanceFormValues(
  today: Date = new Date(),
): AttendanceFormValues {
  return {
    companyName: "",
    fullName: "",
    regNumber: "",
    phone: "",
    gender: "",
    workDate: format(today, "yyyy-MM-dd"),
    shift: "",
    startTime: "",
    endTime: "",
    overtimeMinutes: 0,
    dinner: "N",
    department: "",
  };
}

export type CaseWhenClause = {
  fieldCode: string;
  matchValue: string;
  thenValue: string;
};

export type CaseWhenExpression = {
  whens: CaseWhenClause[];
  elseValue: string;
};

const CASE_WHEN_PREFIX_RE = /^\s*case\s+when\s+/i;

/** 100자 제한 대응 짧은 형식: `@07:D=1730;07:N=2130;?=2030` */
const COMPACT_CASE_SEGMENT_RE = /^(\d{1,2}):([^=]+)=(.+)$/;

const CASE_WHEN_WHEN_RE =
  /when\s+c_code\s*=\s*['"](\d{1,2})['"]\s+and\s+c_attr2\s*=\s*['"]([^'"]+)['"]\s+then\s+['"]([^'"]*)['"]/gi;

const CASE_WHEN_ELSE_RE = /else\s+['"]([^'"]*)['"]\s+end\s*$/i;

function normalizeFieldCode(code: string): string {
  const n = Number.parseInt(code.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return code.trim();
  return String(n).padStart(2, "0");
}

export function isCompactCaseWhenInitialValue(c_attr3: string): boolean {
  return c_attr3.trim().startsWith("@");
}

function parseCompactCaseWhenInitialValue(
  c_attr3: string,
): CaseWhenExpression | null {
  const body = c_attr3.trim().slice(1);
  if (!body) return null;

  const whens: CaseWhenClause[] = [];
  let elseValue = "";

  for (const part of body.split(";").map((p) => p.trim()).filter(Boolean)) {
    if (part.startsWith("?=")) {
      elseValue = part.slice(2).trim();
      continue;
    }

    const match = COMPACT_CASE_SEGMENT_RE.exec(part);
    if (!match) return null;
    whens.push({
      fieldCode: normalizeFieldCode(match[1]),
      matchValue: match[2].trim(),
      thenValue: match[3].trim(),
    });
  }

  if (whens.length === 0) return null;
  return { whens, elseValue };
}

export function isCaseWhenInitialValue(c_attr3: string): boolean {
  const trimmed = c_attr3.trim();
  return CASE_WHEN_PREFIX_RE.test(trimmed) || isCompactCaseWhenInitialValue(trimmed);
}

export function parseCaseWhenInitialValue(
  c_attr3: string,
): CaseWhenExpression | null {
  const trimmed = c_attr3.trim();
  if (isCompactCaseWhenInitialValue(trimmed)) {
    return parseCompactCaseWhenInitialValue(trimmed);
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  if (!CASE_WHEN_PREFIX_RE.test(normalized)) return null;

  const whens: CaseWhenClause[] = [];
  let match: RegExpExecArray | null;
  CASE_WHEN_WHEN_RE.lastIndex = 0;
  while ((match = CASE_WHEN_WHEN_RE.exec(normalized)) !== null) {
    whens.push({
      fieldCode: normalizeFieldCode(match[1]),
      matchValue: match[2].trim(),
      thenValue: match[3].trim(),
    });
  }

  const elseMatch = CASE_WHEN_ELSE_RE.exec(normalized);
  if (whens.length === 0) return null;

  return {
    whens,
    elseValue: elseMatch?.[1]?.trim() ?? "",
  };
}

/** `c_attr3` 컬럼(100자) 잘림 등으로 CASE 파싱이 불완전할 때 */
export function getCaseWhenInitialValueIssue(c_attr3: string): string | null {
  const raw = c_attr3.trim();
  if (!isCaseWhenInitialValue(raw)) return null;

  const expr = parseCaseWhenInitialValue(raw);
  if (!expr) {
    return "조건문 초기값 형식이 올바르지 않거나 데이터가 잘렸습니다. c_attr3 길이(100자)를 확인해 주세요.";
  }

  if (
    !isCompactCaseWhenInitialValue(raw) &&
    raw.length >= 100 &&
    !/else\s+['"][^'"]*['"]\s+end\s*$/i.test(raw)
  ) {
    return "조건문이 100자에서 잘린 것 같습니다. c_attr3 컬럼 길이를 늘리거나 짧은 형식(@07:D=1730;07:N=2130;?=2030)을 사용해 주세요.";
  }

  return null;
}

export function evaluateCaseWhenInitialValue(
  expression: CaseWhenExpression,
  fieldValuesByCode: Record<string, string>,
): string {
  for (const when of expression.whens) {
    const current = (fieldValuesByCode[when.fieldCode] ?? "").trim();
    if (
      current === when.matchValue ||
      current.toLowerCase() === when.matchValue.toLowerCase()
    ) {
      return when.thenValue;
    }
  }
  return expression.elseValue;
}

export function buildAttendanceFieldValuesByCode(
  values: AttendanceFormValues,
): Record<string, string> {
  return {
    "01": values.companyName,
    "02": values.fullName,
    "03": values.regNumber,
    "04": values.phone,
    "05": values.gender,
    "06": values.workDate,
    "07": values.shift,
    "08": values.startTime,
    "09": values.endTime,
    "10": String(values.overtimeMinutes),
    "11": values.dinner,
    "12": values.department,
  };
}

export function resolveEtcAttr3Initial(
  c_attr3: string,
  fieldValuesByCode: Record<string, string>,
  options?: { inputKind?: EtcInputKind; excludeFieldCode?: string },
): string {
  const raw = c_attr3.trim();
  if (!raw) return "";

  if (isCaseWhenInitialValue(raw)) {
    const caseExpr = parseCaseWhenInitialValue(raw);
    if (!caseExpr) return "";

    const context = { ...fieldValuesByCode };
    if (options?.excludeFieldCode) {
      delete context[options.excludeFieldCode];
    }

    const resolved = evaluateCaseWhenInitialValue(caseExpr, context);
    const kind = options?.inputKind ?? "text";
    if (kind === "date") return coerceInitialWorkDate(resolved);
    if (kind === "time") return coerceInitialTimeDisplay(resolved);
    return resolved;
  }

  const kind = options?.inputKind ?? "text";
  if (kind === "date") return coerceInitialWorkDate(raw);
  if (kind === "time") return coerceInitialTimeDisplay(raw);
  return raw;
}

export function getCaseWhenDependencyCodes(c_attr3: string): string[] {
  const expr = parseCaseWhenInitialValue(c_attr3);
  if (!expr) return [];
  return [...new Set(expr.whens.map((w) => w.fieldCode))];
}

export const ATTENDANCE_FIELD_CODE_TO_FORM_KEY: Record<
  string,
  keyof AttendanceFormValues
> = {
  "01": "companyName",
  "02": "fullName",
  "03": "regNumber",
  "04": "phone",
  "05": "gender",
  "06": "workDate",
  "07": "shift",
  "08": "startTime",
  "09": "endTime",
  "10": "overtimeMinutes",
  "11": "dinner",
  "12": "department",
};

/** CASE WHEN 조건이 참조하는 폼 필드만 (대상 필드 자체는 제외) */
export function collectCaseWhenDependencyFormNames(
  rows: EtcFormMstRow[],
): Array<keyof AttendanceFormValues> {
  const names = new Set<keyof AttendanceFormValues>();
  for (const row of rows) {
    const init = row.c_attr3?.trim() ?? "";
    if (!isCaseWhenInitialValue(init)) continue;
    for (const code of getCaseWhenDependencyCodes(init)) {
      const key = ATTENDANCE_FIELD_CODE_TO_FORM_KEY[code];
      if (key) names.add(key);
    }
  }
  return [...names];
}

function setFormValueIfChanged(
  getValues: () => AttendanceFormValues,
  setValue: (
    name: keyof AttendanceFormValues,
    value: AttendanceFormValues[keyof AttendanceFormValues],
    options?: { shouldValidate?: boolean },
  ) => void,
  name: keyof AttendanceFormValues,
  value: AttendanceFormValues[keyof AttendanceFormValues],
) {
  const current = getValues()[name];
  if (current === value) return;
  setValue(name, value, { shouldValidate: true });
}

/** CASE WHEN `c_attr3`를 참조하는 필드만 폼 값에 반영 */
export function applyCaseWhenDrivenFormFields(
  rowsByCode: Map<string, EtcFormMstRow>,
  fieldValuesByCode: Record<string, string>,
  getValues: () => AttendanceFormValues,
  setValue: (
    name: keyof AttendanceFormValues,
    value: AttendanceFormValues[keyof AttendanceFormValues],
    options?: { shouldValidate?: boolean },
  ) => void,
) {
  for (const [code, row] of rowsByCode) {
    const init = row.c_attr3?.trim() ?? "";
    if (!isCaseWhenInitialValue(init)) continue;

    const kind = normalizeEtcInputKind(row.c_attr1);
    const resolved = resolveEtcAttr3Initial(init, fieldValuesByCode, {
      inputKind: kind,
      excludeFieldCode: code,
    });

    switch (code) {
      case "01":
        setFormValueIfChanged(getValues, setValue, "companyName", resolved);
        break;
      case "02":
        setFormValueIfChanged(getValues, setValue, "fullName", resolved);
        break;
      case "03":
        setFormValueIfChanged(
          getValues,
          setValue,
          "regNumber",
          resolved.replace(/\D/g, "").slice(0, 13),
        );
        break;
      case "04":
        setFormValueIfChanged(
          getValues,
          setValue,
          "phone",
          resolved.replace(/\D/g, "").slice(0, 11),
        );
        break;
      case "05":
        setFormValueIfChanged(getValues, setValue, "gender", resolved);
        break;
      case "06":
        setFormValueIfChanged(getValues, setValue, "workDate", resolved);
        break;
      case "07":
        setFormValueIfChanged(getValues, setValue, "shift", resolved);
        break;
      case "08":
        setFormValueIfChanged(getValues, setValue, "startTime", resolved);
        break;
      case "09":
        setFormValueIfChanged(getValues, setValue, "endTime", resolved);
        break;
      case "10": {
        const n = Number.parseInt(resolved, 10);
        if (Number.isFinite(n)) {
          setFormValueIfChanged(getValues, setValue, "overtimeMinutes", n);
        }
        break;
      }
      case "11":
        setFormValueIfChanged(
          getValues,
          setValue,
          "dinner",
          resolved.toUpperCase() === "Y" ? "Y" : "N",
        );
        break;
      case "12":
        setFormValueIfChanged(getValues, setValue, "department", resolved);
        break;
      default:
        break;
    }
  }
}

function assignCaseWhenResolvedValue(
  values: AttendanceFormValues,
  code: string,
  resolved: string,
): AttendanceFormValues {
  switch (code) {
    case "01":
      return { ...values, companyName: resolved };
    case "02":
      return { ...values, fullName: resolved };
    case "03":
      return {
        ...values,
        regNumber: resolved.replace(/\D/g, "").slice(0, 13),
      };
    case "04":
      return { ...values, phone: resolved.replace(/\D/g, "").slice(0, 11) };
    case "05":
      return { ...values, gender: resolved };
    case "06":
      return { ...values, workDate: resolved };
    case "07":
      return { ...values, shift: resolved };
    case "08":
      return { ...values, startTime: resolved };
    case "09":
      return { ...values, endTime: resolved };
    case "10": {
      const n = Number.parseInt(resolved, 10);
      return Number.isFinite(n) ? { ...values, overtimeMinutes: n } : values;
    }
    case "11":
      return {
        ...values,
        dinner: resolved.toUpperCase() === "Y" ? "Y" : "N",
      };
    case "12":
      return { ...values, department: resolved };
    default:
      return values;
  }
}

/** CASE WHEN `c_attr3` 초기값을 폼 객체에 반영 */
export function applyCaseWhenDrivenValues(
  values: AttendanceFormValues,
  rowsByCode: Map<string, EtcFormMstRow>,
): AttendanceFormValues {
  let next = { ...values };
  const fieldValuesByCode = buildAttendanceFieldValuesByCode(next);

  for (const [code, row] of rowsByCode) {
    const init = row.c_attr3?.trim() ?? "";
    if (!isCaseWhenInitialValue(init)) continue;

    const kind = normalizeEtcInputKind(row.c_attr1);
    const resolved = resolveEtcAttr3Initial(init, fieldValuesByCode, {
      inputKind: kind,
      excludeFieldCode: code,
    });
    next = assignCaseWhenResolvedValue(next, code, resolved);
    const formKey = ATTENDANCE_FIELD_CODE_TO_FORM_KEY[code];
    if (formKey) {
      fieldValuesByCode[code] = String(next[formKey]);
    }
  }

  return next;
}

function normalizeAttendanceFieldCode(c_code: string): string | null {
  const t = c_code.trim();
  if (!t || t.toLowerCase() === "title") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return String(n).padStart(2, "0");
}

function pickEtcComboInitialValue(row: EtcFormMstRow): string | undefined {
  const opts = parseEtcAttr2Options(row.c_attr2);
  if (opts.length === 0) return undefined;
  const raw = row.c_attr3?.trim() ?? "";
  if (!raw || isCaseWhenInitialValue(raw)) return opts[0]?.value;
  const exact = opts.find((o) => o.value === raw);
  if (exact) return exact.value;
  const ci = opts.find((o) => o.value.toLowerCase() === raw.toLowerCase());
  return ci?.value ?? opts[0]?.value;
}

/**
 * 전송 성공 후 폼 초기화용 값.
 * 마스터 `c_attr3` 등으로 정의된 초기값만 유지하고, 나머지는 비움.
 */
export function buildAttendanceFormResetValues(
  sortedEnabledRows: EtcFormMstRow[],
  departmentOptions: DepartmentWorkOption[],
): AttendanceFormValues {
  let values = createDefaultAttendanceFormValues();
  const byCode = new Map(
    sortedEnabledRows
      .map((r) => {
        const c = normalizeAttendanceFieldCode(r.c_code);
        return c ? ([c, r] as const) : null;
      })
      .filter((e): e is readonly [string, EtcFormMstRow] => e != null),
  );
  const visible = new Set(byCode.keys());
  const fieldValuesByCode = buildAttendanceFieldValuesByCode(values);

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
          values = { ...values, companyName: init };
          fieldValuesByCode["01"] = init;
        }
        break;
      case "02":
        if (init && !isCaseWhenInitialValue(init)) {
          values = { ...values, fullName: init };
          fieldValuesByCode["02"] = init;
        }
        break;
      case "03":
        if (init && !isCaseWhenInitialValue(init)) {
          const v = init.replace(/\D/g, "").slice(0, 13);
          values = { ...values, regNumber: v };
          fieldValuesByCode["03"] = v;
        }
        break;
      case "04":
        if (init && !isCaseWhenInitialValue(init)) {
          const v = init.replace(/\D/g, "").slice(0, 11);
          values = { ...values, phone: v };
          fieldValuesByCode["04"] = v;
        }
        break;
      case "05": {
        const opts = parseEtcAttr2Options(row.c_attr2);
        if (opts.length > 0) {
          const v = pickEtcComboInitialValue(row);
          if (v) {
            values = { ...values, gender: v };
            fieldValuesByCode["05"] = v;
          }
        } else if (init && !isCaseWhenInitialValue(init)) {
          values = { ...values, gender: init };
          fieldValuesByCode["05"] = init;
        }
        break;
      }
      case "06":
        if (init) {
          const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
            inputKind: kind,
          });
          values = { ...values, workDate: v };
          fieldValuesByCode["06"] = v;
        }
        break;
      case "07": {
        const opts = parseEtcAttr2Options(row.c_attr2);
        if (opts.length > 0) {
          const v = pickEtcComboInitialValue(row);
          if (v) {
            values = { ...values, shift: v };
            fieldValuesByCode["07"] = v;
          }
        } else if (init && !isCaseWhenInitialValue(init)) {
          values = { ...values, shift: init };
          fieldValuesByCode["07"] = init;
        }
        break;
      }
      case "08": {
        if (init) {
          const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
            inputKind: kind,
            excludeFieldCode: "08",
          });
          values = { ...values, startTime: v };
          fieldValuesByCode["08"] = v;
        }
        break;
      }
      case "09": {
        if (init) {
          const v = resolveEtcAttr3Initial(init, fieldValuesByCode, {
            inputKind: kind,
            excludeFieldCode: "09",
          });
          values = { ...values, endTime: v };
          fieldValuesByCode["09"] = v;
        }
        break;
      }
      case "10":
        if (kind === "combo") {
          const v = pickEtcComboInitialValue(row);
          if (v) {
            const n = Number.parseInt(v, 10);
            if (Number.isFinite(n)) {
              values = { ...values, overtimeMinutes: n };
            }
          }
        } else if (init) {
          const n = Number.parseInt(init, 10);
          if (Number.isFinite(n)) {
            values = { ...values, overtimeMinutes: n };
          }
        }
        break;
      case "11":
        if (kind === "combo") {
          const v = pickEtcComboInitialValue(row);
          if (v === "Y" || v === "N") {
            values = { ...values, dinner: v };
          }
        } else if (init) {
          values = {
            ...values,
            dinner: init.toUpperCase() === "Y" ? "Y" : "N",
          };
        }
        break;
      case "12":
        if (kind === "combo") {
          const v = pickEtcComboInitialValue(row);
          if (v) values = { ...values, department: v };
        } else if (init) {
          values = { ...values, department: init };
        }
        break;
      default:
        break;
    }
  }

  values = applyCaseWhenDrivenValues(values, byCode);

  if (!visible.has("01")) {
    values = { ...values, companyName: "-" };
  }
  if (!visible.has("02")) {
    values = { ...values, fullName: "-" };
  }
  if (!visible.has("03")) {
    values = { ...values, regNumber: "0000000000000" };
  }
  if (!visible.has("04")) {
    values = { ...values, phone: "01000000000" };
  }
  if (!visible.has("05") && !values.gender.trim()) {
    values = { ...values, gender: "M" };
  }
  if (!visible.has("07") && !values.shift.trim()) {
    values = { ...values, shift: "D" };
  }
  if (!visible.has("10")) {
    values = { ...values, overtimeMinutes: 0 };
  }
  if (!visible.has("11")) {
    values = { ...values, dinner: "N" };
  }
  if (!visible.has("12") && departmentOptions[0]?.c_code) {
    values = { ...values, department: departmentOptions[0].c_code };
  }
  if (!visible.has("08")) {
    values = { ...values, startTime: "" };
  }
  if (!visible.has("09")) {
    values = { ...values, endTime: "" };
  }

  return values;
}
