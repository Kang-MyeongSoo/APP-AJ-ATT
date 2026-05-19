import { buildR2JsonProcUrl } from "@/lib/r2-json-proc-url";
import { NextRequest, NextResponse } from "next/server";

function isAllowedR2Target(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  return url.pathname.toLowerCase().endsWith("/r2jsonproc.asp");
}

/**
 * 브라우저 → 동일 출처로 호출 후, 서버에서 R2JsonProc.asp 로 프록시.
 * (업스트림이 잘못된 CORS 헤더를 내려도 클라이언트는 영향 없음.)
 */
export async function GET(request: NextRequest) {
  const base = request.nextUrl.searchParams.get("base");
  const proc = request.nextUrl.searchParams.get("proc");
  const param1 = request.nextUrl.searchParams.get("param1");
  const param2 = request.nextUrl.searchParams.get("param2");
  const param3 = request.nextUrl.searchParams.get("param3");

  if (!base?.trim() || !proc?.trim()) {
    return NextResponse.json(
      { error: "base, proc 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  let target: URL;
  try {
    const href = buildR2JsonProcUrl(base, proc, {
      param1: param1 ?? undefined,
      param2: param2 ?? undefined,
      param3: param3 ?? undefined,
    });
    target = new URL(href);
  } catch {
    return NextResponse.json({ error: "잘못된 URL입니다." }, { status: 400 });
  }

  if (!isAllowedR2Target(target)) {
    return NextResponse.json(
      { error: "허용되지 않는 요청입니다." },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json, text/plain, */*" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "업스트림 연결 실패";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const text = await upstream.text();
  const trimmed = text.trimStart();
  const looksJson =
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    (upstream.headers.get("content-type") ?? "").includes("application/json");

  if (looksJson) {
    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    } catch {
      return NextResponse.json(
        { error: "업스트림 JSON을 파싱할 수 없습니다." },
        { status: 502 },
      );
    }
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
    },
  });
}
