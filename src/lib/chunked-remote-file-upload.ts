import { parseImageSendUpstreamResponse } from "@/lib/parse-image-send-response";

const UPLOAD_CHUNK_SIZE = 256 * 1024;

export type ChunkedUploadFailure = {
  success: false;
  status: number | null;
  statusText: string;
  body: string;
  remoteName: string;
};

export type ChunkedUploadSuccess = {
  success: true;
  remoteName: string;
  file_name: string;
  file_path: string;
  flag: number;
};

export function isChunkedUploadFailure(
  result: ChunkedUploadSuccess | ChunkedUploadFailure,
): result is ChunkedUploadFailure {
  return result.success === false;
}

export async function uploadBytesByChunks(
  endpoint: string,
  remoteName: string,
  bytes: Uint8Array,
): Promise<ChunkedUploadSuccess | ChunkedUploadFailure> {
  const totalChunks = Math.max(1, Math.ceil(bytes.length / UPLOAD_CHUNK_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, bytes.length);
    const chunk = bytes.subarray(start, end);
    const base64Data = Buffer.from(chunk).toString("base64");
    const isLast = chunkIndex === totalChunks - 1 ? "1" : "0";
    const append = chunkIndex === 0 ? "0" : "1";

    const body = new URLSearchParams({
      name: remoteName,
      data: base64Data,
      append,
      end: isLast,
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
    }).catch(() => null);

    const upstreamBody = res
      ? (await res.text().catch(() => "")).slice(0, 2000)
      : "";

    if (!res?.ok) {
      return {
        success: false,
        status: res?.status ?? null,
        statusText: res?.statusText ?? "NETWORK_ERROR",
        body: upstreamBody,
        remoteName,
      };
    }

    if (isLast !== "1") continue;

    const parsed = parseImageSendUpstreamResponse(upstreamBody);
    if (!parsed) {
      return {
        success: false,
        status: res.status,
        statusText: res.statusText,
        body: upstreamBody || "이미지 업로드 응답을 해석할 수 없습니다.",
        remoteName,
      };
    }

    if (parsed.flag !== 1) {
      return {
        success: false,
        status: res.status,
        statusText: res.statusText,
        body: parsed.msg ?? upstreamBody,
        remoteName,
      };
    }

    return {
      success: true,
      remoteName,
      file_name: parsed.file_name,
      file_path: parsed.file_path,
      flag: parsed.flag,
    };
  }

  return {
    success: false,
    status: null,
    statusText: "EMPTY_RESPONSE",
    body: "이미지 업로드 응답이 없습니다.",
    remoteName,
  };
}
