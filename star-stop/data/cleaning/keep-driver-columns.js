#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../csv');
const driversFile = path.join(dataDir, 'f1db-drivers.csv');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l !== '');
  if (lines.length === 0) return [];
  if (!lines[0].includes(',')) lines.shift();
  if (lines.length === 0) return [];
  const headerLine = lines.shift();
  const headers = parseCsvLine(headerLine);
  const rows = lines.map((ln) => parseCsvLine(ln)).filter((r) => r.length > 0);
  return rows.map((cols) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = cols[i] === undefined ? '' : cols[i];
    }
    return obj;
  });
}

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || line.endsWith(',')) res.push(cur);
  return res;
}

function quote(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function stringifyCsv(records, headers) {
  const lines = [];
  lines.push(headers.map(quote).join(','));
  for (const r of records) {
    const row = headers.map((h) => quote(r[h] ?? ''));
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

function main() {
  if (!fs.existsSync(driversFile)) {
    console.error('drivers file not found:', driversFile);
    process.exit(1);
  }

  const raw = fs.readFileSync(driversFile, 'utf8');
  const rows = parseCsv(raw);

  // Desired output columns and mapping from input header
  const outHeaders = ['name', 'dateOfBirth', 'placeOfBirth', 'countryOfBirth'];
  const inputKeyForCountry = 'countryOfBirthCountryId';

  const filtered = rows.map((r) => ({
    name: r.name || '',
    dateOfBirth: r.dateOfBirth || '',
    placeOfBirth: r.placeOfBirth || '',
    countryOfBirth: r[inputKeyForCountry] || r.countryOfBirth || '',
  }));

  if (filtered.length === 0) {
    console.error('No rows found in drivers file — aborting');
    process.exit(2);
  }

  // Backup
  const backup = driversFile + '.cols.bak';
  fs.copyFileSync(driversFile, backup);

  const out = stringifyCsv(filtered, outHeaders);
  fs.writeFileSync(driversFile, out, 'utf8');

  console.log(`Wrote ${filtered.length} rows to ${driversFile} (backup at ${backup})`);
}

if (require.main === module) main();
