// Node: Code - Create Row Batches
// Type: Code | Mode: Run Once for All Items
// Purpose: Split rows into batches (large-file safety, keeps memory usage low).

const input = $input.first().json;
const rows = input.originalRows || [];
const beforeProfile = input.beforeProfile;
const BATCH_SIZE = 1000; // adjust based on available memory

if (!Array.isArray(rows) || rows.length === 0) throw new Error('No original rows found for batching.');

const batches = [];
for (let start = 0; start < rows.length; start += BATCH_SIZE) {
  batches.push(rows.slice(start, start + BATCH_SIZE));
}

return batches.map((batchRows, index) => ({
  json: { batchIndex: index + 1, totalBatches: batches.length, batchSize: batchRows.length, batchRows, beforeProfile }
}));
