<script>
  import { onMount } from 'svelte';
  import ConfigManager from './config.js';
  import DatabaseManager from './database.js';
  import { CSVParser } from './csvParser.js';
  import TableViewer from './TableViewer.svelte';
  import LoadingIndicator from './LoadingIndicator.svelte';
  import ConfigPreview from './ConfigPreview.svelte';
  import TableManager from './TableManager.svelte';

  let configManager;
  let dbManager;
  let currentView = 'loading'; // 'configPreview', 'loading', 'viewer'
  let config = null;
  let configPath = null;
  let tables = [];
  let tableToCsvMap = {}; // Map table names to CSV file paths
  let currentTable = null;
  let loadingMessage = '';
  let errorMessage = '';

  onMount(async () => {
    console.log('App mounted, checking for electronAPI...');
    console.log('window.electronAPI:', window.electronAPI);
    
    // Listen for LLM status - only display failures
    window.addEventListener('llm-status', (event) => {
      const status = event.detail;
      // Only show error message if connection failed
      if (!status.connected && status.message) {
        errorMessage = `Ollama Connection Failed: ${status.message}`;
      }
    });
    
    if (window.electronAPI) {
      try {
        configManager = new ConfigManager(window.electronAPI);
        await configManager.initialize();
        dbManager = new DatabaseManager();
        await dbManager.initialize();
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
    }
  }

  function handleRefresh() {
    if (dbManager) {
      tables = dbManager.getTableNames();
      if (tables.length > 0 && !tables.includes(currentTable)) {
        currentTable = tables[0];
      }
    }
  }
</script>

<svelte:window on:beforeunload={() => {
  if (dbManager) {
    dbManager.close();
  }
}} />

<div class="app">
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
    <TableViewer
      {tables}
      {currentTable}
      {dbManager}
      tableToCsvMap={tableToCsvMap}
      on:tableSelect={handleTableSelect}
      on:refresh={handleRefresh}
    />
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
</style>

