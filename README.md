# CSV to SQL Loader

A Windows desktop application built with Svelte and Electron that loads CSV files into SQLite database tables with a graphical user interface.

## Features

- **Graphical User Interface**: Modern Svelte-based UI for easy navigation
- **CSV Schema Detection**: Automatically detects column names and types from the first line of CSV files
- **SQLite Database**: Uses sql.js for in-memory SQLite database operations
- **Config File Management**: Stores CSV file paths and database location in a JSON config file
- **Table Navigation**: Browse and view loaded tables with pagination
- **Automatic Table Creation**: Each CSV file is loaded into a separate table

## CSV File Format

The first line of each CSV file should specify the schema using this format:
```
column name:column type, column name:column type, ...
```

**Column Types:**
- `string` - Text data (default if no type specified)
- `number` - Numeric data

**Example:**
```
name:string, age:number, email:string, salary:number
John Doe, 30, john@example.com, 50000
Jane Smith, 25, jane@example.com, 60000
```

If a column type is not specified, it defaults to `string`.

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

## Notes

- The application uses sql.js which runs SQLite in the browser/Electron renderer process
- CSV files are loaded sequentially and data is inserted into the database
- The database is saved to disk after all CSV files are processed
- Missing columns in CSV rows are filled with blank/null values
- Table names are derived from CSV file names (sanitized for SQL compatibility)

