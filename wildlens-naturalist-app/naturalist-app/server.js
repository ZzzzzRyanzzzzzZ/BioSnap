//BIOSNAP backend
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for handling image uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

let collectionDb = [];

// Fallback safety specimen if GBIF network request fails
// includes an `image`, or app.js's "retry until we get an image" loop
const FALLBACK_SPECIES = {
  common_name: 'Sunflower',
  scientific_name: 'Helianthus annuus',
  family: 'Asteraceae',
  genus: 'Helianthus',
  description: 'A tall annual plant with a large daisy-like flower head.',
  clue: 'Look for bright yellow petals surrounding a large seed disk.',
  image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/A_sunflower.jpg/640px-A_sunflower.jpg',
};

// Rough lat/lon bounding boxes for each region offered in the onboarding dropdown.
const REGION_BOUNDS = {
  'northeast-us':        { lat: '40,47',  lon: '-80,-67' },
  'pacific-northwest':   { lat: '42,49',  lon: '-124,-116' },
  'southeast-us':        { lat: '25,36',  lon: '-90,-75' },
  'midwest-us':          { lat: '36,49',  lon: '-104,-80' },
  'western-europe':      { lat: '43,55',  lon: '-5,15' },
};
const DEFAULT_BOUNDS = { lat: '25,55', lon: '-125,15' }; // wide fallback if region is missing/unrecognized

const LEADERBOARD_SAMPLE = [
  { username: 'ForestGuardian', species: 14, level: 3 },
  { username: 'BotanistBob', species: 9, level: 2 },
  { username: 'PetalPatrol', species: 7, level: 2 },
  { username: 'TrailBlazerTia', species: 5, level: 1 },
  { username: 'MossyMara', species: 3, level: 1 },
];

function buildLeaderboard(profileUsername, collectionCount) {
  const board = LEADERBOARD_SAMPLE.map(p => ({ ...p, isYou: false }));

  if (profileUsername) {
    const level = collectionCount >= 10 ? 3 : collectionCount >= 5 ? 2 : 1;
    const existingIdx = board.findIndex(p => p.username.toLowerCase() === profileUsername.toLowerCase());
    if (existingIdx >= 0) {
      board[existingIdx].species = collectionCount;
      board[existingIdx].level = level;
      board[existingIdx].isYou = true;
    } else {
      board.push({ username: profileUsername, species: collectionCount, level, isYou: true });
    }
  }

  board.sort((a, b) => b.species - a.species);
  return board;
}

// Helper function to fetch a random plant *with a photo* from GBIF, scoped to the given region.
function gbifGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'BioSnapApp/1.0 (contact@biosnap.local)' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

async function fetchVernacularName(speciesKey) {
  if (!speciesKey) return null;
  try {
    const data = await gbifGet(`https://api.gbif.org/v1/species/${speciesKey}/vernacularNames?limit=20`);
    const names = data.results || [];
    const english = names.find((n) => (n.language || '').toLowerCase() === 'eng' && n.vernacularName);
    if (english) return english.vernacularName;
    const any = names.find((n) => n.vernacularName);
    return any ? any.vernacularName : null;
  } catch {
    return null;
  }
}

async function fetchRandomPlantFromGBIF(region, excludeSciName) {
  const bounds = REGION_BOUNDS[region] || DEFAULT_BOUNDS;

  const MAX_ATTEMPTS = 4;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const randomOffset = Math.floor(Math.random() * 200);
    const url =
      `https://api.gbif.org/v1/occurrence/search` +
      `?kingdomKey=6` + // Plantae
      `&mediaType=StillImage` +
      `&hasCoordinate=true` +
      `&decimalLatitude=${bounds.lat}` +
      `&decimalLongitude=${bounds.lon}` +
      `&limit=20&offset=${randomOffset}`;

    let parsed;
    try {
      parsed = await gbifGet(url);
    } catch {
      continue;
    }

    let results = (parsed.results || []).filter((r) => {
      const hasPhoto = Array.isArray(r.media) && r.media.some((m) => m.type === 'StillImage' && m.identifier);
      return hasPhoto && r.scientificName;
    });

    if (excludeSciName) {
      results = results.filter((r) => r.scientificName.toLowerCase() !== excludeSciName.toLowerCase());
    }

    if (results.length === 0) continue;

    const CANDIDATES_TO_TRY = Math.min(4, results.length);
    const shuffled = [...results].sort(() => Math.random() - 0.5).slice(0, CANDIDATES_TO_TRY);

    const withNames = await Promise.all(
      shuffled.map(async (candidate) => ({
        candidate,
        vernacular: candidate.vernacularName || (await fetchVernacularName(candidate.speciesKey || candidate.taxonKey)),
      }))
    );

    const match = withNames.find((w) => w.vernacular) || withNames[0];
    const chosen = match.candidate;
    const photo = chosen.media.find((m) => m.type === 'StillImage' && m.identifier);
    const whereSeen = chosen.stateProvince || chosen.county || chosen.country;

    return {

      common_name: match.vernacular || chosen.species || chosen.scientificName,
      scientific_name: chosen.species || chosen.scientificName,
      family: chosen.family || 'Plantae',
      genus: chosen.genus || 'Unknown',
      description: `A wild plant recorded in GBIF's biodiversity database${whereSeen ? ` near ${whereSeen}` : ''}.`,
      clue: whereSeen
        ? `This one's been spotted before near ${whereSeen} — keep an eye out.`
        : `Keep an eye out — this species has been recorded in your area before.`,
      image: photo.identifier,
    };
  }

  throw new Error('No photographed plants found for this region after retrying');
}

// API Routes
app.get('/api/target', async (req, res) => {
  const region = req.query.region;
  const exclude = req.query.exclude;
  try {
    const target = await fetchRandomPlantFromGBIF(region, exclude);
    res.json(target);
  } catch (err) {

    res.json(FALLBACK_SPECIES);
  }
});

app.get('/api/leaderboard', (req, res) => {
  const username = req.query.username;
  const count = parseInt(req.query.count || '0', 10) || collectionDb.length;
  const board = buildLeaderboard(username, count);
  res.json(board);
});

app.post('/api/identify', upload.single('image'), async (req, res) => {
  const targetSci = req.query.target;
  const apiKey = process.env.PLANTNET_API_KEY;


  if (!req.file || !apiKey) {
    return res.json({
      success: true,
      data: JSON.stringify({
        common_name: FALLBACK_SPECIES.common_name,
        scientific_name: FALLBACK_SPECIES.scientific_name,
        confidence: 0.95,
      }),
    });
  }

  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const bufferHeader = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${req.file.originalname || 'upload.jpg'}"\r\nContent-Type: ${req.file.mimetype}\r\n\r\n`);
    const bufferFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const postData = Buffer.concat([bufferHeader, req.file.buffer, bufferFooter]);

    const plantNetOptions = {
      hostname: 'my-api.plantnet.org',
      path: `/v2/identify/all?api-key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': postData.length
      }
    };

    const plantNetData = await new Promise((resolve, reject) => {
      const externalReq = https.request(plantNetOptions, (extRes) => {
        let data = '';
        extRes.on('data', chunk => { data += chunk; });
        extRes.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      externalReq.on('error', reject);
      externalReq.write(postData);
      externalReq.end();
    });

    const top = (plantNetData.results || [])[0];
    if (!top) {
      return res.json({ success: false, error: 'No match found in that photo.' });
    }

    const sciName = top.species?.scientificNameWithoutAuthor || top.species?.scientificName || 'Unknown species';
    const commonName = (top.species?.commonNames && top.species.commonNames[0]) || sciName;
    const matchesTarget = targetSci ? sciName.toLowerCase() === targetSci.toLowerCase() : true;

    res.json({
      success: true,
      data: JSON.stringify({
        common_name: commonName,
        scientific_name: sciName,
        confidence: top.score || 0,
        matches_target: matchesTarget,
      }),
    });

  } catch (apiErr) {
    res.json({ success: false, error: 'Failed to communicate with Pl@ntNet API' });
  }
});

app.get('/api/collection', (req, res) => {
  const username = req.query.username;
  const items = username
    ? collectionDb.filter(item => (item.username || '').toLowerCase() === username.toLowerCase())
    : collectionDb;
  res.json(items);
});

app.post('/api/collection', (req, res) => {
  const newItem = {
    id: Date.now().toString(),
    savedAt: Date.now(),
    ...req.body
  };
  collectionDb.unshift(newItem);
  res.status(201).json(newItem);
});

app.delete('/api/collection/:id', (req, res) => {
  const id = req.params.id;
  collectionDb = collectionDb.filter(item => item.id !== id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`BIOSNAP server running at http://localhost:3000`);
});