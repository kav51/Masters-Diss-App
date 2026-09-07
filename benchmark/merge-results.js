

const fs = require('fs');
const path = require('path');

// --- UPDATE THESE TWO FILENAMES to match your actual files ---
const ORIGINAL_FILE = 'results-scenarios-1788362785891.csv';
const COLDLOAD_RERUN_FILE = 'results-coldload-rerun-1788364397127.csv';
// ----------------------------------------------------------------

const RESULTS_DIR = path.join(__dirname, 'results');
const OUTPUT_FILE = path.join(RESULTS_DIR, `results-MERGED-${Date.now()}.csv`);

function readCsvLines(filename) {
  const fullPath = path.join(RESULTS_DIR, filename);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0];
  const rows = lines.slice(1);
  return { header, rows };
}

const original = readCsvLines(ORIGINAL_FILE);
const coldloadRerun = readCsvLines(COLDLOAD_RERUN_FILE);


if (original.header !== coldloadRerun.header) {
  console.error('ERROR: CSV headers do not match between the two files. Aborting merge.');
  console.error('Original header:', original.header);
  console.error('Rerun header:', coldloadRerun.header);
  process.exit(1);
}

const originalWithoutColdLoad = original.rows.filter((line) => !line.startsWith('cold-load,'));

const droppedCount = original.rows.length - originalWithoutColdLoad.length;
console.log(`Original file: ${original.rows.length} rows total`);
console.log(`Dropped ${droppedCount} old cold-load rows (should be 270)`);
console.log(`Adding ${coldloadRerun.rows.length} corrected cold-load rows (should be 270)`);

const mergedRows = [...originalWithoutColdLoad, ...coldloadRerun.rows];
const mergedContent = [original.header, ...mergedRows].join('\n') + '\n';

fs.writeFileSync(OUTPUT_FILE, mergedContent);

console.log(`\nMerged file written: ${OUTPUT_FILE}`);
console.log(`Total rows: ${mergedRows.length} (should be 1080)`);