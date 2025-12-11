import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';

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

// Helper function to clear log files on startup
function clearLogFiles() {
  try {
    const sqlLogPath = join(__dirname, 'sql-command-log.txt');
    const llmLogPath = join(__dirname, 'llm-prompt-log.txt');
    
    // Clear SQL log file
    if (fs.existsSync(sqlLogPath)) {
      fs.writeFileSync(sqlLogPath, '', 'utf8');
      console.log('✓ Cleared SQL command log file');
    } else {
      console.log('SQL command log file does not exist, skipping');
    }
    
    // Clear LLM log file
    if (fs.existsSync(llmLogPath)) {
      fs.writeFileSync(llmLogPath, '', 'utf8');
      console.log('✓ Cleared LLM prompt log file');
    } else {
      console.log('LLM prompt log file does not exist, skipping');
    }
  } catch (error) {
    console.error('Error clearing log files:', error);
    // Don't throw - log clearing failure shouldn't prevent app startup
  }
}

// Helper function to test Ollama connection (defined early for startup use)
async function testOllamaConnection(host, port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: host,
      port: parseInt(port),
      path: '/api/tags',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ success: res.statusCode === 200, statusCode: res.statusCode, body });
      });
    });
    
    req.on('error', (error) => {
      resolve({ success: false, error: error.code, message: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'ETIMEDOUT', message: 'Connection timeout' });
    });
    
    req.end();
  });
}

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

app.whenReady().then(async () => {
  // Clear log files on startup
  console.log('Clearing log files on startup...');
  clearLogFiles();
  
  createWindow();

  // Get Ollama configuration from environment variables or use defaults
  const ollamaHost = process.env.OLLAMA_HOST || 'localhost';
  const ollamaPort = process.env.OLLAMA_PORT || '11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'codellama';
  
  // Display model information prominently
  console.log('');
  console.log('LLM Configuration:');
  console.log(`  Model: ${ollamaModel}`);
  console.log(`  Host: ${ollamaHost}`);
  console.log(`  Port: ${ollamaPort}`);
  console.log('');
  
  console.log('Testing Ollama connection at startup...');
  
  let llmStatus = { connected: false, message: 'Testing connection...', host: ollamaHost, port: ollamaPort, model: ollamaModel };
  
  try {
    // Test connection using environment variables (or defaults)
    let testResult = await testOllamaConnection(ollamaHost, ollamaPort);
    
    if (testResult.success) {
      // Connection test passed, now test with an actual message
      console.log('Connection test passed, testing LLM with a message...');
      try {
        const messageTest = await testLLMWithMessage(ollamaHost, ollamaPort, ollamaModel);
        llmStatus = {
          connected: true,
          message: `Ollama connected and responding (${ollamaHost}:${ollamaPort}, model: ${ollamaModel})`,
          host: ollamaHost,
          port: ollamaPort,
          model: ollamaModel
        };
        console.log(`✓ Ollama LLM test successful on ${ollamaHost}:${ollamaPort}`);
      } catch (messageError) {
        // Connection works but message test failed
        const errorMsg = `Ollama connection OK but message test failed: ${messageError.message}`;
        console.error('✗', errorMsg);
        
        // Show error dialog and halt
        dialog.showErrorBox(
          'Ollama LLM Test Failed',
          `${errorMsg}\n\nPlease ensure:\n1. Ollama is running\n2. Model "${ollamaModel}" is installed (run: ollama pull ${ollamaModel})\n3. Ollama is accessible on ${ollamaHost}:${ollamaPort}\n\nThe application will continue but LLM features may not work.`
        );
        
        llmStatus = {
          connected: false,
          message: errorMsg,
          host: ollamaHost,
          port: ollamaPort,
          model: ollamaModel,
          error: messageError.message
        };
      }
    } else {
      // If configured host failed, try fallback to localhost:11434 (only if env vars weren't set)
      let fallbackHost = null;
      let fallbackPort = null;
      
      if (!process.env.OLLAMA_HOST && !process.env.OLLAMA_PORT) {
        // No env vars set, try localhost and 127.0.0.1 as fallbacks
        if (ollamaHost === 'localhost') {
          fallbackHost = '127.0.0.1';
          fallbackPort = ollamaPort;
        }
      }
      
      if (fallbackHost) {
        console.log(`${ollamaHost}:${ollamaPort} failed, trying fallback ${fallbackHost}:${fallbackPort}...`);
        const testFallback = await testOllamaConnection(fallbackHost, fallbackPort);
        
        if (testFallback.success) {
          // Connection test passed, now test with an actual message
          console.log('Connection test passed on fallback, testing LLM with a message...');
          try {
            const messageTest = await testLLMWithMessage(fallbackHost, fallbackPort, ollamaModel);
            llmStatus = {
              connected: true,
              message: `Ollama connected and responding via ${fallbackHost}:${fallbackPort} (${ollamaHost} failed, model: ${ollamaModel})`,
              host: fallbackHost,
              port: fallbackPort,
              model: ollamaModel,
              suggestion: `Consider setting OLLAMA_HOST=${fallbackHost}`
            };
            console.log(`✓ Ollama LLM test successful on ${fallbackHost}:${fallbackPort}`);
          } catch (messageError) {
            // Connection works but message test failed
            const errorMsg = `Ollama connection OK on ${fallbackHost}:${fallbackPort} but message test failed: ${messageError.message}`;
            console.error('✗', errorMsg);
            
            // Show error dialog
            dialog.showErrorBox(
              'Ollama LLM Test Failed',
              `${errorMsg}\n\nPlease ensure:\n1. Ollama is running\n2. Model "${ollamaModel}" is installed (run: ollama pull ${ollamaModel})\n3. Ollama is accessible on ${fallbackHost}:${fallbackPort}\n\nThe application will continue but LLM features may not work.`
            );
            
            llmStatus = {
              connected: false,
              message: errorMsg,
              host: fallbackHost,
              port: fallbackPort,
              model: ollamaModel,
              error: messageError.message
            };
          }
        } else {
          // Both failed - show error
          const errorMsg = `Ollama not available on ${ollamaHost}:${ollamaPort} or ${fallbackHost}:${fallbackPort}`;
          console.error('✗', errorMsg);
          
          dialog.showErrorBox(
            'Ollama Connection Failed',
            `${errorMsg}\n\nError details: ${testResult.error || testFallback.error || 'Connection refused'}\n\nPlease ensure:\n1. Ollama is installed and running\n2. Start Ollama with: ollama serve\n3. Check that port ${ollamaPort} is not blocked by firewall\n4. If using custom host/port, verify OLLAMA_HOST and OLLAMA_PORT are correct\n\nThe application will continue but LLM features will not work.`
          );
          
          llmStatus = {
            connected: false,
            message: errorMsg,
            host: ollamaHost,
            port: ollamaPort,
            model: ollamaModel,
            error: testResult.error || testFallback.error
          };
        }
      } else {
        // Environment variables were set but connection failed - show error
        const errorMsg = `Ollama not available on ${ollamaHost}:${ollamaPort}`;
        console.error('✗', errorMsg);
        
        dialog.showErrorBox(
          'Ollama Connection Failed',
          `${errorMsg}\n\nError details: ${testResult.error || 'Connection refused'}\n\nPlease ensure:\n1. Ollama is installed and running\n2. Start Ollama with: ollama serve\n3. Check that port ${ollamaPort} is not blocked by firewall\n4. Verify OLLAMA_HOST=${ollamaHost} and OLLAMA_PORT=${ollamaPort} are correct\n\nThe application will continue but LLM features will not work.`
        );
        
        llmStatus = {
          connected: false,
          message: errorMsg,
          host: ollamaHost,
          port: ollamaPort,
          model: ollamaModel,
          error: testResult.error
        };
      }
    }
  } catch (error) {
    const errorMsg = `Ollama connection error: ${error.message}`;
    console.error('✗', errorMsg);
    
    dialog.showErrorBox(
      'Ollama Connection Error',
      `${errorMsg}\n\nThe application will continue but LLM features will not work.`
    );
    
    llmStatus = {
      connected: false,
      message: errorMsg,
      host: ollamaHost,
      port: ollamaPort,
      model: ollamaModel,
      error: error.message
    };
  }
  
  // Send status to renderer when it's ready
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('llm-status', llmStatus);
  });

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

ipcMain.handle('get-default-log-path', () => {
  return join(__dirname, 'sql-command-log.txt');
});

ipcMain.handle('get-default-llm-log-path', () => {
  return join(__dirname, 'llm-prompt-log.txt');
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

ipcMain.handle('save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  
  if (result.canceled) {
    return null;
  }
  return result.filePath;
});

ipcMain.handle('write-csv-file', async (event, filePath, content) => {
  try {
    const fileDir = dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing CSV file:', error);
    throw error;
  }
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

ipcMain.handle('read-log-file', async (event, logPath) => {
  try {
    if (!fs.existsSync(logPath)) {
      return '';
    }
    const content = fs.readFileSync(logPath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading log file:', error);
    throw error;
  }
});

ipcMain.handle('write-log-file', async (event, logPath, content) => {
  try {
    const logDir = dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(logPath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing log file:', error);
    throw error;
  }
});

ipcMain.handle('read-llm-log-file', async (event) => {
  try {
    const llmLogPath = join(__dirname, 'llm-prompt-log.txt');
    if (!fs.existsSync(llmLogPath)) {
      return '';
    }
    const content = fs.readFileSync(llmLogPath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading LLM log file:', error);
    throw error;
  }
});

ipcMain.handle('read-commands-file', async (event) => {
  try {
    const commandsPath = join(__dirname, 'commands.txt');
    if (!fs.existsSync(commandsPath)) {
      throw new Error('commands.txt file not found in application directory');
    }
    const content = fs.readFileSync(commandsPath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading commands file:', error);
    throw error;
  }
});

ipcMain.handle('get-sql-for-command', async (event, commandText) => {
  try {
    const commandsPath = join(__dirname, 'commands.txt');
    if (!fs.existsSync(commandsPath)) {
      return null; // File doesn't exist, no SQL available
    }
    
    const content = fs.readFileSync(commandsPath, 'utf8');
    const lines = content.split('\n');
    
    // Find the line that matches the command text (trimmed)
    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      // Match if the line (ignoring leading/trailing whitespace) matches the command
      // and it's not already a SQL line (starts with [)
      if (trimmedLine === commandText && !trimmedLine.startsWith('[')) {
        // Check if the next line exists and is a SQL line (starts with [ and ends with ])
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('[') && nextLine.endsWith(']')) {
            // Extract SQL from between the brackets
            const sql = nextLine.slice(1, -1); // Remove [ and ]
            return sql;
          }
        }
        // No SQL found for this command
        return null;
      }
    }
    
    // Command not found
    return null;
  } catch (error) {
    console.error('Error getting SQL for command:', error);
    return null; // Return null on error, will trigger translation
  }
});

ipcMain.handle('insert-sql-into-commands-file', async (event, commandText, sql) => {
  try {
    const commandsPath = join(__dirname, 'commands.txt');
    if (!fs.existsSync(commandsPath)) {
      throw new Error('commands.txt file not found in application directory');
    }
    
    let content = fs.readFileSync(commandsPath, 'utf8');
    const lines = content.split('\n');
    
    // Find the line that matches the command text (trimmed, ignoring empty lines and comments)
    let foundIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      // Match if the line (ignoring leading/trailing whitespace) matches the command
      // Also skip if it's already a SQL line (starts with [)
      if (trimmedLine === commandText && !trimmedLine.startsWith('[')) {
        foundIndex = i;
        break;
      }
    }
    
    if (foundIndex === -1) {
      throw new Error(`Command text not found in commands.txt: "${commandText}"`);
    }
    
    // Insert SQL on a new line after the command, wrapped in [ ]
    const sqlLine = `[${sql}]`;
    lines.splice(foundIndex + 1, 0, sqlLine);
    
    // Write back to file
    content = lines.join('\n');
    fs.writeFileSync(commandsPath, content, 'utf8');
    
    return true;
  } catch (error) {
    console.error('Error inserting SQL into commands file:', error);
    throw error;
  }
});

ipcMain.handle('test-ollama-connection', async (event) => {
  // Use environment variables or defaults
  const ollamaHost = process.env.OLLAMA_HOST || 'localhost';
  const ollamaPort = process.env.OLLAMA_PORT || '11434';
  
  console.log(`Testing Ollama connection to ${ollamaHost}:${ollamaPort} (from environment variables or defaults)`);
  
  const result = await testOllamaConnection(ollamaHost, ollamaPort);
  result.host = ollamaHost;
  result.port = ollamaPort;
  
  // Only try fallback if environment variables weren't explicitly set
  if (!result.success && !process.env.OLLAMA_HOST && ollamaHost === 'localhost') {
    console.log('Environment variables not set, trying 127.0.0.1 as fallback...');
    const result127 = await testOllamaConnection('127.0.0.1', ollamaPort);
    if (result127.success) {
      return {
        ...result127,
        host: '127.0.0.1',
        port: ollamaPort,
        suggestion: 'Connection works with 127.0.0.1. Consider setting OLLAMA_HOST=127.0.0.1'
      };
    }
  }
  
  return result;
});

// Helper function to append to LLM log file
async function appendToLLMLog(prompt, response, error = null) {
  try {
    const llmLogPath = join(__dirname, 'llm-prompt-log.txt');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    let logEntry = `[${timestamp}]\n`;
    logEntry += `PROMPT:\n${prompt}\n`;
    
    if (error) {
      logEntry += `ERROR: ${error}\n`;
    } else {
      logEntry += `RESPONSE:\n${response}\n`;
    }
    
    logEntry += '---\n';
    
    // Append to file (create if doesn't exist)
    const logDir = dirname(llmLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Append to file
    fs.appendFileSync(llmLogPath, logEntry, 'utf8');
  } catch (err) {
    console.error('Error writing to LLM log file:', err);
    // Don't throw - logging failure shouldn't break the main functionality
  }
}

// Helper function to test LLM with an actual message
async function testLLMWithMessage(host, port, model) {
  const testPrompt = {
    model: model,
    messages: [
      {
        role: 'user',
        content: 'Say "OK" if you can read this.'
      }
    ],
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 10
    }
  };

  const requestData = JSON.stringify(testPrompt);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: parseInt(port),
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 30000 // 30 seconds for test
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            const response = data.message?.content?.trim() || '';
            if (!response) {
              reject(new Error('Empty response from Ollama - model may not be loaded'));
            } else {
              resolve({ success: true, response });
            }
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}`));
          }
        } else {
          reject(new Error(`Ollama API error: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', (error) => {
      let errorMsg;
      if (error.code === 'ECONNREFUSED') {
        errorMsg = `Connection refused to ${host}:${port}`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMsg = `Connection timeout to ${host}:${port}`;
      } else if (error.code === 'ENOTFOUND') {
        errorMsg = `Host not found: ${host}`;
      } else {
        errorMsg = `Connection error (${error.code}): ${error.message}`;
      }
      reject(new Error(errorMsg));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout - Ollama may be processing slowly or model not loaded'));
    });
    
    req.write(requestData);
    req.end();
  });
}

// Helper function to make Ollama API request
async function makeOllamaRequest(host, port, model, requestData, promptForLog) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: parseInt(port),
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 60000 // 60 seconds for model processing
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            const sql = data.message?.content?.trim() || '';
            if (!sql) {
              throw new Error('Empty response from Ollama');
            }
            // Remove markdown code blocks more aggressively
            let cleanedSql = sql
              // Remove ```sql or ```SQL at the start (with optional newline)
              .replace(/^```\s*sql\s*\n?/i, '')
              // Remove ``` at the start (without language specifier)
              .replace(/^```\s*\n?/, '')
              // Remove ``` at the end (with optional newline)
              .replace(/\n?```\s*$/, '')
              // Remove any remaining backticks at start or end
              .replace(/^`+|`+$/g, '')
              .trim();
            
            // Fallback: If backticks are still present, try to extract content between them
            if (cleanedSql.includes('```') || cleanedSql.startsWith('`')) {
              // Try to extract SQL from between backticks
              const backtickMatch = cleanedSql.match(/```(?:sql)?\s*\n?(.*?)\n?```/is);
              if (backtickMatch && backtickMatch[1]) {
                cleanedSql = backtickMatch[1].trim();
              } else {
                // Remove all backticks as last resort
                cleanedSql = cleanedSql.replace(/`/g, '').trim();
              }
            }
            
            // If still empty after cleaning, use original
            if (!cleanedSql) {
              cleanedSql = sql.trim();
            }
            
            // Final safety check: remove any remaining backticks
            cleanedSql = cleanedSql.replace(/^`+|`+$/g, '').trim();
            
            console.log('Original SQL from LLM:', sql);
            console.log('Cleaned SQL:', cleanedSql);
            
            appendToLLMLog(promptForLog, JSON.stringify(data, null, 2));
            resolve(cleanedSql);
          } catch (e) {
            console.error('Failed to parse Ollama response:', e);
            console.error('Response body:', body);
            const errorMsg = `Failed to parse Ollama response: ${e.message}`;
            appendToLLMLog(promptForLog, body, errorMsg);
            reject(new Error(errorMsg));
          }
        } else {
          const errorMsg = `Ollama API error: ${res.statusCode} ${res.statusMessage}`;
          console.error(errorMsg);
          console.error('Response body:', body);
          appendToLLMLog(promptForLog, body, errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Ollama request error to ${host}:${port}:`, error);
      let errorMsg;
      if (error.code === 'ECONNREFUSED') {
        errorMsg = `Connection refused to ${host}:${port}`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMsg = `Connection timeout to ${host}:${port}`;
      } else if (error.code === 'ENOTFOUND') {
        errorMsg = `Host not found: ${host}`;
      } else {
        errorMsg = `Connection error (${error.code}): ${error.message}`;
      }
      appendToLLMLog(promptForLog, '', errorMsg);
      reject(new Error(errorMsg));
    });
    
    req.on('timeout', () => {
      console.error(`Request timeout to ${host}:${port}`);
      req.destroy();
      const errorMsg = `Request timeout - model may be processing slowly`;
      appendToLLMLog(promptForLog, '', errorMsg);
      reject(new Error('OLLAMA_TIMEOUT'));
    });
    
    req.write(requestData);
    req.end();
  });
}

ipcMain.handle('translate-to-sql', async (event, naturalLanguage, tableName, tableSchema) => {
  // Get Ollama configuration from environment or use defaults
  let ollamaHost = process.env.OLLAMA_HOST || 'localhost';
  const ollamaPort = process.env.OLLAMA_PORT || '11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'codellama';
  
  console.log(`Attempting to connect to Ollama at ${ollamaHost}:${ollamaPort} with model ${ollamaModel}`);
  
  // Build the system prompt
  const systemPrompt = `You are a SQL expert. Convert natural language queries to SQLite SQL. 
Table name: ${tableName}
Schema: ${JSON.stringify(tableSchema)}
IMPORTANT: Return ONLY the raw SQL query. Do NOT use markdown code blocks (no backticks, no \`\`\`sql). 
Return the SQL statement directly without any formatting, explanations, or code block markers.`;

  const fullPrompt = {
    model: ollamaModel,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: naturalLanguage
      }
    ],
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 200
    }
  };

  const requestData = JSON.stringify(fullPrompt);
  const promptForLog = JSON.stringify(fullPrompt, null, 2);

  try {
    // Try using environment variables (or defaults)
    const response = await makeOllamaRequest(ollamaHost, ollamaPort, ollamaModel, requestData, promptForLog);
    console.log(`Successfully received response from Ollama at ${ollamaHost}:${ollamaPort}`);
    return response;
  } catch (error) {
    console.error(`Error with configured host ${ollamaHost}:${ollamaPort}:`, error.message);
    
    // Only try fallback if environment variables weren't explicitly set
    if (!process.env.OLLAMA_HOST && ollamaHost === 'localhost' && error.message.includes('Connection refused')) {
      console.log('Environment variables not set, trying 127.0.0.1 as fallback...');
      try {
        const response = await makeOllamaRequest('127.0.0.1', ollamaPort, ollamaModel, requestData, promptForLog);
        console.log('Successfully connected using 127.0.0.1');
        console.warn('Note: localhost failed but 127.0.0.1 worked. Consider setting OLLAMA_HOST=127.0.0.1');
        return response;
      } catch (error2) {
        console.error('127.0.0.1 also failed:', error2.message);
      }
    }
    
    // Test connection to provide better diagnostics
    const connectionTest = await testOllamaConnection(ollamaHost, ollamaPort);
    console.log('Ollama connection test result:', connectionTest);
    
    // Fall back to pattern matching
    console.log('Falling back to simple pattern matching');
    appendToLLMLog(promptForLog, 'FALLBACK_TO_PATTERN_MATCHING', `${error.message}. Connection test: ${JSON.stringify(connectionTest)}`);
    return translateSimplePattern(naturalLanguage, tableName, tableSchema);
  }
});

function translateSimplePattern(naturalLanguage, tableName, tableSchema) {
  const lower = naturalLanguage.toLowerCase();
  const columns = tableSchema.map(col => col.name).join(', ');
  
  // Simple pattern matching for common queries
  if (lower.includes('show all') || lower.includes('select all') || lower.includes('get all')) {
    return `SELECT * FROM "${tableName}"`;
  }
  
  if (lower.includes('count')) {
    return `SELECT COUNT(*) FROM "${tableName}"`;
  }
  
  if (lower.includes('where')) {
    // Try to extract column and value from "where column = value" pattern
    const whereMatch = lower.match(/where\s+(\w+)\s*=\s*['"]?([^'"]+)['"]?/i);
    if (whereMatch) {
      const [, col, val] = whereMatch;
      return `SELECT * FROM "${tableName}" WHERE "${col}" = '${val}'`;
    }
    return `SELECT * FROM "${tableName}" WHERE 1=1`;
  }
  
  // Default: select all
  return `SELECT * FROM "${tableName}"`;
}

