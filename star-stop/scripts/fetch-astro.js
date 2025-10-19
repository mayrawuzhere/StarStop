#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Config
const CSV_PATH = path.resolve(__dirname, '../data/csv/f1db-drivers-opencage-geocoded-7214233502.csv');
const OUT_DIR = path.resolve(__dirname, '../data/astro-results');
const CONCURRENCY = 8;

const ASTRO_API_URL = 'https://astroapi-4.divineapi.com/western-api/v1/planetary-positions';
// Auto-load .env.local (if present) so users don't have to `source` it manually.
function loadEnvLocal() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((raw) => {
      let line = raw.trim();
      if (!line || line.startsWith('#')) return;
      if (line.startsWith('export ')) line = line.replace(/^export\s+/, '');
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) return;
      const key = m[1];
      let val = m[2] || '';
      // remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    });
  } catch (err) {
    // ignore errors reading .env.local
  }
}

loadEnvLocal();

const ASTRO_API_KEY = process.env.ASTRO_API_KEY || process.env.ASTRO_KEY;
const ASTRO_AUTH_TOKEN = process.env.ASTRO_AUTH_TOKEN || process.env.ASTRO_TOKEN;

if (!ASTRO_API_KEY || !ASTRO_AUTH_TOKEN) {
  console.error('Missing ASTRO_API_KEY or ASTRO_AUTH_TOKEN environment variables');
  process.exit(1);
}

function parseCSVLine(line) {
  // Simple CSV split for this file (no quoted commas expected in relevant fields)
  const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.trim());
  return {
    name: parts[0],
    dateOfBirth: parts[1],
    placeOfBirth: parts[2],
    countryOfBirth: parts[3],
    lat: parts[4],
    lon: parts[5],
    openCageNote: parts[6],
    timezoneOffset: parts[7],
    tzOffsetCode: parts[8],
    gender: parts[9]
  };
}

function datePartsFromISO(isoDate) {
  // isoDate expected YYYY-MM-DD
  if (!isoDate) return { day: '', month: '', year: '' };
  const [year, month, day] = isoDate.split('-');
  return { day: day || '', month: month || '', year: year || '' };
}

async function ensureOutDir() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
}

async function sendRequest(row) {
  const { day, month, year } = datePartsFromISO(row.dateOfBirth);

  const form = new FormData();
  form.append('api_key', ASTRO_API_KEY);
  form.append('full_name', row.name);
  form.append('day', day);
  form.append('month', month);
  form.append('year', year);
  // If time is unknown, send zeros
  form.append('hour', '12');
  form.append('min', '0');
  form.append('sec', '0');
  form.append('gender', (row.gender || '').toLowerCase());
  form.append('place', row.placeOfBirth || '');
  form.append('lat', row.lat || '');
  form.append('lon', row.lon || '');
  form.append('tzone', row.tzOffsetCode);
  form.append('lan', 'en');
  form.append('house_system', 'P');

  const res = await fetch(ASTRO_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ASTRO_AUTH_TOKEN}`
    },
    body: form
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  return { status: res.status, ok: res.ok, body: json };
}

async function worker(queue) {
  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    const safeName = item.name.replace(/[^a-z0-9\-_\.]/gi, '_');
    try {
      const result = await sendRequest(item);
      const outFile = path.join(OUT_DIR, `${safeName}-${item.dateOfBirth}.json`);
      await fs.promises.writeFile(outFile, JSON.stringify({ row: item, result }, null, 2));
      // append to jsonl
      const jsonlLine = JSON.stringify({ row: item, result });
      await fs.promises.appendFile(path.join(OUT_DIR, 'aggregate.jsonl'), jsonlLine + '\n');
      console.log(`Saved ${outFile} (status ${result.status})`);
    } catch (err) {
      console.error('Request failed for', item.name, err && err.message);
    }
    await new Promise(r => setTimeout(r, 200)); // small delay to be polite
  }
}

async function main() {
  await ensureOutDir();

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_PATH),
    crlfDelay: Infinity
  });

  const lines = [];
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    if (!line.trim()) continue;
    const parsed = parseCSVLine(line);
    lines.push(parsed);
  }

  const queue = lines.slice();
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
    workers.push(worker(queue));
  }
  await Promise.all(workers);
  console.log('All done. Results in', OUT_DIR);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
