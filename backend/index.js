require('dotenv').config();

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const db = require('./db/knex');

const app = express();
const port = process.env.PORT || 3001;
const storageDir = path.join(__dirname, 'storage');
const sheetFilePath = path.join(storageDir, 'active-donor-sheet.json');
const managerFilePath = path.join(storageDir, 'manager-account.json');
const PRIMARY_MANAGER = {
  id: 1,
  name: String(process.env.SUPER_MANAGER_NAME || 'Fast Forward India Super Manager').trim(),
  gmail: String(process.env.SUPER_MANAGER_EMAIL || 'manager@fastforwardindia.org').trim().toLowerCase(),
  password: String(process.env.SUPER_MANAGER_PASSWORD || 'FFI-Manager-1234').trim(),
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

async function readPrimaryManager() {
  try {
    const manager = await readManagerStore();
    if (manager && manager.gmail) {
      return manager;
    }
  } catch (error) {
    // fall back to DB / seed below
  }

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
    // Accept manager "id" as the manager email address (gmail) + password
    const rawId = String(request.body?.id || '').trim();
    const email = rawId.toLowerCase();
    const password = String(request.body?.password || '').trim();

    if (!email) {
      return response.status(400).json({ message: 'email is required.' });
    }

    // Basic email format validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      return response.status(400).json({ message: 'email must be a valid email address.' });
    }

    if (!password) {
      return response.status(400).json({ message: 'password is required.' });
    }

    const manager = await readPrimaryManager();

    if (!manager || !manager.is_primary || String((manager.gmail || '')).toLowerCase() !== email || String(manager.password || '') !== password) {
      return response.status(401).json({ message: 'Only the seeded manager email and password can sign in.' });
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

const crypto = require('crypto');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

function makeTransporter() {
  if (!nodemailer) return null;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: true,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

async function sendResetEmail(email, token) {
  const transporter = makeTransporter();
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/forgot-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your Fast Forward India manager password';
  const text = `A password reset was requested for this account. Use the link below to reset your password:\n\nLink: ${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your Fast Forward India manager password</h2>
      <p>A password reset was requested for this account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open reset link</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
        to: email,
        subject,
        text,
        html,
        replyTo: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@fastforwardindia.org',
      });
      return { sent: true };
    } catch (err) {
      console.warn('Failed to send reset email:', err && err.message);
      // fall through to console fallback; expose the token in dev so the flow remains testable
    }
  }

  // Console fallback and dev-friendly token exposure when SHOW_RESET_TOKEN=true
  console.log('Password reset token for', email, token, 'reset link:', resetUrl);
  return { sent: false, token }; 
}

// Request a password-reset token (sends email)
app.post('/api/manager/forgot/request', async (request, response) => {
  try {
    const email = String(request.body?.email || '').trim().toLowerCase();

    if (!email) return response.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return response.status(400).json({ message: 'email must be a valid email address.' });

    const manager = await readPrimaryManager();
    if (!manager || String((manager.gmail || '')).toLowerCase() !== email) {
      // Generic response to avoid account enumeration
      return response.json({ message: 'If the email matches the seeded manager, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Persist token to DB if possible
    try {
      await db('managers').where('id', manager.id).update({ reset_token: token, reset_expires: expires });
    } catch (err) {
      // ignore DB errors
    }

    // Persist token to the manager storage file so it survives restarts
    try {
      await writeManagerStore({
        ...(manager || PRIMARY_MANAGER),
        reset_token: token,
        reset_expires: expires.toISOString(),
      });
    } catch (e) {
      // ignore file errors
    }

    // Update in-memory seed as fallback for the current process
    try { PRIMARY_MANAGER.reset_token = token; PRIMARY_MANAGER.reset_expires = expires; } catch (e) {}

    const result = await sendResetEmail(email, token);

    const resp = { message: 'If the email matches the seeded manager, a reset link has been sent.' };
    if (process.env.SHOW_RESET_TOKEN === 'true' || !result.sent) {
      resp.token = result.token || token;
    }

    return response.json(resp);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to request password reset.' });
  }
});

// Confirm password reset using token
app.post('/api/manager/forgot/confirm', async (request, response) => {
  try {
    const token = String(request.body?.token || '').trim();
    const newPassword = String(request.body?.password || '').trim();

    if (!token) return response.status(400).json({ message: 'token is required.' });
    if (!newPassword) return response.status(400).json({ message: 'password is required.' });

    // Try DB lookup first
    let manager = null;
    try {
      manager = await db('managers').where('reset_token', token).andWhere('reset_expires', '>', db.fn.now()).first();
    } catch (err) {
      // ignore DB errors
    }

    // Fallback to in-memory seeded token
    if (!manager) {
      if (PRIMARY_MANAGER.reset_token && PRIMARY_MANAGER.reset_token === token && new Date(PRIMARY_MANAGER.reset_expires) > new Date()) {
        manager = PRIMARY_MANAGER;
      }
    }

    if (!manager) return response.status(400).json({ message: 'Invalid or expired token.' });

    // Update password and clear token
    try {
      if (manager.id && typeof manager.id === 'number') {
        await db('managers').where('id', manager.id).update({ password: newPassword, reset_token: null, reset_expires: null, updated_at: db.fn.now() });
      }
    } catch (err) {
      // ignore DB error
    }

    try {
      await writeManagerStore({
        ...(manager || PRIMARY_MANAGER),
        password: newPassword,
        reset_token: null,
        reset_expires: null,
      });
    } catch (e) {
      // ignore file errors
    }

    try { PRIMARY_MANAGER.password = newPassword; PRIMARY_MANAGER.reset_token = null; PRIMARY_MANAGER.reset_expires = null; } catch (e) {}

    return response.json({ message: 'Password has been reset. You can now sign in with the new password.' });
  } catch (error) {
    return response.status(500).json({ message: 'Failed to confirm password reset.' });
  }
});

app.listen(port, () => {
  console.log(`BDFFI backend listening on port ${port}`);
});
