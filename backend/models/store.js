const path = require('path');
const fs = require('fs/promises');

const storageDir = path.join(__dirname, '..', 'storage');
const sheetFilePath = path.join(storageDir, 'active-donor-sheet.json');
const managerFilePath = path.join(storageDir, 'manager-account.json');

const PRIMARY_MANAGER = {
  id: 1,
  name: String(process.env.SUPER_MANAGER_NAME || 'Fast Forward India Super Manager').trim(),
  gmail: String(process.env.SUPER_MANAGER_EMAIL || 'manager@fastforwardindia.org').trim().toLowerCase(),
  password: String(process.env.SUPER_MANAGER_PASSWORD || 'FFI-Manager-1234').trim(),
  is_primary: true,
  is_active: true,
  whatsapp_alerts_enabled: true,
};

async function ensureStorageFile() {
  try {
    await fs.access(sheetFilePath);
  } catch {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(sheetFilePath, JSON.stringify({ sheetMeta: null, donors: [], blockedFilters: { admissionPrefixes: [], programmes: [] } }, null, 2), 'utf8');
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

async function ensureManagerStoreFile() {
  try {
    await fs.access(managerFilePath);
  } catch {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(managerFilePath, JSON.stringify(PRIMARY_MANAGER, null, 2), 'utf8');
  }
}

async function readManagerStore() {
  await ensureManagerStoreFile();
  const raw = await fs.readFile(managerFilePath, 'utf8');
  return JSON.parse(raw);
}

async function writeManagerStore(nextManager) {
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(managerFilePath, JSON.stringify(nextManager, null, 2), 'utf8');
}

module.exports = {
  PRIMARY_MANAGER,
  readSheetStore,
  writeSheetStore,
  readManagerStore,
  writeManagerStore,
};
