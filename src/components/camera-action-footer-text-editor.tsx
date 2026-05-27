"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RICH_TEXT_SIZE_OPTIONS,
  type RichTextSizeToken,
  wrapRichTextSelection,
} from "@/lib/camera-action-footer-rich-text";
import { Bold, Palette } from "lucide-react";
import { useRef, useState } from "react";

type CameraActionFooterTextEditorProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function CameraActionFooterTextEditor({
  id,
  label,
  value,
  placeholder,
  onChange,
}: CameraActionFooterTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [colorHex, setColorHex] = useState("#dc2626");
  const [sizeToken, setSizeToken] = useState<RichTextSizeToken>("lg");

  const applyWrap = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { nextValue, selectionStart, selectionEnd } = wrapRichTextSelection(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      before,
      after,
    );
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2 py-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 bg-white"
          onClick={() => applyWrap("**", "**")}
          aria-label={`${label} 굵게`}
        >
          <Bold className="h-4 w-4" />
          굵게
        </Button>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={colorHex}
            onChange={(event) => setColorHex(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
            aria-label={`${label} 글자 색`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 bg-white"
            onClick={() => applyWrap(`[color=${colorHex}]`, "[/color]")}
            aria-label={`${label} 색상 적용`}
          >
            <Palette className="h-4 w-4" />
            색상
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Select
            value={sizeToken}
            onValueChange={(next) => setSizeToken(next as RichTextSizeToken)}
          >
            <SelectTrigger className="h-8 w-[7.5rem] bg-white text-sm">
              <SelectValue placeholder="크기" />
            </SelectTrigger>
            <SelectContent>
              {RICH_TEXT_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.token} value={option.token}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 bg-white"
            onClick={() => applyWrap(`[size=${sizeToken}]`, "[/size]")}
          >
            크기 적용
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        굵게: <code className="rounded bg-zinc-100 px-1">**글자**</code> · 색상:{" "}
        <code className="rounded bg-zinc-100 px-1">[color=#hex]글자[/color]</code>{" "}
        · 크기:{" "}
        <code className="rounded bg-zinc-100 px-1">
          [size=sm|base|lg|xl]글자[/size]
        </code>
      </p>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        placeholder={placeholder}
        className="resize-y bg-white font-mono text-sm leading-relaxed"
      />
    </div>
  );
}
