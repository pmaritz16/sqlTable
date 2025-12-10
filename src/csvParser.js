export class CSVParser {
  static parseSchemaLine(line) {
    const columns = [];
    const parts = line.split(',');
    
    // Valid type modifiers
    const validTypes = ['string', 'number', 'boolean'];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const name = trimmed.substring(0, colonIndex).trim();
        const type = trimmed.substring(colonIndex + 1).trim().toLowerCase();
        
        // Validate type modifier
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid column type modifier "${type}" for column "${name}". Valid types are: string, number, boolean`);
        }
        
        columns.push({
          name: name,
          type: type
        });
      } else {
        columns.push({
          name: trimmed,
          type: 'string'
        });
      }
    }
    
    return columns;
  }

  static parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // First line is schema
    const schema = this.parseSchemaLine(lines[0]);
    
    // Remaining lines are data
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row = {};
      
      schema.forEach((col, index) => {
        let value = values[index] || '';
        value = value.trim();
        
        if (col.type === 'number') {
          row[col.name] = value === '' ? null : parseFloat(value);
          if (isNaN(row[col.name])) {
            row[col.name] = null;
          }
        } else if (col.type === 'boolean') {
          // Convert to boolean: true for "true", "1", "yes", "y" (case-insensitive), false otherwise
          const lowerValue = value.toLowerCase();
          row[col.name] = lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'y';
        } else {
          // string type (default)
          row[col.name] = value;
        }
      });
      
      data.push(row);
    }
    
    return { schema, data };
  }

  static parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  static getTableNameFromPath(filePath) {
    const fileName = filePath.split(/[/\\]/).pop();
    const nameWithoutExt = fileName.replace(/\.csv$/i, '');
    // Sanitize table name (SQLite identifiers)
    return nameWithoutExt.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}

