const db = require('../db/knex');
const crypto = require('crypto');
const { ensureManagersTable, ensureManagerLogsTable, ensureVolunteersTable } = require('../db/database');
const { PRIMARY_MANAGER, readManagerStore, writeManagerStore } = require('../models/store');
const { sendManagerPromotionEmail, sendResetEmail } = require('../utils/email');
const { isActiveFlag, isAlertsEnabledFlag } = require('../utils/helpers');

async function readPrimaryManager() {
  await ensureManagersTable();

  try {
    const manager = await db('managers').where('is_primary', true).first();
    if (manager) {
      return manager;
    }
  } catch (error) {
    // fall back
  }

  try {
    const manager = await readManagerStore();
    if (manager && manager.gmail) {
      return manager;
    }
  } catch (error) {
    // fall back
  }

  return PRIMARY_MANAGER;
}

function serializeManager(manager) {
  if (!manager) return null;

  return {
    id: manager.id,
    name: manager.name,
    gmail: manager.gmail,
    is_primary: Boolean(manager.is_primary),
    is_active: isActiveFlag(manager.is_active),
    whatsapp_alerts_enabled: isAlertsEnabledFlag(manager.whatsapp_alerts_enabled),
    created_at: manager.created_at || null,
    updated_at: manager.updated_at || null,
  };
}

async function readManagerByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  await ensureManagersTable();

  try {
    const manager = await db('managers').whereRaw('LOWER(gmail) = ?', [normalizedEmail]).first();
    if (manager) {
      return manager;
    }
  } catch (error) {
    // fall back
  }

  try {
    const manager = await readManagerStore();
    if (manager && String(manager.gmail || '').trim().toLowerCase() === normalizedEmail) {
      return manager;
    }
  } catch (error) {
    // ignore
  }

  return null;
}

async function readManagers() {
  await ensureManagersTable();

  try {
    return await db('managers').orderBy([
      { column: 'is_primary', order: 'desc' },
      { column: 'created_at', order: 'asc' },
    ]);
  } catch (error) {
    const primaryManager = await readPrimaryManager();
    return primaryManager ? [primaryManager] : [];
  }
}

async function createManagerAccount({ name, gmail, password }) {
  await ensureManagersTable();

  const createdAt = new Date().toISOString();
  const tempPassword = String(password || '').trim() || crypto.randomBytes(6).toString('base64url');

  const [createdId] = await db('managers').insert({
    name: String(name || '').trim(),
    gmail: String(gmail || '').trim().toLowerCase(),
    password: tempPassword,
    is_primary: false,
    is_active: true,
    whatsapp_alerts_enabled: true,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  return {
    id: createdId,
    name: String(name || '').trim(),
    gmail: String(gmail || '').trim().toLowerCase(),
    password: tempPassword,
    is_primary: false,
    is_active: true,
    whatsapp_alerts_enabled: true,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function readVolunteerByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  try {
    return await db('volunteers').whereRaw('LOWER(email) = ?', [normalizedEmail]).first();
  } catch (error) {
    return null;
  }
}

async function getPrimaryManager(_req, res) {
  try {
    const manager = await readPrimaryManager();
    return res.json(serializeManager(manager));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load manager account.' });
  }
}

async function getAllManagers(_req, res) {
  try {
    const managers = await readManagers();
    return res.json(managers.map(serializeManager));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load manager accounts.' });
  }
}

async function promoteVolunteer(req, res) {
  try {
    const gmail = String(req.body?.gmail || req.body?.email || '').trim().toLowerCase();

    if (!gmail) {
      return res.status(400).json({ message: 'gmail is required.' });
    }

    if (!/\S+@\S+\.\S+/.test(gmail)) {
      return res.status(400).json({ message: 'gmail must be a valid email address.' });
    }

    const volunteer = await readVolunteerByEmail(gmail);
    if (!volunteer) {
      return res.status(400).json({ message: `Only existing volunteers can be promoted to managers. No volunteer found with email: ${gmail}` });
    }

    const existingManager = await readManagerByEmail(gmail);
    if (existingManager) {
      if (isActiveFlag(existingManager.is_active)) {
        return res.status(409).json({ message: 'This volunteer is already an active manager.' });
      } else {
        await db('managers').where('id', existingManager.id).update({ is_active: true, updated_at: db.fn.now() });
        await sendManagerPromotionEmail(gmail, volunteer.name);
        
        const updatedManager = await readManagerByEmail(gmail);
        const payload = serializeManager(updatedManager);
        payload.message = 'Manager account reactivated successfully.';
        payload.promoted = true;
        return res.json(payload);
      }
    }

    const createdManager = await createManagerAccount({ 
      name: volunteer.name, 
      gmail, 
      password: volunteer.password 
    });
    
    await sendManagerPromotionEmail(gmail, volunteer.name);

    const payload = serializeManager(createdManager);
    payload.message = 'Volunteer promoted to Manager successfully.';
    payload.promoted = true;

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to promote volunteer to manager.' });
  }
}

async function demoteManager(req, res) {
  try {
    await ensureManagersTable();
    const managerId = Number(req.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return res.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found.' });
    }

    if (manager.is_primary) {
      return res.status(400).json({ message: 'Primary manager cannot be demoted.' });
    }

    await db('managers').where('id', managerId).del();

    return res.json({ message: `Manager account ${manager.name} (${manager.gmail}) successfully demoted to Volunteer.` });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to demote manager account.' });
  }
}

async function deactivateManager(req, res) {
  try {
    await ensureManagersTable();
    const managerId = Number(req.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return res.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found.' });
    }

    if (manager.is_primary) {
      return res.status(400).json({ message: 'Primary manager cannot be deactivated.' });
    }

    await db('managers').where('id', managerId).update({ is_active: false, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return res.json(serializeManager(updatedManager));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deactivate manager account.' });
  }
}

async function activateManager(req, res) {
  try {
    await ensureManagersTable();
    const managerId = Number(req.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return res.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found.' });
    }

    await db('managers').where('id', managerId).update({ is_active: true, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return res.json(serializeManager(updatedManager));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to activate manager account.' });
  }
}

async function updateAlertsSetting(req, res) {
  try {
    await ensureManagersTable();
    const managerId = Number(req.params.id);
    const enabled = Boolean(req.body?.enabled);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return res.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found.' });
    }

    await db('managers').update({ whatsapp_alerts_enabled: enabled, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return res.json(serializeManager(updatedManager));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update WhatsApp alert setting.' });
  }
}

async function getManagerLogs(_req, res) {
  try {
    await ensureManagerLogsTable();
    const logs = await db('manager_logs').orderBy('created_at', 'desc').limit(200);
    return res.json({ ok: true, logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function createManagerLog(req, res) {
  try {
    const { actor, request, msg, status } = req.body;
    if (!request || !msg) {
      return res.status(400).json({ ok: false, error: 'request and msg are required' });
    }
    await ensureManagerLogsTable();
    await db('manager_logs').insert({
      actor: actor || 'Manager',
      request,
      msg,
      status: status || 'accepted',
      created_at: db.fn.now(),
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function loginManager(req, res) {
  try {
    const rawId = String(req.body?.id || '').trim();
    const email = rawId.toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!email) {
      return res.status(400).json({ message: 'email is required.' });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: 'email must be a valid email address.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'password is required.' });
    }

    const manager = await readManagerByEmail(email);
    if (!manager) {
      return res.status(401).json({ message: 'Invalid manager email or password.' });
    }

    const volunteer = await readVolunteerByEmail(email);
    if (!volunteer || String(volunteer.password || '') !== password) {
      return res.status(401).json({ message: 'Invalid manager email or password.' });
    }

    if (!manager.is_primary && !isActiveFlag(manager.is_active)) {
      return res.status(423).json({
        message: 'Your account is deactivated. Activate it to continue.',
        inactive: true,
        manager: serializeManager(manager),
      });
    }

    return res.json(serializeManager(manager));
  } catch (error) {
    return res.status(500).json({ message: 'Manager login failed.' });
  }
}

async function forgotRequestManager(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) return res.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'email must be a valid email address.' });

    const manager = await readManagerByEmail(email);
    if (!manager) {
      return res.json({ message: 'If the email matches the seeded manager, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      await db('managers').where('id', manager.id).update({ reset_token: token, reset_expires: expires });
    } catch (err) {
      // ignore
    }

    try {
      await writeManagerStore({
        ...(manager || PRIMARY_MANAGER),
        reset_token: token,
        reset_expires: expires.toISOString(),
      });
    } catch (e) {
      // ignore
    }

    try {
      PRIMARY_MANAGER.reset_token = token;
      PRIMARY_MANAGER.reset_expires = expires;
    } catch (e) {
      // ignore
    }

    const result = await sendResetEmail(email, token);

    const resp = { message: 'If the email matches the seeded manager, a reset link has been sent.' };
    if (process.env.SHOW_RESET_TOKEN === 'true' || !result.sent) {
      resp.token = result.token || token;
    }

    return res.json(resp);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request password reset.' });
  }
}

async function forgotConfirmManager(req, res) {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '').trim();

    if (!token) return res.status(400).json({ message: 'token is required.' });
    if (!newPassword) return res.status(400).json({ message: 'password is required.' });

    let manager = null;
    try {
      manager = await db('managers').where('reset_token', token).andWhere('reset_expires', '>', db.fn.now()).first();
    } catch (err) {
      // ignore
    }

    if (!manager) {
      if (PRIMARY_MANAGER.reset_token && PRIMARY_MANAGER.reset_token === token && new Date(PRIMARY_MANAGER.reset_expires) > new Date()) {
        manager = PRIMARY_MANAGER;
      }
    }

    if (!manager) return res.status(400).json({ message: 'Invalid or expired token.' });

    try {
      if (manager.id && typeof manager.id === 'number') {
        await db('managers').where('id', manager.id).update({ password: newPassword, reset_token: null, reset_expires: null, updated_at: db.fn.now() });
      }
    } catch (err) {
      // ignore
    }

    try {
      const emailToSync = (manager.gmail || manager.email || '').toLowerCase();
      if (emailToSync) {
        await ensureVolunteersTable();
        await db('volunteers').whereRaw('LOWER(email) = ?', [emailToSync]).update({
          password: newPassword,
          updated_at: db.fn.now()
        });
      }
    } catch (volErr) {
      console.warn('Failed to sync manager password reset to volunteer:', volErr.message);
    }

    try {
      await writeManagerStore({
        ...(manager || PRIMARY_MANAGER),
        password: newPassword,
        reset_token: null,
        reset_expires: null,
      });
    } catch (e) {
      // ignore
    }

    try {
      PRIMARY_MANAGER.password = newPassword;
      PRIMARY_MANAGER.reset_token = null;
      PRIMARY_MANAGER.reset_expires = null;
    } catch (e) {
      // ignore
    }

    return res.json({ message: 'Password has been reset. You can now sign in with the new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to confirm password reset.' });
  }
}

module.exports = {
  readPrimaryManager,
  readManagerByEmail,
  readManagers,
  serializeManager,
  getPrimaryManager,
  getAllManagers,
  promoteVolunteer,
  demoteManager,
  deactivateManager,
  activateManager,
  updateAlertsSetting,
  getManagerLogs,
  createManagerLog,
  loginManager,
  forgotRequestManager,
  forgotConfirmManager,
};
