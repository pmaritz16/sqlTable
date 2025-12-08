<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import TableDisplay from './TableDisplay.svelte';

  export let tables = [];
  export let currentTable = null;
  export let dbManager = null;
  export let tableToCsvMap = {};

  const dispatch = createEventDispatcher();
  let tableData = { columns: [], rows: [] };
  let rowCount = 0;
  let currentPage = 0;
  let pageSize = 100;
  let loading = false;

  $: if (currentTable && dbManager) {
    loadTableData();
  }

  async function loadTableData() {
    if (!currentTable || !dbManager) return;
    
    loading = true;
    try {
      rowCount = dbManager.getTableRowCount(currentTable);
      const offset = currentPage * pageSize;
      tableData = dbManager.getTableData(currentTable, pageSize, offset);
    } catch (error) {
      console.error('Error loading table data:', error);
    } finally {
      loading = false;
    }
  }

  function handleTableSelect(event) {
    const tableName = event.target.value;
    if (tableName) {
      currentPage = 0;
      dispatch('tableSelect', { table: tableName });
    }
  }

  function handleRefresh() {
    loadTableData();
    dispatch('refresh');
  }

  function handlePreviousPage() {
    if (currentPage > 0) {
      currentPage--;
      loadTableData();
    }
  }

  function handleNextPage() {
    const maxPage = Math.ceil(rowCount / pageSize) - 1;
    if (currentPage < maxPage) {
      currentPage++;
      loadTableData();
    }
  }

  $: maxPage = Math.ceil(rowCount / pageSize) - 1;
  $: canGoPrevious = currentPage > 0;
  $: canGoNext = currentPage < maxPage;
</script>

<div class="table-viewer">
  <header class="viewer-header">
    <div class="header-left">
      <h2>Database Tables</h2>
      <select 
        class="table-selector"
        value={currentTable || ''}
        on:change={handleTableSelect}
      >
        {#if tables.length === 0}
          <option value="">No tables available</option>
        {:else}
          {#each tables as table}
            <option value={table}>{table}</option>
          {/each}
        {/if}
      </select>
    </div>
    <div class="header-right">
      <button class="refresh-button" on:click={handleRefresh} title="Refresh">
        ↻
      </button>
    </div>
  </header>

  <div class="viewer-content">
    {#if loading}
      <div class="loading-message">Loading table data...</div>
    {:else if currentTable && tableData.columns.length > 0}
      <div class="table-info">
        <span>Table: <strong>{currentTable}</strong></span>
        {#if tableToCsvMap[currentTable]}
          <span>Source: <strong>{tableToCsvMap[currentTable].split(/[/\\]/).pop()}</strong></span>
        {/if}
        <span>Rows: <strong>{rowCount}</strong></span>
        <span>Page: <strong>{currentPage + 1}</strong> of <strong>{maxPage + 1}</strong></span>
      </div>
      
      <TableDisplay {tableData} />
      
      <div class="pagination">
        <button 
          class="page-button"
          on:click={handlePreviousPage}
          disabled={!canGoPrevious}
        >
          ← Previous
        </button>
        <span class="page-info">
          Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, rowCount)} of {rowCount}
        </span>
        <button 
          class="page-button"
          on:click={handleNextPage}
          disabled={!canGoNext}
        >
          Next →
        </button>
      </div>
    {:else if currentTable}
      <div class="empty-message">Table is empty</div>
    {:else}
      <div class="empty-message">Select a table to view</div>
    {/if}
  </div>
</div>

<style>
  .table-viewer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f5f5f5;
  }

  .viewer-header {
    background: white;
    padding: 16px 24px;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  h2 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }

  .table-selector {
    padding: 8px 16px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    min-width: 200px;
  }

  .table-selector:hover {
    border-color: #667eea;
  }

  .header-right {
    display: flex;
    gap: 12px;
  }

  .refresh-button {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 20px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    background: #5568d3;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .viewer-content {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .table-info {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    font-size: 14px;
    color: #666;
  }

  .table-info strong {
    color: #333;
  }

  .loading-message,
  .empty-message {
    text-align: center;
    padding: 48px;
    color: #999;
    font-size: 18px;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
    padding: 16px;
    background: white;
    border-radius: 6px;
  }

  .page-button {
    padding: 10px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .page-button:hover:not(:disabled) {
    background: #5568d3;
  }

  .page-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    color: #666;
    font-size: 14px;
  }
</style>

