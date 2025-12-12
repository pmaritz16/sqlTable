import initSqlJs from 'sql.js';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.sqlJs = null;
  }

  async initialize() {
    if (!this.sqlJs) {
      // In Electron, we need to specify the WASM file location
      // It's in the dist folder when built, or node_modules in dev
      const isDev = window.location.protocol === 'http:';
      const wasmPath = isDev 
        ? '/node_modules/sql.js/dist/sql-wasm.wasm'
        : './sql-wasm.wasm';
      
      this.sqlJs = await initSqlJs({
        locateFile: (file) => wasmPath
      });
    }
  }

  async loadFromFile(dbPath, electronAPI) {
    await this.initialize();
    
    try {
      const buffer = await electronAPI.readDatabase(dbPath);
      if (buffer) {
        const uint8Array = new Uint8Array(buffer);
        this.db = new this.sqlJs.Database(uint8Array);
      } else {
        this.db = new this.sqlJs.Database();
      }
      return true;
    } catch (error) {
      console.error('Error loading database:', error);
      this.db = new this.sqlJs.Database();
      return false;
    }
  }

  createNew() {
    if (!this.sqlJs) {
      throw new Error('SQL.js not initialized');
    }
    this.db = new this.sqlJs.Database();
  }

  createTable(tableName, schema) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const columns = schema.map(col => {
      let sqlType;
      if (col.type === 'number') {
        sqlType = 'REAL';
      } else if (col.type === 'boolean') {
        // SQLite doesn't have native boolean, use INTEGER (0/1)
        sqlType = 'INTEGER';
      } else {
        sqlType = 'TEXT';
      }
      return `"${col.name}" ${sqlType}`;
    }).join(', ');

    const createTableSQL = `CREATE TABLE "${tableName}" (${columns})`;
    this.db.run(createTableSQL);
  }

  insertData(tableName, schema, data) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (data.length === 0) return;

    const columnNames = schema.map(col => `"${col.name}"`).join(', ');
    const placeholders = schema.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

    const stmt = this.db.prepare(insertSQL);
    
    for (const row of data) {
      const values = schema.map(col => {
        const value = row[col.name];
        if (value === null || value === undefined) {
          return null;
        }
        // Convert boolean to integer for SQLite (0/1)
        if (col.type === 'boolean') {
          return value ? 1 : 0;
        }
        return value;
      });
      stmt.run(values);
    }
    
    stmt.free();
  }

  getTableNames() {
    if (!this.db) {
      return [];
    }

    const result = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    if (result.length === 0) {
      return [];
    }

    const tableNames = [];
    for (const row of result[0].values) {
      tableNames.push(row[0]);
    }
    return tableNames;
  }

  getTableData(tableName, limit = 1000, offset = 0) {
    if (!this.db) {
      return { columns: [], rows: [] };
    }

    // Include ROWID for row identification, order by rowid ASC to preserve CSV file order
    const result = this.db.exec(`SELECT rowid, * FROM "${tableName}" ORDER BY rowid ASC LIMIT ${limit} OFFSET ${offset}`);
    
    if (result.length === 0) {
      return { columns: [], rows: [] };
    }

    const allColumns = result[0].columns;
    // Filter out 'rowid' from display columns but keep it in row data
    const columns = allColumns.filter(col => col !== 'rowid');
    const rows = result[0].values.map(row => {
      const obj = {};
      allColumns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });

    return { columns, rows };
  }

  getAllTableData(tableName) {
    if (!this.db) {
      return { columns: [], rows: [] };
    }

    // Get all data without limit
    const result = this.db.exec(`SELECT * FROM "${tableName}"`);
    
    if (result.length === 0) {
      return { columns: [], rows: [] };
    }

    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });

    return { columns, rows };
  }

  getTableRowCount(tableName) {
    if (!this.db) {
      return 0;
    }

    const result = this.db.exec(`SELECT COUNT(*) as count FROM "${tableName}"`);
    if (result.length === 0) {
      return 0;
    }
    return result[0].values[0][0];
  }

  async saveToFile(dbPath, electronAPI) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = this.db.export();
    const buffer = Array.from(data);
    await electronAPI.writeDatabase(dbPath, buffer);
  }

  deleteTable(tableName) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    this.db.run(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  executeSQL(sql) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Check if it's a SELECT query
      const trimmedSQL = sql.trim().toUpperCase();
      if (trimmedSQL.startsWith('SELECT')) {
        const result = this.db.exec(sql);
        if (result.length === 0) {
          return { type: 'select', columns: [], rows: [], rowCount: 0 };
        }
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
          const obj = {};
          columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        });
        
        return { type: 'select', columns, rows, rowCount: rows.length };
      } else {
        // For INSERT, UPDATE, DELETE, etc.
        this.db.run(sql);
        // Try to get affected rows count
        const changes = this.db.exec("SELECT changes() as count");
        const affectedRows = changes.length > 0 ? changes[0].values[0][0] : 0;
        return { type: 'modify', affectedRows };
      }
    } catch (error) {
      throw new Error(`SQL execution error: ${error.message}`);
    }
  }

  getTableSchema(tableName) {
    if (!this.db) {
      return [];
    }

    try {
      const result = this.db.exec(`PRAGMA table_info("${tableName}")`);
      if (result.length === 0) {
        return [];
      }

      return result[0].values.map(row => ({
        name: row[1],
        type: row[2],
        notnull: row[3],
        defaultValue: row[4],
        pk: row[5]
      }));
    } catch (error) {
      console.error('Error getting table schema:', error);
      return [];
    }
  }

  deleteRow(tableName, rowid) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const deleteSQL = `DELETE FROM "${tableName}" WHERE rowid = ?`;
      const stmt = this.db.prepare(deleteSQL);
      stmt.run([rowid]);
      stmt.free();
      return true;
    } catch (error) {
      throw new Error(`Error deleting row: ${error.message}`);
    }
  }

  updateRow(tableName, rowid, rowData, schema) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Build UPDATE statement
      const columns = Object.keys(rowData).filter(key => key !== 'rowid');
      const setClause = columns.map(col => `"${col}" = ?`).join(', ');
      const updateSQL = `UPDATE "${tableName}" SET ${setClause} WHERE rowid = ?`;
      
      const stmt = this.db.prepare(updateSQL);
      
      // Get schema info for type conversion
      const schemaMap = {};
      if (schema) {
        schema.forEach(col => {
          schemaMap[col.name] = col;
        });
      }
      
      // Prepare values with type conversion
      const values = columns.map(col => {
        const value = rowData[col];
        if (value === null || value === undefined || value === '') {
          return null;
        }
        // Convert boolean to integer for SQLite
        const colInfo = schemaMap[col];
        if (colInfo && colInfo.type === 'INTEGER' && (value === true || value === false || value === 'true' || value === 'false')) {
          return (value === true || value === 'true') ? 1 : 0;
        }
        return value;
      });
      
      values.push(rowid); // Add rowid for WHERE clause
      stmt.run(values);
      stmt.free();
      return true;
    } catch (error) {
      throw new Error(`Error updating row: ${error.message}`);
    }
  }

  insertRow(tableName, rowData, schema, position = 'end') {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Remove rowid from rowData if present (it's auto-generated)
      const insertData = { ...rowData };
      delete insertData.rowid;
      
      const columns = Object.keys(insertData);
      const columnNames = columns.map(col => `"${col}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      
      // Get schema info for type conversion
      const schemaMap = {};
      if (schema) {
        schema.forEach(col => {
          schemaMap[col.name] = col;
        });
      }
      
      // Prepare values with type conversion
      const values = columns.map(col => {
        const value = insertData[col];
        if (value === null || value === undefined || value === '') {
          return null;
        }
        // Convert boolean to integer for SQLite
        const colInfo = schemaMap[col];
        if (colInfo && colInfo.type === 'INTEGER' && (value === true || value === false || value === 'true' || value === 'false')) {
          return (value === true || value === 'true') ? 1 : 0;
        }
        return value;
      });

      if (position === 'beginning') {
        // To insert at the beginning, we need to use a temporary table approach
        // to preserve the rowid ordering
        this.insertRowAtBeginning(tableName, columns, values, schema);
      } else {
        // Normal insert at end
        const insertSQL = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(insertSQL);
        stmt.run(values);
        stmt.free();
      }
      
      return true;
    } catch (error) {
      throw new Error(`Error inserting row: ${error.message}`);
    }
  }

  insertRowAtBeginning(tableName, columns, newRowValues, schema) {
    // Use a temporary table to reorder rows
    const tempTableName = `_temp_${tableName}_${Date.now()}`;
    
    try {
      // Get table schema
      const tableInfo = this.db.exec(`PRAGMA table_info("${tableName}")`);
      if (tableInfo.length === 0) {
        throw new Error('Table not found');
      }

      // Create temporary table with same structure
      const createTempSQL = `CREATE TABLE "${tempTableName}" AS SELECT * FROM "${tableName}" WHERE 1=0`;
      this.db.run(createTempSQL);

      // Insert new row first into temp table
      const columnNames = columns.map(col => `"${col}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const insertSQL = `INSERT INTO "${tempTableName}" (${columnNames}) VALUES (${placeholders})`;
      const stmt = this.db.prepare(insertSQL);
      stmt.run(newRowValues);
      stmt.free();

      // Copy all existing rows from original table to temp table
      const allColumns = tableInfo[0].values.map(row => row[1]); // Column names
      const allColumnNames = allColumns.map(col => `"${col}"`).join(', ');
      const copySQL = `INSERT INTO "${tempTableName}" (${allColumnNames}) SELECT ${allColumnNames} FROM "${tableName}" ORDER BY rowid ASC`;
      this.db.run(copySQL);

      // Drop original table
      this.db.run(`DROP TABLE "${tableName}"`);

      // Rename temp table to original name
      this.db.run(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}"`);
    } catch (error) {
      // Clean up temp table if it exists
      try {
        this.db.run(`DROP TABLE IF EXISTS "${tempTableName}"`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseManager;

