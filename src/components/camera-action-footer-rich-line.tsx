"use client";

import { renderCameraActionFooterRichText } from "@/lib/camera-action-footer-rich-text";
import { cn } from "@/lib/utils";

type CameraActionFooterRichLineProps = {
  text: string;
  className?: string;
  richKeyPrefix: string;
};

export function CameraActionFooterRichLine({
  text,
  className,
  richKeyPrefix,
}: CameraActionFooterRichLineProps) {
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {renderCameraActionFooterRichText(text, richKeyPrefix)}
    </p>
  );
}
