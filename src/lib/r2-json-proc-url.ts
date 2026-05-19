export type R2JsonProcParams = {
  param1?: string;
  param2?: string;
  param3?: string;
};

/**
 * localStorage `serverBaseUrl` 값은 `/Mobile` 까지 포함한 Base URL이어야 함.
 */
export function buildR2JsonProcUrl(
  serverBaseUrl: string,
  proc: string,
  params?: R2JsonProcParams,
): string {
  const base = serverBaseUrl.trim().replace(/\/+$/, "");
  const search = new URLSearchParams({ proc });
  for (const key of ["param1", "param2", "param3"] as const) {
    const value = params?.[key];
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  return `${base}/R2JsonProc.asp?${search.toString()}`;
}
