"use client";

import { CameraActionFooterRichLine } from "@/components/camera-action-footer-rich-line";
import type { CameraActionFooterTexts } from "@/lib/camera-action-footer-texts";
import { cn } from "@/lib/utils";

type CameraActionFooterNoticeProps = {
  texts: CameraActionFooterTexts;
  className?: string;
  emptyHint?: string;
};

export function CameraActionFooterNotice({
  texts,
  className,
  emptyHint,
}: CameraActionFooterNoticeProps) {
  const bodyKo = texts.bodyKo.trim();
  const bodyEn = texts.bodyEn.trim();
  const hasContent = bodyKo.length > 0 || bodyEn.length > 0;

  return (
    <div
      className={cn(
        "min-h-[5rem] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-800",
        className,
      )}
    >
      {hasContent ? (
        <>
          {bodyKo.length > 0 ? (
            <CameraActionFooterRichLine
              text={bodyKo}
              richKeyPrefix="footer-ko"
            />
          ) : null}
          {bodyEn.length > 0 ? (
            <CameraActionFooterRichLine
              text={bodyEn}
              richKeyPrefix="footer-en"
              className={cn(
                "text-[0.9rem] text-zinc-600",
                bodyKo.length > 0 && "mt-2",
              )}
            />
          ) : null}
        </>
      ) : emptyHint ? (
        <p className="text-zinc-400">{emptyHint}</p>
      ) : null}
    </div>
  );
}
