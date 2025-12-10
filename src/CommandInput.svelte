<script>
  import { createEventDispatcher } from 'svelte';

  export let currentTable = null;
  export let tableSchema = [];
  export let electronAPI = null;
  export let disabled = false;

  const dispatch = createEventDispatcher();
  let command = '';
  let translating = false;
  let executing = false;

  async function handleSubmit() {
    if (!command.trim() || !currentTable || disabled) return;

    translating = true;
    let sql = '';
    let error = null;

    try {
      // Translate natural language to SQL
      sql = await electronAPI.translateToSQL(command.trim(), currentTable, tableSchema);
    } catch (err) {
      error = err.message || 'Failed to translate command to SQL';
      console.error('Translation error:', err);
    } finally {
      translating = false;
    }

    if (error) {
      dispatch('commandResult', {
        naturalLanguage: command,
        sql: '',
        error,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });
      command = '';
      return;
    }

    // Dispatch to parent to execute SQL
    executing = true;
    dispatch('executeSQL', { sql, naturalLanguage: command });
    executing = false;
    command = '';
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="command-input">
  <div class="input-container">
    <label for="command-input">Natural Language Command:</label>
    <div class="input-wrapper">
      <input
        id="command-input"
        type="text"
        bind:value={command}
        on:keydown={handleKeyPress}
        placeholder="Enter a command in natural language (e.g., 'show all rows', 'count records', 'find rows where column = value')"
        disabled={disabled || !currentTable || translating || executing}
        class="command-field"
      />
      <button
        on:click={handleSubmit}
        disabled={disabled || !currentTable || !command.trim() || translating || executing}
        class="submit-button"
      >
        {#if translating}
          Translating...
        {:else if executing}
          Executing...
        {:else}
          Execute
        {/if}
      </button>
    </div>
    {#if !currentTable}
      <p class="hint">Select a table first to enter commands</p>
    {/if}
    <p class="hint">Press Ctrl+Enter to submit</p>
  </div>
</div>

<style>
  .command-input {
    background: white;
    padding: 16px 24px;
    border-bottom: 1px solid #ddd;
  }

  .input-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }

  .input-wrapper {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .command-field {
    flex: 1;
    padding: 12px 16px;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 6px;
    transition: border-color 0.2s;
  }

  .command-field:focus {
    outline: none;
    border-color: #667eea;
  }

  .command-field:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .submit-button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .submit-button:hover:not(:disabled) {
    background: #5568d3;
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hint {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: #666;
    font-style: italic;
  }
</style>

