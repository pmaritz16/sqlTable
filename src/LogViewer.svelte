<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import LogManager from './logManager.js';

  export let logManager = null;
  export let dbManager = null;
  export let currentTable = null;
  export let electronAPI = null;

  const dispatch = createEventDispatcher();
  let logContent = '';
  let isEditing = false;
  let editedContent = '';
  let logEntries = [];
  let selectedEntryIndex = null;
  let executing = false;
  let errorMessage = '';

  $: if (logManager) {
    loadLog();
  }

  async function loadLog() {
    if (!logManager) return;
    try {
      logContent = await logManager.loadLog();
      editedContent = logContent;
      parseLogEntries();
    } catch (error) {
      console.error('Error loading log:', error);
      errorMessage = `Error loading log: ${error.message}`;
    }
  }

  function parseLogEntries() {
    if (!logManager) return;
    logEntries = logManager.parseLogEntries(logContent);
  }

  function startEditing() {
    isEditing = true;
    editedContent = logContent;
  }

  function cancelEditing() {
    isEditing = false;
    editedContent = logContent;
    errorMessage = '';
  }

  async function saveLog() {
    if (!logManager) return;
    try {
      await logManager.saveLog(editedContent);
      logContent = editedContent;
      parseLogEntries();
      isEditing = false;
      errorMessage = '';
    } catch (error) {
      console.error('Error saving log:', error);
      errorMessage = `Error saving log: ${error.message}`;
    }
  }

  function selectEntry(index) {
    selectedEntryIndex = index;
  }

  async function executeFromSelected() {
    if (selectedEntryIndex === null || !dbManager || !currentTable) {
      errorMessage = 'Please select an entry and ensure a table is selected';
      return;
    }

    executing = true;
    errorMessage = '';
    const entriesToExecute = logEntries.slice(selectedEntryIndex);
    const updatedEntries = [];

    for (let i = 0; i < entriesToExecute.length; i++) {
      const entry = entriesToExecute[i];
      if (!entry.sql || entry.sql.trim() === '') {
        updatedEntries.push(entry);
        continue;
      }

      const updatedEntry = { ...entry };
      try {
        const result = dbManager.executeSQL(entry.sql);
        
        // Update log entry with result
        updatedEntry.result = result.type === 'select' 
          ? `Returned ${result.rowCount} row(s)`
          : `Affected ${result.affectedRows} row(s)`;
        updatedEntry.error = null;
      } catch (error) {
        updatedEntry.error = error.message;
        updatedEntry.result = null;
        errorMessage += `Error executing entry ${selectedEntryIndex + i + 1}: ${error.message}\n`;
      }
      updatedEntries.push(updatedEntry);
    }

    // Rebuild log content with updated entries
    const beforeEntries = logEntries.slice(0, selectedEntryIndex);
    const allEntries = [...beforeEntries, ...updatedEntries];
    const newLogContent = allEntries.map(entry => logManager.formatLogEntry(entry)).join('\n');
    
    // Save updated log
    if (logManager) {
      logContent = newLogContent;
      editedContent = newLogContent;
      await logManager.saveLog(newLogContent);
      parseLogEntries();
    }

    executing = false;
    dispatch('refresh');
  }
</script>

<div class="log-viewer">
  <header class="log-header">
    <h2>SQL Command Log</h2>
    <div class="header-actions">
      {#if isEditing}
        <button class="button save" on:click={saveLog}>Save</button>
        <button class="button cancel" on:click={cancelEditing}>Cancel</button>
      {:else}
        <button class="button edit" on:click={startEditing}>Edit</button>
        <button 
          class="button execute" 
          on:click={executeFromSelected}
          disabled={selectedEntryIndex === null || !currentTable || executing}
        >
          {executing ? 'Executing...' : 'Execute from Selected'}
        </button>
      {/if}
      <button class="button refresh" on:click={loadLog}>Refresh</button>
    </div>
  </header>

  {#if errorMessage}
    <div class="error-banner">
      <pre>{errorMessage}</pre>
      <button on:click={() => errorMessage = ''}>×</button>
    </div>
  {/if}

  <div class="log-content">
    {#if isEditing}
      <textarea
        bind:value={editedContent}
        class="log-editor"
        placeholder="Log file content..."
      ></textarea>
    {:else}
      <div class="log-display">
        {#if logEntries.length === 0}
          <div class="empty-message">No log entries yet. Execute some commands to see them here.</div>
        {:else}
          {#each logEntries as entry, index (index)}
            <div 
              class="log-entry {selectedEntryIndex === index ? 'selected' : ''} {entry.error ? 'has-error' : ''}"
              on:click={() => selectEntry(index)}
            >
              <div class="entry-header">
                <span class="timestamp">[{entry.timestamp}]</span>
                {#if entry.error}
                  <span class="error-badge">ERROR</span>
                {/if}
              </div>
              {#if entry.naturalLanguage}
                <div class="entry-line">
                  <strong>NL:</strong> {entry.naturalLanguage}
                </div>
              {/if}
              {#if entry.sql}
                <div class="entry-line">
                  <strong>SQL:</strong> <code>{entry.sql}</code>
                </div>
              {/if}
              {#if entry.error}
                <div class="entry-line error">
                  <strong>ERROR:</strong> {entry.error}
                </div>
              {/if}
              {#if entry.result}
                <div class="entry-line result">
                  <strong>RESULT:</strong> {entry.result}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .log-viewer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f5f5f5;
  }

  .log-header {
    background: white;
    padding: 16px 24px;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  h2 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .button.edit {
    background: #667eea;
    color: white;
  }

  .button.edit:hover {
    background: #5568d3;
  }

  .button.save {
    background: #10b981;
    color: white;
  }

  .button.save:hover {
    background: #059669;
  }

  .button.cancel {
    background: #ef4444;
    color: white;
  }

  .button.cancel:hover {
    background: #dc2626;
  }

  .button.execute {
    background: #f59e0b;
    color: white;
  }

  .button.execute:hover:not(:disabled) {
    background: #d97706;
  }

  .button.execute:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button.refresh {
    background: #6b7280;
    color: white;
  }

  .button.refresh:hover {
    background: #4b5563;
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

  .error-banner pre {
    margin: 0;
    white-space: pre-wrap;
  }

  .error-banner button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #c33;
    padding: 0 8px;
  }

  .log-content {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .log-editor {
    width: 100%;
    height: 100%;
    min-height: 500px;
    padding: 16px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    border: 2px solid #ddd;
    border-radius: 6px;
    resize: vertical;
  }

  .log-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .log-entry {
    background: white;
    padding: 16px;
    border-radius: 6px;
    border: 2px solid #e5e7eb;
    cursor: pointer;
    transition: all 0.2s;
  }

  .log-entry:hover {
    border-color: #667eea;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
  }

  .log-entry.selected {
    border-color: #667eea;
    background: #f0f4ff;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  }

  .log-entry.has-error {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .timestamp {
    font-weight: 600;
    color: #666;
    font-size: 13px;
  }

  .error-badge {
    background: #ef4444;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .entry-line {
    margin: 8px 0;
    font-size: 14px;
    line-height: 1.6;
  }

  .entry-line strong {
    color: #333;
    margin-right: 8px;
  }

  .entry-line code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #667eea;
  }

  .entry-line.error {
    color: #dc2626;
  }

  .entry-line.result {
    color: #059669;
  }

  .empty-message {
    text-align: center;
    padding: 48px;
    color: #999;
    font-size: 18px;
  }
</style>

