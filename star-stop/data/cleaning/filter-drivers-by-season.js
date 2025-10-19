#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../csv');
const driversFile = path.join(dataDir, 'f1db-drivers.csv');
const seasonsDriversFile = path.join(dataDir, 'f1db-seasons-drivers.csv');

function parseCsv(text) {
  // remove optional first non-csv header line
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
  // push last
  if (cur !== '' || line.endsWith(',')) res.push(cur);
  return res;
}

function stringifyCsv(records) {
  if (!records || records.length === 0) return '';
  const headers = Object.keys(records[0]);
  const lines = [];
  lines.push(headers.map(quote).join(','));
  for (const r of records) {
    const row = headers.map((h) => quote(r[h] ?? ''));
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

function quote(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function main() {
  if (!fs.existsSync(driversFile)) {
    console.error('drivers file not found:', driversFile);
    process.exit(1);
  }
  if (!fs.existsSync(seasonsDriversFile)) {
    console.error('seasons-drivers file not found:', seasonsDriversFile);
    process.exit(1);
  }

  const driversRaw = fs.readFileSync(driversFile, 'utf8');
  const seasonsRaw = fs.readFileSync(seasonsDriversFile, 'utf8');

  const drivers = parseCsv(driversRaw);
  const seasons = parseCsv(seasonsRaw);

  const allowed = new Set(seasons.map((r) => r.driverId).filter(Boolean));

  const filtered = drivers.filter((d) => allowed.has(d.id));

  console.log(`drivers: ${drivers.length}, allowed: ${allowed.size}, kept: ${filtered.length}`);

  if (filtered.length === 0) {
    console.error('No drivers would be kept — aborting to avoid data loss');
    process.exit(2);
  }

  // Backup original
  fs.copyFileSync(driversFile, driversFile + '.bak');

  const out = stringifyCsv(filtered);
  fs.writeFileSync(driversFile, out, 'utf8');

  console.log('Wrote filtered drivers to', driversFile, '(backup at .bak)');
}

if (require.main === module) {
  main();
}
