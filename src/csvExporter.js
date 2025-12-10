// CSV Exporter - converts table data to CSV format with schema line
export class CSVExporter {
  // Convert SQLite type to CSV schema type
  static sqliteTypeToCsvType(sqliteType, columnName, sampleValues = []) {
    const upperType = sqliteType.toUpperCase();
    
    if (upperType === 'TEXT') {
      return 'string';
    } else if (upperType === 'REAL') {
      return 'number';
    } else if (upperType === 'INTEGER') {
      // Check if it's likely a boolean column
      // If we have sample values, check if they're all 0, 1, or null
      if (sampleValues.length > 0) {
        const isBoolean = sampleValues.every(val => 
          val === null || val === undefined || val === 0 || val === 1 || val === '0' || val === '1' || val === true || val === false
        );
        
        if (isBoolean) {
          return 'boolean';
        }
      }
      
      // Also check column name for common boolean patterns
      const nameLower = columnName.toLowerCase();
      const booleanKeywords = ['active', 'enabled', 'is', 'has', 'can', 'should', 'flag', 'bool'];
      const nameSuggestsBoolean = booleanKeywords.some(keyword => 
        nameLower.startsWith(keyword) || nameLower.includes('_' + keyword) || nameLower.includes(keyword + '_')
      );
      
      if (nameSuggestsBoolean) {
        return 'boolean';
      }
      
      // Default INTEGER to number if not clearly boolean
      return 'number';
    }
    
    // Default to string for unknown types
    return 'string';
  }

  // Format a value for CSV output
  static formatValue(value, csvType) {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (csvType === 'boolean') {
      // Convert 0/1 to true/false
      if (value === 0 || value === '0') {
        return 'false';
      } else if (value === 1 || value === '1') {
        return 'true';
      }
      // If already a boolean, convert to string
      return value ? 'true' : 'false';
    }
    
    // For string and number, convert to string
    // If value contains comma, quote, or newline, wrap in quotes and escape
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
      // Escape quotes by doubling them
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    
    return strValue;
  }

  // Export table to CSV format
  static exportTableToCSV(tableName, schema, data) {
    if (!schema || schema.length === 0) {
      throw new Error('Table schema is required');
    }

    if (!data || !data.rows || data.rows.length === 0) {
      // Empty table - still export with schema line
      const schemaParts = schema.map(col => {
        const csvType = this.sqliteTypeToCsvType(col.type, col.name, []);
        return `${col.name}:${csvType}`;
      });
      return schemaParts.join(', ') + '\n';
    }

    // Get sample values for type detection (first 10 rows)
    const sampleRows = data.rows.slice(0, 10);
    const sampleValuesByColumn = {};
    schema.forEach(col => {
      sampleValuesByColumn[col.name] = sampleRows.map(row => row[col.name]);
    });

    // Build schema line
    const schemaParts = schema.map(col => {
      const csvType = this.sqliteTypeToCsvType(
        col.type,
        col.name,
        sampleValuesByColumn[col.name] || []
      );
      return `${col.name}:${csvType}`;
    });
    const schemaLine = schemaParts.join(', ');

    // Build CSV content
    let csvContent = schemaLine + '\n';

    // Add data rows
    for (const row of data.rows) {
      const values = schema.map(col => {
        const csvType = this.sqliteTypeToCsvType(
          col.type,
          col.name,
          sampleValuesByColumn[col.name] || []
        );
        return this.formatValue(row[col.name], csvType);
      });
      csvContent += values.join(',') + '\n';
    }

    return csvContent;
  }
}

