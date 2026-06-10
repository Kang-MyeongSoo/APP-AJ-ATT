"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AttendanceForm } from "@/features/attendance/components/attendance-form";
import {
  defaultAttendanceFormColors,
  mergeAttendanceFormColors,
  normalizeHexColor,
  type AttendanceFormColors,
} from "@/features/attendance/lib/attendance-form-colors";
import { useAttendanceFormColorsStore } from "@/features/attendance/stores/attendance-form-colors-store";
import { useEffect, useMemo, useState } from "react";

type ColorFieldKey = keyof AttendanceFormColors;

const colorFieldLabels: Record<ColorFieldKey, string> = {
  titleHeaderBackgroundColor: "구분·내용·비고 셀 색상",
  disabledCellColor: "비활성화 셀 색상",
};

const colorFieldDescriptions: Record<ColorFieldKey, string> = {
  titleHeaderBackgroundColor:
    "입력폼 상단 구분·내용·비고 헤더 셀의 배경 색상입니다.",
  disabledCellColor:
    "날짜·출퇴근시간 등 자동 입력·비활성화된 입력란의 배경 색상입니다.",
};

const colorFieldPlaceholders: Record<ColorFieldKey, string> = {
  titleHeaderBackgroundColor: "#d4d4d8",
  disabledCellColor: "#e4e4e7",
};

function previewColorsFromDraft(draft: AttendanceFormColors): AttendanceFormColors {
  return {
    titleHeaderBackgroundColor:
      normalizeHexColor(draft.titleHeaderBackgroundColor) ??
      draft.titleHeaderBackgroundColor,
    disabledCellColor:
      normalizeHexColor(draft.disabledCellColor) ?? draft.disabledCellColor,
  };
}

function ColorFieldRow({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: ColorFieldKey;
  value: string;
  onChange: (next: string) => void;
}) {
  const pickerValue = normalizeHexColor(value) ?? colorFieldPlaceholders[fieldKey];

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="space-y-1">
        <Label htmlFor={`attendance-form-color-${fieldKey}`}>
          {colorFieldLabels[fieldKey]}
        </Label>
        <p className="text-xs text-zinc-500">{colorFieldDescriptions[fieldKey]}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          id={`attendance-form-color-${fieldKey}`}
          type="color"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-16 cursor-pointer rounded-lg border-zinc-300 p-1"
          aria-label={`${colorFieldLabels[fieldKey]} 선택`}
        />
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={colorFieldPlaceholders[fieldKey]}
          className="max-w-[10rem] font-mono text-sm"
          spellCheck={false}
        />
        <div
          className="h-11 w-11 rounded-lg border border-zinc-300"
          style={{ backgroundColor: normalizeHexColor(value) ?? value }}
          aria-hidden
        />
      </div>
    </div>
  );
}

type AttendanceFormColorsEditorProps = {
  onSaved?: () => void;
};

export function AttendanceFormColorsEditor({
  onSaved,
}: AttendanceFormColorsEditorProps) {
  const [draftColors, setDraftColors] = useState<AttendanceFormColors>(
    defaultAttendanceFormColors,
  );
  const setStoreColors = useAttendanceFormColorsStore((state) => state.setColors);
  const resetStoreColors = useAttendanceFormColorsStore(
    (state) => state.resetToDefault,
  );

  useEffect(() => {
    void useAttendanceFormColorsStore.persist.rehydrate();
    const { titleHeaderBackgroundColor, disabledCellColor } =
      useAttendanceFormColorsStore.getState();
    setDraftColors({ titleHeaderBackgroundColor, disabledCellColor });
  }, []);

  const handleDraftChange = (key: ColorFieldKey, value: string) => {
    setDraftColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const normalized = mergeAttendanceFormColors(draftColors);
    setStoreColors(normalized);
    setDraftColors(normalized);
    onSaved?.();
  };

  const handleResetDraft = () => {
    setDraftColors(defaultAttendanceFormColors);
  };

  const handleResetAndSave = () => {
    resetStoreColors();
    setDraftColors(defaultAttendanceFormColors);
    onSaved?.();
  };

  const previewColors = useMemo(
    () => previewColorsFromDraft(draftColors),
    [draftColors],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900">색상 변경</h2>
          <p className="mt-1 text-sm text-zinc-600">
            홈 화면 입력폼의 구분·내용·비고 헤더 셀 배경과 비활성화된 입력 셀
            배경 색상을 조정합니다. 색상을 바꾸면 미리보기에 바로 반영되며,
            저장하면 이 기기에 보관됩니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleResetDraft}>
            미리보기 초기화
          </Button>
          <Button type="button" variant="outline" onClick={handleResetAndSave}>
            기본값 복원
          </Button>
          <Button type="button" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ColorFieldRow
          fieldKey="titleHeaderBackgroundColor"
          value={draftColors.titleHeaderBackgroundColor}
          onChange={(value) =>
            handleDraftChange("titleHeaderBackgroundColor", value)
          }
        />
        <ColorFieldRow
          fieldKey="disabledCellColor"
          value={draftColors.disabledCellColor}
          onChange={(value) => handleDraftChange("disabledCellColor", value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-900">미리보기</p>
        <div className="min-h-[24rem] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <AttendanceForm
            className="h-full max-h-none"
            colorsOverride={previewColors}
          />
        </div>
      </div>
    </div>
  );
}
