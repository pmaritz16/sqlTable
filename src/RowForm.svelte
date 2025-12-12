<script>
  import { createEventDispatcher } from 'svelte';

  export let columns = [];
  export let schema = [];
  export let rowData = null; // null for new row, object for edit
  export let open = false;

  const dispatch = createEventDispatcher();

  let formData = {};
  let errors = {};
  let insertPosition = 'end'; // 'beginning' or 'end'

  // Initialize form data
  $: if (open && columns.length > 0) {
    if (rowData) {
      // Edit mode: copy existing data
      formData = {};
      columns.forEach(col => {
        formData[col] = rowData[col] ?? '';
      });
    } else {
      // Add mode: initialize with empty values
      formData = {};
      columns.forEach(col => {
        formData[col] = '';
      });
    }
    errors = {};
  }

  function getColumnType(columnName) {
    const colInfo = schema.find(col => col.name === columnName);
    if (!colInfo) return 'TEXT';
    
    const sqlType = colInfo.type.toUpperCase();
    if (sqlType === 'INTEGER') {
      // Check if it's a boolean based on sample values or column name
      const sampleValue = rowData ? rowData[columnName] : null;
      if (sampleValue === 0 || sampleValue === 1 || 
          columnName.toLowerCase().includes('flag') ||
          columnName.toLowerCase().includes('is') ||
          columnName.toLowerCase().includes('has')) {
        return 'BOOLEAN';
      }
      return 'INTEGER';
    } else if (sqlType === 'REAL') {
      return 'NUMBER';
    }
    return 'TEXT';
  }

  function formatValueForInput(value, type) {
    if (value === null || value === undefined) return '';
    if (type === 'BOOLEAN') {
      return value === 1 || value === true || value === '1' || value === 'true';
    }
    return String(value);
  }

  function handleInputChange(column, value, type) {
    if (type === 'BOOLEAN') {
      formData[column] = value;
    } else {
      formData[column] = value;
    }
    // Clear error for this field
    if (errors[column]) {
      errors = { ...errors };
      delete errors[column];
      errors = errors;
    }
  }

  function validateForm() {
    errors = {};
    let isValid = true;

    columns.forEach(col => {
      const value = formData[col];
      const colInfo = schema.find(s => s.name === col);
      
      // Check NOT NULL constraint
      if (colInfo && colInfo.notnull && (value === null || value === undefined || value === '')) {
        errors[col] = 'This field is required';
        isValid = false;
      }
      
      // Validate number type
      const type = getColumnType(col);
      if (type === 'NUMBER' || type === 'INTEGER') {
        if (value !== '' && value !== null && value !== undefined) {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors[col] = 'Must be a valid number';
            isValid = false;
          }
        }
      }
    });

    return isValid;
  }

  function handleSave() {
    if (!validateForm()) {
      return;
    }

    // Convert form data to proper types
    const processedData = {};
    columns.forEach(col => {
      const type = getColumnType(col);
      let value = formData[col];
      
      if (value === '' || value === null || value === undefined) {
        processedData[col] = null;
      } else if (type === 'BOOLEAN') {
        processedData[col] = value === true || value === 'true' || value === 1 || value === '1';
      } else if (type === 'NUMBER' || type === 'INTEGER') {
        processedData[col] = Number(value);
      } else {
        processedData[col] = String(value);
      }
    });

    // Include rowid for edit mode
    if (rowData && rowData.rowid) {
      processedData.rowid = rowData.rowid;
    }

    dispatch('save', { 
      rowData: processedData, 
      isEdit: !!rowData,
      insertPosition: rowData ? null : insertPosition // Only relevant for new rows
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

{#if open}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={handleCancel} on:keydown={(e) => e.key === 'Escape' && handleCancel()}>
    <div class="modal-content" role="document" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{rowData ? 'Edit Row' : 'Add New Row'}</h3>
        <button class="close-button" on:click={handleCancel}>×</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleSave}>
          {#if !rowData}
            <div class="form-field insert-position-field">
              <div class="radio-group-label">Insert Position:</div>
              <div class="radio-group" role="radiogroup" aria-label="Insert Position">
                <label class="radio-label">
                  <input 
                    type="radio" 
                    value="beginning" 
                    bind:group={insertPosition}
                  />
                  <span>Insert at beginning (first row)</span>
                </label>
                <label class="radio-label">
                  <input 
                    type="radio" 
                    value="end" 
                    bind:group={insertPosition}
                  />
                  <span>Append at end (last row)</span>
                </label>
              </div>
            </div>
          {/if}
          {#each columns as column}
            {@const type = getColumnType(column)}
            {@const colInfo = schema.find(s => s.name === column)}
            {@const isRequired = colInfo && colInfo.notnull}
            {@const value = formatValueForInput(formData[column], type)}
            
            <div class="form-field">
              <label for="field-{column}">
                {column}
                {#if isRequired}
                  <span class="required">*</span>
                {/if}
              </label>
              
              {#if type === 'BOOLEAN'}
                <select
                  id="field-{column}"
                  class="form-input"
                  class:error={errors[column]}
                  value={value}
                  on:change={(e) => handleInputChange(column, e.target.value === 'true', type)}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              {:else if type === 'NUMBER' || type === 'INTEGER'}
                <input
                  id="field-{column}"
                  type="number"
                  class="form-input"
                  class:error={errors[column]}
                  value={value}
                  on:input={(e) => handleInputChange(column, e.target.value, type)}
                  step={type === 'INTEGER' ? '1' : 'any'}
                />
              {:else}
                <input
                  id="field-{column}"
                  type="text"
                  class="form-input"
                  class:error={errors[column]}
                  value={value}
                  on:input={(e) => handleInputChange(column, e.target.value, type)}
                />
              {/if}
              
              {#if errors[column]}
                <span class="error-message">{errors[column]}</span>
              {/if}
            </div>
          {/each}
        </form>
      </div>
      
      <div class="modal-footer">
        <button class="button button-secondary" on:click={handleCancel}>Cancel</button>
        <button class="button button-primary" on:click={handleSave}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 20px;
    color: #333;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 28px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-button:hover {
    background: #f0f0f0;
    color: #333;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .form-field {
    margin-bottom: 20px;
  }

  .insert-position-field {
    background: #f8f9ff;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    margin-bottom: 24px;
  }

  .radio-group-label {
    font-weight: 600;
    margin-bottom: 12px;
    color: #333;
    font-size: 14px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .radio-label input[type="radio"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .form-field label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
    font-size: 14px;
  }

  .required {
    color: #e74c3c;
    margin-left: 4px;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .form-input.error {
    border-color: #e74c3c;
  }

  .error-message {
    display: block;
    color: #e74c3c;
    font-size: 12px;
    margin-top: 4px;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .button-primary {
    background: #667eea;
    color: white;
  }

  .button-primary:hover {
    background: #5568d3;
  }

  .button-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .button-secondary:hover {
    background: #e0e0e0;
  }
</style>

