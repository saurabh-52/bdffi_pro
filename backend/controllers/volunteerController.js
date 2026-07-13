const db = require('../db/knex');
const crypto = require('crypto');
const { ensureVolunteersTable, ensureManagerLogsTable } = require('../db/database');
const { sendVolunteerWelcomeEmail, sendVolunteerRemovalEmail, sendVolunteerResetEmail } = require('../utils/email');
const { isActiveFlag } = require('../utils/helpers');

function serializeVolunteer(volunteer) {
  if (!volunteer) return null;
  return {
    id: volunteer.id,
    name: volunteer.name,
    email: volunteer.email,
    is_active: isActiveFlag(volunteer.is_active),
    created_at: volunteer.created_at || null,
    updated_at: volunteer.updated_at || null,
  };
}

async function readVolunteerByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  await ensureVolunteersTable();

  try {
    return await db('volunteers').whereRaw('LOWER(email) = ?', [normalizedEmail]).first();
  } catch (error) {
    return null;
  }
}

async function createVolunteerAccount({ name, email, password }) {
  await ensureVolunteersTable();

  const tempPassword = String(password || '').trim() || crypto.randomBytes(6).toString('base64url');

  const [createdId] = await db('volunteers').insert({
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    password: tempPassword,
    is_active: true,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  return {
    id: createdId,
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    password: tempPassword,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function loginVolunteer(req, res) {
  try {
    const email = String(req.body?.email || req.body?.id || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!email) return res.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'email must be a valid email address.' });
    if (!password) return res.status(400).json({ message: 'password is required.' });

    const volunteer = await readVolunteerByEmail(email);

    if (!volunteer || String(volunteer.password || '') !== password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!isActiveFlag(volunteer.is_active)) {
      return res.status(423).json({ message: 'Your account is deactivated. Contact a manager.', inactive: true });
    }

    return res.json(serializeVolunteer(volunteer));
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.' });
  }
}

async function requestReset(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'email must be a valid email address.' });

    const volunteer = await readVolunteerByEmail(email);
    if (!volunteer) {
      return res.json({ message: 'If the email matches a volunteer account, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      await db('volunteers').where('id', volunteer.id).update({ reset_token: token, reset_expires: expires });
    } catch (err) {
      // ignore
    }

    const result = await sendVolunteerResetEmail(email, token);

    const resp = { message: 'If the email matches a volunteer account, a reset link has been sent.' };
    if (process.env.SHOW_RESET_TOKEN === 'true' || !result.sent) {
      resp.token = result.token || token;
    }

    return res.json(resp);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request password reset.' });
  }
}

async function confirmReset(req, res) {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '').trim();

    if (!token) return res.status(400).json({ message: 'token is required.' });
    if (!newPassword) return res.status(400).json({ message: 'password is required.' });

    await ensureVolunteersTable();
    let volunteer = null;
    try {
      volunteer = await db('volunteers').where('reset_token', token).andWhere('reset_expires', '>', db.fn.now()).first();
    } catch (err) {
      // ignore
    }

    if (!volunteer) return res.status(400).json({ message: 'Invalid or expired token.' });

    try {
      await db('volunteers').where('id', volunteer.id).update({ password: newPassword, reset_token: null, reset_expires: null, updated_at: db.fn.now() });
    } catch (err) {
      // ignore
    }

    return res.json({ message: 'Password has been reset. You can now sign in with the new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to confirm password reset.' });
  }
}

async function createVolunteer(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || req.body?.gmail || '').trim().toLowerCase();

    if (!name) return res.status(400).json({ message: 'name is required.' });
    if (!email) return res.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'email must be a valid email address.' });

    const existing = await readVolunteerByEmail(email);
    if (existing) return res.status(409).json({ message: 'A volunteer with that email already exists.' });

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const createdVolunteer = await createVolunteerAccount({ name, email, password: randomPassword });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db('volunteers').where('id', createdVolunteer.id).update({
      reset_token: token,
      reset_expires: expires
    });

    const mailResult = await sendVolunteerWelcomeEmail(email, name, token);

    const payload = serializeVolunteer(createdVolunteer);
    payload.message = 'Volunteer account created successfully.';
    if (process.env.SHOW_RESET_TOKEN === 'true' || !mailResult.sent) {
      payload.activationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/volunteer-forgot-password?token=${encodeURIComponent(token)}`;
    }

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create volunteer account.' });
  }
}

async function getVolunteers(_req, res) {
  try {
    await ensureVolunteersTable();
    const volunteers = await db('volunteers').orderBy('created_at', 'asc');
    return res.json(volunteers.map(serializeVolunteer));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load volunteer accounts.' });
  }
}

async function removeVolunteer(req, res) {
  try {
    const { id } = req.params;
    const actorEmail = req.query?.actorEmail || 'Manager';
    const actorName = req.query?.actorName || 'Manager';

    await ensureVolunteersTable();
    const volunteer = await db('volunteers').where('id', id).first();
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer account not found.' });
    }

    await db('volunteers').where('id', id).del();

    await sendVolunteerRemovalEmail(volunteer.email, volunteer.name);

    await ensureManagerLogsTable();
    await db('manager_logs').insert({
      actor: actorName,
      request: 'Removed Volunteer',
      msg: `Volunteer ${volunteer.name} (${volunteer.email}) was removed by Manager ${actorName} (${actorEmail}).`,
      status: 'declined',
      created_at: db.fn.now(),
    });

    return res.json({ message: `Successfully removed volunteer ${volunteer.name}.` });
  } catch (error) {
    console.error('Failed to remove volunteer:', error.message);
    return res.status(500).json({ message: 'Failed to remove volunteer account.' });
  }
}

module.exports = {
  readVolunteerByEmail,
  serializeVolunteer,
  loginVolunteer,
  requestReset,
  confirmReset,
  createVolunteer,
  getVolunteers,
  removeVolunteer,
};
