# ISM6427 Music — Waveform Studio

An AI music generator web app powered by [SunoAPI.org](https://docs.sunoapi.org/), built for Netlify.

## Features
- **Simple mode** — describe a vibe; AI writes the lyrics, music and vocals.
- **Custom mode** — your own title, style tags, lyrics, vocal gender, length, styles to exclude, style weight, weirdness and variety.
- **✨ AI lyrics** — generate lyrics from a short idea, then use them in Custom mode.
- Instrumental toggle and model picker (V6, V6 Mini, V6 Wild).
- Live progress with streaming previews; each request gives two takes, with cover art, a player, downloads and lyrics.
- Library saved in the browser. Remaining API credits shown in the header.

## How it works
```
public/            static frontend (HTML/CSS/JS, no build step)
netlify/functions/ serverless proxy to https://api.sunoapi.org
  generate.mjs  POST /api/generate   -> POST /api/v1/generate
  status.mjs    GET  /api/status     -> GET  /api/v1/generate/record-info
  lyrics.mjs    POST/GET /api/lyrics -> /api/v1/lyrics (+ record-info)
  credits.mjs   GET  /api/credits    -> GET  /api/v1/generate/credit
  callback.mjs  /api/callback (Suno's required callBackUrl; the app polls)
netlify/lib/suno.mjs shared helpers
```
The Suno API key is only read on the server from an environment variable and never reaches the browser.

## Deploy to Netlify
1. In Netlify: **Add new site → Import an existing project →** pick this repo, branch `main`. Build settings come from `netlify.toml` (publish `public`, functions `netlify/functions`). No build command is needed.
2. **Site configuration → Environment variables**, add:
   - `SUNO_API_KEY` = your SunoAPI.org key (required)
   - `ACCESS_CODE` = any passphrase (optional; if set, visitors must enter it before generating, so strangers can't use up your credits)
3. Deploy, or redeploy after adding the variables.

## Local development
```bash
npm i -g netlify-cli
cp .env.example .env   # fill in SUNO_API_KEY
netlify dev
```
