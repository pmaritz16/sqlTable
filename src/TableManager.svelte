<script>
  import { createEventDispatcher } from 'svelte';

  export let tables = [];
  export let dbManager = null;

  const dispatch = createEventDispatcher();
  let deleting = false;
  let tablesToDelete = new Set();

  function toggleTableDelete(tableName) {
    if (tablesToDelete.has(tableName)) {
      tablesToDelete.delete(tableName);
    } else {
      tablesToDelete.add(tableName);
    }
    tablesToDelete = tablesToDelete; // Trigger reactivity
  }

  function selectAll() {
    if (tablesToDelete.size === tables.length) {
      tablesToDelete.clear();
    } else {
      tablesToDelete = new Set(tables);
    }
    tablesToDelete = tablesToDelete; // Trigger reactivity
  }

  async function handleDelete() {
    if (tablesToDelete.size === 0) {
      dispatch('proceed');
      return;
    }

    deleting = true;
    try {
      for (const tableName of tablesToDelete) {
        if (dbManager && dbManager.db) {
          dbManager.db.run(`DROP TABLE IF EXISTS "${tableName}"`);
        }
      }
      // Note: Database will be saved when CSV files are loaded
      dispatch('tablesDeleted');
    } catch (error) {
      console.error('Error deleting tables:', error);
    } finally {
      deleting = false;
    }
  }

  function handleProceed() {
    dispatch('proceed');
  }

  $: hasSelection = tablesToDelete.size > 0;
  $: allSelected = tables.length > 0 && tablesToDelete.size === tables.length;
</script>

<div class="table-manager">
  <div class="manager-content">
    <h2>Existing Database Tables</h2>
    
    {#if tables.length === 0}
      <div class="no-tables">
        <p>No existing tables found in the database.</p>
        <button class="button primary" on:click={handleProceed}>
          Proceed to Load CSV Files
        </button>
      </div>
    {:else}
      <p class="info-text">
        The following tables already exist in the database. Select the tables you want to delete before loading new CSV files.
      </p>

      <div class="table-list-container">
        <div class="select-all-container">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              checked={allSelected}
              on:change={selectAll}
            />
            <span><strong>Select All ({tables.length} tables)</strong></span>
          </label>
        </div>

        <div class="table-list">
          {#each tables as table}
            <div class="table-item">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={tablesToDelete.has(table)}
                  on:change={() => toggleTableDelete(table)}
                />
                <span class="table-name">{table}</span>
              </label>
            </div>
          {/each}
        </div>
      </div>

      <div class="actions">
        <button 
          class="button secondary" 
          on:click={handleProceed}
          disabled={deleting}
        >
          Skip (Keep All Tables)
        </button>
        <button 
          class="button danger" 
          on:click={handleDelete}
          disabled={deleting || !hasSelection}
        >
          {deleting ? 'Deleting...' : `Delete Selected (${tablesToDelete.size})`}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .table-manager {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .manager-content {
    background: white;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 28px;
  }

  .info-text {
    color: #666;
    margin: 0 0 24px 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .no-tables {
    text-align: center;
    padding: 32px 0;
  }

  .no-tables p {
    color: #666;
    margin-bottom: 24px;
    font-size: 16px;
  }

  .table-list-container {
    margin-bottom: 24px;
  }

  .select-all-container {
    padding: 12px;
    background: #f5f5f5;
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .table-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fafafa;
  }

  .table-item {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    transition: background 0.2s;
  }

  .table-item:last-child {
    border-bottom: none;
  }

  .table-item:hover {
    background: #f0f0f0;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #667eea;
  }

  .table-name {
    font-family: 'Courier New', monospace;
    font-size: 14px;
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

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .button.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .button.secondary {
    background: #f5f5f5;
    color: #333;
    border: 2px solid #ddd;
  }

  .button.secondary:hover:not(:disabled) {
    background: #e8e8e8;
    border-color: #bbb;
  }

  .button.danger {
    background: #dc3545;
    color: white;
  }

  .button.danger:hover:not(:disabled) {
    background: #c82333;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
  }
</style>

