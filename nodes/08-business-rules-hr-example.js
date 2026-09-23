// Node: Code - Business Rules (HR/Employee example) (runs inside Loop Over Items)
// Type: Code | Mode: Run Once for All Items
// Purpose: Industry-specific validation rules. This is the HR/Employee example —
// swap this ONE node for a different industry (e.g., Grocery/Retail) while
// Quality Analysis and Report Generator stay untouched, because this node
// supplies its own label metadata (actionMeta) and breakdown data (flaggedIssues).

const CONFIG = {
  salaryColumns: ['salary', 'income', 'compensation', 'wage'],
  departmentColumns: ['department', 'dept', 'division', 'team'],
  genderColumns: ['gender', 'sex'],
  statusColumns: ['status', 'employment status', 'active status', 'account status'],

  salaryPlaceholders: ['not provided', 'not available', 'n/a', 'na', 'unknown', 'tbd', 'none', '-', '--', 'null'],

  departmentMap: {
    'hr': 'Human Resources', 'human resource': 'Human Resources', 'human resources': 'Human Resources', 'humanresources': 'Human Resources',
    'it': 'IT', 'information technology': 'IT', 'tech': 'IT', 'technology': 'IT',
    'sales': 'Sales', 'sale': 'Sales', 'sales dept': 'Sales',
    'marketing': 'Marketing', 'markting': 'Marketing', 'markeing': 'Marketing', 'mktg': 'Marketing',
    'finance': 'Finance', 'finanace': 'Finance', 'fin': 'Finance', 'accounts': 'Finance', 'accounting': 'Finance',
    'operations': 'Operations', 'ops': 'Operations', 'operation': 'Operations',
    'customer support': 'Customer Support', 'support': 'Customer Support', 'customer service': 'Customer Support', 'cs': 'Customer Support',
    'logistics': 'Logistics', 'logisitcs': 'Logistics', 'log': 'Logistics',
    'admin': 'Administration', 'administration': 'Administration',
    'quality assurance': 'Quality Assurance', 'qa': 'Quality Assurance',
    'research & development': 'Research & Development', 'research and development': 'Research & Development', 'r&d': 'Research & Development',
    'procurement': 'Procurement', 'purchasing': 'Procurement',
    'legal affairs': 'Legal Affairs', 'legal': 'Legal Affairs'
  },
  departmentPatterns: [
    { test: /^hr\b|human\s*res/i, value: 'Human Resources' },
    { test: /^i\.?t\.?$|inform.*tech|^tech/i, value: 'IT' },
    { test: /^sale/i, value: 'Sales' },
    { test: /^mark|^mktg/i, value: 'Marketing' },
    { test: /^fin|account/i, value: 'Finance' },
    { test: /^op(s|eration)/i, value: 'Operations' },
    { test: /support|customer\s*serv|^cs\b/i, value: 'Customer Support' },
    { test: /log(istics)?/i, value: 'Logistics' },
    { test: /admin/i, value: 'Administration' }
  ],
  genderMap: { 'm': 'Male', 'male': 'Male', 'man': 'Male', 'boy': 'Male', 'f': 'Female', 'female': 'Female', 'woman': 'Female', 'girl': 'Female', 'o': 'Other', 'other': 'Other', 'non-binary': 'Other', 'nonbinary': 'Other' },
  statusMap: { 'active': 'Active', 'actve': 'Active', 'activ': 'Active', 'inactive': 'Inactive', 'in-active': 'Inactive', 'in active': 'Inactive', 'inactve': 'Inactive', 'pending': 'Pending', 'suspended': 'Suspended', 'terminated': 'Terminated', 'on leave': 'On Leave', 'onleave': 'On Leave' }
};

function headerMatches(header, keywordList) { const h = String(header || '').toLowerCase(); return keywordList.some(k => h.includes(k)); }
function cleanKey(value) { return String(value).trim().replace(/\./g, '').replace(/\s+/g, ' ').toLowerCase(); }
function isBlank(value) { return value === null || value === undefined || String(value).trim() === ''; }
function isSalaryPlaceholder(value) { if (isBlank(value)) return true; return CONFIG.salaryPlaceholders.includes(cleanKey(value)); }
function isNegativeSalary(value) {
  if (isBlank(value)) return false;
  if (typeof value === 'number') return value < 0;
  const text = String(value).trim();
  return text.startsWith('-') && /\d/.test(text);
}
function normalizeByMap(value, map, patterns = []) {
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  const key = cleanKey(trimmed);
  if (map[key]) return { value: map[key], matched: true };
  for (const p of patterns) if (p.test.test(trimmed)) return { value: p.value, matched: true };
  const titleCased = trimmed.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { value: titleCased, matched: false };
}

const inputItems = $input.all();
const outputItems = [];

for (const item of inputItems) {
  const batch = item.json;
  const actions = {
    negativeSalariesFlagged: 0, salaryPlaceholdersBlanked: 0,
    departmentsStandardized: 0, unknownDepartmentsFlagged: 0,
    gendersStandardized: 0, unknownGendersFlagged: 0,
    statusesStandardized: 0, unknownStatusesFlagged: 0
  };
  const unknownDepartments = [], unknownGenders = [], unknownStatuses = [];

  const processedRows = (batch.cleanedBatchRows || []).map((row, rowIndex) => {
    const output = { ...row };
    const rowIdentifier = row.FullName || row.Name || row.Email || `Row ${rowIndex + 1}`;

    for (const column of Object.keys(row)) {
      const value = output[column];

      if (headerMatches(column, CONFIG.salaryColumns)) {
        if (isSalaryPlaceholder(value)) { output[column] = null; actions.salaryPlaceholdersBlanked += 1; }
        else if (isNegativeSalary(value)) { actions.negativeSalariesFlagged += 1; } // value stays UNCHANGED
        continue;
      }
      if (headerMatches(column, CONFIG.departmentColumns)) {
        if (isBlank(value)) continue;
        const r = normalizeByMap(value, CONFIG.departmentMap, CONFIG.departmentPatterns);
        output[column] = r.value;
        if (r.matched) actions.departmentsStandardized += 1;
        else { actions.unknownDepartmentsFlagged += 1; unknownDepartments.push({ row: rowIdentifier, column, value: r.value }); }
        continue;
      }
      if (headerMatches(column, CONFIG.genderColumns)) {
        if (isBlank(value)) continue;
        const r = normalizeByMap(value, CONFIG.genderMap);
        output[column] = r.value;
        if (r.matched) actions.gendersStandardized += 1;
        else { actions.unknownGendersFlagged += 1; unknownGenders.push({ row: rowIdentifier, column, value: r.value }); }
        continue;
      }
      if (headerMatches(column, CONFIG.statusColumns)) {
        if (isBlank(value)) continue;
        const r = normalizeByMap(value, CONFIG.statusMap);
        output[column] = r.value;
        if (r.matched) actions.statusesStandardized += 1;
        else { actions.unknownStatusesFlagged += 1; unknownStatuses.push({ row: rowIdentifier, column, value: r.value }); }
        continue;
      }
    }
    return output;
  });

  const combinedActions = { ...(batch.actions || {}) };
  for (const [key, value] of Object.entries(actions)) combinedActions[key] = (combinedActions[key] || 0) + value;

  // actionMeta: tells Report Generator how to LABEL each action key (dynamic, no hardcoding downstream)
  const actionMeta = {
    negativeSalariesFlagged: { label: 'Negative Salaries Flagged (left unchanged — manual review required)', type: 'Flagged' },
    salaryPlaceholdersBlanked: { label: 'Salary placeholders cleared to blank', type: 'Standardized' },
    departmentsStandardized: { label: 'Department names standardized', type: 'Standardized' },
    unknownDepartmentsFlagged: { label: 'Unknown Departments Flagged (left as-is)', type: 'Flagged' },
    gendersStandardized: { label: 'Gender values standardized', type: 'Standardized' },
    unknownGendersFlagged: { label: 'Unknown Genders Flagged (left as-is)', type: 'Flagged' },
    statusesStandardized: { label: 'Status values standardized', type: 'Standardized' },
    unknownStatusesFlagged: { label: 'Unknown Statuses Flagged (left as-is)', type: 'Flagged' }
  };

  // flaggedIssues: tells Quality Analysis what to show in the Validation Breakdown table (dynamic)
  const flaggedIssues = [];
  if (actions.negativeSalariesFlagged > 0) flaggedIssues.push({ category: 'Negative Salaries (Flagged, Unchanged)', count: actions.negativeSalariesFlagged });
  if (actions.unknownDepartmentsFlagged > 0) flaggedIssues.push({ category: 'Unknown Departments', count: actions.unknownDepartmentsFlagged });
  if (actions.unknownGendersFlagged > 0) flaggedIssues.push({ category: 'Unknown Genders', count: actions.unknownGendersFlagged });
  if (actions.unknownStatusesFlagged > 0) flaggedIssues.push({ category: 'Unknown Statuses', count: actions.unknownStatusesFlagged });

  outputItems.push({
    json: {
      batchIndex: batch.batchIndex, totalBatches: batch.totalBatches, cleanedBatchRows: processedRows,
      actions: combinedActions, actionMeta, flaggedIssues,
      beforeProfile: batch.beforeProfile, validationIssues: batch.validationIssues || [],
      unknownDepartments, unknownGenders, unknownStatuses
    }
  });
}

return outputItems;
