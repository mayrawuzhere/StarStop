# StarStop — A Super Celestial Playground

Welcome to StarStop: an Expo-based app shell with a cosmic data pipeline that harvests planetary positions for people in a CSV and prepares those results for downstream LLM workflows.

Think of this repo as two cosmic engines working together:

- The mobile app (an Expo project) in `star-stop/` — the earthly interface.
- The astro data pipeline (node scripts) under `star-stop/scripts/` — the part that talks to an astrology API and stores per-person planetary data for later analysis or for sending into a model like Google Gemini.

Table of contents
- What this repo contains
- Quick start (run the app)
- Fetching celestial data (the astro pipeline)
- Output format & Gemini prep
- Security & environment
- Next steps & ideas (celestial)

What this repo contains
- `star-stop/` — an Expo app scaffold created with create-expo-app. Edit `app/` to change the mobile UI.
- `star-stop/scripts/fetch-astro.js` — a Node script that reads `star-stop/data/csv/f1db-drivers-opencage-geocoded-7214233502.csv`, calls a planetary-positions API for each person, and writes results to `star-stop/data/astro-results/`.
- `star-stop/data/csv/` — CSV sources used by the pipeline.
- `star-stop/data/astro-results/` — where the API responses land as per-row JSON files and an `aggregate.jsonl` (one JSON per line) ready for streaming into a model pipeline.

Quick start — run the Expo app
1. Install dependencies (repo root or inside `star-stop/`):

```bash
cd star-stop
npm install
```

2. Start the Expo dev server

```bash
npx expo start
```

Fetching celestial data (astro pipeline)
This repo includes a small Node script that posts each person from the CSV to an astrology endpoint and saves the response.

1. Add your credentials to `star-stop/.env.local` (this file is gitignored):

```bash
export ASTRO_API_KEY='your-api-key-here'
export ASTRO_AUTH_TOKEN='your-bearer-token-here'
```

2. (Optional) source the file into your shell, or the script auto-loads it for you:

```bash
# from repo root — the script will auto-load star-stop/.env.local
npm --prefix star-stop run fetch-astro

# or change into the folder and run
cd star-stop
npm run fetch-astro
```

What the fetch script does
- Reads `star-stop/data/csv/f1db-drivers-opencage-geocoded-7214233502.csv`.
- For each row it sends a multipart/form POST to the astro API (`/western-api/v1/planetary-positions`).
- Saves each response to `star-stop/data/astro-results/<safe-name>-YYYY-MM-DD.json` and appends a line to `star-stop/data/astro-results/aggregate.jsonl`.

Output format & Gemini prep
- Per-row JSON files include the original row and the API response (status, ok, body). Example filename: `Alexander_Albon-1996-03-23.json`.
- `aggregate.jsonl` has one JSON object per line: { row, result }

This JSONL format is convenient for streaming into LLMs. If you want a ready-to-send Gemini prompt envelope, an additional helper can:
- Map/flatten response fields into a concise JSON object per person.
- Build few-shot or single-shot prompt templates that pass planetary positions and metadata as structured context to the model.

Security
- `star-stop/.env.local` is included in `.gitignore`. Do not commit secrets.
- Be cautious when pasting or sharing outputs that contain tokens or PII. Consider redacting sensitive fields before uploading or sharing.

Next steps & celestial ideas
- Add retries and exponential backoff for the astro fetcher to handle transient API errors.
- Create a `scripts/prepare-gemini.js` helper that converts `aggregate.jsonl` into a single prompt or a batch of JSON documents ready for Gemini.
- Add provenance metadata: stamp each result with request time, API version, and request id so you can audit model inputs.
- Visualize results: build an Expo screen that pulls the per-person planetary data and shows glyphs and positions in a simple sky-chart.

Enjoy the cosmos ✨
