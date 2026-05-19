export type R2FlagMsgDialogTone = "success" | "error";

export type R2FlagMsgDialogContent = {
  title: string;
  message: string;
  tone: R2FlagMsgDialogTone;
};

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

  if (typeof data !== "object" || data === null) {
    return {
      title: errorTitle,
      message: "서버 응답을 해석할 수 없습니다.",
      tone: "error",
    };
  }

  const record = data as Record<string, unknown>;
  const flag = parseFlagValue(record.Flag);
  const msg =
    typeof record.MSG === "string" && record.MSG.trim().length > 0
      ? record.MSG.trim()
      : flag === 1
        ? "정상 처리되었습니다."
        : flag === -1
          ? "처리 중 오류가 발생했습니다."
          : "서버 응답을 확인할 수 없습니다.";

  if (flag === 1) {
    return { title: successTitle, message: msg, tone: "success" };
  }

  if (flag === -1) {
    return { title: errorTitle, message: msg, tone: "error" };
  }

  return { title: unknownTitle, message: msg, tone: "error" };
}

export function isR2FlagSuccess(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  return parseFlagValue((data as Record<string, unknown>).Flag) === 1;
}

export function buildR2ApiErrorDialogContent(error: string): R2FlagMsgDialogContent {
  return {
    title: "전송 실패",
    message: error,
    tone: "error",
  };
}
