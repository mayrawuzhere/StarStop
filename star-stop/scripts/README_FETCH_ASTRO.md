Fetch Astro data for rows in CSV

Place your credentials in environment variables and run the script.

Required environment variables:

- ASTRO_API_KEY  - the form api key for the astro provider
- ASTRO_AUTH_TOKEN - the bearer token for Authorization header

Install dependencies (from the `star-stop` directory):

```bash
npm install node-fetch@2 form-data
```

Run:

```bash
npm run fetch-astro
```

Outputs are written to `data/astro-results/` as per-row JSON files and `aggregate.jsonl` (one JSON per line) ready to feed into a LLM pipeline such as Google Gemini.
