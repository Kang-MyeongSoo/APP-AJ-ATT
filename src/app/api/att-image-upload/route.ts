import {
  isChunkedUploadFailure,
  uploadBytesByChunks,
} from "@/lib/chunked-remote-file-upload";
import { NextRequest, NextResponse } from "next/server";

const IMAGE_SEND_ASP_NAME = "R2JsonProc_image_send.aspx";

function isAllowedImageUploadTarget(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  return url.pathname
    .toLowerCase()
    .endsWith(`/${IMAGE_SEND_ASP_NAME.toLowerCase()}`);
}

function buildImageUploadUrl(serverBaseUrl: string): string {
  const base = serverBaseUrl.trim().replace(/\/+$/, "");
  return `${base}/${IMAGE_SEND_ASP_NAME}`;
}

function decodeBase64ToBytes(base64: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 본문이 필요합니다." },
      { status: 400 },
    );
  }

  const base =
    typeof body === "object" &&
    body !== null &&
    "base" in body &&
    typeof (body as { base: unknown }).base === "string"
      ? (body as { base: string }).base
      : null;

  const remoteName =
    typeof body === "object" &&
    body !== null &&
    "remoteName" in body &&
    typeof (body as { remoteName: unknown }).remoteName === "string"
      ? (body as { remoteName: string }).remoteName.trim()
      : null;

  const base64 =
    typeof body === "object" &&
    body !== null &&
    "base64" in body &&
    typeof (body as { base64: unknown }).base64 === "string"
      ? (body as { base64: string }).base64
      : null;

  if (!base?.trim()) {
    return NextResponse.json(
      { error: "base(서버 URL)가 필요합니다." },
      { status: 400 },
    );
  }

  if (!remoteName) {
    return NextResponse.json(
      { error: "remoteName이 필요합니다." },
      { status: 400 },
    );
  }

  if (!base64?.length) {
    return NextResponse.json(
      { error: "base64 이미지 데이터가 필요합니다." },
      { status: 400 },
    );
  }

  let target: URL;
  try {
    target = new URL(buildImageUploadUrl(base));
  } catch {
    return NextResponse.json({ error: "잘못된 서버 URL입니다." }, { status: 400 });
  }

  if (!isAllowedImageUploadTarget(target)) {
    return NextResponse.json(
      { error: "허용되지 않는 요청입니다." },
      { status: 400 },
    );
  }

  const bytes = decodeBase64ToBytes(base64);
  if (!bytes?.length) {
    return NextResponse.json(
      { error: "base64 디코딩에 실패했습니다." },
      { status: 400 },
    );
  }

  const uploadResult = await uploadBytesByChunks(
    target.toString(),
    remoteName,
    bytes,
  );

  if (isChunkedUploadFailure(uploadResult)) {
    return NextResponse.json(
      {
        error: "이미지 업로드에 실패했습니다.",
        upstream: {
          requestUrl: target.toString(),
          status: uploadResult.status,
          statusText: uploadResult.statusText,
          body: uploadResult.body,
          remoteName: uploadResult.remoteName,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    remoteName: uploadResult.remoteName,
    Flag: uploadResult.flag,
    file_name: uploadResult.file_name,
    file_path: uploadResult.file_path,
  });
}
