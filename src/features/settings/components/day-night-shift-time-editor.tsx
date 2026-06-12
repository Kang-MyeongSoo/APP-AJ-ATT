"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS,
  readDayNightShiftTimeSettings,
  writeDayNightShiftTimeSettings,
  type DayNightShiftTimeSettings,
} from "@/lib/day-night-shift-time-storage";
import { useEffect, useState } from "react";

function formatTimeWithColon(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
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

function TimeRangeField({
  idPrefix,
  label,
  description,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: {
  idPrefix: string;
  label: string;
  description: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const handleChange = (value: string, onChange: (next: string) => void) => {
    const next = formatTimeWithColon(value);
    if (!isValidPartialTimeHm(next)) return;
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-start`}>시작</Label>
          <Input
            id={`${idPrefix}-start`}
            type="text"
            inputMode="numeric"
            placeholder="08:30"
            value={startValue}
            onChange={(event) =>
              handleChange(event.target.value, onStartChange)
            }
            className="max-w-[8rem] font-mono text-sm"
            spellCheck={false}
            maxLength={5}
          />
        </div>
        <span className="mt-6 text-sm text-zinc-500">~</span>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-end`}>종료</Label>
          <Input
            id={`${idPrefix}-end`}
            type="text"
            inputMode="numeric"
            placeholder="20:29"
            value={endValue}
            onChange={(event) => handleChange(event.target.value, onEndChange)}
            className="max-w-[8rem] font-mono text-sm"
            spellCheck={false}
            maxLength={5}
          />
        </div>
      </div>
    </div>
  );
}

type DayNightShiftTimeEditorProps = {
  onSaved?: () => void;
};

export function DayNightShiftTimeEditor({ onSaved }: DayNightShiftTimeEditorProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<DayNightShiftTimeSettings>(
    DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS,
  );

  useEffect(() => {
    setDraft(readDayNightShiftTimeSettings());
  }, []);

  const handleSave = () => {
    const saved = writeDayNightShiftTimeSettings(draft);
    if (!saved) {
      toast({
        variant: "destructive",
        description:
          "시간 형식이 올바르지 않습니다. HH:mm 형식(예: 08:30)으로 입력해 주세요.",
      });
      return;
    }
    setDraft(saved);
    onSaved?.();
  };

  const handleReset = () => {
    setDraft(DEFAULT_DAY_NIGHT_SHIFT_TIME_SETTINGS);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900">
            주간/야간 구분 시간
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            홈 화면에서 주간/야간 초기값을 판별할 때 사용할 시간대를 설정합니다.
            설정은 이 기기 브라우저 저장소에 보관됩니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            기본값
          </Button>
          <Button type="button" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TimeRangeField
          idPrefix="day-shift"
          label="주간 구분 시간"
          description="이 시간대에 해당하면 주간으로 초기 설정됩니다."
          startValue={draft.dayStart}
          endValue={draft.dayEnd}
          onStartChange={(dayStart) => setDraft((prev) => ({ ...prev, dayStart }))}
          onEndChange={(dayEnd) => setDraft((prev) => ({ ...prev, dayEnd }))}
        />
        <TimeRangeField
          idPrefix="night-shift"
          label="야간 구분 시간"
          description="이 시간대에 해당하면 야간으로 초기 설정됩니다."
          startValue={draft.nightStart}
          endValue={draft.nightEnd}
          onStartChange={(nightStart) =>
            setDraft((prev) => ({ ...prev, nightStart }))
          }
          onEndChange={(nightEnd) =>
            setDraft((prev) => ({ ...prev, nightEnd }))
          }
        />
      </div>

      <p className="text-xs text-zinc-500">
        기본값: 주간 08:30 ~ 20:29, 야간 20:30 ~ 08:29
      </p>
    </div>
  );
}
