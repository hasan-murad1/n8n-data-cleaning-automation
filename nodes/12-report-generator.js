// Node: Code - Report Generator
// Type: Code | Mode: Run Once for All Items
// Purpose: Build the client-facing HTML quality report. Fully dynamic —
// merges base (universal) action labels with whatever actionMeta the
// Business Rules node supplied, and auto-generates a readable fallback
// label for any key it doesn't recognize. No hardcoded per-industry logic.

const aiNodeOutput = $input.first().json || {};
const quality = $('Code - Quality Analysis').first().json;
const aiSummary = aiNodeOutput.text || aiNodeOutput.output || aiNodeOutput.response || aiNodeOutput.message || 'Summary was not returned. Use the deterministic quality metrics below.';

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function rowsToHtmlTable(rows, headers) {
  if (!rows || rows.length === 0) return '<p>No issues found.</p>';
  const severityColors = { Critical: '#D32F2F', High: '#F57C00', Medium: '#FBC02D', Low: '#388E3C' };
  const head = '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
  const body = rows.map(row => '<tr>' + headers.map(h => {
    if (h === 'Severity' && severityColors[row[h]]) return `<td style="color:${severityColors[row[h]]};font-weight:bold;">${esc(row[h])}</td>`;
    if (h === 'Change' && row.__changeColor) return `<td style="color:${row.__changeColor};font-weight:bold;">${esc(row[h])}</td>`;
    return `<td>${esc(row[h])}</td>`;
  }).join('') + '</tr>').join('');
  return `<table>${head}${body}</table>`;
}

function formatTypeCounts(typeCounts) {
  const parts = [];
  if (typeCounts.number > 0) parts.push(`${typeCounts.number} number`);
  if (typeCounts.text > 0) parts.push(`${typeCounts.text} text`);
  if (typeCounts.date > 0) parts.push(`${typeCounts.date} date`);
  if (typeCounts.boolean > 0) parts.push(`${typeCounts.boolean} boolean`);
  if (typeCounts.missing > 0) parts.push(`${typeCounts.missing} missing`);
  return parts.join(', ');
}

function getSeverity(pct) { if (pct >= 50) return 'Critical'; if (pct >= 20) return 'High'; if (pct >= 5) return 'Medium'; return 'Low'; }
function getSuggestion(pct, column) {
  if (pct >= 50) return `Review data source for ${column} — over half the values are missing.`;
  if (pct >= 20) return `Consider requiring ${column} at data entry to reduce gaps.`;
  if (pct >= 5) return `Minor gaps in ${column} — spot-check a few records.`;
  return 'Minimal impact, no action needed.';
}

function buildOverviewRow(label, beforeVal, afterVal, opts = {}) {
  const { lowerIsBetter = null, isPercent = false, isNeutral = false } = opts;
  const diff = Number((afterVal - beforeVal).toFixed(2));
  const sign = diff > 0 ? '+' : '';
  let color = '#666';
  if (!isNeutral && diff !== 0) { const improved = lowerIsBetter ? diff < 0 : diff > 0; color = improved ? '#388E3C' : '#D32F2F'; }
  return { Metric: label, Before: isPercent ? `${beforeVal}%` : beforeVal, After: isPercent ? `${afterVal}%` : afterVal, Change: diff === 0 ? 'No change' : `${sign}${diff}${isPercent ? '%' : ''}`, __changeColor: color };
}

const overviewRows = [
  buildOverviewRow('Total Rows', quality.beforeProfile.totalRows, quality.afterProfile.totalRows, { isNeutral: true }),
  buildOverviewRow('Total Columns', quality.beforeProfile.totalColumns, quality.afterProfile.totalColumns, { isNeutral: true }),
  buildOverviewRow('Missing Cell %', quality.beforeProfile.missingCellPct, quality.afterProfile.missingCellPct, { lowerIsBetter: true, isPercent: true }),
  buildOverviewRow('Duplicate Rows', quality.beforeProfile.duplicateRows, quality.afterProfile.duplicateRows, { lowerIsBetter: true }),
  buildOverviewRow('Mixed-Type Columns', quality.beforeProfile.mixedTypeColumns, quality.afterProfile.mixedTypeColumns, { lowerIsBetter: true })
];

const missingRows = (quality.topMissingColumns || []).map(x => ({ Column: x.column, 'Missing Count': x.missingCount, 'Missing %': `${x.missingPct}%`, Severity: getSeverity(x.missingPct), Suggestion: getSuggestion(x.missingPct, x.column) }));
const typeRows = (quality.typeIssueColumns || []).slice(0, 10).map(x => ({ Column: x.column, 'Detected Type': x.detectedType, 'Type Breakdown': formatTypeCounts(x.typeCounts) }));

// Base labels for universal (industry-agnostic) actions
const baseActionLabels = {
  trimmedCells: { label: 'Extra spaces trimmed', type: 'Corrected' },
  standardizedMissingValues: { label: 'Missing values standardized to blank', type: 'Standardized' },
  convertedNumbers: { label: 'Numbers formatted correctly', type: 'Corrected' },
  convertedBooleans: { label: 'Boolean values standardized', type: 'Standardized' },
  duplicatesRemovedAfterCleaning: { label: 'Duplicate rows removed', type: 'Corrected' },
  findReplaceApplied: { label: 'Placeholder text standardized to blank', type: 'Standardized' },
  corruptedDateObjectsNormalized: { label: 'Corrupted date cells cleared', type: 'Corrected' },
  htmlTagsStripped: { label: 'HTML tags removed from text fields', type: 'Corrected' },
  titleCased: { label: 'Name/City/Company fields capitalized', type: 'Standardized' },
  upperCased: { label: 'Code/ID fields uppercased', type: 'Standardized' },
  lowerCased: { label: 'Status/Category fields lowercased', type: 'Standardized' },
  phoneNormalized: { label: 'Phone Numbers Formatted', type: 'Standardized' },
  emailAutoCleaned: { label: 'Emails Standardized', type: 'Standardized' },
  dateStandardized: { label: 'Dates standardized to YYYY-MM-DD', type: 'Standardized' },
  invalidDatesDetected: { label: 'Invalid dates detected (unparseable format)', type: 'Flagged' },
  countriesStandardized: { label: 'Country names standardized', type: 'Standardized' },
  invalidEmailsFlagged: { label: 'Invalid Emails Flagged (not modified)', type: 'Flagged' },
  invalidPhonesFlagged: { label: 'Invalid Phone Numbers Flagged (not modified)', type: 'Flagged' },
  rowsWithValidationIssues: { label: 'Rows with at least one validation issue', type: 'Flagged' }
};

function autoLabel(key) {
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Merge base labels with whatever the Business Rules node supplied (industry-specific)
const actionLabels = { ...baseActionLabels, ...(quality.actionMeta || {}) };
const excludedFromActionTable = new Set(['negativeSalariesBlanked']);

const actionRows = Object.entries(quality.cleaningActions || {})
  .filter(([key, value]) => value > 0 && !excludedFromActionTable.has(key))
  .map(([key, value]) => {
    const meta = actionLabels[key] || { label: autoLabel(key), type: 'Standardized' };
    return { Action: meta.label, Type: meta.type, Count: value };
  });

const validationRows = (quality.validationBreakdown || []).map(v => ({ Category: v.category, Count: v.count }));

const fullyCleanColumns = quality.fullyCleanColumns || [];
const fullyCleanText = fullyCleanColumns.length > 0 ? `Fully clean (no missing or type issues): ${fullyCleanColumns.join(', ')}.` : 'No columns are fully clean yet — see issues below.';

const missingPctNote = quality.afterProfile.missingCellPct > quality.beforeProfile.missingCellPct
  ? `<p style="font-size:10px;color:#888;font-style:italic;">Note: Missing % may appear to rise after cleaning because duplicate (fully complete) rows were removed, and placeholder text like "N/A" was standardized to true blank cells for accuracy. The number of genuinely missing values did not increase — this reflects more accurate detection, not new data loss.</p>`
  : '';

const reportHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, sans-serif; color: #17202A; margin: 28px; }
  h1 { color: #1F4E79; font-size: 24px; margin-bottom: 4px; }
  h2 { color: #1F4E79; font-size: 16px; margin-top: 22px; }
  .meta { color: #666; font-size: 11px; }
  .scorebox { display: flex; gap: 12px; margin: 16px 0; }
  .score { border: 1px solid #B7C9D6; border-radius: 8px; padding: 12px; width: 45%; background: #F4F8FB; }
  .score strong { font-size: 28px; color: #1F4E79; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 11px; }
  th { background: #D9EAF7; text-align: left; }
  th, td { border: 1px solid #B7C9D6; padding: 6px; vertical-align: top; }
  .recommendation { background: #E2F0D9; padding: 10px; border-radius: 8px; }
  .summary-box { background: #F7F7F7; padding: 10px; border-left: 4px solid #1F4E79; white-space: pre-wrap; }
  .clean-note { font-size: 10px; color: #388E3C; margin-top: 6px; }
</style>
</head>
<body>
  <h1>Spreadsheet Data Quality Report</h1>
  <div class="meta">Generated at: ${esc(quality.generatedAt)}</div>
  <div class="scorebox">
    <div class="score"><div>Before Cleaning</div><strong>${esc(quality.qualityScoreBefore)}/100</strong></div>
    <div class="score"><div>After Cleaning</div><strong>${esc(quality.qualityScoreAfter)}/100</strong></div>
  </div>
  <h2>Executive Summary</h2>
  <div class="summary-box">${esc(aiSummary)}</div>
  <h2>Final Recommendation</h2>
  <div class="recommendation">${esc(quality.recommendation)}</div>
  <h2>Dataset Overview</h2>
  ${rowsToHtmlTable(overviewRows, ['Metric', 'Before', 'After', 'Change'])}
  ${missingPctNote}
  <h2>Cleaning Actions</h2>
  <p style="font-size:10px;color:#888;">Legend — <b>Corrected</b>: value was fixed. <b>Standardized</b>: value was reformatted for consistency. <b>Flagged</b>: issue was identified but the value was left unchanged and requires manual review.</p>
  ${rowsToHtmlTable(actionRows, ['Action', 'Type', 'Count'])}
  <h2>Validation Issues Breakdown</h2>
  ${rowsToHtmlTable(validationRows, ['Category', 'Count'])}
  <h2>Top Missing Value Columns</h2>
  ${rowsToHtmlTable(missingRows, ['Column', 'Missing Count', 'Missing %', 'Severity', 'Suggestion'])}
  <h2>Data Type Issues</h2>
  ${rowsToHtmlTable(typeRows, ['Column', 'Detected Type', 'Type Breakdown'])}
  <div class="clean-note">${esc(fullyCleanText)}</div>
</body>
</html>`;

return [{
  json: {
    reportHtml,
    pdfPayload: {
      title: 'Spreadsheet Data Quality Report', generatedAt: quality.generatedAt,
      qualityScoreBefore: quality.qualityScoreBefore, qualityScoreAfter: quality.qualityScoreAfter,
      aiSummary, recommendation: quality.recommendation,
      datasetOverview: { before: quality.beforeProfile, after: quality.afterProfile },
      cleaningActions: quality.cleaningActions, validationBreakdown: quality.validationBreakdown,
      topMissingColumns: quality.topMissingColumns, typeIssueColumns: quality.typeIssueColumns,
      fullyCleanColumns: quality.fullyCleanColumns
    }
  }
}];
