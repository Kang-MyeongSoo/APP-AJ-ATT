export {};

interface SaveImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface ElectronAPI {
  /** 네이티브 폴더 선택 다이얼로그. 취소 시 null 반환 */
  selectSaveDirectory: () => Promise<string | null>;
  /** base64 이미지를 지정 디렉토리에 파일로 저장 */
  saveImage: (
    base64: string,
    dirPath: string,
    filename: string,
  ) => Promise<SaveImageResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
