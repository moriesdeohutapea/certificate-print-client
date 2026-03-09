import './index.css';

const paperSizes = ['A4', 'A5', 'Letter', 'Legal', 'Custom'];
const orientations = ['portrait', 'landscape'];
const fontOptions = [
  '"Helvetica Neue", Arial, sans-serif',
  'Arial, sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Times New Roman", serif',
  '"Trebuchet MS", sans-serif',
  'Verdana, sans-serif',
];
const positionKeys = [
  ['athleteName', 'Athlete name'],
  ['clubName', 'Club name'],
  ['award', 'Award'],
  ['rank', 'Rank'],
  ['finalTime', 'Final time'],
];

const state = {
  settings: null,
  printers: [],
  socket: null,
  reconnectTimer: null,
  connectionStatus: 'disconnected',
  reconnectCount: 0,
  logs: [],
  preview: null,
  isSaving: false,
};

const app = document.querySelector('#app');

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const addLog = (type, message, payload) => {
  state.logs = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      payload,
      createdAt: new Date().toLocaleString(),
    },
    ...state.logs,
  ].slice(0, 50);
  render();
};

const matchesChannel = (message, settings) => {
  const channel = settings.channel?.trim();
  const platform4Mapping = settings.platform4Mapping?.trim();
  if (!channel && !platform4Mapping) {
    return true;
  }

  const candidates = [
    message.channel,
    message.platform,
    message.platform_4,
    message.payload?.channel,
    message.payload?.platform_4,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  if (channel && candidates.includes(channel)) {
    return true;
  }

  if (platform4Mapping && candidates.includes(platform4Mapping)) {
    return true;
  }

  return false;
};

const certificateMarkup = (certificate, settings) => {
  if (!certificate || !settings) {
    return `
      <div class="preview-empty">
        <p>No certificate received yet.</p>
        <span>Incoming PRINT_CERTIFICATE payloads will appear here before silent printing.</span>
      </div>
    `;
  }

  const positions = settings.positions;
  const previewStyle = [
    `font-family:${escapeHtml(settings.fontFamily)}`,
    `color:${escapeHtml(settings.textColor)}`,
  ].join(';');
  const field = (label, value, position) => `
    <div class="preview-field" style="left:${position.x}%;top:${position.y}%;font-size:${position.size}px;">
      <span class="preview-label" style="color:${escapeHtml(settings.labelColor)}">${escapeHtml(label)}</span>
      <span class="preview-value">${escapeHtml(value)}</span>
    </div>
  `;

  return `
    <div class="preview-certificate paper-${(settings.paperSize || 'A4').toLowerCase()} orientation-${escapeHtml(
      settings.orientation || 'landscape',
    )}" style="${previewStyle}">
      <div class="preview-frame"></div>
      <div class="preview-inner-frame"></div>
      <div class="preview-title" style="font-family:${escapeHtml(settings.titleFontFamily)};color:${escapeHtml(settings.titleColor)}">Certificate</div>
      <div class="preview-subtitle" style="color:${escapeHtml(settings.subtitleColor)}">Official result acknowledgment</div>
      ${field('Athlete Name', certificate.athlete_name, positions.athleteName)}
      ${field('Club Name', certificate.club_name, positions.clubName)}
      ${field('Award', certificate.award, positions.award)}
      ${field('Rank', certificate.rank, positions.rank)}
      ${field('Final Time', certificate.final_time, positions.finalTime)}
    </div>
  `;
};

const render = () => {
  if (!state.settings) {
    app.innerHTML = '<main class="loading-shell">Loading certificate print client...</main>';
    return;
  }

  const printerOptions = [
    '<option value="">System default printer</option>',
    ...state.printers.map(
      (printer) => `
        <option value="${escapeHtml(printer.name)}" ${printer.name === state.settings.defaultPrinter ? 'selected' : ''}>
          ${escapeHtml(printer.displayName || printer.name)}${printer.isDefault ? ' (Default)' : ''}
        </option>
      `,
    ),
  ].join('');

  const positionControls = positionKeys
    .map(([key, label]) => {
      const position = state.settings.positions[key];
      return `
        <div class="position-card">
          <h4>${escapeHtml(label)}</h4>
          <label>X (%)
            <input data-setting="position-x" data-key="${key}" type="number" min="0" max="100" step="1" value="${position.x}" />
          </label>
          <label>Y (%)
            <input data-setting="position-y" data-key="${key}" type="number" min="0" max="100" step="1" value="${position.y}" />
          </label>
          <label>Font (px)
            <input data-setting="position-size" data-key="${key}" type="number" min="8" max="72" step="1" value="${position.size}" />
          </label>
        </div>
      `;
    })
    .join('');

  const logsMarkup =
    state.logs.length === 0
      ? '<div class="empty-log">No events captured yet.</div>'
      : state.logs
          .map(
            (entry) => `
              <article class="log-entry log-${entry.type}">
                <header>
                  <strong>${escapeHtml(entry.message)}</strong>
                  <span>${escapeHtml(entry.createdAt)}</span>
                </header>
                <pre>${escapeHtml(entry.payload ? JSON.stringify(entry.payload, null, 2) : '')}</pre>
              </article>
            `,
          )
          .join('');

  app.innerHTML = `
    <main class="shell">
      <section class="hero-card">
        <div>
          <p class="eyebrow">Certificate print client</p>
          <h1>Silent printing for incoming certificate jobs.</h1>
          <p class="hero-copy">The app listens for <code>PRINT_CERTIFICATE</code> WebSocket events, renders a preview, and prints without opening the dialog.</p>
        </div>
        <div class="status-panel">
          <div class="status-pill status-${escapeHtml(state.connectionStatus)}">${escapeHtml(state.connectionStatus)}</div>
          <p>Reconnect attempts: ${state.reconnectCount}</p>
          <button id="connect-button" class="secondary-button">
            ${state.connectionStatus === 'connected' ? 'Reconnect socket' : 'Connect socket'}
          </button>
        </div>
      </section>

      <section class="content-grid">
        <div class="preview-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Live preview</p>
              <h2>Certificate layout</h2>
            </div>
          </div>
          ${certificateMarkup(state.preview, state.settings)}
        </div>

        <div class="settings-panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Settings</p>
              <h2>Transport and print defaults</h2>
            </div>
            <button id="save-settings" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Saving...' : 'Save settings'}</button>
          </div>

          <div class="settings-form">
            <label>WebSocket host
              <input data-setting="websocketHost" type="text" value="${escapeHtml(state.settings.websocketHost)}" placeholder="ws://127.0.0.1:8000/oceantic/v1/ws/platform/4" />
            </label>
            <label>Channel
              <input data-setting="channel" type="text" value="${escapeHtml(state.settings.channel)}" placeholder="platform_4" />
            </label>
            <label>platform_4 mapping
              <input data-setting="platform4Mapping" type="text" value="${escapeHtml(state.settings.platform4Mapping)}" placeholder="platform_4" />
            </label>
            <label>Reconnect delay (ms)
              <input data-setting="reconnectIntervalMs" type="number" min="1000" step="500" value="${state.settings.reconnectIntervalMs}" />
            </label>
            <label>Default printer
              <select data-setting="defaultPrinter">${printerOptions}</select>
            </label>
            <label>Paper size
              <select data-setting="paperSize">
                ${paperSizes
                  .map(
                    (paper) =>
                      `<option value="${escapeHtml(paper)}" ${paper === state.settings.paperSize ? 'selected' : ''}>${escapeHtml(paper)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>Orientation
              <select data-setting="orientation">
                ${orientations
                  .map(
                    (orientation) =>
                      `<option value="${escapeHtml(orientation)}" ${orientation === state.settings.orientation ? 'selected' : ''}>${escapeHtml(orientation)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>Custom width (mm)
              <input data-setting="customPaperWidthMm" type="number" min="50" step="1" value="${state.settings.customPaperWidthMm}" />
            </label>
            <label>Custom height (mm)
              <input data-setting="customPaperHeightMm" type="number" min="50" step="1" value="${state.settings.customPaperHeightMm}" />
            </label>
            <label>Body font
              <select data-setting="fontFamily">
                ${fontOptions
                  .map(
                    (font) =>
                      `<option value="${escapeHtml(font)}" ${font === state.settings.fontFamily ? 'selected' : ''}>${escapeHtml(font)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>Title font
              <select data-setting="titleFontFamily">
                ${fontOptions
                  .map(
                    (font) =>
                      `<option value="${escapeHtml(font)}" ${font === state.settings.titleFontFamily ? 'selected' : ''}>${escapeHtml(font)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label>Text color
              <input data-setting="textColor" type="color" value="${escapeHtml(state.settings.textColor)}" />
            </label>
            <label>Label color
              <input data-setting="labelColor" type="color" value="${escapeHtml(state.settings.labelColor)}" />
            </label>
            <label>Title color
              <input data-setting="titleColor" type="color" value="${escapeHtml(state.settings.titleColor)}" />
            </label>
            <label>Subtitle color
              <input data-setting="subtitleColor" type="color" value="${escapeHtml(state.settings.subtitleColor)}" />
            </label>
          </div>

          <div class="positions-grid">
            ${positionControls}
          </div>
        </div>
      </section>

      <section class="logs-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Logs</p>
            <h2>Payload and print events</h2>
          </div>
        </div>
        <div class="logs-list">${logsMarkup}</div>
      </section>
    </main>
  `;

  bindEvents();
};

const bindEvents = () => {
  document.querySelector('#save-settings')?.addEventListener('click', saveSettings);
  document.querySelector('#connect-button')?.addEventListener('click', connectSocket);

  document.querySelectorAll('[data-setting]').forEach((element) => {
    element.addEventListener('input', (event) => {
      const { setting, key } = event.target.dataset;
      const { value } = event.target;

      if (setting === 'position-x') {
        state.settings.positions[key].x = Number(value);
      } else if (setting === 'position-y') {
        state.settings.positions[key].y = Number(value);
      } else if (setting === 'position-size') {
        state.settings.positions[key].size = Number(value);
      } else if (
        setting === 'reconnectIntervalMs' ||
        setting === 'customPaperWidthMm' ||
        setting === 'customPaperHeightMm'
      ) {
        state.settings[setting] = Number(value);
      } else {
        state.settings[setting] = value;
      }

      if (state.preview) {
        render();
      }
    });
  });
};

const handlePrintMessage = async (message) => {
  if (!matchesChannel(message, state.settings)) {
    addLog('info', 'Message ignored due to channel/platform_4 mapping', message);
    return;
  }

  if (message.type !== 'PRINT_CERTIFICATE') {
    addLog('info', 'Message ignored because type did not match PRINT_CERTIFICATE', message);
    return;
  }

  const certificates = Array.isArray(message.payload?.certificates)
    ? message.payload.certificates
    : [];

  if (certificates.length === 0) {
    addLog('error', 'PRINT_CERTIFICATE received without payload.certificates', message);
    return;
  }

  for (const certificate of certificates) {
    state.preview = certificate;
    render();
    addLog('success', 'Certificate payload received', certificate);
    await window.certificateClient.printCertificate({
      certificate,
      messageMeta: {
        channel: message.channel ?? message.payload?.channel ?? null,
        platform_4: message.platform_4 ?? message.payload?.platform_4 ?? null,
        type: message.type,
      },
    });
  }
};

const scheduleReconnect = () => {
  window.clearTimeout(state.reconnectTimer);
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectCount += 1;
    connectSocket();
  }, Math.max(1000, Number(state.settings.reconnectIntervalMs) || 5000));
};

const connectSocket = () => {
  window.clearTimeout(state.reconnectTimer);

  if (state.socket) {
    state.socket.onopen = null;
    state.socket.onmessage = null;
    state.socket.onerror = null;
    state.socket.onclose = null;
    state.socket.close();
  }

  try {
    state.connectionStatus = 'connecting';
    render();
    state.socket = new WebSocket(state.settings.websocketHost);
  } catch (error) {
    state.connectionStatus = 'error';
    addLog('error', 'WebSocket creation failed', { error: error.message });
    scheduleReconnect();
    render();
    return;
  }

  state.socket.onopen = () => {
    state.connectionStatus = 'connected';
    addLog('success', 'WebSocket connected', { host: state.settings.websocketHost });
    render();
  };

  state.socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      addLog('info', 'WebSocket payload received', message);
      await handlePrintMessage(message);
    } catch (error) {
      addLog('error', 'Failed to parse WebSocket payload', {
        error: error.message,
        raw: event.data,
      });
    }
  };

  state.socket.onerror = () => {
    state.connectionStatus = 'error';
    addLog('error', 'WebSocket transport error', { host: state.settings.websocketHost });
    render();
  };

  state.socket.onclose = (event) => {
    state.connectionStatus = 'disconnected';
    addLog('info', 'WebSocket closed; reconnect scheduled', {
      code: event.code,
      reason: event.reason,
    });
    scheduleReconnect();
    render();
  };
};

const saveSettings = async () => {
  state.isSaving = true;
  render();
  state.settings = await window.certificateClient.saveSettings(state.settings);
  state.printers = await window.certificateClient.listPrinters();
  state.isSaving = false;
  addLog('success', 'Settings saved', state.settings);
  connectSocket();
  render();
};

const bootstrap = async () => {
  state.settings = await window.certificateClient.getSettings();
  state.printers = await window.certificateClient.listPrinters();

  window.certificateClient.onPrintSuccess((payload) => {
    addLog('success', 'Silent print completed', payload);
  });

  window.certificateClient.onPrintError((payload) => {
    addLog('error', 'Silent print failed', payload);
  });

  connectSocket();
  render();
};

bootstrap();
