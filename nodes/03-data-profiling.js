// Node: Code - Data Profiling
// Type: Code | Mode: Run Once for All Items
// Purpose: Create the "before cleaning" profile — missing values, duplicates, type mix, score.

const rows = $input.all().map(item => stripInternal(item.json));

function stripInternal(row) {
  const output = {};
  for (const [key, value] of Object.entries(row || {})) { if (!key.startsWith('__')) output[key] = value; }
  return output;
}
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}
function isMissing(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim().toLowerCase();
  return ['', 'null', 'undefined', 'n/a', 'na', 'none', '-', '--', 'not provided'].includes(text);
}
function classifyValue(value) {
  if (isMissing(value)) return 'missing';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  const text = String(value).trim();
  const numeric = text.replace(/[,৳$£€₹%]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return 'number';
  if (/^(true|false|yes|no|y|n|0|1)$/i.test(text)) return 'boolean';
  const parsedDate = Date.parse(text);
  if (!Number.isNaN(parsedDate) && /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|\d{4}-\d{2}-\d{2}/.test(text)) return 'date';
  return 'text';
}
function detectType(counts) {
  const candidates = Object.entries(counts).filter(([type]) => type !== 'missing').sort((a, b) => b[1] - a[1]);
  return candidates.length === 0 ? 'empty' : candidates[0][0];
}
function profileRows(inputRows) {
  const columns = Array.from(new Set(inputRows.flatMap(row => Object.keys(row))));
  const totalRows = inputRows.length;
  const totalColumns = columns.length;
  const totalCells = totalRows * totalColumns;
  let totalMissingCells = 0, mixedTypeColumns = 0, emptyColumns = 0;

  const columnProfiles = columns.map(column => {
    const typeCounts = { missing: 0, number: 0, boolean: 0, date: 0, text: 0 };
    const unique = new Set();
    const samples = [];
    for (const row of inputRows) {
      const value = row[column];
      const type = classifyValue(value);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      if (type === 'missing') { totalMissingCells += 1; }
      else { unique.add(String(value).trim()); if (samples.length < 5) samples.push(value); }
    }
    const nonMissing = totalRows - typeCounts.missing;
    const detectedType = detectType(typeCounts);
    const nonMissingTypeCounts = Object.entries(typeCounts).filter(([type]) => type !== 'missing' && typeCounts[type] > 0);
    const isMixedType = nonMissingTypeCounts.length > 1;
    if (isMixedType) mixedTypeColumns += 1;
    if (nonMissing === 0) emptyColumns += 1;
    return {
      column, detectedType, missingCount: typeCounts.missing,
      missingPct: totalRows ? Number(((typeCounts.missing / totalRows) * 100).toFixed(2)) : 0,
      uniqueCount: unique.size, typeCounts, isMixedType, samples
    };
  });

  const seen = new Map();
  let duplicateRows = 0;
  for (const row of inputRows) { const sig = stableStringify(row); seen.set(sig, (seen.get(sig) || 0) + 1); }
  for (const count of seen.values()) if (count > 1) duplicateRows += count - 1;

  const missingCellPct = totalCells ? (totalMissingCells / totalCells) * 100 : 0;
  const duplicatePct = totalRows ? (duplicateRows / totalRows) * 100 : 0;
  const mixedTypePct = totalColumns ? (mixedTypeColumns / totalColumns) * 100 : 0;
  const emptyColumnPct = totalColumns ? (emptyColumns / totalColumns) * 100 : 0;
  const qualityScore = Math.max(0, Math.round(
    100 - Math.min(40, missingCellPct * 0.8) - Math.min(25, duplicatePct * 1.2)
        - Math.min(25, mixedTypePct * 0.9) - Math.min(10, emptyColumnPct)
  ));

  return {
    totalRows, totalColumns, totalCells, totalMissingCells,
    missingCellPct: Number(missingCellPct.toFixed(2)), duplicateRows,
    duplicatePct: Number(duplicatePct.toFixed(2)), mixedTypeColumns, emptyColumns,
    qualityScore, columnProfiles
  };
}

if (rows.length === 0) throw new Error('No rows available for profiling.');
const beforeProfile = profileRows(rows);

return [{ json: { originalRows: rows, beforeProfile, profilingCreatedAt: new Date().toISOString() } }];
