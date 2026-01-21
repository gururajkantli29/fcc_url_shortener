require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const { URL } = require('url');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// MongoDB
const client = new MongoClient(process.env.DB_URL);
let urls;

// 🔴 MUST CONNECT
async function connectDB() {
  await client.connect();
  const db = client.db('urlshortner');
  urls = db.collection('urls');
  console.log('MongoDB connected');
}
connectDB();

// POST
app.post('/api/shorturl', (req, res) => {
  const originalUrl = req.body.url;

  let parsed;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return res.json({ error: 'invalid url' });
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.json({ error: 'invalid url' });
  }

  dns.lookup(parsed.hostname, async err => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }

    // FCC-safe short_url generation
    const last = await urls.find().sort({ short_url: -1 }).limit(1).toArray();
    const shortUrl = last.length === 0 ? 1 : last[0].short_url + 1;

    await urls.insertOne({
      original_url: originalUrl,
      short_url: shortUrl
    });

    res.json({
      original_url: originalUrl,
      short_url: shortUrl
    });
  });
});

// GET redirect
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = Number(req.params.short_url);
  const doc = await urls.findOne({ short_url: shortUrl });

  if (!doc) {
    return res.json({ error: 'No short URL found for the given input' });
  }

  res.redirect(doc.original_url);
});

// Listen
app.listen(port, () => {
  console.log('Listening on port ' + port);
});
