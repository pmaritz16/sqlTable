const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

// Listen for LLM status from main process
ipcRenderer.on('llm-status', (event, status) => {
  window.dispatchEvent(new CustomEvent('llm-status', { detail: status }));
});

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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDefaultLogPath: () => ipcRenderer.invoke('get-default-log-path'),
  readLogFile: (path) => ipcRenderer.invoke('read-log-file', path),
  writeLogFile: (path, content) => ipcRenderer.invoke('write-log-file', path, content),
  translateToSQL: (naturalLanguage, tableName, tableSchema) => ipcRenderer.invoke('translate-to-sql', naturalLanguage, tableName, tableSchema),
  testOllamaConnection: () => ipcRenderer.invoke('test-ollama-connection'),
  readLLMLogFile: () => ipcRenderer.invoke('read-llm-log-file'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  writeCsvFile: (filePath, content) => ipcRenderer.invoke('write-csv-file', filePath, content),
  readCommandsFile: () => ipcRenderer.invoke('read-commands-file'),
  insertSqlIntoCommandsFile: (commandText, sql) => ipcRenderer.invoke('insert-sql-into-commands-file', commandText, sql),
  getSqlForCommand: (commandText) => ipcRenderer.invoke('get-sql-for-command', commandText),
  deleteDatabase: (path) => ipcRenderer.invoke('delete-database', path)
});

console.log('Preload script loaded, electronAPI exposed');

