<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let config = null;
  export let configPath = '';
  export let configManager = null;

  const dispatch = createEventDispatcher();
  let rawConfigContent = '';

  onMount(async () => {
    if (configManager && configPath) {
      try {
        rawConfigContent = await configManager.readConfigFileRaw(configPath) || '';
      } catch (error) {
        console.error('Error reading raw config:', error);
        rawConfigContent = JSON.stringify(config, null, 2);
      }
    } else {
      rawConfigContent = JSON.stringify(config, null, 2);
    }
  });

  function handleProceed() {
    dispatch('proceed');
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="config-preview">
  <div class="preview-content">
    <h2>Configuration File Preview</h2>
    <p class="config-path">File: <code>{configPath}</code></p>
    
    <div class="config-display">
      <h3>Database Path:</h3>
      <div class="config-value">
        <code>{config?.databasePath || 'Not specified'}</code>
      </div>

      <h3>CSV Files ({config?.csvFiles?.length || 0}):</h3>
      <div class="csv-files-list">
        {#if config?.csvFiles && config.csvFiles.length > 0}
          <ul>
            {#each config.csvFiles as csvFile}
              <li><code>{csvFile}</code></li>
            {/each}
          </ul>
        {:else}
          <p class="no-files">No CSV files specified</p>
        {/if}
      </div>

      <div class="raw-json">
        <h3>Raw File Content:</h3>
        <pre>{rawConfigContent || JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>

    <div class="actions">
      <button class="button secondary" on:click={handleCancel}>
        Cancel
      </button>
      <button class="button primary" on:click={handleProceed}>
        Proceed with Loading
      </button>
    </div>
  </div>
</div>

<style>
  .config-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .preview-content {
    background: white;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 28px;
  }

  .config-path {
    margin: 0 0 24px 0;
    color: #666;
    font-size: 14px;
  }

  .config-path code {
    background: #f5f5f5;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    word-break: break-all;
  }

  .config-display {
    margin-bottom: 24px;
  }

  .config-display h3 {
    margin: 20px 0 8px 0;
    color: #333;
    font-size: 16px;
    font-weight: 600;
  }

  .config-display h3:first-child {
    margin-top: 0;
  }

  .config-value {
    margin-bottom: 16px;
  }

  .config-value code {
    display: block;
    background: #f5f5f5;
    padding: 12px;
    border-radius: 6px;
    font-size: 13px;
    word-break: break-all;
    border-left: 3px solid #667eea;
  }

  .csv-files-list {
    margin-bottom: 16px;
  }

  .csv-files-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .csv-files-list li {
    background: #f5f5f5;
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: 6px;
    border-left: 3px solid #667eea;
  }

  .csv-files-list li code {
    font-size: 12px;
    word-break: break-all;
  }

  .no-files {
    color: #999;
    font-style: italic;
    margin: 8px 0;
  }

  .raw-json {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #eee;
  }

  .raw-json h3 {
    margin-top: 0;
  }

  .raw-json pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
    border: 1px solid #ddd;
    max-height: 300px;
    overflow-y: auto;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #eee;
  }

  .button {
    padding: 12px 24px;
    font-size: 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .button.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .button.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .button.secondary {
    background: #f5f5f5;
    color: #333;
    border: 2px solid #ddd;
  }

  .button.secondary:hover {
    background: #e8e8e8;
    border-color: #bbb;
  }
</style>

