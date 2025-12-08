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
      const type = col.type === 'number' ? 'REAL' : 'TEXT';
      return `"${col.name}" ${type}`;
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
        return value === null || value === undefined ? null : value;
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

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default DatabaseManager;

