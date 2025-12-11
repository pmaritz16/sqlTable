#!/usr/bin/env node

/**
 * CSV Date Reformatting Helper
 * 
 * Reads a CSV file and converts date fields from MM/DD/YYYY to YYYY/MM/DD format.
 * Output is written to a new file with "-new" appended to the original filename.
 * 
 * Usage: node reformat-dates.cjs <input-file.csv>
 */

const fs = require('fs');
const path = require('path');

// Regular expression to match MM/DD/YYYY format
const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Check if a string matches MM/DD/YYYY format
 */
function isDateMMDDYYYY(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  const match = trimmed.match(DATE_PATTERN);
  if (!match) {
    return false;
  }
  
  // Validate month and day ranges
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1000 || year > 9999) return false;
  
  return true;
}

/**
 * Convert MM/DD/YYYY to YYYY/MM/DD
 */
function convertDate(value) {
  const match = value.trim().match(DATE_PATTERN);
  if (!match) {
    return value; // Return original if conversion fails
  }
  
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = match[3];
  
  return `${year}/${month}/${day}`;
}

/**
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : null;
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add the last field
  fields.push(currentField);
  
  return fields;
}

/**
 * Format fields back into a CSV line, quoting if necessary
 */
function formatCSVLine(fields) {
  return fields.map(field => {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }).join(',');
}

/**
 * Process the CSV file
 */
function processCSVFile(inputPath) {
  try {
    // Read the input file
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    if (lines.length === 0) {
      console.error('Error: Input file is empty');
      process.exit(1);
    }
    
    // Process each line
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line.length === 0) {
        processedLines.push('');
        continue;
      }
      
      // Parse the CSV line
      const fields = parseCSVLine(line);
      
      // Process each field
      const processedFields = fields.map(field => {
        // Check if field is a date in MM/DD/YYYY format
        if (isDateMMDDYYYY(field)) {
          return convertDate(field);
        }
        return field;
      });
      
      // Reconstruct the line
      processedLines.push(formatCSVLine(processedFields));
    }
    
    // Generate output filename
    const inputDir = path.dirname(inputPath);
    const inputBase = path.basename(inputPath, path.extname(inputPath));
    const inputExt = path.extname(inputPath);
    const outputPath = path.join(inputDir, `${inputBase}-new${inputExt}`);
    
    // Write output file
    const outputContent = processedLines.join('\n');
    fs.writeFileSync(outputPath, outputContent, 'utf8');
    
    console.log(`Successfully processed ${lines.length} line(s)`);
    console.log(`Output written to: ${outputPath}`);
    
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  // Get input file from command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node reformat-dates.cjs <input-file.csv>');
    console.error('Example: node reformat-dates.cjs data.csv');
    process.exit(1);
  }
  
  const inputFile = args[0];
  
  // Check if file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }
  
  // Check if it's a file (not a directory)
  const stats = fs.statSync(inputFile);
  if (!stats.isFile()) {
    console.error(`Error: ${inputFile} is not a file`);
    process.exit(1);
  }
  
  console.log(`Processing: ${inputFile}`);
  processCSVFile(inputFile);
}

module.exports = { processCSVFile, convertDate, isDateMMDDYYYY };

