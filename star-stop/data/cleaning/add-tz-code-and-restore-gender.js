#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../csv');
const driversFile = path.join(dataDir, 'f1db-drivers-opencage-geocoded-7214233502.csv');
const backupFile = path.join(dataDir, 'f1db-drivers.csv.bak');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  if (!lines[0].includes(',')) lines.shift();
  if (lines.length === 0) return { headers: [], rows: [] };
  const headerLine = lines.shift();
  const headers = parseCsvLine(headerLine);
  const rows = lines.map((ln) => parseCsvLine(ln)).filter((r) => r.length > 0);
  return { headers, rows: rows.map((cols) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = cols[i] === undefined ? '' : cols[i];
    return obj;
  }) };
}

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur !== '' || line.endsWith(',')) res.push(cur);
  return res;
}

function quote(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
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

function getOffsetMinutesForTimeZone(tz) {
  if (!tz) return null;
  try {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = dtf.formatToParts(now);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const year = Number(map.year), month = Number(map.month), day = Number(map.day);
    const hour = Number(map.hour), minute = Number(map.minute), second = Number(map.second);
    const tzTime = Date.UTC(year, month - 1, day, hour, minute, second);
    const utc = now.getTime();
    // offset minutes = (tzTime - utc) / 60000
    const offsetMin = Math.round((tzTime - utc) / 60000);
    return offsetMin;
  } catch (e) {
    return null;
  }
}

function offsetMinutesToCode(mins) {
  if (mins === null || mins === undefined) return '';
  // convert to hours, rounding to nearest integer
  const hours = Math.round(mins / 60);
  return String(hours);
}

function main() {
  if (!fs.existsSync(driversFile)) { console.error('drivers file not found:', driversFile); process.exit(1); }
  if (!fs.existsSync(backupFile)) { console.error('backup file not found:', backupFile); process.exit(1); }

  const currentRaw = fs.readFileSync(driversFile, 'utf8');
  const backupRaw = fs.readFileSync(backupFile, 'utf8');

  const current = parseCsv(currentRaw);
  const backup = parseCsv(backupRaw);

  // build name -> gender map from backup
  const genderMap = new Map();
  for (const r of backup.rows) {
    const name = (r.name || '').trim();
    const gender = (r.gender || r.Gender || '').trim();
    if (name) genderMap.set(name, gender);
  }

  // Ensure tzOffsetCode and gender columns exist
  const tzCol = 'tzOffsetCode';
  if (!current.headers.includes(tzCol)) current.headers.push(tzCol);
  const genderCol = 'gender';
  if (!current.headers.includes(genderCol)) current.headers.push(genderCol);

  // try to find any header that contains 'timezone' to support different CSVs
  const tzHeader = current.headers.find(h => /timezone/i.test(h)) || null;

  for (const r of current.rows) {
    const placeTz = (r.placeOfBirth_tz || '').trim();
    const countryTz = (r.countryOfBirth_tz || '').trim();
    const otherTz = tzHeader ? String(r[tzHeader] || '').trim() : '';
    let tz = placeTz || countryTz || otherTz || '';
    let offsetMins = null;
    if (tz) offsetMins = getOffsetMinutesForTimeZone(tz);
    // if offset couldn't be determined and tz looks like an offset (+01:00), parse it
    if (offsetMins === null && tz) {
      // normalize offsets like +0100 -> +01:00
      const norm = tz.replace(/^(\+|\-)(\d{2})(\d{2})$/, (_, s, h, m) => `${s}${h}:${m}`);
      const m = norm.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
      if (m) {
        const sign = m[1] === '-' ? -1 : 1;
        const hh = Number(m[2]);
        const mm = m[3] ? Number(m[3]) : 0;
        offsetMins = sign * (hh * 60 + mm);
      }
    }
    r[tzCol] = offsetMinutesToCode(offsetMins);

    // restore gender from backup by name match
    const name = (r.name || '').trim();
    const g = genderMap.get(name) || '';
    r[genderCol] = g;
  }

  // backup current
  const outBackup = driversFile + '.tzgender.bak';
  fs.copyFileSync(driversFile, outBackup);

  const out = stringifyCsv(current.rows, current.headers);
  fs.writeFileSync(driversFile, out, 'utf8');

  console.log(`Wrote ${current.rows.length} rows to ${driversFile} (backup at ${outBackup})`);
}

if (require.main === module) main();
