#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const AGG_PATH = path.resolve(__dirname, '../data/astro-results/aggregate.jsonl');
const OUT_DIR = path.resolve(__dirname, '../data/gemini');
const OUT_JSONL = path.join(OUT_DIR, 'gemini-input.jsonl');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function buildDocument(entry) {
  // entry: { row, result }
  const row = entry.row || {};
  const result = (entry.result && entry.result.body && entry.result.body.data) || [];

  const planets = {};
  result.forEach(p => {
    const key = (p.name || '').toLowerCase().replace(/\s+/g, '_');
    planets[key] = {
      name: p.name,
      sign: p.sign,
      full_degree: p.full_degree,
      house: p.house,
      longitude: p.longitude,
      is_retro: p.is_retro === 'true' || p.is_retro === true
    };
  });

  const doc = {
    id: `${row.name || 'unknown'}::${row.dateOfBirth || ''}`,
    name: row.name,
    dateOfBirth: row.dateOfBirth,
    placeOfBirth: row.placeOfBirth,
    lat: row.lat,
    lon: row.lon,
    gender: row.gender,
    timezoneOffset: row.timezoneOffset,
    planets
  };

  return doc;
}

function makePrompt(doc) {
  // Simple prompt template: structured JSON context + instruction
  const summary = {
    name: doc.name,
    dateOfBirth: doc.dateOfBirth,
    placeOfBirth: doc.placeOfBirth,
    planets: Object.keys(doc.planets).reduce((acc, k) => {
      const p = doc.planets[k];
      acc[k] = { sign: p.sign, full_degree: p.full_degree, house: p.house };
      return acc;
    }, {})
  };

  const prompt = `You are given the planetary positions for a person as structured JSON. Create a concise, human-friendly summary (2-4 sentences) of key astrological highlights. Return JSON with keys: { summary_text, highlights } where highlights is an array of short strings describing notable placements.`;

  return { prompt, context: summary };
}

function main() {
  if (!fs.existsSync(AGG_PATH)) {
    console.error('aggregate.jsonl not found at', AGG_PATH);
    process.exit(1);
  }

  ensureOutDir();
  const out = fs.createWriteStream(OUT_JSONL, { flags: 'w' });

  const lines = fs.readFileSync(AGG_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const doc = buildDocument(parsed);
      const promptObj = makePrompt(doc);
      const outObj = { doc, prompt: promptObj };
      out.write(JSON.stringify(outObj) + '\n');
    } catch (err) {
      console.error('skipping invalid line', err && err.message);
    }
  }
  out.end();
  console.log('Wrote', OUT_JSONL);
}

main();
