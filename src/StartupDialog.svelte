<script>
  import { createEventDispatcher } from 'svelte';

  export let configManager;

  const dispatch = createEventDispatcher();
  let customConfigPath = '';
  let loading = false;
  let showPreview = false; // Default to skipping preview

  async function handleUseDefault() {
    loading = true;
    try {
      const defaultPath = configManager.getDefaultConfigPath();
      dispatch('configSelected', { path: defaultPath, useDefault: true, showPreview });
    } catch (error) {
      console.error('Error using default config:', error);
    } finally {
      loading = false;
    }
  }

  async function handleSelectCustom() {
    loading = true;
    try {
      const selectedPath = await configManager.selectConfigFile();
      if (selectedPath) {
        dispatch('configSelected', { path: selectedPath, useDefault: false, showPreview });
      }
    } catch (error) {
      console.error('Error selecting config file:', error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="startup-dialog">
  <div class="dialog-content">
    <h1>CSV to SQL Loader</h1>
    <p class="subtitle">Select a configuration file to begin</p>
    
    <div class="options">
      <button 
        class="option-button primary" 
        on:click={handleUseDefault}
        disabled={loading}
      >
        Use Default Config
      </button>
      
      <div class="divider">
        <span>OR</span>
      </div>
      
      <button 
        class="option-button secondary" 
        on:click={handleSelectCustom}
        disabled={loading}
      >
        Select Custom Config File
      </button>
    </div>

    <div class="checkbox-container">
      <label class="checkbox-label">
        <input 
          type="checkbox" 
          bind:checked={showPreview}
          disabled={loading}
        />
        <span>Show config preview before loading</span>
      </label>
    </div>

    {#if loading}
      <div class="loading">Loading...</div>
    {/if}

    <div class="info">
      <p><strong>Default config location:</strong></p>
      <code>{configManager?.getDefaultConfigPath() || '...'}</code>
      <p class="help-text">
        The default config file will be created automatically if it doesn't exist.
      </p>
    </div>
  </div>
</div>

<style>
  .startup-dialog {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .dialog-content {
    background: white;
    border-radius: 12px;
    padding: 48px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
  }

  h1 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 32px;
    text-align: center;
  }

  .subtitle {
    text-align: center;
    color: #666;
    margin: 0 0 32px 0;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
  }

  .option-button {
    padding: 16px 24px;
    font-size: 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .option-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-button.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .option-button.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .option-button.secondary {
    background: #f5f5f5;
    color: #333;
    border: 2px solid #ddd;
  }

  .option-button.secondary:hover:not(:disabled) {
    background: #e8e8e8;
    border-color: #bbb;
  }

  .divider {
    text-align: center;
    position: relative;
    margin: 8px 0;
  }

  .divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #ddd;
  }

  .divider span {
    background: white;
    padding: 0 16px;
    color: #999;
    position: relative;
  }

  .loading {
    text-align: center;
    color: #666;
    margin: 16px 0;
  }

  .info {
    margin-top: 32px;
    padding-top: 32px;
    border-top: 1px solid #eee;
  }

  .info p {
    margin: 8px 0;
    color: #666;
    font-size: 14px;
  }

  .info code {
    display: block;
    background: #f5f5f5;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    word-break: break-all;
    margin: 8px 0;
  }

  .help-text {
    font-size: 12px;
    color: #999;
    font-style: italic;
  }

  .checkbox-container {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #eee;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #667eea;
  }

  .checkbox-label:has(input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>







