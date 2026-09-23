// Node: Code - Quality Analysis (runs AFTER Loop Over Items completes — "done" output)
// Type: Code | Mode: Run Once for All Items
// Purpose: Combine all cleaned batches, remove duplicates globally, score
// before/after quality, and build a DYNAMIC validation breakdown + label
// metadata — reads whatever actionMeta/flaggedIssues the Business Rules
// node supplied, with no hardcoded keys. Swap industries by swapping only
// the Business Rules node; this stays untouched.

const batchItems = $input.all().map(item => item.json).sort((a, b) => a.batchIndex - b.batchIndex);
if (batchItems.length === 0) throw new Error('No cleaned batches received.');

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
  if (/^-?\d+(\.\d+)?$/.test(text.replace(/[,৳$£€₹%]/g, ''))) return 'number';
  if (/^(true|false|yes|no|y|n|0|1)$/i.test(text)) return 'boolean';
  if (!Number.isNaN(Date.parse(text)) && /\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|\d{4}-\d{2}-\d{2}/.test(text)) return 'date';
  return 'text';
}
function profileRows(rows) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const totalRows = rows.length, totalColumns = columns.length, totalCells = totalRows * totalColumns;
  let totalMissingCells = 0, mixedTypeColumns = 0, emptyColumns = 0;

  const columnProfiles = columns.map(column => {
    const typeCounts = { missing: 0, number: 0, boolean: 0, date: 0, text: 0 };
    const unique = new Set();
    for (const row of rows) {
      const type = classifyValue(row[column]);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      if (type === 'missing') totalMissingCells += 1; else unique.add(String(row[column]).trim());
    }
    const nonMissingTypes = Object.entries(typeCounts).filter(([t, c]) => t !== 'missing' && c > 0);
    const detectedType = nonMissingTypes.sort((a, b) => b[1] - a[1])[0]?.[0] || 'empty';
    const isMixedType = nonMissingTypes.length > 1;
    if (isMixedType) mixedTypeColumns += 1;
    if ((typeCounts.missing || 0) === totalRows) emptyColumns += 1;
    return { column, detectedType, missingCount: typeCounts.missing, missingPct: totalRows ? Number(((typeCounts.missing / totalRows) * 100).toFixed(2)) : 0, uniqueCount: unique.size, typeCounts, isMixedType, fullyClean: !isMixedType && typeCounts.missing === 0 };
  });

  const seen = new Map();
  let duplicateRows = 0;
  for (const row of rows) { const sig = stableStringify(row); seen.set(sig, (seen.get(sig) || 0) + 1); }
  for (const count of seen.values()) if (count > 1) duplicateRows += count - 1;

  const missingCellPct = totalCells ? (totalMissingCells / totalCells) * 100 : 0;
  const duplicatePct = totalRows ? (duplicateRows / totalRows) * 100 : 0;
  const mixedTypePct = totalColumns ? (mixedTypeColumns / totalColumns) * 100 : 0;
  const emptyColumnPct = totalColumns ? (emptyColumns / totalColumns) * 100 : 0;

  return { totalRows, totalColumns, totalCells, totalMissingCells, missingCellPct: Number(missingCellPct.toFixed(2)), duplicateRows, duplicatePct: Number(duplicatePct.toFixed(2)), mixedTypeColumns, emptyColumns, columnProfiles };
}
function computeScore(missingPct, duplicatePct, mixedTypePct, emptyColumnPct) {
  return Math.max(0, Math.round(100 - Math.min(35, missingPct * 0.6) - Math.min(30, duplicatePct * 1.3) - Math.min(25, mixedTypePct * 0.8) - Math.min(10, emptyColumnPct)));
}
function profileRowsWithScore(p) {
  const mixedTypePctVal = p.totalColumns ? (p.mixedTypeColumns / p.totalColumns) * 100 : 0;
  const emptyColumnPctVal = p.totalColumns ? (p.emptyColumns / p.totalColumns) * 100 : 0;
  return { ...p, qualityScore: computeScore(p.missingCellPct, p.duplicatePct, mixedTypePctVal, emptyColumnPctVal) };
}

const beforeProfile = profileRowsWithScore(batchItems[0].beforeProfile);
const combinedRows = batchItems.flatMap(batch => batch.cleanedBatchRows || []);
const cleaningActions = batchItems.reduce((acc, batch) => {
  for (const [key, value] of Object.entries(batch.actions || {})) acc[key] = (acc[key] || 0) + value;
  return acc;
}, {});

// DYNAMIC: merge label metadata + breakdown issues from whatever Business Rules node supplied
const actionMeta = batchItems.reduce((acc, batch) => ({ ...acc, ...(batch.actionMeta || {}) }), {});
const flaggedIssuesMap = {};
for (const batch of batchItems) for (const issue of (batch.flaggedIssues || [])) flaggedIssuesMap[issue.category] = (flaggedIssuesMap[issue.category] || 0) + issue.count;

const seen = new Set();
const cleanedRows = [];
let duplicatesRemovedAfterCleaning = 0;
for (const row of combinedRows) {
  const sig = stableStringify(row);
  if (seen.has(sig)) duplicatesRemovedAfterCleaning += 1; else { seen.add(sig); cleanedRows.push(row); }
}

const afterProfileRaw = profileRows(cleanedRows);
// KEY FIX: use the ORIGINAL total cell count as denominator for the scoring missing %,
// so duplicate removal never artificially inflates the missing percentage in the score.
const adjustedAfterMissingPct = beforeProfile.totalCells ? Number(((afterProfileRaw.totalMissingCells / beforeProfile.totalCells) * 100).toFixed(2)) : afterProfileRaw.missingCellPct;
const afterProfileForScore = profileRowsWithScore({ ...afterProfileRaw, missingCellPct: adjustedAfterMissingPct });

cleaningActions.duplicatesRemovedAfterCleaning = duplicatesRemovedAfterCleaning;

const allValidationIssues = batchItems.flatMap(batch => batch.validationIssues || []);
const issueCategoryCounts = {};
for (const entry of allValidationIssues) for (const issue of entry.issues || []) issueCategoryCounts[issue.issue] = (issueCategoryCounts[issue.issue] || 0) + 1;
const categoryLabels = { invalid_email_format: 'Invalid Emails', invalid_phone_format: 'Invalid Phone Numbers' };
const validationBreakdown = Object.entries(issueCategoryCounts).map(([key, count]) => ({ category: categoryLabels[key] || key, count }));
for (const [category, count] of Object.entries(flaggedIssuesMap)) validationBreakdown.push({ category, count });
validationBreakdown.sort((a, b) => b.count - a.count);

const topMissingColumns = afterProfileRaw.columnProfiles.filter(c => c.missingCount > 0).sort((a, b) => b.missingPct - a.missingPct).slice(0, 10).map(c => ({ column: c.column, missingCount: c.missingCount, missingPct: c.missingPct }));
const typeIssueColumns = afterProfileRaw.columnProfiles.filter(c => c.isMixedType).map(c => ({ column: c.column, detectedType: c.detectedType, typeCounts: c.typeCounts }));
const fullyCleanColumns = afterProfileRaw.columnProfiles.filter(c => c.fullyClean).map(c => c.column);

function buildRecommendation(score, topMissingCols, typeIssueCols, valBreakdown) {
  const actionItems = [];
  if (topMissingCols.length > 0) { const worst = topMissingCols[0]; actionItems.push(`verify data completeness in "${worst.column}" (${worst.missingPct}% missing)`); }
  if (typeIssueCols.length > 0) actionItems.push(`confirm data formats in ${typeIssueCols.slice(0, 2).map(c => c.column).join(' and ')}`);
  for (const item of (valBreakdown || []).slice(0, 3)) actionItems.push(`review ${item.count} record${item.count > 1 ? 's' : ''} flagged under "${item.category}"`);

  if (score >= 90 && actionItems.length === 0) return 'This dataset is in excellent condition and is ready for business reporting, analysis, or dashboard use.';
  if (actionItems.length === 0) return score >= 70 ? 'This dataset is usable for most purposes. No major action items were identified.' : 'This dataset needs manual review before business reporting or dashboard use.';

  const urgency = score >= 70 ? 'Before critical business decisions, we recommend addressing the following' : 'This dataset requires manual review before business use. Priority items';
  return `${urgency}: ${actionItems.join('; ')}. These issues are common in raw data and are typically resolved with quick source-level corrections.`;
}

const recommendation = buildRecommendation(afterProfileForScore.qualityScore, topMissingColumns, typeIssueColumns, validationBreakdown);

const aiPromptData = {
  before: { rows: beforeProfile.totalRows, columns: beforeProfile.totalColumns, qualityScore: beforeProfile.qualityScore, missingCellPct: beforeProfile.missingCellPct, duplicateRows: beforeProfile.duplicateRows, mixedTypeColumns: beforeProfile.mixedTypeColumns },
  after: { rows: afterProfileRaw.totalRows, columns: afterProfileRaw.totalColumns, qualityScore: afterProfileForScore.qualityScore, missingCellPct: afterProfileRaw.missingCellPct, duplicateRows: afterProfileRaw.duplicateRows, mixedTypeColumns: afterProfileRaw.mixedTypeColumns },
  topMissingColumns, typeIssueColumns: typeIssueColumns.slice(0, 10), cleaningActions, recommendation, validationBreakdown
};

return [{
  json: {
    cleanedRows, beforeProfile, afterProfile: afterProfileRaw, cleaningActions, actionMeta,
    topMissingColumns, typeIssueColumns, fullyCleanColumns, validationBreakdown,
    qualityScoreBefore: beforeProfile.qualityScore, qualityScoreAfter: afterProfileForScore.qualityScore,
    recommendation, aiPromptData, generatedAt: new Date().toISOString()
  }
}];
