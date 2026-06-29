"use client";

import { Input } from "@/components/ui/input";
import { regNumberMaskedInputClass } from "@/features/attendance/lib/attendance-reg-number-input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState, type KeyboardEventHandler, type Ref } from "react";

type RegNumberMaskedInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onBlurLookup?: (value: string) => void;
  name: string;
  ref: Ref<HTMLInputElement>;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function RegNumberMaskedInput({
  value,
  onChange,
  onBlur,
  onBlurLookup,
  name,
  ref,
  className,
  onKeyDown,
}: RegNumberMaskedInputProps) {
  const [masked, setMasked] = useState(false);

  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        name={name}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={cn(regNumberMaskedInputClass(className ?? "", masked), "pr-10")}
        inputMode="numeric"
        maxLength={13}
        placeholder="13자리"
        value={value}
        onBlur={() => {
          onBlur();
          onBlurLookup?.(value);
        }}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 13);
          onChange(v);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        aria-label={masked ? "등록번호 보기" : "등록번호 숨기기"}
        aria-pressed={!masked}
        onClick={() => setMasked((prev) => !prev)}
      >
        {masked ? (
          <Eye className="h-4 w-4" aria-hidden />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
