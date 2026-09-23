// Node: Code - Clean Batch (runs inside Loop Over Items)
// Type: Code | Mode: Run Once for All Items
// Purpose: Trim, strip HTML, standardize missing values, convert numbers/booleans.
// NOTE: Date parsing is intentionally NOT done here — it's handled exclusively by
// "Data Formatting" downstream, which has calendar validation. Doing date parsing
// in two places caused a real bug: valid dates like "20/03/2024" were misread here
// and then rejected as invalid later, silently becoming blank.

function isMissing(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim().toLowerCase();
  return ['', 'null', 'undefined', 'n/a', 'na', 'none', '-', '--'].includes(text);
}

const TEXT_ONLY_COLUMN_KEYWORDS = ['phone', 'mobile', 'contact', 'id', 'zip', 'postal', 'code', 'nid', 'account'];
function isTextOnlyColumn(columnName) {
  const lower = String(columnName || '').toLowerCase();
  return TEXT_ONLY_COLUMN_KEYWORDS.some(keyword => lower.includes(keyword));
}

function stripHtmlTags(value) {
  if (typeof value !== 'string') return value;
  let cleaned = value.replace(/<\/?[a-z][\s\S]*?>/gi, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/[,৳$£€₹]/g, '');
  if (/^-?\d+(\.\d+)?%?$/.test(text)) return text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text);
  return value;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(text)) return true;
  if (['false', 'no', 'n', '0'].includes(text)) return false;
  return value;
}

function cleanValue(value, detectedType, columnName, actions) {
  let output = value;

  if (typeof output === 'string') {
    const stripped = stripHtmlTags(output);
    if (stripped !== output) actions.htmlTagsStripped += 1;
    output = stripped;
  }
  if (typeof output === 'string') {
    const trimmed = output.trim().replace(/\s+/g, ' ');
    if (trimmed !== output) actions.trimmedCells += 1;
    output = trimmed;
  }
  if (isMissing(output)) { actions.standardizedMissingValues += 1; return null; }
  if (isTextOnlyColumn(columnName)) return String(output);

  const before = output;
  if (detectedType === 'number') output = parseNumber(output);
  if (detectedType === 'boolean') output = parseBoolean(output);
  if (before !== output) {
    if (detectedType === 'number') actions.convertedNumbers += 1;
    if (detectedType === 'boolean') actions.convertedBooleans += 1;
  }
  return output;
}

const inputItems = $input.all();
const outputItems = [];

for (const item of inputItems) {
  const batch = item.json;
  const profile = batch.beforeProfile || {};
  const columnTypeMap = Object.fromEntries((profile.columnProfiles || []).map(col => [col.column, col.detectedType]));

  const actions = { trimmedCells: 0, standardizedMissingValues: 0, convertedNumbers: 0, convertedBooleans: 0, htmlTagsStripped: 0 };

  const cleanedBatchRows = (batch.batchRows || []).map(row => {
    const clean = {};
    for (const column of Object.keys(row)) clean[column] = cleanValue(row[column], columnTypeMap[column] || 'text', column, actions);
    return clean;
  });

  outputItems.push({ json: { batchIndex: batch.batchIndex, totalBatches: batch.totalBatches, cleanedBatchRows, actions, beforeProfile: profile } });
}

return outputItems;
