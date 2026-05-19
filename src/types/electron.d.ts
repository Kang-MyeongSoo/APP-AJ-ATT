import type { AspProxyResult } from "@/lib/asp-remote-client";

export {};

interface SaveImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface ElectronAPI {
  selectSaveDirectory: () => Promise<string | null>;
  saveImage: (
    base64: string,
    dirPath: string,
    filename: string,
  ) => Promise<SaveImageResult>;
  proxyR2JsonGet: (input: {
    base: string;
    proc: string;
    param1?: string;
    param2?: string;
    param3?: string;
  }) => Promise<AspProxyResult<unknown>>;
  proxyAttEtcDailySave: (input: {
    base: string;
    payload: unknown;
  }) => Promise<AspProxyResult<unknown>>;
  proxyAttImageUpload: (input: {
    base: string;
    remoteName: string;
    base64: string;
  }) => Promise<
    AspProxyResult<{
      success: boolean;
      remoteName: string;
      Flag: number;
      file_name: string;
      file_path: string;
    }>
  >;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
