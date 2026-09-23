// Node: Code - File Validation
// Type: Code | Mode: Run Once for All Items
// Purpose: Validate uploaded file (extension, MIME type, size) before extraction.

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['csv', 'xls', 'xlsx'];
const ALLOWED_MIME_PARTS = [
  'csv', 'excel', 'spreadsheet', 'vnd.ms-excel',
  'vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

function parseSizeToBytes(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^([0-9.]+)\s*(b|kb|kib|mb|mib|gb|gib)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  const unit = match[2] || 'b';
  const multipliers = { b: 1, kb: 1000, kib: 1024, mb: 1000 ** 2, mib: 1024 ** 2, gb: 1000 ** 3, gib: 1024 ** 3 };
  return Math.round(number * (multipliers[unit] || 1));
}

function getExtension(fileName = '') {
  const clean = String(fileName).split('?')[0].split('#')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

const incoming = $input.first();
const binary = incoming.binary || {};
const binaryKeys = Object.keys(binary);
const binaryKey = binaryKeys.includes('data') ? 'data' : binaryKeys[0];

if (!binaryKey) {
  return [{
    json: {
      valid: false,
      errorMessage: 'No uploaded file found. Upload one CSV, XLS, or XLSX file.',
      checkedAt: new Date().toISOString()
    }
  }];
}

const file = binary[binaryKey];
const fileName = file.fileName || file.filename || 'uploaded_file';
const extension = getExtension(fileName);
const mimeType = String(file.mimeType || '').toLowerCase();
const fileSizeBytes = parseSizeToBytes(file.fileSize ?? file.filesize ?? file.size);

let valid = true;
let errorMessage = '';

if (!ALLOWED_EXTENSIONS.includes(extension)) {
  valid = false;
  errorMessage = `Unsupported file type .${extension || 'unknown'}. Allowed: CSV, XLS, XLSX.`;
}
if (valid && mimeType && !ALLOWED_MIME_PARTS.some(part => mimeType.includes(part))) {
  valid = false;
  errorMessage = `Unsupported MIME type: ${mimeType}. Upload a spreadsheet file.`;
}
if (valid && fileSizeBytes !== null && fileSizeBytes <= 0) {
  valid = false;
  errorMessage = 'The uploaded file is empty.';
}
if (valid && fileSizeBytes !== null && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
  valid = false;
  errorMessage = `File is too large (${fileSizeBytes} bytes). Maximum allowed is ${MAX_FILE_SIZE_BYTES} bytes.`;
}

return [{
  json: {
    valid, errorMessage, binaryKey: 'data', originalBinaryKey: binaryKey,
    fileName, extension, mimeType, fileSizeBytes,
    cleanFileName: fileName.replace(/\.(csv|xls|xlsx)$/i, '') + '_cleaned.xlsx',
    reportFileName: fileName.replace(/\.(csv|xls|xlsx)$/i, '') + '_quality_report.pdf',
    checkedAt: new Date().toISOString()
  },
  binary: { data: file }
}];
