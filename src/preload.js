const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('certificateClient', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  printCertificate: (payload) => ipcRenderer.invoke('print:certificate', payload),
  onPrintSuccess: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('print:success', listener);
    return () => ipcRenderer.removeListener('print:success', listener);
  },
  onPrintError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('print:error', listener);
    return () => ipcRenderer.removeListener('print:error', listener);
  },
});
