import { NextRequest, NextResponse } from 'next/server';

const REMOTE_BASE =
  'http://211.56.248.9/CHANGWOO_TEST/Mobile/R2JsonProc_emp_image_update.asp';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '유효한 JSON 본문이 필요합니다.' },
      { status: 400 },
    );
  }

  const base64 =
    typeof body === 'object' &&
    body !== null &&
    'base64' in body &&
    typeof (body as { base64: unknown }).base64 === 'string'
      ? (body as { base64: string }).base64
      : null;

  if (!base64?.length) {
    return NextResponse.json(
      { error: 'param1에 담을 base64 문자열이 필요합니다.' },
      { status: 400 },
    );
  }

  const param1 = `base64${base64}`;

  console.log('[upload-emp-image] base64 길이:', base64.length, '자');
  console.log('[upload-emp-image] param1 앞 80자:', param1.slice(0, 80));
  console.log('[upload-emp-image] param1 길이:', param1.length, '자 → POST body 로 전송');

  let remoteResponse: Response;
  try {
    remoteResponse = await fetch(REMOTE_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ param1 }),
      cache: 'no-store',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '원격 호출 실패';
    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }

  const text = await remoteResponse.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    data = { raw: text };
  }

  return NextResponse.json({
    ok: remoteResponse.ok,
    status: remoteResponse.status,
    data,
  });
}
