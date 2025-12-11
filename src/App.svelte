<script>
  import { onMount } from 'svelte';
  import ConfigManager from './config.js';
  import DatabaseManager from './database.js';
  import LogManager from './logManager.js';
  import { CSVParser } from './csvParser.js';
  import TableViewer from './TableViewer.svelte';
  import LoadingIndicator from './LoadingIndicator.svelte';
  import ConfigPreview from './ConfigPreview.svelte';
  import TableManager from './TableManager.svelte';
  import LogViewer from './LogViewer.svelte';

  let configManager;
  let dbManager;
  let logManager;
  let currentView = 'loading'; // 'configPreview', 'loading', 'viewer', 'logView'
  let config = null;
  let configPath = null;
  let tables = [];
  let tableToCsvMap = {}; // Map table names to CSV file paths
  let currentTable = null;
  let loadingMessage = '';
  let errorMessage = '';
  let appVersion = '';
  let currentTableSchema = [];
  let llmStatus = null;
  let showLLMStatus = true;

  onMount(async () => {
    // Listen for LLM status from main process
    window.addEventListener('llm-status', (event) => {
      llmStatus = event.detail;
      console.log('LLM Status:', llmStatus);
    });
    
    console.log('App mounted, checking for electronAPI...');
    console.log('window.electronAPI:', window.electronAPI);
    
    // Request LLM status if not received within 1 second (fallback)
    setTimeout(async () => {
      if (!llmStatus && window.electronAPI && window.electronAPI.testOllamaConnection) {
        try {
          const result = await window.electronAPI.testOllamaConnection();
          llmStatus = {
            connected: result.success,
            message: result.success 
              ? `Ollama connected successfully`
              : `Ollama not available: ${result.error || result.message || 'Connection failed'}`,
            host: result.host || 'localhost',
            port: result.port || '11434',
            error: result.error,
            suggestion: result.suggestion
          };
        } catch (error) {
          llmStatus = {
            connected: false,
            message: `Failed to test Ollama connection: ${error.message}`
          };
        }
      }
    }, 1000);
    
    if (window.electronAPI) {
      try {
        // Get app version
        if (window.electronAPI.getAppVersion) {
          appVersion = await window.electronAPI.getAppVersion();
          console.log(`Application version: ${appVersion}`);
        }
        
        configManager = new ConfigManager(window.electronAPI);
        await configManager.initialize();
        dbManager = new DatabaseManager();
        await dbManager.initialize();
        logManager = new LogManager(window.electronAPI);
        await logManager.initialize();
        console.log('Initialization complete');
        
        // Automatically load default config
        await loadDefaultConfig();
      } catch (error) {
        console.error('Initialization error:', error);
        errorMessage = `Initialization error: ${error.message}`;
      }
    } else {
      console.error('Electron API not available');
      errorMessage = 'Electron API not available. Please run this application in Electron.';
    }
  });

  async function loadDefaultConfig() {
    try {
      // First load the database to check for existing tables
      loadingMessage = 'Loading database...';
      configPath = configManager.getDefaultConfigPath();
      config = await configManager.loadConfig(configPath);
      
      if (!config) {
        // Create default config if it doesn't exist
        await configManager.createDefaultConfig();
        config = await configManager.loadConfig(configPath);
      }

      if (!config || !configManager.validateConfig(config)) {
        errorMessage = 'Invalid configuration file';
        return;
      }

      // Load database to check for existing tables
      await dbManager.loadFromFile(config.databasePath, window.electronAPI);
      
      // Get existing tables
      tables = dbManager.getTableNames();
      
      // Show table manager to allow deletion before loading new files
      currentView = 'tableManager';
      loadingMessage = '';
    } catch (error) {
      errorMessage = `Error loading config: ${error.message}`;
      console.error(error);
    }
  }

  async function handleTablesDeleted() {
    // Save database after deletion
    if (dbManager && config) {
      await dbManager.saveToFile(config.databasePath, window.electronAPI);
    }
    // Refresh table list after deletion
    if (dbManager) {
      tables = dbManager.getTableNames();
    }
    // Proceed to load CSV files
    handleProceedToLoad();
  }

  function handleProceedToLoad() {
    // Proceed to loading CSV files
    currentView = 'loading';
    loadCSVFiles();
  }


  async function loadCSVFiles() {
    if (!config || !config.csvFiles || config.csvFiles.length === 0) {
      // No CSV files to load, go to viewer
      tables = dbManager.getTableNames();
      if (tables.length > 0) {
        currentTable = tables[0];
      }
      currentView = 'viewer';
      loadingMessage = '';
      
      // Automatically start executing commands even if no CSV files to load
      if (tables.length > 0) {
        console.log('No CSV files to load, starting automatic command execution...');
        setTimeout(async () => {
          await executeAllCommands();
        }, 200);
      }
      return;
    }

    loadingMessage = 'Checking CSV files...';
    
    // Get existing tables
    const existingTables = new Set(dbManager.getTableNames());
    
    // Clear the mapping for fresh load
    tableToCsvMap = {};

    let filesLoaded = 0;
    let filesSkipped = 0;

    for (let i = 0; i < config.csvFiles.length; i++) {
      const csvPath = config.csvFiles[i];
      
      // Get table name from file path
      const tableName = CSVParser.getTableNameFromPath(csvPath);
      
      // Check if table already exists
      if (existingTables.has(tableName)) {
        console.log(`Table ${tableName} already exists, skipping CSV file ${csvPath}`);
        filesSkipped++;
        // Still add to mapping for display purposes
        tableToCsvMap[tableName] = csvPath;
        continue;
      }
      
      loadingMessage = `Loading ${csvPath}... (${i + 1}/${config.csvFiles.length})`;
      
      try {
        // Read CSV file
        const csvContent = await window.electronAPI.readCsvFile(csvPath);
        
        // Parse CSV
        const { schema, data } = CSVParser.parseCSV(csvContent);
        
        // Store mapping of table name to CSV file path
        tableToCsvMap[tableName] = csvPath;
        
        // Create table
        dbManager.createTable(tableName, schema);
        
        // Insert data
        dbManager.insertData(tableName, schema, data);
        
        filesLoaded++;
        existingTables.add(tableName); // Add to set so we don't try to load it again
        
      } catch (error) {
        console.error(`Error loading CSV file ${csvPath}:`, error);
        errorMessage = `Error loading ${csvPath}: ${error.message}`;
      }
    }

    // Save database
    if (filesLoaded > 0) {
      loadingMessage = 'Saving database...';
      await dbManager.saveToFile(config.databasePath, window.electronAPI);
    }
    
    // Get updated table list
    tables = dbManager.getTableNames();
    
    if (tables.length > 0) {
      currentTable = tables[0];
      updateTableSchema();
    }
    
    // Show summary message if files were skipped
    if (filesSkipped > 0) {
      const summaryMsg = `Loaded ${filesLoaded} file(s), skipped ${filesSkipped} file(s) (tables already exist)`;
      console.log(summaryMsg);
      if (!errorMessage) {
        // Show info message briefly
        setTimeout(() => {
          // Info will be shown in console, not as error
        }, 100);
      }
    }
    
    currentView = 'viewer';
    loadingMessage = '';
    
    // Automatically start executing commands after CSV files are loaded
    // Only if there were no errors during CSV loading
    if (!errorMessage && tables.length > 0) {
      console.log('CSV files loaded successfully, starting automatic command execution...');
      // Wait a moment for the viewer to be ready, then start executing commands
      setTimeout(async () => {
        await executeAllCommands();
      }, 200);
    }
  }

  function handleCancelConfig() {
    currentView = 'startup';
    config = null;
    configPath = null;
  }


  function handleTableSelect(event) {
    // event.detail is { table: tableName }
    const tableName = event.detail?.table;
    if (tableName) {
      currentTable = tableName;
      updateTableSchema();
    }
  }

  function updateTableSchema() {
    if (dbManager && currentTable) {
      currentTableSchema = dbManager.getTableSchema(currentTable);
    } else {
      currentTableSchema = [];
    }
  }

  function handleRefresh() {
    if (dbManager) {
      tables = dbManager.getTableNames();
      if (tables.length > 0 && !tables.includes(currentTable)) {
        currentTable = tables[0];
        updateTableSchema();
      } else if (currentTable) {
        updateTableSchema();
      }
    }
  }

  function toggleView() {
    if (currentView === 'viewer') {
      currentView = 'logView';
    } else if (currentView === 'logView') {
      currentView = 'viewer';
    }
  }

  async function handleCommandResult(event) {
    const result = event.detail;
    if (!logManager) return;

    // Format and append to log
    const logEntry = logManager.formatLogEntry(result);
    const currentLog = await logManager.loadLog();
    const newLog = currentLog + (currentLog ? '\n' : '') + logEntry;
    await logManager.saveLog(newLog);
  }

  async function handleExecuteSQL(event) {
    const { sql, naturalLanguage } = event.detail;
    if (!dbManager || !currentTable) {
      errorMessage = 'No table selected or database not available';
      return;
    }

    let result = null;
    let error = null;

    try {
      result = dbManager.executeSQL(sql);
      // Save database if modified
      if (config && result.type === 'modify') {
        await dbManager.saveToFile(config.databasePath, window.electronAPI);
        // Refresh table data
        handleRefresh();
      }
    } catch (err) {
      error = err.message || 'SQL execution failed';
    }

    // Save to log
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await handleCommandResult({
      detail: {
        naturalLanguage,
        sql,
        error,
        result: result ? (result.type === 'select' ? `Returned ${result.rowCount} row(s)` : `Affected ${result.affectedRows} row(s)`) : null,
        timestamp
      }
    });
  }

  let commands = [];
  let currentCommandIndex = 0; // Global command index, not per table
  let executingCommand = false;
  let commandsError = null;
  let commandsLoaded = false;

  // Load commands when table is selected or viewer is shown
  async function loadCommands() {
    if (!window.electronAPI) {
      commands = [];
      commandsError = 'Electron API not available';
      commandsLoaded = false;
      return;
    }

    try {
      const commandsContent = await window.electronAPI.readCommandsFile();
      const newCommands = commandsContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('[')); // Filter empty lines, comments, and SQL lines
      
      // Don't reset the global index - preserve it across table switches and refreshes
      commands = newCommands;
      commandsError = null;
      commandsLoaded = true;
      
      // Ensure index doesn't exceed command count
      if (currentCommandIndex >= commands.length) {
        currentCommandIndex = commands.length; // Will show "all completed"
      }
      
      if (commands.length === 0) {
        commandsError = 'No commands found in commands.txt (empty file or only comments)';
      }
    } catch (error) {
      console.error('Error loading commands:', error);
      commands = [];
      commandsError = `Error reading commands.txt: ${error.message}`;
      commandsLoaded = false;
      // Don't reset index on error - keep current position
    }
  }

  // Get the next command to execute
  $: nextCommand = currentCommandIndex < commands.length ? commands[currentCommandIndex] : null;
  $: hasMoreCommands = currentCommandIndex < commands.length;
  $: commandProgress = commands.length > 0 ? `${currentCommandIndex + 1} / ${commands.length}` : '0 / 0';

  // Load commands when viewer is shown and table is selected
  $: if (currentView === 'viewer' && currentTable && window.electronAPI && !commandsLoaded) {
    loadCommands();
  }

  async function handleExecuteNextCommand() {
    if (!window.electronAPI || !dbManager || !currentTable) {
      errorMessage = 'Electron API, database, or table not available';
      return false; // Return false to indicate failure/stop
    }

    if (executingCommand || !nextCommand) {
      return false; // Return false if no command to execute
    }

    executingCommand = true;
    errorMessage = '';
    commandsError = null;

    try {
      // Get current table schema
      let tableSchema = dbManager.getTableSchema(currentTable);
      if (!tableSchema || tableSchema.length === 0) {
        errorMessage = 'Unable to get table schema';
        executingCommand = false;
        return false; // Stop on error
      }

      const naturalLanguage = nextCommand;
      console.log(`Processing command ${currentCommandIndex + 1}/${commands.length}: ${naturalLanguage}`);

      // Check if SQL already exists for this command
      let sql = null;
      try {
        const existingSql = await window.electronAPI.getSqlForCommand(naturalLanguage);
        if (existingSql && existingSql.trim() !== '') {
          sql = existingSql.trim();
          console.log(`Using existing SQL for command: ${sql}`);
        }
      } catch (checkError) {
        console.warn('Error checking for existing SQL:', checkError);
        // Continue to translation if check fails
      }

      // Translate to SQL only if not found in file
      if (!sql) {
        try {
          sql = await window.electronAPI.translateToSQL(naturalLanguage, currentTable, tableSchema);
          if (!sql || sql.trim() === '') {
            throw new Error('Empty SQL returned from translation');
          }
          console.log(`Generated new SQL for command: ${sql}`);
        } catch (translateError) {
          const errorMsg = translateError.message;
          console.error(`Error translating command ${currentCommandIndex + 1}:`, errorMsg);
          
          // Log the error
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
          await handleCommandResult({
            detail: {
              naturalLanguage,
              sql: null,
              error: errorMsg,
              result: null,
              timestamp
            }
          });

          errorMessage = `Error translating command ${currentCommandIndex + 1} ("${naturalLanguage}"): ${errorMsg}`;
          executingCommand = false;
          return false; // Stop on error
        }
      }

      // Execute SQL
      let result = null;
      let error = null;
      try {
        result = dbManager.executeSQL(sql);
        // Save database if modified
        if (config && result.type === 'modify') {
          await dbManager.saveToFile(config.databasePath, window.electronAPI);
          // Refresh table data and schema
          handleRefresh();
          updateTableSchema();
        }
      } catch (execError) {
        error = execError.message || 'SQL execution failed';
        console.error(`Error executing command ${currentCommandIndex + 1}:`, error);

        // Log the error
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await handleCommandResult({
          detail: {
            naturalLanguage,
            sql,
            error,
            result: null,
            timestamp
          }
        });

        errorMessage = `Error executing command ${currentCommandIndex + 1} ("${naturalLanguage}"): ${error}`;
        executingCommand = false;
        return false; // Stop on error
      }

      // Log successful execution
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      await handleCommandResult({
        detail: {
          naturalLanguage,
          sql,
          error: null,
          result: result ? (result.type === 'select' ? `Returned ${result.rowCount} row(s)` : `Affected ${result.affectedRows} row(s)`) : null,
          timestamp
        }
      });

      // Insert SQL into commands.txt file after successful execution (only if it wasn't already there)
      try {
        const existingSql = await window.electronAPI.getSqlForCommand(naturalLanguage);
        if (!existingSql || existingSql.trim() === '') {
          // SQL doesn't exist yet, insert it
          await window.electronAPI.insertSqlIntoCommandsFile(naturalLanguage, sql);
          console.log(`SQL inserted into commands.txt after command: ${naturalLanguage}`);
        } else {
          console.log(`SQL already exists for command, skipping insertion`);
        }
        
        // Reload commands to reflect any changes (SQL lines starting with [ will be filtered out)
        await loadCommands();
      } catch (insertError) {
        console.error('Error inserting SQL into commands.txt:', insertError);
        // Don't fail the execution if we can't insert the SQL
      }

      // Move to next command - increment after successful execution
      currentCommandIndex = currentCommandIndex + 1;
      console.log(`Command ${currentCommandIndex}/${commands.length} completed, moving to next`);
      return true; // Return true to indicate success and continue
    } catch (error) {
      console.error('Error executing command:', error);
      errorMessage = `Error executing command: ${error.message}`;
      return false; // Stop on error
    } finally {
      executingCommand = false;
    }
  }

  // Automatically execute all commands until an error occurs or no more commands
  async function executeAllCommands() {
    if (!window.electronAPI || !dbManager || !currentTable) {
      console.log('Cannot execute commands: prerequisites not met');
      return;
    }

    // Wait for commands to be loaded
    if (!commandsLoaded) {
      console.log('Waiting for commands to load...');
      await loadCommands();
    }

    // Wait a bit for reactive statements to update
    await new Promise(resolve => setTimeout(resolve, 100));

    if (commands.length === 0) {
      console.log('No commands to execute');
      return;
    }

    console.log(`Starting automatic execution of ${commands.length} command(s)...`);
    loadingMessage = `Executing commands... (${currentCommandIndex + 1}/${commands.length})`;

    // Execute commands one by one until error or completion
    while (currentCommandIndex < commands.length && !errorMessage) {
      const success = await handleExecuteNextCommand();
      
      if (!success) {
        // Error occurred or no more commands
        console.log('Command execution stopped');
        break;
      }

      // Update loading message
      if (currentCommandIndex < commands.length) {
        loadingMessage = `Executing commands... (${currentCommandIndex + 1}/${commands.length})`;
      } else {
        loadingMessage = `All commands completed (${commands.length}/${commands.length})`;
      }

      // Small delay between commands to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    loadingMessage = '';
    
    if (currentCommandIndex >= commands.length) {
      console.log('All commands executed successfully');
    } else if (errorMessage) {
      console.log(`Command execution stopped due to error: ${errorMessage}`);
    }
  }

  $: if (currentTable && dbManager) {
    updateTableSchema();
  }
</script>

<svelte:window on:beforeunload={() => {
  if (dbManager) {
    dbManager.close();
  }
}} />

<div class="app">
  {#if appVersion}
    <div class="version-banner">
      Version {appVersion}
    </div>
  {/if}
  {#if showLLMStatus && llmStatus}
    <div class="llm-status-banner {llmStatus.connected ? 'connected' : 'disconnected'}">
      <div class="llm-status-content">
        <span class="llm-status-icon">{llmStatus.connected ? '✓' : '✗'}</span>
        <span class="llm-status-message">{llmStatus.message}</span>
        {#if llmStatus.suggestion}
          <span class="llm-status-suggestion">({llmStatus.suggestion})</span>
        {/if}
      </div>
      <button class="llm-status-close" on:click={() => showLLMStatus = false} title="Dismiss">×</button>
    </div>
  {/if}
  {#if errorMessage}
    <div class="error-banner">
      {errorMessage}
      <button on:click={() => errorMessage = ''}>×</button>
    </div>
  {/if}

  {#if currentView === 'tableManager'}
    <TableManager
      {tables}
      {dbManager}
      on:tablesDeleted={handleTablesDeleted}
      on:proceed={handleProceedToLoad}
    />
  {:else if currentView === 'configPreview'}
    <ConfigPreview 
      {config}
      {configPath}
      {configManager}
      on:proceed={handleProceedToLoad}
      on:cancel={handleCancelConfig}
    />
  {:else if currentView === 'loading'}
    <LoadingIndicator message={loadingMessage} />
  {:else if currentView === 'viewer'}
    <div class="viewer-container">
      <div class="view-toggle">
        <button class="toggle-button active">Table View</button>
        <button class="toggle-button" on:click={toggleView}>Log View</button>
      </div>
      {#if currentTable && window.electronAPI}
        <div class="commands-panel">
          {#if commandsError}
            <div class="commands-error">
              {commandsError}
            </div>
          {:else if hasMoreCommands}
            <div class="next-command-display">
              <div class="command-label">Next Command ({commandProgress}):</div>
              <div class="command-text">{nextCommand}</div>
              <button 
                class="execute-next-button" 
                on:click={handleExecuteNextCommand}
                disabled={executingCommand}
                title="Execute this command"
              >
                {executingCommand ? 'Executing...' : 'Execute Next Command'}
              </button>
            </div>
          {:else if commands.length === 0}
            <div class="commands-info">
              No commands loaded. Create a commands.txt file in the application directory.
            </div>
          {:else}
            <div class="commands-complete">
              All commands completed ({commands.length} total)
            </div>
          {/if}
        </div>
      {/if}
      <TableViewer
        {tables}
        {currentTable}
        {dbManager}
        tableToCsvMap={tableToCsvMap}
        electronAPI={window.electronAPI}
        on:tableSelect={handleTableSelect}
        on:refresh={handleRefresh}
      />
    </div>
  {:else if currentView === 'logView'}
    <div class="viewer-container">
      <div class="view-toggle">
        <button class="toggle-button" on:click={toggleView}>Table View</button>
        <button class="toggle-button active">Log View</button>
      </div>
      <LogViewer
        {logManager}
        on:refresh={handleRefresh}
      />
    </div>
  {/if}
</div>

<style>
  .app {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  .error-banner {
    background-color: #fee;
    color: #c33;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #fcc;
  }

  .error-banner button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #c33;
    padding: 0 8px;
  }

  .error-banner button:hover {
    background-color: #fcc;
  }

  .version-banner {
    background-color: #e8f4f8;
    color: #2c5f7c;
    padding: 6px 16px;
    font-size: 12px;
    text-align: right;
    border-bottom: 1px solid #cce4f0;
  }

  .llm-status-banner {
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid;
    font-size: 14px;
    font-weight: 500;
  }

  .llm-status-banner.connected {
    background-color: #d1fae5;
    color: #065f46;
    border-bottom-color: #a7f3d0;
  }

  .llm-status-banner.disconnected {
    background-color: #fee2e2;
    color: #991b1b;
    border-bottom-color: #fecaca;
  }

  .llm-status-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .llm-status-icon {
    font-weight: bold;
    font-size: 16px;
  }

  .llm-status-message {
    flex: 1;
  }

  .llm-status-suggestion {
    font-size: 12px;
    opacity: 0.8;
    font-style: italic;
  }

  .llm-status-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 8px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .llm-status-close:hover {
    opacity: 1;
  }

  .llm-status-banner.connected .llm-status-close {
    color: #065f46;
  }

  .llm-status-banner.disconnected .llm-status-close {
    color: #991b1b;
  }

  .viewer-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .view-toggle {
    display: flex;
    background: white;
    border-bottom: 1px solid #ddd;
    padding: 0;
  }

  .toggle-button {
    flex: 1;
    padding: 12px 24px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-button:hover {
    background: #f5f5f5;
    color: #333;
  }

  .toggle-button.active {
    color: #667eea;
    border-bottom-color: #667eea;
    background: #f0f4ff;
  }

  .commands-panel {
    background: white;
    border-bottom: 1px solid #ddd;
    padding: 16px 24px;
  }

  .commands-error {
    color: #dc2626;
    font-size: 14px;
    padding: 8px;
    background: #fef2f2;
    border-radius: 6px;
    border: 1px solid #fecaca;
  }

  .commands-info {
    color: #666;
    font-size: 14px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 6px;
  }

  .commands-complete {
    color: #059669;
    font-size: 14px;
    padding: 8px;
    background: #d1fae5;
    border-radius: 6px;
    border: 1px solid #a7f3d0;
    font-weight: 600;
  }

  .next-command-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .command-label {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  .command-text {
    font-size: 16px;
    padding: 12px 16px;
    background: #f9fafb;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    color: #111827;
    font-family: 'Courier New', monospace;
    word-break: break-word;
  }

  .execute-next-button {
    align-self: flex-start;
    padding: 10px 20px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .execute-next-button:hover:not(:disabled) {
    background: #059669;
  }

  .execute-next-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #6b7280;
  }
</style>

