// Node: Code - Data Formatting (runs inside Loop Over Items)
// Type: Code | Mode: Run Once for All Items
// Purpose: The single source of truth for dates (calendar-validated), plus
// email auto-fix, phone normalization, country standardization, text casing.
// FIX: strict date parser now retries with day/month swapped when the first
// reading gives an invalid month (>12) — this correctly resolves ambiguous
// formats like "3/18/2015" (MM/DD/YYYY) that would otherwise be wrongly
// rejected as invalid and dropped.

const CONFIG = {
  emailColumns: ['email', 'e-mail', 'mail address'],
  phoneColumns: ['phone', 'mobile', 'contact no', 'contact number', 'whatsapp', 'cell'],
  countryColumns: ['country', 'nation'],
  titleCaseColumns: ['name', 'city', 'company', 'address', 'client', 'customer'], // 'employee' removed — it matched "EmployeeID" and wrongly title-cased ID codes
  upperCaseColumns: ['code', 'sku', 'id no'],
  lowerCaseColumns: ['status', 'category'],
  dateOutputFormat: 'YYYY-MM-DD',
  placeholders: ['not provided', 'n/a', 'null', 'none', 'unknown', 'tbd', '-', '--']
};

function headerMatches(header, keywordList) {
  const h = String(header || '').toLowerCase();
  if (h.endsWith('id') || h === 'id') return false; // never text-transform ID-type columns
  return keywordList.some(k => h.includes(k));
}

function isPlaceholder(value) {
  if (value === null || value === undefined) return true;
  return CONFIG.placeholders.includes(String(value).trim().toLowerCase());
}

function cleanAndNormalizeEmail(value) {
  if (isPlaceholder(value)) return null;
  let email = String(value).trim().toLowerCase();
  email = email.replace(/\s+/g, '').replace(/@{2,}/g, '@').replace(/\.{2,}/g, '.').replace(/,com$/, '.com');
  if (!email.includes('@')) {
    for (const domain of ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']) {
      if (email.includes(domain)) { email = email.replace(domain, `@${domain}`); break; }
    }
  }
  if (email.includes('@')) {
    const domain = email.split('@')[1];
    if (['gmail', 'yahoo', 'hotmail'].includes(domain)) email += '.com';
  }
  return email;
}

function isLeapYear(year) { return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0); }
function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day > 0 && day <= daysInMonth[month - 1];
}

function parseStrictDate(value) {
  if (isPlaceholder(value)) return null;
  const text = String(value).trim();
  if (!text) return null;

  let y = NaN, m = NaN, d = NaN;

  const dmyMatch = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    d = parseInt(dmyMatch[1], 10);
    m = parseInt(dmyMatch[2], 10);
    const tempY = dmyMatch[3];
    y = parseInt(tempY.length === 2 ? '20' + tempY : tempY, 10);

    // Ambiguity fix: if Day/Month reading is invalid because "month" > 12,
    // it's likely actually Month/Day format — swap and retry.
    if (!isValidCalendarDate(y, m, d) && m > 12 && d <= 12) {
      const swapped = d; d = m; m = swapped;
    }
  }

  if (isNaN(y)) {
    const ymdMatch = text.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymdMatch) { y = parseInt(ymdMatch[1], 10); m = parseInt(ymdMatch[2], 10); d = parseInt(ymdMatch[3], 10); }
  }
  if (isNaN(y)) {
    const parsedNative = new Date(text);
    if (!isNaN(parsedNative.getTime())) { y = parsedNative.getFullYear(); m = parsedNative.getMonth() + 1; d = parsedNative.getDate(); }
  }

  if (!isNaN(y) && !isNaN(m) && !isNaN(d) && isValidCalendarDate(y, m, d)) return { year: y, month: m, day: d };
  return null;
}

function formatStrictDate(dateObj, outputFormat) {
  if (!dateObj) return '';
  const y = String(dateObj.year), m = String(dateObj.month).padStart(2, '0'), d = String(dateObj.day).padStart(2, '0');
  if (outputFormat === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
  if (outputFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  return `${y}-${m}-${d}`;
}

function standardizeCountry(value) {
  if (isPlaceholder(value)) return null;
  const cleanedText = String(value).replace(/\./g, '').trim().toUpperCase();
  const countryMap = {
    'USA': 'United States', 'US': 'United States', 'UNITED STATES OF AMERICA': 'United States',
    'CANADA': 'Canada', 'BD': 'Bangladesh', 'BANGLADESH': 'Bangladesh', 'IN': 'India', 'INDIA': 'India',
    'PK': 'Pakistan', 'UK': 'United Kingdom', 'UNITED KINGDOM': 'United Kingdom', 'GB': 'United Kingdom',
    'UAE': 'United Arab Emirates', 'KSA': 'Saudi Arabia'
  };
  if (countryMap[cleanedText]) return countryMap[cleanedText];
  return cleanedText.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function toTitleCase(value) {
  if (isPlaceholder(value)) return value;
  const text = String(value).trim();
  if (!text) return value;
  return text.toLowerCase().split(/(\s+|-)/).map(part => (/^\s+$/.test(part) || part === '-') ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function normalizePhone(value) {
  if (isPlaceholder(value)) return null;
  const original = String(value).trim();
  if (!original) return value;
  const hasPlus = original.startsWith('+');
  const digitsOnly = original.replace(/[^\d]/g, '');
  if (!digitsOnly) return value;
  return hasPlus ? '+' + digitsOnly : digitsOnly;
}

const inputItems = $input.all();
const outputItems = [];

for (const item of inputItems) {
  const batch = item.json;
  const profile = batch.beforeProfile || {};
  const dateColumnNames = new Set((profile.columnProfiles || []).filter(c => c.detectedType === 'date').map(c => c.column));

  const actions = { titleCased: 0, upperCased: 0, lowerCased: 0, phoneNormalized: 0, emailAutoCleaned: 0, dateStandardized: 0, invalidDatesDetected: 0, countriesStandardized: 0 };

  const formattedRows = (batch.cleanedBatchRows || []).map(row => {
    const output = {};
    for (const column of Object.keys(row)) {
      let value = row[column];

      if (isPlaceholder(value)) { output[column] = null; continue; }

      if (headerMatches(column, CONFIG.emailColumns)) { output[column] = cleanAndNormalizeEmail(value); actions.emailAutoCleaned += 1; continue; }
      if (headerMatches(column, CONFIG.phoneColumns)) { output[column] = normalizePhone(value); actions.phoneNormalized += 1; continue; }
      if (headerMatches(column, CONFIG.countryColumns)) { output[column] = standardizeCountry(value); actions.countriesStandardized += 1; continue; }

      if (dateColumnNames.has(column) || headerMatches(column, ['date', 'dob', 'created_at'])) {
        const parsed = parseStrictDate(value);
        if (parsed) { output[column] = formatStrictDate(parsed, CONFIG.dateOutputFormat); actions.dateStandardized += 1; }
        else { output[column] = null; actions.invalidDatesDetected += 1; }
        continue;
      }

      if (headerMatches(column, CONFIG.titleCaseColumns) && typeof value === 'string') { output[column] = toTitleCase(value); actions.titleCased += 1; continue; }
      if (headerMatches(column, CONFIG.upperCaseColumns) && typeof value === 'string') { output[column] = value.toUpperCase(); actions.upperCased += 1; continue; }
      if (headerMatches(column, CONFIG.lowerCaseColumns) && typeof value === 'string') { output[column] = value.toLowerCase(); actions.lowerCased += 1; continue; }

      output[column] = value;
    }
    return output;
  });

  const combinedActions = { ...(batch.actions || {}) };
  for (const [key, value] of Object.entries(actions)) combinedActions[key] = (combinedActions[key] || 0) + value;

  outputItems.push({ json: { batchIndex: batch.batchIndex, totalBatches: batch.totalBatches, cleanedBatchRows: formattedRows, actions: combinedActions, beforeProfile: profile } });
}

return outputItems;
