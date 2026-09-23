// Node: Code - Prepare Clean Rows for File
// Type: Code | Mode: Run Once for All Items
// Purpose: Expand cleanedRows array into individual row items for Convert to File,
// stripping any internal "__" prefixed fields so they never leak into the Excel output.

const cleanedRows = $input.first().json.cleanedRows || [];
if (!Array.isArray(cleanedRows) || cleanedRows.length === 0) throw new Error('No cleaned rows available for export.');

function stripInternalFields(row) {
  const clean = {};
  for (const key of Object.keys(row)) if (!key.startsWith('__')) clean[key] = row[key];
  return clean;
}

return cleanedRows.map(row => ({ json: stripInternalFields(row) }));
