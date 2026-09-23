// Node: Code - Normalize Extracted Rows
// Type: Code | Mode: Run Once for All Items
// Purpose: Normalize output from Extract From File (CSV/XLS/XLSX) into clean row objects.

const items = $input.all();

function isPlainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function isMissing(value) { if (value === null || value === undefined) return true; return String(value).trim() === ''; }
function cleanHeader(value, index) {
  let header = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!header) header = `Column_${index + 1}`;
  return header;
}
function makeUnique(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = cleanHeader(header, index);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

const rawRows = [];
for (const item of items) {
  const candidate = item.json?.row ?? item.json;
  if (Array.isArray(candidate)) { for (const row of candidate) if (isPlainObject(row)) rawRows.push(row); }
  else if (isPlainObject(candidate)) { rawRows.push(candidate); }
}
if (rawRows.length === 0) throw new Error('The spreadsheet was extracted, but no usable rows were found.');

const firstKeys = Object.keys(rawRows[0] || {});
const looksLikeNumericColumns = firstKeys.length > 0 && firstKeys.every(key => /^\d+$/.test(key));
let normalizedRows = [];
let headers = [];

if (looksLikeNumericColumns) {
  const orderedKeys = firstKeys.sort((a, b) => Number(a) - Number(b));
  headers = makeUnique(orderedKeys.map((key, index) => cleanHeader(rawRows[0][key], index)));
  normalizedRows = rawRows.slice(1).map((row) => {
    const output = {};
    orderedKeys.forEach((key, index) => { output[headers[index]] = row[key] ?? null; });
    return output;
  });
} else {
  const rawHeaders = [];
  for (const row of rawRows) { for (const key of Object.keys(row)) { if (!rawHeaders.includes(key)) rawHeaders.push(key); } }
  headers = makeUnique(rawHeaders.map((key, index) => cleanHeader(key, index)));
  const headerMap = Object.fromEntries(rawHeaders.map((key, index) => [key, headers[index]]));
  normalizedRows = rawRows.map(row => {
    const output = {};
    rawHeaders.forEach(key => { output[headerMap[key]] = row[key] ?? null; });
    return output;
  });
}

normalizedRows = normalizedRows
  .map((row, index) => ({ ...row, __rowNumber: index + 1 }))
  .filter(row => Object.entries(row).some(([key, value]) => !key.startsWith('__') && !isMissing(value)));

if (normalizedRows.length === 0) throw new Error('The spreadsheet has columns but no non-empty data rows.');

return normalizedRows.map(row => ({ json: row }));
