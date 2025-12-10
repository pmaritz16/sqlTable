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

    const result = this.db.exec(`SELECT * FROM "${tableName}" LIMIT ${limit} OFFSET ${offset}`);
    
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

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseManager;

