const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const db = require('./db/knex');

const app = express();
const port = process.env.PORT || 3001;
const storageDir = path.join(__dirname, 'storage');
const sheetFilePath = path.join(storageDir, 'active-donor-sheet.json');
const PRIMARY_MANAGER = {
  id: 1,
  name: 'Fast Forward India Manager',
  gmail: 'manager@fastforwardindia.org',
  is_primary: true,
};

app.use(express.json({ limit: '10mb' }));

async function ensureStorageFile() {
  try {
    await fs.access(sheetFilePath);
  } catch {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(sheetFilePath, JSON.stringify({ sheetMeta: null, donors: [] }, null, 2), 'utf8');
  }
}

async function readSheetStore() {
  await ensureStorageFile();
  const raw = await fs.readFile(sheetFilePath, 'utf8');
  return JSON.parse(raw);
}

async function writeSheetStore(nextStore) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(sheetFilePath, JSON.stringify(nextStore, null, 2), 'utf8');
}

async function readPrimaryManager() {
  try {
    const manager = await db('managers').where('is_primary', true).first();
    return manager || PRIMARY_MANAGER;
  } catch (error) {
    return PRIMARY_MANAGER;
  }
}

function normalizeDonor(row, index) {
  return {
    id: Number(row.id) || Date.now() + index + 1,
    name: String(row.name || '').trim(),
    admission: String(row.admission || row.admission_no || '').trim(),
    gender: String(row.gender || '').trim(),
    programme: String(row.programme || '').trim(),
    blood: String(row.blood || row.blood_group || '').trim(),
    mobile: String(row.mobile || row.phone || row.mobile_no || '').trim(),
    lastDon: row.lastDon || row.last_donation_date || null,
    eligible: Boolean(row.eligible ?? true),
    notified: Boolean(row.notified ?? false),
  };
}

app.get('/api/donors', async (_request, response) => {
  try {
    const store = await readSheetStore();
    response.json(store);
  } catch (error) {
    response.status(500).json({ message: 'Failed to read donor sheet storage.' });
  }
});

app.post('/api/donors/import', async (request, response) => {
  try {
    const { donors = [], sheetMeta = null } = request.body || {};

    if (!Array.isArray(donors)) {
      return response.status(400).json({ message: 'donors must be an array.' });
    }

    const normalizedDonors = donors.map((row, index) => normalizeDonor(row, index));
    const nextStore = {
      sheetMeta: sheetMeta ? {
        name: String(sheetMeta.name || 'donor-sheet.xlsx'),
        rows: normalizedDonors.length,
        importedAt: sheetMeta.importedAt || new Date().toISOString(),
      } : null,
      donors: normalizedDonors,
    };

    await writeSheetStore(nextStore);
    response.json(nextStore);
  } catch (error) {
    response.status(500).json({ message: 'Failed to save donor sheet.' });
  }
});

app.delete('/api/donors', async (_request, response) => {
  try {
    const nextStore = { sheetMeta: null, donors: [] };
    await writeSheetStore(nextStore);
    response.json(nextStore);
  } catch (error) {
    response.status(500).json({ message: 'Failed to delete donor sheet.' });
  }
});

app.get('/api/manager', async (_request, response) => {
  try {
    const manager = await readPrimaryManager();

    response.json({
      id: manager.id,
      name: manager.name,
      gmail: manager.gmail,
    });
  } catch (error) {
    response.status(500).json({ message: 'Failed to load manager account.' });
  }
});

app.post('/api/manager/login', async (request, response) => {
  try {
    const gmail = String(request.body?.gmail || '').trim().toLowerCase();

    if (!gmail) {
      return response.status(400).json({ message: 'gmail is required.' });
    }

    const manager = await readPrimaryManager();

    if (!manager || !manager.is_primary || String(manager.gmail || '').trim().toLowerCase() !== gmail) {
      return response.status(401).json({ message: 'Only the seeded manager Gmail can sign in.' });
    }

    response.json({
      id: manager.id,
      name: manager.name,
      gmail: manager.gmail,
    });
  } catch (error) {
    response.status(500).json({ message: 'Manager login failed.' });
  }
});

app.listen(port, () => {
  console.log(`BDFFI backend listening on port ${port}`);
});
