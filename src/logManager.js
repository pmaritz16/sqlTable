// Log manager for storing and managing SQL command logs
export default class LogManager {
  constructor(electronAPI) {
    this.api = electronAPI;
    this.logPath = null;
  }

  async initialize() {
    this.logPath = await this.api.getDefaultLogPath();
  }

  getLogPath() {
    return this.logPath;
  }

  async loadLog() {
    try {
      const content = await this.api.readLogFile(this.logPath);
      return content || '';
    } catch (error) {
      console.error('Error loading log file:', error);
      return '';
    }
  }

  async saveLog(content) {
    try {
      await this.api.writeLogFile(this.logPath, content);
      return true;
    } catch (error) {
      console.error('Error saving log file:', error);
      return false;
    }
  }

  parseLogEntries(content) {
    if (!content || content.trim() === '') {
      return [];
    }

    const lines = content.split('\n');
    const entries = [];
    let currentEntry = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for timestamp line (format: [YYYY-MM-DD HH:MM:SS])
      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      
      if (timestampMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          entries.push(currentEntry);
        }
        
        // Start new entry
        currentEntry = {
          timestamp: timestampMatch[1],
          lineNumber: i + 1,
          naturalLanguage: '',
          sql: '',
          error: null,
          result: null
        };
      } else if (currentEntry) {
        // Check for command type markers
        if (line.startsWith('NL:')) {
          currentEntry.naturalLanguage = line.substring(3).trim();
        } else if (line.startsWith('SQL:')) {
          currentEntry.sql = line.substring(4).trim();
        } else if (line.startsWith('ERROR:')) {
          currentEntry.error = line.substring(6).trim();
        } else if (line.startsWith('RESULT:')) {
          currentEntry.result = line.substring(7).trim();
        } else if (line && !line.startsWith('---')) {
          // Continue appending to the last field that was set
          // Multi-line SQL support
          if (currentEntry.sql && !currentEntry.error && !currentEntry.result) {
            currentEntry.sql += ' ' + line;
          } else if (currentEntry.error && !currentEntry.result) {
            currentEntry.error += ' ' + line;
          } else if (currentEntry.result) {
            currentEntry.result += ' ' + line;
          } else if (!currentEntry.naturalLanguage && !currentEntry.sql) {
            currentEntry.naturalLanguage = line;
          }
        }
      }
    }

    // Add last entry
    if (currentEntry) {
      entries.push(currentEntry);
    }

    return entries;
  }

  formatLogEntry(entry) {
    let formatted = `[${entry.timestamp}]\n`;
    if (entry.naturalLanguage) {
      formatted += `NL: ${entry.naturalLanguage}\n`;
    }
    if (entry.sql) {
      formatted += `SQL: ${entry.sql}\n`;
    }
    if (entry.error) {
      formatted += `ERROR: ${entry.error}\n`;
    }
    if (entry.result) {
      formatted += `RESULT: ${entry.result}\n`;
    }
    formatted += '---\n';
    return formatted;
  }
}

