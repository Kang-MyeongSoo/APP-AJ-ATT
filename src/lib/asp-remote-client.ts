export type AspProxyError = {
  ok: false;
  status: number;
  error: string;
  upstream?: unknown;
};

export type AspProxySuccess<T> = {
  ok: true;
  status: number;
  data: T;
};

export type AspProxyResult<T> = AspProxySuccess<T> | AspProxyError;

export function isAspProxyError<T>(
  result: AspProxyResult<T>,
): result is AspProxyError {
  return result.ok === false;
}

function getElectronApi() {
  if (typeof window === "undefined" || !window.electronAPI) {
    return null;
  }
  return window.electronAPI;
}

export function assertElectronAspClient(): void {
  if (!getElectronApi()?.proxyR2JsonGet) {
    throw new Error(
      "Electron 앱에서만 ASP 서버에 연결할 수 있습니다. npm run electron:dev 로 실행해 주세요.",
    );
  }
}

export async function proxyR2JsonGet(input: {
  base: string;
  proc: string;
  param1?: string;
  param2?: string;
  param3?: string;
}): Promise<AspProxyResult<unknown>> {
  const api = getElectronApi();
  if (!api?.proxyR2JsonGet) {
    return {
      ok: false,
      status: 0,
      error:
        "Electron 앱에서만 ASP 서버에 연결할 수 있습니다. npm run electron:dev 로 실행해 주세요.",
    };
  }
  return api.proxyR2JsonGet(input);
}

export async function proxyAttEtcDailySave(input: {
  base: string;
  payload: unknown;
}): Promise<AspProxyResult<unknown>> {
  const api = getElectronApi();
  if (!api?.proxyAttEtcDailySave) {
    return {
      ok: false,
      status: 0,
      error:
        "Electron 앱에서만 ASP 서버에 연결할 수 있습니다. npm run electron:dev 로 실행해 주세요.",
    };
  }
  return api.proxyAttEtcDailySave(input);
}

export async function proxyAttImageUpload(input: {
  base: string;
  remoteName: string;
  base64: string;
}): Promise<
  AspProxyResult<{
    success: boolean;
    remoteName: string;
    Flag: number;
    file_name: string;
    file_path: string;
  }>
> {
  const api = getElectronApi();
  if (!api?.proxyAttImageUpload) {
    return {
      ok: false,
      status: 0,
      error:
        "Electron 앱에서만 ASP 서버에 연결할 수 있습니다. npm run electron:dev 로 실행해 주세요.",
    };
  }
  return api.proxyAttImageUpload(input);
}
