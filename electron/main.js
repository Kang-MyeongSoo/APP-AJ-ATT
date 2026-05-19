'use strict';

const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  dialog,
  protocol,
  net,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const {
  proxyR2JsonGet,
  proxyAttEtcDailySave,
  proxyAttImageUpload,
} = require('./asp-proxy');

const NEXT_DEV_PORT = 3000;
/** `localhost` 대신 127.0.0.1: Turbopack/Webpack·IPv6/캐시 꼬임을 줄이기 위함 */
const NEXT_DEV_ORIGIN = `http://127.0.0.1:${NEXT_DEV_PORT}`;

const isDev = !app.isPackaged;

/** file:// 대신 사용 — `/_next/...` 절대 경로·클라이언트 라우팅이 동작함 */
const STATIC_APP_ORIGIN = 'app://local';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/**
 * ELECTRON_TEST_URL 환경변수로 임의의 URL(예: http://192.168.0.18:3000)을 주입해
 * non-localhost HTTP 환경에서도 카메라 권한이 동작하는지 검증할 수 있다.
 */
const DEV_LOAD_URL = process.env.ELECTRON_TEST_URL ?? NEXT_DEV_ORIGIN;

/** 입력 폼 + 카메라 2열에 맞게 넉넉히 */
const WINDOW_WIDTH = 1100;
const WINDOW_HEIGHT = 900;

/** @type {BrowserWindow | null} */
let mainWindow = null;

function getStaticRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app-out');
  }
  return path.join(__dirname, '..', 'out');
}

function shouldUseStaticBundle() {
  if (app.isPackaged) return true;
  if (process.env.ELECTRON_USE_STATIC !== '1') return false;
  return fs.existsSync(path.join(getStaticRoot(), 'index.html'));
}

function resolvePathWithinStaticRoot(urlPathname) {
  const staticRoot = path.resolve(getStaticRoot());
  let pathname = decodeURIComponent(urlPathname);
  if (!pathname || pathname === '/') {
    return path.join(staticRoot, 'index.html');
  }

  const relative = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  let candidate = path.join(staticRoot, relative);

  if (pathname.endsWith('/')) {
    candidate = path.join(candidate, 'index.html');
  } else if (!path.extname(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
    candidate = path.join(candidate, 'index.html');
  }

  const resolved = path.resolve(candidate);
  if (
    resolved !== staticRoot &&
    !resolved.startsWith(staticRoot + path.sep)
  ) {
    throw new Error('Forbidden static path');
  }

  return resolved;
}

function registerStaticAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const { pathname } = new URL(request.url);
      const filePath = resolvePathWithinStaticRoot(pathname);
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Static file error';
      return new Response(message, { status: 500 });
    }
  });
}

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

  ipcMain.handle('asp-r2-json-get', (_event, input) => proxyR2JsonGet(input));
  ipcMain.handle('asp-att-etc-daily-save', (_event, input) =>
    proxyAttEtcDailySave(input),
  );
  ipcMain.handle('asp-att-image-upload', (_event, input) =>
    proxyAttImageUpload(input),
  );
}

async function loadWindowContent() {
  if (!mainWindow) return;

  if (isDev && !shouldUseStaticBundle()) {
    await mainWindow.webContents.session.clearCache();
    await mainWindow.loadURL(DEV_LOAD_URL);
    return;
  }

  const indexHtml = path.join(getStaticRoot(), 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error(
      `정적 UI 번들이 없습니다: ${indexHtml}\n먼저 npm run build 를 실행하세요.`,
    );
  }
  await mainWindow.loadURL(`${STATIC_APP_ORIGIN}/index.html`);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: '일용직 근태관리',
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  await loadWindowContent();

  if (process.env.ELECTRON_DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (shouldUseStaticBundle()) {
    registerStaticAppProtocol();
  }
  setupMediaPermissions();
  setupIpcHandlers();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
