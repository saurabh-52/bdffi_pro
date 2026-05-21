const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;
const storageDir = path.join(__dirname, 'storage');
const sheetFilePath = path.join(storageDir, 'active-donor-sheet.json');

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

app.listen(port, () => {
  console.log(`BDFFI backend listening on port ${port}`);
});
