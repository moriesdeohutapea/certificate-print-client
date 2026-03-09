const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const SETTINGS_FILE_NAME = 'settings.json';
const PREVIEW_HTML_FILE_NAME = 'print-preview.html';
const DEFAULT_SETTINGS = {
  websocketHost: 'ws://127.0.0.1:8000/oceantic/v1/ws/platform/4',
  reconnectIntervalMs: 5000,
  channel: '4',
  platform4Mapping: '4',
  defaultPrinter: '',
  paperSize: 'A4',
  orientation: 'landscape',
  customPaperWidthMm: 297,
  customPaperHeightMm: 210,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  titleFontFamily: 'Georgia, "Times New Roman", serif',
  textColor: '#1b1a17',
  labelColor: '#6f6f69',
  titleColor: '#8a6b2f',
  subtitleColor: '#31404f',
  positions: {
    athleteName: { x: 50, y: 42, size: 34 },
    clubName: { x: 50, y: 51, size: 22 },
    award: { x: 50, y: 61, size: 26 },
    rank: { x: 50, y: 70, size: 22 },
    finalTime: { x: 50, y: 79, size: 20 },
  },
};

let mainWindow;
let settingsPath;
let printTemplatePath;
let currentSettings = DEFAULT_SETTINGS;

const clone = (value) => JSON.parse(JSON.stringify(value));

const mergeSettings = (stored = {}) => ({
  ...clone(DEFAULT_SETTINGS),
  ...stored,
  positions: {
    ...clone(DEFAULT_SETTINGS.positions),
    ...(stored.positions || {}),
  },
});

const ensureAssets = () => {
  settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
  printTemplatePath = path.join(app.getPath('userData'), PREVIEW_HTML_FILE_NAME);

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
};

const loadSettings = () => {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    currentSettings = mergeSettings(JSON.parse(raw));
  } catch (error) {
    currentSettings = clone(DEFAULT_SETTINGS);
    fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
  }
  return currentSettings;
};

const saveSettings = (nextSettings) => {
  currentSettings = mergeSettings(nextSettings);
  fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
  return currentSettings;
};

const buildPrintHtml = (certificate, settings) => {
  const positions = settings.positions || DEFAULT_SETTINGS.positions;
  const safe = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const pageSize =
    settings.paperSize === 'Custom'
      ? `${Number(settings.customPaperWidthMm) || 297}mm ${Number(settings.customPaperHeightMm) || 210}mm`
      : `${safe(settings.paperSize || 'A4')} ${safe(settings.orientation || 'landscape')}`;

  const fieldBlock = (className, label, value, position) => `
    <div
      class="${className}"
      style="left:${position.x}%;top:${position.y}%;font-size:${position.size}px;"
    >
      <span class="field-label">${safe(label)}</span>
      <span class="field-value">${safe(value)}</span>
    </div>
  `;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        @page { size: ${pageSize}; margin: 0; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: ${safe(settings.fontFamily)};
          color: ${safe(settings.textColor)};
          background: #ffffff;
        }
        .sheet {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(197, 168, 109, 0.22), transparent 30%),
            radial-gradient(circle at bottom right, rgba(11, 65, 96, 0.12), transparent 24%),
            linear-gradient(145deg, #fffef8, #f6f0da);
        }
        .frame {
          position: absolute;
          inset: 18px;
          border: 10px solid #c5a86d;
        }
        .inner-frame {
          position: absolute;
          inset: 40px;
          border: 2px solid rgba(27, 26, 23, 0.22);
        }
        .title {
          position: absolute;
          left: 50%;
          top: 12%;
          transform: translateX(-50%);
          font-size: 44px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          font-family: ${safe(settings.titleFontFamily)};
          color: ${safe(settings.titleColor)};
        }
        .subtitle {
          position: absolute;
          left: 50%;
          top: 22%;
          transform: translateX(-50%);
          font-size: 16px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${safe(settings.subtitleColor)};
        }
        .field {
          position: absolute;
          width: 100%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
        }
        .field-label {
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${safe(settings.labelColor)};
        }
        .field-value {
          font-weight: 700;
        }
        .footer {
          position: absolute;
          left: 50%;
          bottom: 11%;
          transform: translateX(-50%);
          font-size: 14px;
          letter-spacing: 0.14em;
          color: ${safe(settings.subtitleColor)};
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="frame"></div>
        <div class="inner-frame"></div>
        <div class="title">Certificate</div>
        <div class="subtitle">Official result acknowledgment</div>
        ${fieldBlock('field', 'Athlete Name', certificate.athlete_name, positions.athleteName)}
        ${fieldBlock('field', 'Club Name', certificate.club_name, positions.clubName)}
        ${fieldBlock('field', 'Award', certificate.award, positions.award)}
        ${fieldBlock('field', 'Rank', certificate.rank, positions.rank)}
        ${fieldBlock('field', 'Final Time', certificate.final_time, positions.finalTime)}
        <div class="footer">${safe(settings.channel || 'platform_4')}</div>
      </div>
    </body>
  </html>`;
};

const notifyRenderer = (channel, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(channel, payload);
};

const listPrinters = async () => {
  if (!mainWindow) {
    return [];
  }
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName,
    description: printer.description,
    isDefault: printer.isDefault,
    status: printer.status,
  }));
};

const printCertificate = async (certificate, messageMeta = {}) => {
  const html = buildPrintHtml(certificate, currentSettings);
  fs.writeFileSync(printTemplatePath, html);

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWindow.loadFile(printTemplatePath);

    const printOptions = {
      silent: true,
      printBackground: true,
      deviceName: currentSettings.defaultPrinter || undefined,
    };

    const printResult = await new Promise((resolve, reject) => {
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          reject(new Error(failureReason || 'Silent print failed'));
          return;
        }
        resolve(true);
      });
    });

    notifyRenderer('print:success', {
      certificate,
      messageMeta,
      result: printResult,
      printedAt: new Date().toISOString(),
    });
  } catch (error) {
    notifyRenderer('print:error', {
      certificate,
      messageMeta,
      error: error.message,
      failedAt: new Date().toISOString(),
    });
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  }
};

const createWindow = () => {
  console.log('[main] createWindow start');
  console.log('[main] MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY:', MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY);
  console.log('[main] MAIN_WINDOW_WEBPACK_ENTRY:', MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#f2ece0',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] main window finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[main] main window failed to load', {
      errorCode,
      errorDescription,
    });
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

ipcMain.handle('settings:get', async () => loadSettings());
ipcMain.handle('settings:save', async (_event, nextSettings) => saveSettings(nextSettings));
ipcMain.handle('printers:list', async () => listPrinters());
ipcMain.handle('print:certificate', async (_event, payload) => {
  await printCertificate(payload.certificate, payload.messageMeta);
  return true;
});

app.whenReady().then(() => {
  console.log('[main] app ready');
  ensureAssets();
  loadSettings();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
