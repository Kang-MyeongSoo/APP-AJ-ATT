'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Camera, FolderOpen, ImagePlus, Send } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';

const PLACEHOLDER_SRC = 'https://picsum.photos/seed/app-aj-att/800/600';
const MAX_CAPTURE_WIDTH = 480;
const MAX_CAPTURE_HEIGHT = 640;
const JPEG_QUALITY = 0.92;

type UploadApiJson = {
  ok: boolean;
  status: number;
  data: unknown;
};

function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
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
    throw new Error('아직 카메라 프레임이 준비되지 않았습니다.');
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

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스를 초기화할 수 없습니다.');
  }

  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function buildImageFilename(): string {
  return `capture_${format(new Date(), 'yyyyMMdd_HHmmss')}.jpg`;
}

export default function Home() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>(PLACEHOLDER_SRC);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [savePath, setSavePath] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  const stopStream = useCallback(() => {
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
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraReady(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '카메라를 열 수 없습니다.';
      toast({ variant: 'destructive', description: msg });
    }
  }, [stopStream, toast]);

  useEffect(() => {
    void startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      const dataUrl = captureFrameToDataUrl(video, canvas);
      const b64 = stripDataUrlPrefix(dataUrl);
      setImageBase64(b64);
      setPreviewUrl(dataUrl);
      toast({ description: '촬영되었습니다. 전송 버튼으로 보낼 수 있습니다.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '촬영에 실패했습니다.';
      toast({ variant: 'destructive', description: msg });
    }
  };

  const handleSelectSavePath = async () => {
    if (!window.electronAPI) {
      toast({
        variant: 'destructive',
        description: 'Electron 환경에서만 사용할 수 있습니다.',
      });
      return;
    }

    const selected = await window.electronAPI.selectSaveDirectory();
    if (selected) {
      setSavePath(selected);
      toast({ description: `저장 경로가 설정되었습니다: ${selected}` });
    }
  };

  const handleSend = async () => {
    if (!imageBase64) {
      toast({
        variant: 'destructive',
        description: '먼저 촬영 버튼으로 사진을 찍어주세요.',
      });
      return;
    }

    setSending(true);
    try {
      const [apiResult, saveResult] = await Promise.allSettled([
        fetch('/api/upload-emp-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: imageBase64 }),
        }).then((res) => res.json() as Promise<UploadApiJson | { error?: string }>),

        savePath && window.electronAPI
          ? window.electronAPI.saveImage(
              imageBase64,
              savePath,
              buildImageFilename(),
            )
          : Promise.resolve(null),
      ]);

      if (apiResult.status === 'fulfilled') {
        const json = apiResult.value;
        match(json)
          .with({ error: P.string }, ({ error }) => {
            toast({ variant: 'destructive', description: error });
          })
          .with(
            {
              ok: P.boolean,
              data: P.union(P.record(P.string, P.unknown), P.any),
            },
            (j) => {
              const payload = j.data as Record<string, unknown>;
              const msg =
                typeof payload.MSG === 'string'
                  ? payload.MSG
                  : j.ok
                    ? '전송이 완료되었습니다.'
                    : `서버 응답 (${j.status})`;
              toast({
                variant: j.ok ? 'default' : 'destructive',
                description: msg,
              });
            },
          )
          .otherwise(() => {
            toast({
              variant: 'destructive',
              description: '응답을 해석할 수 없습니다.',
            });
          });
      } else {
        const msg =
          apiResult.reason instanceof Error
            ? apiResult.reason.message
            : '전송에 실패했습니다.';
        toast({ variant: 'destructive', description: msg });
      }

      if (saveResult.status === 'fulfilled' && saveResult.value) {
        const result = saveResult.value;
        if (result.success && result.filePath) {
          toast({ description: `이미지 저장 완료: ${result.filePath}` });
        } else if (!result.success && result.error) {
          toast({
            variant: 'destructive',
            description: `파일 저장 실패: ${result.error}`,
          });
        }
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">APP-AJ-ATT</h1>
          <p className="text-sm text-zinc-400">
            촬영 후 JPEG base64를{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
              param1
            </code>
            으로 전송합니다.
          </p>
        </header>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
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
                ? 'absolute inset-0 h-full w-full object-cover'
                : 'hidden'
            }
            playsInline
            muted
            autoPlay
          />
          {cameraReady && imageBase64 && previewUrl.startsWith('data:') && (
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
            className="gap-2 rounded-full"
            onClick={handleCapture}
            disabled={!cameraReady}
          >
            <Camera className="h-5 w-5" />
            촬영
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="gap-2 rounded-full"
            onClick={() => void startCamera()}
          >
            <ImagePlus className="h-5 w-5" />
            카메라 다시 열기
          </Button>
          <Button
            type="button"
            size="lg"
            variant="default"
            className="gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void handleSend()}
            disabled={!imageBase64 || sending}
          >
            <Send className="h-5 w-5" />
            {sending ? '전송 중…' : '전송'}
          </Button>
        </div>

        {isElectron && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">
                파일 저장 설정
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 rounded-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => void handleSelectSavePath()}
              >
                <FolderOpen className="h-4 w-4" />
                폴더 선택
              </Button>
            </div>
            {savePath ? (
              <p
                className="truncate rounded bg-zinc-800 px-3 py-2 text-xs text-zinc-400"
                title={savePath}
              >
                {savePath}
              </p>
            ) : (
              <p className="text-xs text-zinc-600">
                폴더를 선택하면 전송 시 해당 경로에 이미지가 함께 저장됩니다.
              </p>
            )}
          </div>
        )}

        {imageBase64 && (
          <p className="truncate text-xs text-zinc-500" title={imageBase64}>
            Base64 길이: {imageBase64.length}자
          </p>
        )}
      </div>
    </div>
  );
}
