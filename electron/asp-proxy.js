'use strict';

const SAVE_ASP_NAME = 'R2JsonProc_att_etc_daily_save.asp';
const IMAGE_SEND_ASP_NAME = 'R2JsonProc_image_send.aspx';
const UPLOAD_CHUNK_SIZE = 256 * 1024;

function buildR2JsonProcUrl(serverBaseUrl, proc, params) {
  const base = serverBaseUrl.trim().replace(/\/+$/, '');
  const search = new URLSearchParams({ proc });
  for (const key of ['param1', 'param2', 'param3']) {
    const value = params?.[key];
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  }
  return `${base}/R2JsonProc.asp?${search.toString()}`;
}

function isAllowedR2Target(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.pathname.toLowerCase().endsWith('/r2jsonproc.asp');
}

function isAllowedSaveTarget(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.pathname.toLowerCase().endsWith(`/${SAVE_ASP_NAME.toLowerCase()}`);
}

function isAllowedImageUploadTarget(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.pathname
    .toLowerCase()
    .endsWith(`/${IMAGE_SEND_ASP_NAME.toLowerCase()}`);
}

function buildSaveUrl(serverBaseUrl) {
  const base = serverBaseUrl.trim().replace(/\/+$/, '');
  return `${base}/${SAVE_ASP_NAME}`;
}

function buildImageUploadUrl(serverBaseUrl) {
  const base = serverBaseUrl.trim().replace(/\/+$/, '');
  return `${base}/${IMAGE_SEND_ASP_NAME}`;
}

function parseFlagValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickNonEmptyString(record, key) {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unwrapRecord(parsed) {
  if (Array.isArray(parsed) && parsed.length > 0) {
    return unwrapRecord(parsed[0]);
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  return parsed;
}

function parseImageSendUpstreamResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const record = unwrapRecord(parsed);
  if (!record) return null;

  const flag = parseFlagValue(record.Flag);
  const file_name = pickNonEmptyString(record, 'file_name');
  const file_path = pickNonEmptyString(record, 'file_path');
  if (flag === null || !file_name || !file_path) return null;

  const msg = pickNonEmptyString(record, 'MSG') ?? undefined;
  return { flag, file_name, file_path, msg };
}

function isAttEtcDailySaveBody(value) {
  if (typeof value !== 'object' || value === null) return false;
  const keys = [
    'p_att_date',
    'p_etc_idno',
    'p_att_corp_code',
    'p_etc_name',
    'p_cel_no',
    'p_gender',
    'p_att_dn_flag',
    'p_work_start',
    'p_work_end',
    'p_over_time',
    'p_dinner_yn',
    'p_dpt_work',
    'p_user_id',
  ];
  if (!keys.every((key) => typeof value[key] === 'string')) return false;

  for (const key of ['p_file_name', 'p_file_path']) {
    const field = value[key];
    if (field !== undefined && typeof field !== 'string') return false;
  }
  return true;
}

async function uploadBytesByChunks(endpoint, remoteName, bytes) {
  const totalChunks = Math.max(1, Math.ceil(bytes.length / UPLOAD_CHUNK_SIZE));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, bytes.length);
    const chunk = bytes.subarray(start, end);
    const base64Data = Buffer.from(chunk).toString('base64');
    const isLast = chunkIndex === totalChunks - 1 ? '1' : '0';
    const append = chunkIndex === 0 ? '0' : '1';

    const body = new URLSearchParams({
      name: remoteName,
      data: base64Data,
      append,
      end: isLast,
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body.toString(),
    }).catch(() => null);

    const upstreamBody = res
      ? (await res.text().catch(() => '')).slice(0, 2000)
      : '';

    if (!res?.ok) {
      return {
        success: false,
        status: res?.status ?? null,
        statusText: res?.statusText ?? 'NETWORK_ERROR',
        body: upstreamBody,
        remoteName,
      };
    }

    if (isLast !== '1') continue;

    const parsed = parseImageSendUpstreamResponse(upstreamBody);
    if (!parsed) {
      return {
        success: false,
        status: res.status,
        statusText: res.statusText,
        body: upstreamBody || '이미지 업로드 응답을 해석할 수 없습니다.',
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
    statusText: 'EMPTY_RESPONSE',
    body: '이미지 업로드 응답이 없습니다.',
    remoteName,
  };
}

/**
 * @param {{ base: string, proc: string, param1?: string, param2?: string, param3?: string }} input
 */
async function proxyR2JsonGet(input) {
  const base = typeof input?.base === 'string' ? input.base.trim() : '';
  const proc = typeof input?.proc === 'string' ? input.proc.trim() : '';

  if (!base || !proc) {
    return { ok: false, status: 400, error: 'base, proc 파라미터가 필요합니다.' };
  }

  let target;
  try {
    target = new URL(
      buildR2JsonProcUrl(base, proc, {
        param1: input.param1,
        param2: input.param2,
        param3: input.param3,
      }),
    );
  } catch {
    return { ok: false, status: 400, error: '잘못된 URL입니다.' };
  }

  if (!isAllowedR2Target(target)) {
    return { ok: false, status: 400, error: '허용되지 않는 요청입니다.' };
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      cache: 'no-store',
      headers: { Accept: 'application/json, text/plain, */*' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업스트림 연결 실패';
    return { ok: false, status: 502, error: msg };
  }

  const text = await upstream.text();
  const trimmed = text.trimStart();
  const looksJson =
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    (upstream.headers.get('content-type') ?? '').includes('application/json');

  if (looksJson) {
    try {
      return {
        ok: upstream.ok,
        status: upstream.status,
        data: JSON.parse(text),
      };
    } catch {
      return {
        ok: false,
        status: 502,
        error: '업스트림 JSON을 파싱할 수 없습니다.',
      };
    }
  }

  return { ok: upstream.ok, status: upstream.status, data: { raw: text } };
}

/**
 * @param {{ base: string, payload: unknown }} input
 */
async function proxyAttEtcDailySave(input) {
  const base = typeof input?.base === 'string' ? input.base.trim() : '';
  const payload = input?.payload;

  if (!base) {
    return { ok: false, status: 400, error: 'base(서버 URL)가 필요합니다.' };
  }

  if (!isAttEtcDailySaveBody(payload)) {
    return { ok: false, status: 400, error: 'payload 형식이 올바르지 않습니다.' };
  }

  let target;
  try {
    target = new URL(buildSaveUrl(base));
  } catch {
    return { ok: false, status: 400, error: '잘못된 서버 URL입니다.' };
  }

  if (!isAllowedSaveTarget(target)) {
    return { ok: false, status: 400, error: '허용되지 않는 요청입니다.' };
  }

  const requestBody = Buffer.from(JSON.stringify(payload), 'utf8');

  let remoteResponse;
  try {
    remoteResponse = await fetch(target.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: requestBody,
      cache: 'no-store',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '원격 호출 실패';
    return { ok: false, status: 502, error: message };
  }

  const text = await remoteResponse.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: remoteResponse.ok,
    status: remoteResponse.status,
    data,
  };
}

/**
 * @param {{ base: string, remoteName: string, base64: string }} input
 */
async function proxyAttImageUpload(input) {
  const base = typeof input?.base === 'string' ? input.base.trim() : '';
  const remoteName =
    typeof input?.remoteName === 'string' ? input.remoteName.trim() : '';
  const base64 = typeof input?.base64 === 'string' ? input.base64 : '';

  if (!base) {
    return { ok: false, status: 400, error: 'base(서버 URL)가 필요합니다.' };
  }
  if (!remoteName) {
    return { ok: false, status: 400, error: 'remoteName이 필요합니다.' };
  }
  if (!base64.length) {
    return { ok: false, status: 400, error: 'base64 이미지 데이터가 필요합니다.' };
  }

  let target;
  try {
    target = new URL(buildImageUploadUrl(base));
  } catch {
    return { ok: false, status: 400, error: '잘못된 서버 URL입니다.' };
  }

  if (!isAllowedImageUploadTarget(target)) {
    return { ok: false, status: 400, error: '허용되지 않는 요청입니다.' };
  }

  let bytes;
  try {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  } catch {
    return { ok: false, status: 400, error: 'base64 디코딩에 실패했습니다.' };
  }

  if (!bytes.length) {
    return { ok: false, status: 400, error: 'base64 디코딩에 실패했습니다.' };
  }

  const uploadResult = await uploadBytesByChunks(
    target.toString(),
    remoteName,
    bytes,
  );

  if (!uploadResult.success) {
    return {
      ok: false,
      status: 502,
      error: '이미지 업로드에 실패했습니다.',
      upstream: {
        requestUrl: target.toString(),
        status: uploadResult.status,
        statusText: uploadResult.statusText,
        body: uploadResult.body,
        remoteName: uploadResult.remoteName,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    data: {
      success: true,
      remoteName: uploadResult.remoteName,
      Flag: uploadResult.flag,
      file_name: uploadResult.file_name,
      file_path: uploadResult.file_path,
    },
  };
}

module.exports = {
  proxyR2JsonGet,
  proxyAttEtcDailySave,
  proxyAttImageUpload,
};
