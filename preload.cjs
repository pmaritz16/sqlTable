const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
  getDefaultConfigPath: () => ipcRenderer.invoke('get-default-config-path'),
  getDefaultDatabasePath: () => ipcRenderer.invoke('get-default-database-path'),
  createDefaultConfig: (config) => ipcRenderer.invoke('create-default-config', config),
  loadConfig: (path) => ipcRenderer.invoke('load-config', path),
  saveConfig: (path, config) => ipcRenderer.invoke('save-config', path, config),
  selectConfigFile: (options) => ipcRenderer.invoke('select-file', options),
  readCsvFile: (path) => ipcRenderer.invoke('read-csv-file', path),
  readDatabase: (path) => ipcRenderer.invoke('read-database', path),
  writeDatabase: (path, buffer) => ipcRenderer.invoke('write-database', path, buffer),
  readConfigFileRaw: (path) => ipcRenderer.invoke('read-config-file-raw', path),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});

console.log('Preload script loaded, electronAPI exposed');

