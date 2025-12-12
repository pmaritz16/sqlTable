<script>
  import { createEventDispatcher } from 'svelte';

  export let tableData = { columns: [], rows: [] };

  const dispatch = createEventDispatcher();

  function handleEdit(row) {
    dispatch('edit', row);
  }

  function handleDelete(row) {
    if (confirm('Are you sure you want to delete this row?')) {
      dispatch('delete', row);
    }
  }
</script>

<div class="table-container">
  <table class="data-table">
    <thead>
      <tr>
        {#each tableData.columns as column}
          <th>{column}</th>
        {/each}
        <th class="actions-header">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each tableData.rows as row}
        <tr>
          {#each tableData.columns as column}
            <td>{row[column] ?? ''}</td>
          {/each}
          <td class="actions-cell">
            <button class="action-button edit-button" on:click={() => handleEdit(row)} title="Edit row">
              ✏️
            </button>
            <button class="action-button delete-button" on:click={() => handleDelete(row)} title="Delete row">
              🗑️
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    background: white;
    border-radius: 6px;
    overflow: auto;
    max-height: calc(100vh - 300px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .data-table thead {
    position: sticky;
    top: 0;
    background: #667eea;
    color: white;
    z-index: 10;
  }

  .data-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #5568d3;
  }

  .data-table tbody tr {
    border-bottom: 1px solid #eee;
    transition: background 0.1s;
  }

  .data-table tbody tr:hover {
    background: #f8f9ff;
  }

  .data-table td {
    padding: 12px 16px;
    color: #333;
  }

  .data-table tbody tr:nth-child(even) {
    background: #fafafa;
  }

  .data-table tbody tr:nth-child(even):hover {
    background: #f8f9ff;
  }

  .actions-header {
    width: 120px;
    text-align: center;
  }

  .actions-cell {
    text-align: center;
    padding: 8px;
  }

  .action-button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    margin: 0 2px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .action-button:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .edit-button:hover {
    background: rgba(102, 126, 234, 0.2);
  }

  .delete-button:hover {
    background: rgba(231, 76, 60, 0.2);
  }
</style>









