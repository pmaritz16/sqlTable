# CSV to SQL Loader

A Windows desktop application built with Svelte and Electron that loads CSV files into SQLite database tables with a graphical user interface.

## Features

- **Graphical User Interface**: Modern Svelte-based UI for easy navigation
- **CSV Schema Detection**: Automatically detects column names and types from the first line of CSV files
- **SQLite Database**: Uses sql.js for in-memory SQLite database operations
- **Config File Management**: Stores CSV file paths and database location in a JSON config file
- **Table Navigation**: Browse and view loaded tables with pagination
- **Automatic Table Creation**: Each CSV file is loaded into a separate table
- **Natural Language Commands**: Enter commands in plain English and have them translated to SQL
- **Command Logging**: All commands are logged with timestamps, SQL translations, results, and errors
- **Log File Viewer**: View, edit, and re-execute logged commands
- **Local LLM Integration**: Uses Ollama for local, private SQL translation
- **CSV Export**: Export any table to CSV format with the same schema convention used for import

## CSV File Format

The first line of each CSV file should specify the schema using this format:
```
column name:column type, column name:column type, ...
```

**Column Types:**
- `string` - Text data (default if no type specified)
- `number` - Numeric data
- `boolean` - Boolean data (stored as 0/1 in SQLite)

**Example:**
```
name:string, age:number, email:string, salary:number, active:boolean
John Doe, 30, john@example.com, 50000, true
Jane Smith, 25, jane@example.com, 60000, false
```

If a column type is not specified, it defaults to `string`.

**Type Validation:**
- Only `string`, `number`, and `boolean` are accepted as type modifiers
- Any other type modifier will result in an error
- Boolean values are converted from: "true", "1", "yes", "y" (case-insensitive) → `true`, all other values → `false`

## Configuration File Format

The configuration file is a JSON file with the following structure:

```json
{
  "databasePath": "C:\\path\\to\\database.sqlite",
  "csvFiles": [
    "C:\\path\\to\\file1.csv",
    "C:\\path\\to\\file2.csv"
  ]
}
```

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the application in development mode:
```bash
npm run electron:dev
```

This will start the Vite dev server and launch Electron.

## Building

Build the application:
```bash
npm run build
```

Then run Electron:
```bash
npm run electron
```

## Usage

1. **Start the Application**: Run `npm run electron:dev` or `npm run electron`

2. **Select Configuration File**: 
   - Choose "Use Default Config" to use the default config file at `<project-directory>\csv-loader-config.json`
   - Or choose "Select Custom Config File" to browse for a config file

3. **Default Config**: If using the default config, it will be created automatically with a default database path at `<project-directory>\csv-database.sqlite`

4. **Load CSV Files**: The application will automatically load all CSV files specified in the config file

5. **Navigate Tables**: Use the table selector dropdown to switch between different tables and view their contents

6. **Pagination**: Use the Previous/Next buttons to navigate through large tables (100 rows per page)

7. **Export to CSV**: 
   - Click the "Export CSV" button in the table viewer header
   - Choose a location to save the CSV file
   - The exported file will use the same schema convention (first line with column:type format)
   - All table data will be exported, not just the current page

7. **Natural Language Commands**: 
   - Select a table from the dropdown
   - Enter commands in natural language (e.g., "show all rows", "count records", "find rows where column = value")
   - Press Ctrl+Enter or click "Execute" to translate and run the command
   - Commands are automatically logged to `sql-command-log.txt`
   - LLM prompts and responses are automatically logged to `llm-prompt-log.txt` (saved after each interaction)

8. **View Command Log**: 
   - Click "Log View" to see all executed commands
   - Edit the log file directly in the UI
   - Select any entry and click "Execute from Selected" to re-run that command and all subsequent ones
   - Errors are displayed with clear visual indicators

## Log Files

The application creates two log files in the project directory:

- **`sql-command-log.txt`**: Logs all natural language commands, their SQL translations, execution results, and errors
- **`llm-prompt-log.txt`**: Logs all prompts sent to the LLM (Ollama) and the complete responses received, including errors and fallback scenarios. This log is saved after each LLM interaction.

## Project Structure

```
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── index.html           # HTML entry point
├── src/
│   ├── main.js          # Svelte entry point
│   ├── App.svelte       # Main application component
│   ├── config.js        # Configuration file manager
│   ├── csvParser.js     # CSV parsing with schema detection
│   ├── database.js      # SQLite database operations
│   ├── StartupDialog.svelte    # Initial config selection UI
│   ├── LoadingIndicator.svelte # Loading state UI
│   ├── TableViewer.svelte      # Table navigation UI
│   └── TableDisplay.svelte     # Table data display
└── package.json         # Dependencies and scripts
```

## Requirements

- Node.js (v16 or higher)
- Windows 10 or higher
- npm or yarn
- **Ollama** (for natural language to SQL translation)

## Ollama Setup

This application uses **Ollama** for local LLM-based SQL translation. Ollama must be installed and running on your system.

### Installing Ollama

1. Download and install Ollama from [https://ollama.ai](https://ollama.ai)
2. Start the Ollama service (it runs automatically after installation)

### Pulling a Model

Before using natural language commands, you need to pull an LLM model. Open a terminal and run:

```bash
ollama pull codellama
```

**Note:** To check for the latest available models, visit [https://ollama.com/library](https://ollama.com/library) or run:
```bash
ollama list
```

Popular model options:
- `ollama pull codellama` (default, code-focused model)
- `ollama pull llama3.1` (general purpose)
- `ollama pull llama3.2` (newer version)
- `ollama pull llama3` (alternative version)
- `ollama pull mistral` (alternative model)
- `ollama pull codellama:34b` (larger, more accurate code model)

### Configuration

You can configure Ollama connection via environment variables. The application will use these values if set, otherwise it will use defaults:

- `OLLAMA_HOST` - Default: `localhost` (if not set, will try `127.0.0.1` as fallback)
- `OLLAMA_PORT` - Default: `11434`
- `OLLAMA_MODEL` - Default: `codellama`

**Important:** When environment variables are set, the application will use them directly and will NOT try fallback hosts. This ensures your configuration is respected.

**Windows Examples:**

Set all three:
```bash
set OLLAMA_HOST=127.0.0.1
set OLLAMA_PORT=11434
set OLLAMA_MODEL=llama3.1
npm run electron:dev
```

Or use PowerShell:
```powershell
$env:OLLAMA_HOST="127.0.0.1"
$env:OLLAMA_PORT="11434"
$env:OLLAMA_MODEL="llama3.1"
npm run electron:dev
```

Set just the model:
```bash
set OLLAMA_MODEL=mistral
npm run electron:dev
```

**Note:** You can also use the convenience script:
```bash
npm run electron:dev:127
```
This automatically sets `OLLAMA_HOST=127.0.0.1` for you.

### Fallback Behavior

If Ollama is not running or unavailable, the application will automatically fall back to simple pattern matching for common query types (show all, count, basic where clauses).

### Troubleshooting Connection Issues

If you see "Ollama not available" errors but Ollama is running:

1. **Check the LLM log file**: Look at `llm-prompt-log.txt` for detailed error messages
2. **Try 127.0.0.1 instead of localhost**: Some systems have issues with localhost resolution
   ```bash
   set OLLAMA_HOST=127.0.0.1
   npm run electron:dev
   ```
3. **Verify Ollama is accessible**: Test in a browser or curl:
   ```bash
   curl http://localhost:11434/api/tags
   ```
4. **Check firewall settings**: Ensure port 11434 is not blocked
5. **Check Ollama is running**: Verify the Ollama service is running:
   ```bash
   # Windows PowerShell
   Get-Process ollama
   ```
6. **Check console logs**: The application logs detailed connection information to the console

The application will automatically try `127.0.0.1` if `localhost` fails, and provides detailed error messages in both the console and the LLM log file.

## Notes

- The application uses sql.js which runs SQLite in the browser/Electron renderer process
- CSV files are loaded sequentially and data is inserted into the database
- The database is saved to disk after all CSV files are processed
- Missing columns in CSV rows are filled with blank/null values
- Table names are derived from CSV file names (sanitized for SQL compatibility)

