# BIOSNAP — Neighborhood Plant Scavenger Hunt

BIOSNAP is a mobile-first web game that turns exploring nature into a scavenger hunt. You're given a plant to find in your area, then you go outside, find it, and take a picture to prove you found it. Your discoveries are saved in a field notebook, and you can compete with other local explorers.

- **Frontend:** HTML and JavaScript, separated into `public/index.html` and `app.js`. Tailwind CSS is used for styling.
- **Backend:** Node.js / Express (`server.js`).
- **Plant data:** BIOSNAP uses **GBIF (Global Biodiversity Information Facility)** to find real plant sightings instead of using a preset species list.
- **Plant identification:** Uses the **PlantNet API** to identify plants from uploaded photos.
- **Storage:** Currently uses server memory, so the notebook and leaderboard reset whenever the server restarts. A database could be added later for permanent storage.

BIOSNAP can also run without a PlantNet API key. In that case, the identification endpoint uses a fallback response so the full upload → identify → save process can still be tested.

---

## Features

| Feature | How it works |
|---|---|
| **Sign-in** | Users enter an explorer name, choose their region, and enter a passcode. This is saved locally so they don't have to enter it every time. |
| **Plant Hunt** | GBIF is searched for a real plant sighting in the user's region. The plant's name is hidden and replaced with a clue. |
| **Mobile Design** | The interface is designed for phones with a simple layout and bottom navigation for the Hunt, Notebook, Standings, and Badges. |
| **Take a Photo** | Users can take a picture directly with their phone camera or upload one from their gallery. |
| **Plant Matching** | The uploaded photo is sent to PlantNet, and the result is compared with the plant the user was assigned. |
| **Field Notebook** | Plants you successfully find are saved to your notebook and displayed in a gallery. |
| **Leaderboard** | Users can see how many different species they've found compared with other explorers. |
| **Badges** | Users earn badges for reaching milestones like finding 1, 5, or 10 species. |

---

## Running BIOSNAP

**Requirements:** Node.js 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Optional: add a PlantNet API key
cp .env.example .env

# 3. Start the server
npm start
