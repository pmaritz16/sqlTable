<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import LogManager from './logManager.js';

  export let logManager = null;

  const dispatch = createEventDispatcher();
  let logContent = '';
  let logEntries = [];
  let errorMessage = '';

  $: if (logManager) {
    loadLog();
  }

  async function loadLog() {
    if (!logManager) return;
    try {
      logContent = await logManager.loadLog();
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
</script>

<div class="log-viewer">
  <header class="log-header">
    <h2>SQL Command Log</h2>
    <div class="header-actions">
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
    <div class="log-display">
      {#if logEntries.length === 0}
        <div class="empty-message">No log entries yet. Execute some commands to see them here.</div>
      {:else}
        {#each logEntries as entry, index (index)}
          <div 
            class="log-entry {entry.error ? 'has-error' : ''}"
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
    transition: all 0.2s;
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

