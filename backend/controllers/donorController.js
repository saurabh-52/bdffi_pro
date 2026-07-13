const { readSheetStore, writeSheetStore } = require('../models/store');
const { normalizeDonor } = require('../utils/helpers');

async function getDonors(_req, res) {
  try {
    const store = await readSheetStore();
    if (!store.blockedFilters) {
      store.blockedFilters = { admissionPrefixes: [], programmes: [] };
    }
    return res.json(store);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read donor sheet storage.' });
  }
}

async function importDonors(req, res) {
  try {
    const { donors = [], sheetMeta = null } = req.body || {};

    if (!Array.isArray(donors)) {
      return res.status(400).json({ message: 'donors must be an array.' });
    }

    const store = await readSheetStore();
    const normalizedDonors = donors.map((row, index) => normalizeDonor(row, index));
    const nextStore = {
      sheetMeta: sheetMeta ? {
        name: String(sheetMeta.name || 'donor-sheet.xlsx'),
        rows: normalizedDonors.length,
        importedAt: sheetMeta.importedAt || new Date().toISOString(),
      } : null,
      donors: normalizedDonors,
      blockedFilters: store.blockedFilters || { admissionPrefixes: [], programmes: [] }
    };

    await writeSheetStore(nextStore);
    return res.json(nextStore);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save donor sheet.' });
  }
}

async function deleteDonors(_req, res) {
  try {
    const store = await readSheetStore();
    const nextStore = { 
      sheetMeta: null, 
      donors: [], 
      blockedFilters: store.blockedFilters || { admissionPrefixes: [], programmes: [] } 
    };
    await writeSheetStore(nextStore);
    return res.json(nextStore);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete donor sheet.' });
  }
}

async function updateBlockFilters(req, res) {
  try {
    const { blockedFilters } = req.body || {};
    const store = await readSheetStore();
    store.blockedFilters = blockedFilters || { admissionPrefixes: [], programmes: [] };
    await writeSheetStore(store);
    return res.json({ ok: true, blockedFilters: store.blockedFilters });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update block filters.' });
  }
}

module.exports = {
  getDonors,
  importDonors,
  deleteDonors,
  updateBlockFilters,
};
