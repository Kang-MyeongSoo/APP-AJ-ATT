"use client";

import { ResultMessageDialog } from "@/components/result-message-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AttendanceForm,
  type AttendanceFormHandle,
} from "@/features/attendance/components/attendance-form";
import { uploadAttImage } from "@/features/attendance/lib/att-image-upload-api";
import {
  postAttEtcDailySave,
  type AttEtcDailySaveApiJson,
} from "@/features/attendance/lib/attendance-etc-daily-save-api";
import {
  ATTENDANCE_FORM_TEXTS_STORAGE_KEY,
  defaultAttendanceFormTexts,
  parseAttendanceFormTexts,
  type AttendanceFormTexts,
} from "@/features/attendance/lib/attendance-form-texts";
import { useToast } from "@/hooks/use-toast";
import {
  CAMERA_PREVIEW_WIDTH_DEFAULT,
  readCameraPreviewWidth,
} from "@/lib/camera-preview-size-storage";
import {
  buildR2ApiErrorDialogContent,
  buildR2FlagMsgDialogContent,
  isR2FlagSuccess,
  type R2FlagMsgDialogContent,
} from "@/lib/r2-flag-msg-response";
import { verifyMobileLogin } from "@/lib/mobile-login-api";
import { ServerBaseUrlSetupScreen } from "@/features/settings/components/server-base-url-setup-screen";
import { readServerBaseUrl } from "@/lib/server-connection-storage";
import { writeSettingsSessionLoginId } from "@/lib/settings-session-storage";
import {
  Camera,
  CameraOff,
  ImagePlus,
  Send,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

const PLACEHOLDER_SRC = "https://picsum.photos/seed/app-aj-att/800/600";
const MAX_CAPTURE_WIDTH = 480;
const MAX_CAPTURE_HEIGHT = 640;
const JPEG_QUALITY = 0.92;

function resolveDailySaveResultDialog(
  json: AttEtcDailySaveApiJson | { error?: string },
): R2FlagMsgDialogContent {
  if ("error" in json && typeof json.error === "string") {
    return buildR2ApiErrorDialogContent(json.error);
  }
  if ("data" in json) {
    return buildR2FlagMsgDialogContent(json.data);
  }
  return buildR2ApiErrorDialogContent("응답을 해석할 수 없습니다.");
}

function applyDailySaveResult(
  json: AttEtcDailySaveApiJson | { error?: string },
  setResultDialog: (content: R2FlagMsgDialogContent) => void,
  onSuccess: () => void,
) {
  const dialog = resolveDailySaveResultDialog(json);
  setResultDialog(dialog);
  if ("data" in json && isR2FlagSuccess(json.data)) {
    onSuccess();
  }
}

function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return dataUrl;
  return dataUrl.slice(comma + 1);
}

function captureFrameToDataUrl(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    throw new Error("아직 카메라 프레임이 준비되지 않았습니다.");
  }

  let targetW = vw;
  let targetH = vh;

  if (vw > MAX_CAPTURE_WIDTH) {
    targetW = MAX_CAPTURE_WIDTH;
    targetH = Math.round((vh * MAX_CAPTURE_WIDTH) / vw);
  }

  if (targetH > MAX_CAPTURE_HEIGHT) {
    targetH = MAX_CAPTURE_HEIGHT;
    targetW = Math.round((vw * MAX_CAPTURE_HEIGHT) / vh);
  }

  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("캔버스를 초기화할 수 없습니다.");
  }

  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function isVideoPlayInterruptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("interrupted") ||
    message.includes("aborted") ||
    message.includes("new load request")
  );
}

export default function Home() {
  const { toast } = useToast();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attendanceFormRef = useRef<AttendanceFormHandle>(null);

  const [previewUrl, setPreviewUrl] = useState<string>(PLACEHOLDER_SRC);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [attendanceFormTexts, setAttendanceFormTexts] =
    useState<AttendanceFormTexts>(defaultAttendanceFormTexts);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsLoginId, setSettingsLoginId] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsLoginSubmitting, setSettingsLoginSubmitting] = useState(false);
  const [resultDialog, setResultDialog] = useState<R2FlagMsgDialogContent | null>(
    null,
  );
  const [cameraPreviewWidth, setCameraPreviewWidth] = useState(
    CAMERA_PREVIEW_WIDTH_DEFAULT,
  );
  const [serverBaseUrlReady, setServerBaseUrlReady] = useState(() =>
    readServerBaseUrl().trim().length > 0,
  );

  useEffect(() => {
    const parsed = parseAttendanceFormTexts(
      window.localStorage.getItem(ATTENDANCE_FORM_TEXTS_STORAGE_KEY),
    );
    if (parsed) setAttendanceFormTexts(parsed);
    setCameraPreviewWidth(readCameraPreviewWidth());
    setServerBaseUrlReady(readServerBaseUrl().trim().length > 0);
  }, []);

  const stopStream = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setImageBase64(null);
    setPreviewUrl(PLACEHOLDER_SRC);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch (playError) {
          if (isVideoPlayInterruptedError(playError)) return;
          throw playError;
        }
      }
      setCameraReady(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "카메라를 열 수 없습니다.";
      toast({ variant: "destructive", description: msg });
    }
  }, [stopStream, toast]);

  useEffect(() => {
    if (!cameraEnabled) return;
    void startCamera();
    return () => stopStream();
  }, [cameraEnabled, startCamera, stopStream]);

  const handleTurnOffCamera = useCallback(() => {
    stopStream();
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setCameraEnabled(false);
    setPreviewUrl(PLACEHOLDER_SRC);
  }, [stopStream]);

  const handleReopenCamera = useCallback(() => {
    if (!cameraEnabled) {
      setCameraEnabled(true);
      return;
    }
    void startCamera();
  }, [cameraEnabled, startCamera]);

  const clearCapturedImage = useCallback(() => {
    setImageBase64(null);
    setPreviewUrl(PLACEHOLDER_SRC);
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      const dataUrl = captureFrameToDataUrl(video, canvas);
      const b64 = stripDataUrlPrefix(dataUrl);
      setImageBase64(b64);
      setPreviewUrl(dataUrl);
      toast({ description: "촬영되었습니다. 전송 버튼으로 보낼 수 있습니다." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "촬영에 실패했습니다.";
      toast({ variant: "destructive", description: msg });
    }
  };

  const handleSend = async () => {
    if (!attendanceFormRef.current) {
      toast({
        variant: "destructive",
        description: "양식을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    const validation = await attendanceFormRef.current.getValidatedValues();
    if (validation.ok === false) {
      console.warn("[att-send] validation failed:", validation.message);
      toast({
        variant: "destructive",
        description: validation.message,
      });
      return;
    }
    const formValues = validation.values;

    const serverBaseUrl = readServerBaseUrl();
    if (!serverBaseUrl.trim()) {
      toast({
        variant: "destructive",
        description: "설정에서 서버 연결 URL을 먼저 저장해 주세요.",
      });
      return;
    }

    if (cameraEnabled && !imageBase64) {
      setResultDialog({
        title: "촬영 필요",
        message: "사진을 촬영한 후 전송해 주세요.",
        tone: "error",
      });
      return;
    }

    setSending(true);
    try {
      let uploadedFileInfo:
        | { file_name: string; file_path: string }
        | undefined;

      if (imageBase64) {
        const uploadResult = await uploadAttImage(
          serverBaseUrl,
          formValues,
          imageBase64,
        );

        if (uploadResult.success === false) {
          setResultDialog(buildR2ApiErrorDialogContent(uploadResult.error));
          return;
        }

        uploadedFileInfo = {
          file_name: uploadResult.file_name,
          file_path: uploadResult.file_path,
        };
      }

      console.log("[att-send] 근태 POST 시작");
      try {
        const json = await postAttEtcDailySave(
          serverBaseUrl,
          formValues,
          uploadedFileInfo,
        );
        applyDailySaveResult(json, setResultDialog, () => {
          attendanceFormRef.current?.resetAfterSuccessfulSubmit();
          if (cameraEnabled) {
            clearCapturedImage();
          }
        });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "근태 데이터 전송에 실패했습니다.";
        setResultDialog(buildR2ApiErrorDialogContent(msg));
      }
    } finally {
      setSending(false);
    }
  };

  const handleOpenSettings = () => {
    setSettingsLoginId("");
    setSettingsPassword("");
    setIsSettingsDialogOpen(true);
  };

  const handleCloseSettingsDialog = () => {
    setIsSettingsDialogOpen(false);
    setSettingsLoginId("");
    setSettingsPassword("");
  };

  const handleSubmitSettingsLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const serverBaseUrl = readServerBaseUrl();

    setSettingsLoginSubmitting(true);
    try {
      const result = await verifyMobileLogin(
        serverBaseUrl,
        settingsLoginId,
        settingsPassword,
      );

      if (result.ok === false) {
        setResultDialog({
          title: "로그인 실패",
          message: result.message,
          tone: "error",
        });
        return;
      }

      writeSettingsSessionLoginId(settingsLoginId);
      stopStream();
      handleCloseSettingsDialog();
      router.push("/settings");
    } finally {
      setSettingsLoginSubmitting(false);
    }
  };

  if (!serverBaseUrlReady) {
    return (
      <ServerBaseUrlSetupScreen
        onSaved={() => setServerBaseUrlReady(true)}
      />
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-white text-base text-zinc-900">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-row-reverse items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="pointer-events-auto rounded-full border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
          onClick={handleOpenSettings}
          aria-label="설정"
        >
          <Settings className="h-5 w-5" />
        </Button>
        {cameraEnabled && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="pointer-events-auto rounded-full border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
            onClick={handleTurnOffCamera}
            aria-label="카메라 끄기"
          >
            <CameraOff className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col gap-2 overflow-hidden px-2 py-2 md:gap-3 md:px-4 md:py-3 lg:max-w-7xl">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
          <aside className="w-full min-h-0 overflow-hidden lg:flex-[1.35] lg:min-w-[30rem]">
            <AttendanceForm
              ref={attendanceFormRef}
              className="h-full"
              texts={attendanceFormTexts}
            />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto lg:flex-[0.85] [scrollbar-gutter:stable]">
            <div
              className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
              style={{ maxWidth: `${cameraPreviewWidth}px` }}
            >
              {!cameraReady && (
                <Image
                  src={PLACEHOLDER_SRC}
                  alt="카메라 준비 중 플레이스홀더"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 512px) 100vw, 512px"
                />
              )}
              <video
                ref={videoRef}
                className={
                  cameraReady
                    ? "absolute inset-0 h-full w-full object-cover"
                    : "hidden"
                }
                playsInline
                muted
                autoPlay
                disablePictureInPicture
                controlsList="nodownload noplaybackrate noremoteplayback"
              />
              {cameraReady && imageBase64 && previewUrl.startsWith("data:") && (
                <Image
                  src={previewUrl}
                  alt="촬영 미리보기"
                  fill
                  className="absolute inset-0 z-10 object-cover"
                  unoptimized
                  sizes="(max-width: 512px) 100vw, 512px"
                />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" aria-hidden />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="gap-2 rounded-full text-base"
                onClick={handleCapture}
                disabled={!cameraReady}
              >
                <Camera className="h-6 w-6" />
                촬영
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="gap-2 rounded-full text-base"
                onClick={handleReopenCamera}
              >
                <ImagePlus className="h-6 w-6" />
                카메라 다시 열기
              </Button>
              <Button
                type="button"
                size="lg"
                variant="default"
                className="gap-2 rounded-full bg-emerald-600 text-base hover:bg-emerald-700"
                onClick={() => void handleSend()}
                disabled={sending}
              >
                <Send className="h-6 w-6" />
                {sending ? "전송 중…" : "전송"}
              </Button>
            </div>

            {imageBase64 && (
              <p className="truncate text-sm text-zinc-600" title={imageBase64}>
                Base64 길이: {imageBase64.length}자
              </p>
            )}
          </div>
        </div>
      </div>
      <ResultMessageDialog
        open={resultDialog != null}
        title={resultDialog?.title ?? ""}
        message={resultDialog?.message ?? ""}
        tone={resultDialog?.tone ?? "error"}
        onClose={() => setResultDialog(null)}
      />
      {isSettingsDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">설정 로그인</h2>
            <p className="mt-1 text-sm text-zinc-600">
              설정 화면으로 이동하려면 아이디와 비밀번호를 입력하세요.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => void handleSubmitSettingsLogin(event)}
            >
              <Input
                type="text"
                value={settingsLoginId}
                onChange={(event) => setSettingsLoginId(event.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="아이디"
                aria-label="아이디"
                disabled={settingsLoginSubmitting}
              />
              <Input
                type="password"
                value={settingsPassword}
                onChange={(event) => setSettingsPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="비밀번호"
                aria-label="비밀번호"
                disabled={settingsLoginSubmitting}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseSettingsDialog}
                  disabled={settingsLoginSubmitting}
                >
                  취소
                </Button>
                <Button type="submit" disabled={settingsLoginSubmitting}>
                  {settingsLoginSubmitting ? "확인 중…" : "확인"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
