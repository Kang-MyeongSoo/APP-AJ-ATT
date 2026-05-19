'use strict';

const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const NEXT_DEV_PORT = 3000;
const NEXT_PROD_PORT = 3001;
/** `localhost` 대신 127.0.0.1: Turbopack/Webpack·IPv6/캐시 꼬임을 줄이기 위함 */
const NEXT_DEV_ORIGIN = `http://127.0.0.1:${NEXT_DEV_PORT}`;

const isDev = !app.isPackaged;

/**
 * ELECTRON_TEST_URL 환경변수로 임의의 URL(예: http://192.168.0.18:3000)을 주입해
 * non-localhost HTTP 환경에서도 카메라 권한이 동작하는지 검증할 수 있다.
 */
const NEXT_URL =
  process.env.ELECTRON_TEST_URL ??
  (isDev
    ? NEXT_DEV_ORIGIN
    : `http://127.0.0.1:${NEXT_PROD_PORT}`);

/** 입력 폼 + 카메라 2열에 맞게 넉넉히 */
const WINDOW_WIDTH = 1100;
const WINDOW_HEIGHT = 900;

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {import('child_process').ChildProcess | null} */
let nextServerProcess = null;

/**
 * 카메라/마이크 등 미디어 권한을 HTTPS 없이도 허용하도록 설정.
 * Electron은 로컬 컨텍스트에서 실행되므로 퍼미션을 명시적으로 허용해야 한다.
 */
function setupMediaPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const ALLOWED = ['media', 'camera', 'microphone', 'display-capture'];
      callback(ALLOWED.includes(permission));
    },
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      const ALLOWED = ['media', 'camera', 'microphone', 'display-capture'];
      return ALLOWED.includes(permission);
    },
  );
}

/**
 * 저장 디렉토리 선택 다이얼로그를 열고 선택된 경로를 반환.
 * 취소 시 null 반환.
 */
function setupIpcHandlers() {
  ipcMain.handle('select-save-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '이미지 저장 폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('save-image', (_event, { base64, dirPath, filename }) => {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const buffer = Buffer.from(base64, 'base64');
      const filePath = path.join(dirPath, filename);
      fs.writeFileSync(filePath, buffer);

      return { success: true, filePath };
    } catch (e) {
      const message = e instanceof Error ? e.message : '파일 저장 실패';
      return { success: false, error: message };
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    // Windows·Linux: 창 내메뉴(File/Edit/…)를 기본숨김(Alt 누르면 임시 표시)
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    await mainWindow.webContents.session.clearCache();
  }
  await mainWindow.loadURL(NEXT_URL);

  if (process.env.ELECTRON_DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * production 빌드 시 extraResources로 복사된 Next.js standalone 서버를 기동.
 *
 * require(serverScript) 대신 child_process.spawn을 사용하는 이유:
 * require()는 ASAR 컨텍스트에서 모듈을 해석하므로 standalone/node_modules/next를
 * 찾지 못한다. 독립 프로세스로 실행하면 cwd 기준으로 모듈을 올바르게 해석한다.
 */
function startProductionServer() {
  const standaloneDir = path.join(process.resourcesPath, 'standalone');
  const serverScript = path.join(standaloneDir, 'server.js');

  nextServerProcess = spawn(process.execPath, [serverScript], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(NEXT_PROD_PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  });

  nextServerProcess.stdout?.on('data', (d) =>
    console.log('[next-server]', d.toString().trim()),
  );
  nextServerProcess.stderr?.on('data', (d) =>
    console.error('[next-server]', d.toString().trim()),
  );
  nextServerProcess.on('error', (err) =>
    console.error('[next-server] 기동 실패:', err),
  );

  return new Promise((resolve) => setTimeout(resolve, 2500));
}

app.whenReady().then(async () => {
  setupMediaPermissions();
  setupIpcHandlers();

  if (!isDev) {
    await startProductionServer();
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
