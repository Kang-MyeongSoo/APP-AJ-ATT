'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** 저장할 디렉토리를 네이티브 다이얼로그로 선택. 취소 시 null 반환 */
  selectSaveDirectory: () => ipcRenderer.invoke('select-save-directory'),

  /** base64 이미지를 지정 경로에 파일로 저장 */
  saveImage: (base64, dirPath, filename) =>
    ipcRenderer.invoke('save-image', { base64, dirPath, filename }),
});
