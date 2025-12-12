<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import TableDisplay from './TableDisplay.svelte';
  import RowForm from './RowForm.svelte';
  import { CSVExporter } from './csvExporter.js';

  export let tables = [];
  export let currentTable = null;
  export let dbManager = null;
  export let tableToCsvMap = {};
  export let electronAPI = null;
  export let modifiedTables = new Set();

  const dispatch = createEventDispatcher();
  let tableData = { columns: [], rows: [] };
  let rowCount = 0;
  let currentPage = 0;
  let pageSize = 100;
  let loading = false;
  let exporting = false;
  
  // Row form state
  let showRowForm = false;
  let editingRow = null;
  let tableSchema = [];

  $: if (currentTable && dbManager) {
    loadTableData();
    loadTableSchema();
  }

  async function loadTableSchema() {
    if (!currentTable || !dbManager) return;
    try {
      tableSchema = dbManager.getTableSchema(currentTable);
    } catch (error) {
      console.error('Error loading table schema:', error);
      tableSchema = [];
    }
  }

  // Debug: log when currentTable changes
  $: if (currentTable) {
    console.log('Current table set:', currentTable, 'electronAPI available:', !!electronAPI);
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

  async function handleUpdateAndRestart() {
    dispatch('updateAndRestart');
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

  async function handleExport() {
    if (!currentTable || !dbManager || !electronAPI || exporting) return;

    exporting = true;
    try {
      // Get table schema
      const schema = dbManager.getTableSchema(currentTable);
      if (!schema || schema.length === 0) {
        alert('Unable to get table schema');
        return;
      }

      // Get all table data (not just current page)
      const allData = dbManager.getAllTableData(currentTable);
      if (!allData || allData.rows.length === 0) {
        alert('Table is empty, nothing to export');
        return;
      }

      // Convert to CSV format
      const csvContent = CSVExporter.exportTableToCSV(currentTable, schema, allData);

      // Show save dialog
      const filePath = await electronAPI.saveFile({
        title: 'Export Table to CSV',
        defaultPath: `${currentTable}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      // Write CSV file
      await electronAPI.writeCsvFile(filePath, csvContent);
      
      alert(`Table "${currentTable}" exported successfully to ${filePath}`);
    } catch (error) {
      console.error('Error exporting table:', error);
      alert(`Error exporting table: ${error.message}`);
    } finally {
      exporting = false;
    }
  }

  function handleAddRow() {
    editingRow = null;
    showRowForm = true;
  }

  function handleEditRow(event) {
    editingRow = event.detail;
    showRowForm = true;
  }

  function handleDeleteRow(event) {
    const row = event.detail;
    if (!row || !row.rowid) {
      alert('Error: Cannot identify row to delete');
      return;
    }

    deleteRow(row.rowid);
  }

  async function deleteRow(rowid) {
    if (!currentTable || !dbManager) return;

    try {
      dbManager.deleteRow(currentTable, rowid);
      
      // Save database
      const dbPath = await electronAPI.getDefaultDatabasePath();
      await dbManager.saveToFile(dbPath, electronAPI);
      
      // Refresh table data
      await loadTableData();
      dispatch('refresh');
      
      // Mark table as modified
      dispatch('tableModified', { table: currentTable });
      
      alert('Row deleted successfully');
    } catch (error) {
      console.error('Error deleting row:', error);
      alert(`Error deleting row: ${error.message}`);
    }
  }

  async function handleFormSave(event) {
    const { rowData, isEdit, insertPosition } = event.detail;
    
    if (!currentTable || !dbManager) return;

    try {
      if (isEdit) {
        // Update existing row
        if (!rowData.rowid) {
          alert('Error: Cannot identify row to update');
          return;
        }
        dbManager.updateRow(currentTable, rowData.rowid, rowData, tableSchema);
      } else {
        // Insert new row at specified position
        const position = insertPosition || 'end';
        dbManager.insertRow(currentTable, rowData, tableSchema, position);
        
        if (position === 'beginning') {
          // New row is at the beginning, go to first page
          currentPage = 0;
        } else {
          // New row is at the end, calculate which page it's on
          const newRowCount = dbManager.getTableRowCount(currentTable);
          const newPage = Math.ceil(newRowCount / pageSize) - 1;
          currentPage = Math.max(0, newPage);
        }
      }
      
      // Save database
      const dbPath = await electronAPI.getDefaultDatabasePath();
      await dbManager.saveToFile(dbPath, electronAPI);
      
      // Refresh table data
      await loadTableData();
      dispatch('refresh');
      
      // Mark table as modified
      dispatch('tableModified', { table: currentTable });
      
      // Close form
      showRowForm = false;
      editingRow = null;
      
      alert(isEdit ? 'Row updated successfully' : 'Row added successfully');
    } catch (error) {
      console.error('Error saving row:', error);
      alert(`Error saving row: ${error.message}`);
    }
  }

  function handleFormCancel() {
    showRowForm = false;
    editingRow = null;
  }
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
      {#if modifiedTables.size > 0}
        <button 
          class="update-button" 
          on:click={handleUpdateAndRestart} 
          title="Save modified tables to CSV files and restart"
        >
          Update ({modifiedTables.size})
        </button>
      {/if}
      {#if currentTable && electronAPI}
        <button 
          class="add-row-button" 
          on:click={handleAddRow} 
          title="Add new row"
          disabled={loading || !electronAPI}
        >
          + Add Row
        </button>
        <button 
          class="export-button" 
          on:click={handleExport} 
          title="Export table to CSV"
          disabled={exporting || loading || !electronAPI}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      {/if}
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
      
      <TableDisplay 
        {tableData} 
        on:edit={handleEditRow}
        on:delete={handleDeleteRow}
      />
      
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
      <div class="empty-message">
        Table is empty
        {#if electronAPI}
          <button class="add-row-button" on:click={handleAddRow} style="margin-top: 16px;">
            + Add First Row
          </button>
        {/if}
      </div>
    {:else}
      <div class="empty-message">Select a table to view</div>
    {/if}
  </div>
  
  {#if showRowForm && currentTable}
    <RowForm
      columns={tableData.columns}
      schema={tableSchema}
      rowData={editingRow}
      open={showRowForm}
      on:save={handleFormSave}
      on:cancel={handleFormCancel}
    />
  {/if}
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

  .update-button {
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    margin-right: 8px;
    animation: pulse 2s infinite;
  }

  .update-button:hover {
    background: #d97706;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  .add-row-button {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    margin-right: 8px;
  }

  .add-row-button:hover:not(:disabled) {
    background: #5568d3;
  }

  .add-row-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .export-button {
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    margin-right: 8px;
  }

  .export-button:hover:not(:disabled) {
    background: #059669;
  }

  .export-button:disabled {
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

