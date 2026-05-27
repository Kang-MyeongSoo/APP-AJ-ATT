'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** `npm run electron:dev` 계열에서만 true (ELECTRON_DEV_SESSION=1) */
  isDevSession: process.env.ELECTRON_DEV_SESSION === '1',

  selectSaveDirectory: () => ipcRenderer.invoke('select-save-directory'),

  saveImage: (base64, dirPath, filename) =>
    ipcRenderer.invoke('save-image', { base64, dirPath, filename }),

  proxyR2JsonGet: (input) => ipcRenderer.invoke('asp-r2-json-get', input),

  proxyAttEtcDailySave: (input) =>
    ipcRenderer.invoke('asp-att-etc-daily-save', input),

  proxyAttImageUpload: (input) =>
    ipcRenderer.invoke('asp-att-image-upload', input),
});
