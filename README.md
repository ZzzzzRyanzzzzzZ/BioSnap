# 🌿 BIOSNAP — Neighborhood Plant Scavenger Hunt

A mobile-first web game: BIOSNAP shows you a plant to track down nearby, you go find it, then snap a photo to prove it. Matches get logged in a running field notebook, and you're ranked against other local explorers.

- **Frontend:** HTML and JavaScript cleanly separated into `public/index.html` and `app.js`, styled with Tailwind CSS via CDN.
- **Backend:** Node.js / Express server (`server.js`).
- **Daily targets:** pulled live from [GBIF](https://www.gbif.org/), the Global Biodiversity Information Facility — not a curated species list. Every target plant was a real, photographed sighting recorded near the user's chosen region.
- **Species ID:** [PlantNet API](https://my.plantnet.org/) (free tier available).
- **Storage:** in-memory only, on the server process. There is currently no database or file persistence — the notebook and leaderboard both reset when the server restarts. See **Extending it** below for how to fix that.

Runs with **zero configuration**: if you don't set up a PlantNet API key, `/api/identify` returns a fallback JSON response so the upload → identify → save workflow still runs end-to-end.

---

## ✨ Features

| Requirement | How it's implemented |
|---|---|
| One-time sign-in gate | On first visit, a modal asks for an explorer name, a region (from a fixed dropdown), and a passcode; saved to `localStorage` so it only appears once per device |
| The hunt | `GET /api/target?region=` queries GBIF for a real, photographed plant sighting within a bounding box for that region, and returns it with a clue instead of a name. Retries up to 4 times if a query comes back empty, then falls back to a fixed backup species (a sunflower) if GBIF is unreachable |
| Mobile-first, responsive UI | Tailwind CSS, single scrolling column with a bottom tab bar (Hunt / Notebook / Standings / Badges) |
| Camera capture / gallery upload | `<input type="file" capture="environment">` opens the phone camera directly; a second input opens the gallery/file picker |
| Match checking | `POST /api/identify` proxies the photo to the PlantNet API and checks the result's scientific name against the target the user was assigned — verification happens server-side, not just trusted from the client |
| Field notebook | Saved finds are stored server-side (in memory) via `/api/collection` and rendered in a gallery grid + detail sheet, one entry per unique species |
| Neighborhood standings | `GET /api/leaderboard` blends a small sample roster with the current user's real, live species count, re-fetched and re-sorted every time the notebook changes |
| Badges | Milestone badges (1 / 5 / 10 species) computed client-side from the notebook's length |

---

## 🚀 Run it locally

**Requirements:** Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure a real species-ID API key
cp .env.example .env
# then edit .env and paste in your PlantNet API key — see below

# 3. Start the server
npm start
