export type R2FlagMsgDialogTone = "success" | "error";

export type R2FlagMsgDialogContent = {
  title: string;
  message: string;
  tone: R2FlagMsgDialogTone;
};

/** 오류 팝업 등에 서버/프록시 응답 원문을 사람이 복사할 수 있게 표시 */
export function formatApiResponseForDisplay(
  value: unknown,
  maxChars = 3000,
): string {
  try {
    if (value === undefined) {
      return "(응답 본문 data가 없습니다)";
    }
    if (typeof value === "bigint") {
      return String(value);
    }
    const text = JSON.stringify(value, null, 2);
    if (text.length <= maxChars) {
      return text;
    }
    return `${text.slice(0, maxChars)}…\n\n(전체 ${text.length}자 중 앞부분만 표시)`;
  } catch {
    return String(value);
  }
}

function unwrapFlagRecord(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return unwrapFlagRecord(raw[0]);
  }

  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if ("Flag" in record || "MSG" in record || "flag" in record || "msg" in record) {
    return record;
  }

  const nestedCandidates = [
    record.data,
    record.result,
    record.Data,
    record.Result,
    record.d,
  ];
  for (const candidate of nestedCandidates) {
    const nested = unwrapFlagRecord(candidate);
    if (nested) return nested;
  }

  return record;
}

export function parseFlagValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** R2Json 응답 `Flag`·`MSG` → 팝업 표시용 */
export function buildR2FlagMsgDialogContent(
  data: unknown,
  options?: {
    successTitle?: string;
    errorTitle?: string;
    unknownTitle?: string;
  },
): R2FlagMsgDialogContent {
  const successTitle = options?.successTitle ?? "전송 완료";
  const errorTitle = options?.errorTitle ?? "전송 실패";
  const unknownTitle = options?.unknownTitle ?? "전송 결과";
  const maxChars = 3000;

  if (Array.isArray(data) && data.length === 0) {
    return {
      title: errorTitle,
      message:
        "서버가 빈 목록([])만 돌려줬습니다. 성공/실패(Flag·MSG) 정보가 없어 결과를 표시할 수 없습니다.",
      tone: "error",
    };
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.length > 0) {
      const clipped =
        trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
      return {
        title: unknownTitle,
        message: clipped,
        tone: "error",
      };
    }
  }

  const record = unwrapFlagRecord(data);
  if (!record) {
    const snippet = formatApiResponseForDisplay(data, maxChars);
    return {
      title: errorTitle,
      message: `서버 응답에서 Flag·MSG(또는 flag·msg)를 찾지 못했습니다.\n\n【수신 내용】\n${snippet}`,
      tone: "error",
    };
  }
  const flagRaw = record.Flag ?? record.flag;
  const msgRaw = record.MSG ?? record.msg;
  const flag = parseFlagValue(flagRaw);
  const rawText =
    typeof record.raw === "string" && record.raw.trim().length > 0
      ? record.raw.trim()
      : null;
  const msg =
    typeof msgRaw === "string" && msgRaw.trim().length > 0
      ? msgRaw.trim()
      : flag === 1
        ? "정상 처리되었습니다."
        : flag === -1
          ? "처리 중 오류가 발생했습니다."
          : rawText !== null
            ? rawText.length > 400
              ? `${rawText.slice(0, 400)}…`
              : rawText
            : "서버 응답을 확인할 수 없습니다.";

  if (flag === 1) {
    return { title: successTitle, message: msg, tone: "success" };
  }

  if (flag === -1) {
    return { title: errorTitle, message: msg, tone: "error" };
  }

  if (flag === null) {
    const snippet = formatApiResponseForDisplay(data, maxChars);
    return {
      title: unknownTitle,
      message: `${msg}\n\n【수신 내용】\n${snippet}`,
      tone: "error",
    };
  }

  return { title: unknownTitle, message: msg, tone: "error" };
}

export function isR2FlagSuccess(data: unknown): boolean {
  const record = unwrapFlagRecord(data);
  if (!record) return false;
  return parseFlagValue(record.Flag ?? record.flag) === 1;
}

export function buildR2ApiErrorDialogContent(error: string): R2FlagMsgDialogContent {
  return {
    title: "전송 실패",
    message: error,
    tone: "error",
  };
}
