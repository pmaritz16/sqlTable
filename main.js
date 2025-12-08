import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const appVersion = packageJson.version;
const appName = packageJson.name;

// Display version at startup
console.log('='.repeat(50));
console.log(`${appName} v${appVersion}`);
console.log('='.repeat(50));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
      webSecurity: true
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools can be opened manually with Ctrl+Shift+I if needed
  } else {
    mainWindow.loadFile(join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Log any errors from the renderer process
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer ${level}]:`, message);
  });

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

// IPC handlers
ipcMain.handle('get-default-config-path', () => {
  return join(__dirname, 'csv-loader-config.json');
});

ipcMain.handle('get-default-database-path', () => {
  return join(__dirname, 'csv-database.sqlite');
});

ipcMain.handle('create-default-config', async (event, defaultConfig) => {
  try {
    const configPath = join(__dirname, 'csv-loader-config.json');
    
    // Check if file already exists - don't overwrite it
    if (fs.existsSync(configPath)) {
      console.log('Config file already exists, skipping creation to preserve existing file');
      return false; // Return false to indicate file was not created
    }
    
    const configDir = dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('Default config file created successfully');
    return true;
  } catch (error) {
    console.error('Error creating default config:', error);
    throw error;
  }
});

ipcMain.handle('load-config', async (event, configPath) => {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading config:', error);
    throw error;
  }
});

ipcMain.handle('read-config-file-raw', async (event, configPath) => {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading config file:', error);
    throw error;
  }
});

ipcMain.handle('save-config', async (event, configPath, config, forceOverwrite = false) => {
  try {
    const defaultConfigPath = join(__dirname, 'csv-loader-config.json');
    const isDefaultConfig = configPath === defaultConfigPath;
    
    // Protect default config file from being overwritten unless explicitly forced
    if (isDefaultConfig && fs.existsSync(configPath) && !forceOverwrite) {
      console.warn('Attempted to overwrite default config file. Use forceOverwrite=true to allow this.');
      throw new Error('Cannot overwrite default config file without explicit permission. Set forceOverwrite=true to proceed.');
    }
    
    const configDir = dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    if (isDefaultConfig) {
      console.log('Default config file saved (overwrite was explicitly allowed)');
    }
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
});

ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: options.title || 'Select File',
    filters: options.filters || []
  });
  
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('read-csv-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    throw error;
  }
});

ipcMain.handle('save-database', async (event, buffer) => {
  try {
    // This will be called with the database path from config
    // For now, we'll handle it in the renderer
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
});

ipcMain.handle('read-database', async (event, dbPath) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return null;
    }
    const buffer = fs.readFileSync(dbPath);
    return Array.from(buffer);
  } catch (error) {
    console.error('Error reading database:', error);
    throw error;
  }
});

ipcMain.handle('write-database', async (event, dbPath, buffer) => {
  try {
    const dbDir = dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(dbPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    throw error;
  }
});

ipcMain.handle('get-app-version', () => {
  return appVersion;
});

