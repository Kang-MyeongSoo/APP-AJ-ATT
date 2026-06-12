"use client";

import { CameraActionFooterNotice } from "@/components/camera-action-footer-notice";
import { CameraActionFooterTextEditor } from "@/components/camera-action-footer-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster } from "@/components/ui/toaster";
import { AttendanceEtcFormMstGrid } from "@/features/attendance/components/attendance-etc-form-mst-grid";
import { AttendanceForm } from "@/features/attendance/components/attendance-form";
import {
  ATTENDANCE_FORM_TEXTS_STORAGE_KEY,
  defaultAttendanceFormTexts,
  parseAttendanceFormTexts,
  type AttendanceFormTexts,
} from "@/features/attendance/lib/attendance-form-texts";
import { useToast } from "@/hooks/use-toast";
import {
  defaultCameraActionFooterTexts,
  parseCameraActionFooterTexts,
  CAMERA_ACTION_FOOTER_TEXTS_STORAGE_KEY,
  writeCameraActionFooterTexts,
  type CameraActionFooterTexts,
} from "@/lib/camera-action-footer-texts";
import {
  CAMERA_PREVIEW_WIDTH_DEFAULT,
  CAMERA_PREVIEW_WIDTH_MAX,
  CAMERA_PREVIEW_WIDTH_MIN,
  clampCameraPreviewWidth,
  readCameraPreviewWidth,
  writeCameraPreviewWidth,
} from "@/lib/camera-preview-size-storage";
import { parseServerBaseUrl } from "@/lib/server-base-url-schema";
import {
  readServerBaseUrl,
  writeServerBaseUrl,
} from "@/lib/server-connection-storage";
import { AttendanceFormColorsEditor } from "@/features/settings/components/attendance-form-colors-editor";
import { DayNightShiftTimeEditor } from "@/features/settings/components/day-night-shift-time-editor";
import { hasSettingsAdminSession } from "@/lib/settings-session-storage";
import { Settings } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CAMERA_PREVIEW_PLACEHOLDER_SRC =
  "https://picsum.photos/seed/app-aj-att/800/600";

function cameraPreviewHeight(width: number): number {
  return Math.round((width * 4) / 3);
}

function CameraPreviewSizeBox({ width }: { width: number }) {
  const height = cameraPreviewHeight(width);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-900 bg-zinc-100 ring-2 ring-zinc-900/15"
        style={{ width, height }}
      >
        <Image
          src={CAMERA_PREVIEW_PLACEHOLDER_SRC}
          alt={`카메라 프리뷰 ${width}px`}
          fill
          className="object-cover"
          unoptimized
          sizes={`${width}px`}
        />
      </div>
      <p className="text-center text-xs font-medium text-zinc-900">
        {width} × {height}px
      </p>
    </div>
  );
}

type SettingsMenu =
  | "formTitle"
  | "serverConnection"
  | "cameraViewSize"
  | "cameraActionFooter"
  | "formColors"
  | "dayNightShiftTime";

type FormTitleSubView = "template" | "editForm";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [selectedMenu, setSelectedMenu] =
    useState<SettingsMenu>("serverConnection");
  const [formTitleSubView, setFormTitleSubView] =
    useState<FormTitleSubView>("template");
  const [formTexts, setFormTexts] = useState<AttendanceFormTexts>(
    defaultAttendanceFormTexts,
  );
  const [serverBaseUrl, setServerBaseUrl] = useState("");
  const [cameraPreviewWidth, setCameraPreviewWidth] = useState(
    CAMERA_PREVIEW_WIDTH_DEFAULT,
  );
  const [cameraActionFooterTexts, setCameraActionFooterTexts] =
    useState<CameraActionFooterTexts>(defaultCameraActionFooterTexts);

  useEffect(() => {
    setIsAdminSession(hasSettingsAdminSession());
    const parsed = parseAttendanceFormTexts(
      window.localStorage.getItem(ATTENDANCE_FORM_TEXTS_STORAGE_KEY),
    );
    if (parsed) setFormTexts(parsed);
    const footerParsed = parseCameraActionFooterTexts(
      window.localStorage.getItem(CAMERA_ACTION_FOOTER_TEXTS_STORAGE_KEY),
    );
    if (footerParsed) setCameraActionFooterTexts(footerParsed);
    setServerBaseUrl(readServerBaseUrl());
    setCameraPreviewWidth(readCameraPreviewWidth());
  }, []);

  useEffect(() => {
    if (!isAdminSession && selectedMenu === "formTitle") {
      setSelectedMenu("serverConnection");
    }
  }, [isAdminSession, selectedMenu]);

  const handleTextChange = (key: keyof AttendanceFormTexts, value: string) => {
    setFormTexts((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveServerBaseUrl = () => {
    const parsed = parseServerBaseUrl(serverBaseUrl);
    if (!parsed.success) {
      toast({
        variant: "destructive",
        description:
          "올바른 URL 형식을 입력해 주세요. (예: https://example.com)",
      });
      return;
    }
    writeServerBaseUrl(parsed.data);
    setServerBaseUrl(parsed.data);
    toast({
      description:
        parsed.data === ""
          ? "저장된 서버 주소를 삭제했습니다."
          : "서버 주소를 저장했습니다.",
    });
  };

  const handleCameraPreviewWidthChange = (value: string) => {
    const nextValue =
      value.trim() === "" ? CAMERA_PREVIEW_WIDTH_MIN : Number(value);
    setCameraPreviewWidth(clampCameraPreviewWidth(nextValue));
  };

  const handleSaveCameraPreviewWidth = () => {
    const normalized = writeCameraPreviewWidth(cameraPreviewWidth);
    setCameraPreviewWidth(normalized);
    toast({
      description: `카메라 화면 크기를 ${normalized}px로 저장했습니다.`,
    });
  };

  const handleSaveCameraActionFooterTexts = () => {
    const saved = writeCameraActionFooterTexts(cameraActionFooterTexts);
    setCameraActionFooterTexts(saved);
    toast({ description: "안내 문구를 저장했습니다." });
  };

  const editableKeys = new Set<keyof AttendanceFormTexts>(
    Object.keys(defaultAttendanceFormTexts) as Array<keyof AttendanceFormTexts>,
  );

  return (
    <main className="fixed inset-0 flex overflow-hidden bg-zinc-50 p-4 md:p-6">
      <section className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-zinc-100 p-2 text-zinc-700">
              <Settings className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              프로그램 세팅
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => router.push("/")}
          >
            홈으로 돌아가기
          </Button>
        </div>
        <div className="mb-4 min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 gap-4 md:grid-cols-[12rem_1fr]">
            <nav className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <Button
                type="button"
                variant={
                  selectedMenu === "serverConnection" ? "default" : "ghost"
                }
                className="w-full justify-start rounded-lg"
                onClick={() => setSelectedMenu("serverConnection")}
              >
                서버 연결
              </Button>
              <Button
                type="button"
                variant={
                  selectedMenu === "cameraViewSize" ? "default" : "ghost"
                }
                className="w-full justify-start rounded-lg"
                onClick={() => setSelectedMenu("cameraViewSize")}
              >
                카메라 화면 크기
              </Button>
              <Button
                type="button"
                variant={
                  selectedMenu === "cameraActionFooter" ? "default" : "ghost"
                }
                className="w-full justify-start rounded-lg"
                onClick={() => setSelectedMenu("cameraActionFooter")}
              >
                안내 문구
              </Button>
              <Button
                type="button"
                variant={selectedMenu === "formColors" ? "default" : "ghost"}
                className="w-full justify-start rounded-lg"
                onClick={() => setSelectedMenu("formColors")}
              >
                색상 변경
              </Button>
              <Button
                type="button"
                variant={
                  selectedMenu === "dayNightShiftTime" ? "default" : "ghost"
                }
                className="w-full justify-start rounded-lg"
                onClick={() => setSelectedMenu("dayNightShiftTime")}
              >
                주간/야간 구분 시간
              </Button>
              {isAdminSession ? (
                <Button
                  type="button"
                  variant={selectedMenu === "formTitle" ? "default" : "ghost"}
                  className="w-full justify-start rounded-lg"
                  onClick={() => setSelectedMenu("formTitle")}
                >
                  입력폼 수정
                </Button>
              ) : null}
            </nav>

            <div className="min-h-0 overflow-hidden rounded-xl border border-zinc-200 p-4">
              {isAdminSession && selectedMenu === "formTitle" && (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    입력폼 문구 수정
                  </h2>
                  <p className="text-sm text-zinc-600">
                    아래 입력폼에서 문구를 직접 수정할 수 있습니다.
                  </p>
                  <RadioGroup
                    value={formTitleSubView}
                    onValueChange={(value) =>
                      setFormTitleSubView(value as FormTitleSubView)
                    }
                    className="flex flex-wrap items-center gap-6 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="template"
                        id="settings-form-template"
                      />
                      <Label
                        htmlFor="settings-form-template"
                        className="cursor-pointer font-normal text-zinc-800"
                      >
                        양식
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="editForm"
                        id="settings-form-edit"
                      />
                      <Label
                        htmlFor="settings-form-edit"
                        className="cursor-pointer font-normal text-zinc-800"
                      >
                        수정폼
                      </Label>
                    </div>
                  </RadioGroup>
                  {formTitleSubView === "template" && (
                    <>
                      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <AttendanceForm
                          className="h-full max-h-none"
                          texts={formTexts}
                          textRenderer={(key, value) => {
                            if (!editableKeys.has(key)) return value;
                            return (
                              <Input
                                value={value}
                                onChange={(e) =>
                                  handleTextChange(key, e.target.value)
                                }
                                maxLength={40}
                                className="inline-flex h-8 min-w-[7rem] max-w-[12rem] bg-white align-middle text-sm"
                              />
                            );
                          }}
                        />
                      </div>
                    </>
                  )}
                  {formTitleSubView === "editForm" && (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <AttendanceEtcFormMstGrid serverBaseUrl={serverBaseUrl} />
                    </div>
                  )}
                </div>
              )}

              {selectedMenu === "serverConnection" && (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      서버 연결
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      API 요청에 사용할 서버 Base URL을 등록합니다. 저장하면 이
                      기기 브라우저 저장소에 보관되며, 앱을 다시 열어도
                      유지됩니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-base-url">Base URL</Label>
                    <Input
                      id="server-base-url"
                      type="url"
                      placeholder="http://133.186.251.89:14283/AJCC/Mobile"
                      value={serverBaseUrl}
                      onChange={(e) => setServerBaseUrl(e.target.value)}
                      className="max-w-xl font-mono text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSaveServerBaseUrl}>
                      저장
                    </Button>
                  </div>
                </div>
              )}

              {selectedMenu === "formColors" && (
                <AttendanceFormColorsEditor
                  onSaved={() =>
                    toast({ description: "입력폼 색상을 저장했습니다." })
                  }
                />
              )}

              {selectedMenu === "dayNightShiftTime" && (
                <DayNightShiftTimeEditor
                  onSaved={() =>
                    toast({
                      description: "주간/야간 구분 시간을 저장했습니다.",
                    })
                  }
                />
              )}

              {selectedMenu === "cameraActionFooter" && (
                <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-zinc-900">
                        안내 문구
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        홈 화면의 촬영·카메라 다시 열기·전송 버튼 아래에 표시할
                        안내 문구입니다. 굵게·색상·글자 크기 서식을 적용할 수
                        있습니다.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="shrink-0"
                      onClick={handleSaveCameraActionFooterTexts}
                    >
                      저장
                    </Button>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <CameraActionFooterTextEditor
                      id="camera-footer-ko"
                      label="한글"
                      value={cameraActionFooterTexts.bodyKo}
                      onChange={(bodyKo) =>
                        setCameraActionFooterTexts((prev) => ({
                          ...prev,
                          bodyKo,
                        }))
                      }
                      placeholder="예: 사진을 **촬영**한 후 [color=#dc2626]전송[/color] 버튼을 눌러 주세요."
                    />
                    <CameraActionFooterTextEditor
                      id="camera-footer-en"
                      label="English"
                      value={cameraActionFooterTexts.bodyEn}
                      onChange={(bodyEn) =>
                        setCameraActionFooterTexts((prev) => ({
                          ...prev,
                          bodyEn,
                        }))
                      }
                      placeholder="e.g. Please [size=lg]take a photo[/size], then press **Send**."
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-900">
                      미리보기
                    </p>
                    <CameraActionFooterNotice
                      texts={cameraActionFooterTexts}
                      emptyHint="저장된 안내 문구가 없습니다. 위에서 입력 후 저장하세요."
                    />
                  </div>
                </div>
              )}

              {selectedMenu === "cameraViewSize" && (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-zinc-900">
                        카메라 화면 크기
                      </h2>
                      <p className="mt-1 text-sm text-zinc-600">
                        홈 화면 우측 카메라 프리뷰의 가로 크기를 조정합니다.
                        높이는 비율에 맞춰 자동으로 적용됩니다.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="shrink-0"
                      onClick={handleSaveCameraPreviewWidth}
                    >
                      저장
                    </Button>
                  </div>
                  <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1 space-y-3">
                        <Label htmlFor="camera-preview-width-slider">
                          가로 크기 ({cameraPreviewWidth}px)
                        </Label>
                        <Input
                          id="camera-preview-width-slider"
                          type="range"
                          min={CAMERA_PREVIEW_WIDTH_MIN}
                          max={CAMERA_PREVIEW_WIDTH_MAX}
                          step={10}
                          value={cameraPreviewWidth}
                          onChange={(event) =>
                            handleCameraPreviewWidthChange(event.target.value)
                          }
                        />
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="camera-preview-width-input"
                            className="shrink-0"
                          >
                            직접 입력
                          </Label>
                          <Input
                            id="camera-preview-width-input"
                            type="number"
                            min={CAMERA_PREVIEW_WIDTH_MIN}
                            max={CAMERA_PREVIEW_WIDTH_MAX}
                            value={cameraPreviewWidth}
                            onChange={(event) =>
                              handleCameraPreviewWidthChange(event.target.value)
                            }
                            className="max-w-[10rem]"
                          />
                          <span className="text-sm text-zinc-600">px</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          조절 범위: {CAMERA_PREVIEW_WIDTH_MIN}px ~{" "}
                          {CAMERA_PREVIEW_WIDTH_MAX}px
                        </p>
                      </div>
                      <div className="shrink-0 border-t border-zinc-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                        <p className="text-sm font-medium text-zinc-900">
                          선택한 크기 (홈 화면과 동일)
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          가로 {cameraPreviewWidth}px · 세로 약{" "}
                          {cameraPreviewHeight(cameraPreviewWidth)}px (3:4 비율)
                        </p>
                        <div className="mt-3 max-h-[min(70vh,560px)] overflow-y-auto pr-1">
                          <CameraPreviewSizeBox width={cameraPreviewWidth} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <Toaster />
    </main>
  );
}
