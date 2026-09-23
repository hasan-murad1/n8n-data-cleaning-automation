// Node: Code - Validation & Find Replace (runs inside Loop Over Items)
// Type: Code | Mode: Run Once for All Items
// Purpose: PURE AUDITING for Email and Phone — flags format issues without
// modifying values. Salary/date checks live in Data Formatting and Business
// Rules instead, to avoid double-processing the same fields in two nodes.

const CONFIG = {
  emailColumns: ['email', 'e-mail', 'mail address'],
  phoneColumns: ['phone', 'mobile', 'contact no', 'contact number', 'whatsapp', 'cell'],
  findReplaceMap: { 'n/a': null, 'na': null, 'tbd': null, 'unknown': null, 'none': null, '--': null, '-': null, 'null': null }
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function headerMatches(header, keywordList) {
  const h = String(header || '').toLowerCase();
  return keywordList.some(k => h.includes(k));
}
function isInvalidDateObject(value) { return value instanceof Date && Number.isNaN(value.getTime()); }
function applyFindReplace(value, map) {
  const text = String(value).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, text) ? { changed: true, value: map[text] } : { changed: false, value };
}

const inputItems = $input.all();
const outputItems = [];

for (const item of inputItems) {
  const batch = item.json;
  const actions = { findReplaceApplied: 0, invalidEmailsFlagged: 0, invalidPhonesFlagged: 0, corruptedDateObjectsNormalized: 0 };
  const batchValidationIssues = [];
  let flaggedRowCount = 0;

  const validatedRows = (batch.cleanedBatchRows || []).map((row, rowIndex) => {
    const output = { ...row };
    const rowIssues = [];

    for (const column of Object.keys(row)) {
      let value = output[column];
      if (value === null || value === undefined || value === '') continue;

      if (isInvalidDateObject(value)) { actions.corruptedDateObjectsNormalized += 1; output[column] = null; continue; }

      const fr = applyFindReplace(value, CONFIG.findReplaceMap);
      if (fr.changed) { output[column] = fr.value; actions.findReplaceApplied += 1; value = fr.value; continue; }

      if (value !== 'Not Provided') {
        if (headerMatches(column, CONFIG.emailColumns)) {
          if (!EMAIL_REGEX.test(String(value).trim())) { rowIssues.push({ column, issue: 'invalid_email_format', value }); actions.invalidEmailsFlagged += 1; }
        } else if (headerMatches(column, CONFIG.phoneColumns)) {
          const digitsOnly = String(value).replace(/[^\d]/g, '');
          if (digitsOnly.length < 7 || digitsOnly.length > 15) { rowIssues.push({ column, issue: 'invalid_phone_format', value }); actions.invalidPhonesFlagged += 1; }
        }
      }
    }

    if (rowIssues.length > 0) {
      flaggedRowCount += 1;
      const rowIdentifier = row.CustomerName || row.Name || row.FullName || row.Email || `Row ${rowIndex + 1}`;
      batchValidationIssues.push({ row: rowIdentifier, issues: rowIssues });
    }
    return output;
  });

  const combinedActions = { ...(batch.actions || {}) };
  for (const [key, value] of Object.entries(actions)) combinedActions[key] = (combinedActions[key] || 0) + value;
  combinedActions.rowsWithValidationIssues = (combinedActions.rowsWithValidationIssues || 0) + flaggedRowCount;

  outputItems.push({
    json: {
      batchIndex: batch.batchIndex, totalBatches: batch.totalBatches, cleanedBatchRows: validatedRows,
      actions: combinedActions, beforeProfile: batch.beforeProfile, validationIssues: batchValidationIssues
    }
  });
}

return outputItems;
