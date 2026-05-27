"use client";

import { Button } from "@/components/ui/button";
import type { R2FlagMsgDialogTone } from "@/lib/r2-flag-msg-response";
import { cn } from "@/lib/utils";

type ResultMessageDialogProps = {
  open: boolean;
  title: string;
  message: string;
  tone: R2FlagMsgDialogTone;
  onClose: () => void;
};

export function ResultMessageDialog({
  open,
  title,
  message,
  tone,
  onClose,
}: ResultMessageDialogProps) {
  if (!open) return null;

  const isSuccess = tone === "success";
  const hasRawPayload = message.includes("【수신 내용】");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2
          id="result-dialog-title"
          className={cn(
            "text-lg font-semibold",
            isSuccess ? "text-emerald-700" : "text-red-600",
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "mt-3 max-h-[min(52vh,26rem)] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed text-zinc-800",
            hasRawPayload ? "font-mono text-sm" : "text-base",
          )}
        >
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}
