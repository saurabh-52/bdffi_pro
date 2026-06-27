require('dotenv').config();

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
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
  is_active: true,
  whatsapp_alerts_enabled: true,
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

function isActiveFlag(value) {
  return value === true || value === 1 || value === '1';
}

function isAlertsEnabledFlag(value) {
  return value === true || value === 1 || value === '1';
}

function getMetaWhatsAppConfig() {
  return {
    accessToken: String(process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim(),
    phoneNumberId: String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    apiVersion: String(process.env.META_WHATSAPP_API_VERSION || 'v22.0').trim(),
    verifyToken: String(process.env.META_WHATSAPP_VERIFY_TOKEN || '').trim(),
    templateName: String(process.env.META_WHATSAPP_TEMPLATE_NAME || 'hello_world').trim(),
    templateLanguageCode: String(process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || 'en_US').trim(),
  };
}

function getMissingMetaWhatsAppConfig(config) {
  const missing = [];
  if (!config.accessToken) missing.push('META_WHATSAPP_ACCESS_TOKEN');
  if (!config.phoneNumberId) missing.push('META_WHATSAPP_PHONE_NUMBER_ID');
  if (!config.apiVersion) missing.push('META_WHATSAPP_API_VERSION');
  if (!config.verifyToken) missing.push('META_WHATSAPP_VERIFY_TOKEN');
  return missing;
}

function normalizePhoneNumber(value) {
  let digits = String(value || '').replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

function toJsonText(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify({ raw: value });
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

function buildDonorAlertMessage(donor) {
  return [
    `Hello ${donor.name || 'Donor'},`,
    '',
    'Fast Forward India needs your support for an urgent blood donation request.',
    `Blood group needed: ${donor.blood || 'Not specified'}`,
    'Please reply YES if you are available to donate.',
    '',
    '- Fast Forward India',
  ].join('\n');
}

function buildTemplateComponents(templateParams = []) {
  if (!Array.isArray(templateParams) || templateParams.length === 0) {
    return undefined;
  }

  return [{
    type: 'body',
    parameters: templateParams.map(value => ({
      type: 'text',
      text: String(value ?? ''),
    })),
  }];
}

async function areWhatsAppAlertsEnabled() {
  try {
    await ensureManagersTable();
    const enabledManager = await db('managers').where('whatsapp_alerts_enabled', true).first();
    return Boolean(enabledManager);
  } catch (error) {
    return true;
  }
}

async function sendMetaWhatsAppTemplateMessage({ to, templateName, templateLanguageCode, templateParams = [] }) {
  const config = getMetaWhatsAppConfig();
  const missing = getMissingMetaWhatsAppConfig(config).filter(name => name !== 'META_WHATSAPP_VERIFY_TOKEN');
  if (missing.length) {
    return {
      ok: false,
      status: 500,
      error: `Missing required Meta WhatsApp config: ${missing.join(', ')}`,
    };
  }

  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: 500,
      error: 'Global fetch is not available in this Node runtime.',
    };
  }

  const activeTemplateName = String(templateName || config.templateName || 'hello_world').trim();
  const activeLangCode = String(templateLanguageCode || config.templateLanguageCode || 'en_US').trim();

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const buildTemplatePayload = (params) => {
    const template = {
      name: activeTemplateName,
      language: { code: activeLangCode },
    };

    const components = buildTemplateComponents(params);
    if (components) {
      template.components = components;
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    };
  };

  const sendTemplateRequest = async (params) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(buildTemplatePayload(params)),
    });

    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  try {
    let { response, payload } = await sendTemplateRequest(templateParams);

    // Some templates (for example hello_world) do not accept body parameters.
    // If components were provided and Meta rejects parameter shape, retry once without components.
    if (!response.ok && Array.isArray(templateParams) && templateParams.length > 0) {
      const detail = String(payload?.error?.error_data?.details || '').toLowerCase();
      const shouldRetryWithoutComponents = detail.includes('parameter') || detail.includes('component');
      if (shouldRetryWithoutComponents) {
        const retry = await sendTemplateRequest([]);
        response = retry.response;
        payload = retry.payload;
      }
    }

    if (!response.ok) {
      const metaCode = payload?.error?.code;
      const recipientNotAllowed = metaCode === 131030;
      const baseError = payload?.error?.message || 'Meta WhatsApp API request failed.';

      return {
        ok: false,
        status: response.status,
        error: recipientNotAllowed
          ? `${baseError} Add the recipient phone number to the allowed recipients list in Meta WhatsApp test settings, or switch the app/account to live messaging with an approved template.`
          : baseError,
        payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: `Meta WhatsApp request failed: ${error.message}`,
    };
  }
}

function summarizeMetaWebhook(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let messageCount = 0;
  let statusCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      if (Array.isArray(value.messages)) messageCount += value.messages.length;
      if (Array.isArray(value.statuses)) statusCount += value.statuses.length;
    }
  }

  return {
    object: payload?.object || null,
    entries: entries.length,
    messages: messageCount,
    statuses: statusCount,
  };
}

async function ensureManagersTable() {
  const hasTable = await db.schema.hasTable('managers');

  if (!hasTable) {
    await db.schema.createTable('managers', function(table) {
      table.increments('id').primary();
      table.string('name', 120).notNullable();
      table.string('gmail', 255).notNullable().unique();
      table.string('password', 120).notNullable().defaultTo('FFI-Manager-1234');
      table.boolean('is_primary').notNullable().defaultTo(true);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.boolean('whatsapp_alerts_enabled').notNullable().defaultTo(true);
      table.string('reset_token', 128).nullable();
      table.timestamp('reset_expires').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  } else {
    if (!(await db.schema.hasColumn('managers', 'is_active'))) {
      await db.schema.alterTable('managers', function(table) {
        table.boolean('is_active').notNullable().defaultTo(true);
      });
    }

    if (!(await db.schema.hasColumn('managers', 'whatsapp_alerts_enabled'))) {
      await db.schema.alterTable('managers', function(table) {
        table.boolean('whatsapp_alerts_enabled').notNullable().defaultTo(true);
      });
    }

    if (!(await db.schema.hasColumn('managers', 'reset_token'))) {
      await db.schema.alterTable('managers', function(table) {
        table.string('reset_token', 128).nullable();
      });
    }

    if (!(await db.schema.hasColumn('managers', 'reset_expires'))) {
      await db.schema.alterTable('managers', function(table) {
        table.timestamp('reset_expires').nullable();
      });
    }
  }

  const primaryManager = await db('managers').where('is_primary', true).first();
  if (!primaryManager) {
    const manager = await readManagerStore().catch(() => PRIMARY_MANAGER);
    const primary = {
      name: String(manager.name || PRIMARY_MANAGER.name).trim(),
      gmail: String(manager.gmail || PRIMARY_MANAGER.gmail).trim().toLowerCase(),
      password: String(manager.password || PRIMARY_MANAGER.password).trim(),
      is_primary: true,
      is_active: true,
      whatsapp_alerts_enabled: true,
    };

    const existing = await db('managers').whereRaw('LOWER(gmail) = ?', [primary.gmail]).first();
    if (!existing) {
      await db('managers').insert({
        ...primary,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    }
  }
}

async function ensureWhatsAppEventsTable() {
  try {
    const has = await db.schema.hasTable('whatsapp_events');
    if (!has) {
      await db.schema.createTable('whatsapp_events', function(table) {
        table.increments('id').primary();
        table.integer('request_id').nullable();
        table.string('student_name', 200).nullable();
        table.string('student_phone', 32).nullable();
        table.string('status', 32).notNullable().defaultTo('pending');
        table.string('message_id', 255).nullable();
        table.integer('attempt_count').notNullable().defaultTo(0);
        table.text('last_error').nullable();
        table.string('response', 255).nullable();
        table.json('meta').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
    } else {
      try {
        if (!(await db.schema.hasColumn('whatsapp_events', 'request_id'))) {
          await db.schema.alterTable('whatsapp_events', function(table) {
            table.integer('request_id').nullable();
          });
        }
      } catch (err) {
        if (!String(err.message).includes('Duplicate column')) {
          console.warn('Failed to add request_id column:', err.message);
        }
      }
      try {
        if (!(await db.schema.hasColumn('whatsapp_events', 'response'))) {
          await db.schema.alterTable('whatsapp_events', function(table) {
            table.string('response', 255).nullable();
          });
        }
      } catch (err) {
        if (!String(err.message).includes('Duplicate column')) {
          console.warn('Failed to add response column:', err.message);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to ensure whatsapp_events table:', err && err.message);
  }
}

async function readPrimaryManager() {
  await ensureManagersTable();

  try {
    const manager = await db('managers').where('is_primary', true).first();
    if (manager) {
      return manager;
    }
  } catch (error) {
    // fall back to file storage below
  }

  try {
    const manager = await readManagerStore();
    if (manager && manager.gmail) {
      return manager;
    }
  } catch (error) {
    // fall back to the seeded default below
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
    // ignore DB lookup failures and fall back below
  }

  try {
    const manager = await readManagerStore();
    if (manager && String(manager.gmail || '').trim().toLowerCase() === normalizedEmail) {
      return manager;
    }
  } catch (error) {
    // ignore file lookup failures
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

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

async function sendManagerWelcomeEmail(email, name, tempPassword) {
  const transporter = makeTransporter();
  const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/?view=manager`;
  const subject = 'Your Fast Forward India manager login';
  const text = `Hello ${name},\n\nYour manager account has been created.\n\nLogin link: ${loginUrl}\nTemporary password: ${tempPassword}\n\nUse your Gmail address and the temporary password above to sign in. After logging in, please update the password if needed.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Your Fast Forward India manager login</h2>
      <p>Hello ${name},</p>
      <p>Your manager account has been created.</p>
      <p><a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open manager login</a></p>
      <p><strong>Temporary password:</strong> ${tempPassword}</p>
      <p>Use your Gmail address and the temporary password above to sign in. Please change it after your first login if your workflow requires it.</p>
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
    } catch (error) {
      console.warn('Failed to send manager welcome email:', error && error.message);
    }
  }

  console.log('Manager welcome email fallback for', email, { loginUrl, tempPassword });
  return { sent: false, tempPassword };
}

// ── Volunteer table & utility functions ─────────────────────

async function ensureVolunteersTable() {
  const hasTable = await db.schema.hasTable('volunteers');

  if (!hasTable) {
    await db.schema.createTable('volunteers', function(table) {
      table.increments('id').primary();
      table.string('name', 120).notNullable();
      table.string('email', 255).notNullable().unique();
      table.string('password', 120).notNullable().defaultTo('FFI-Volunteer-1234');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.string('reset_token', 128).nullable();
      table.timestamp('reset_expires').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  } else {
    if (!(await db.schema.hasColumn('volunteers', 'reset_token'))) {
      await db.schema.alterTable('volunteers', function(table) {
        table.string('reset_token', 128).nullable();
      });
    }
    if (!(await db.schema.hasColumn('volunteers', 'reset_expires'))) {
      await db.schema.alterTable('volunteers', function(table) {
        table.timestamp('reset_expires').nullable();
      });
    }
  }

  // Seed default volunteer with super admin credentials
  const defaultEmail = PRIMARY_MANAGER.gmail;
  const existing = await db('volunteers').whereRaw('LOWER(email) = ?', [defaultEmail]).first();
  if (!existing) {
    await db('volunteers').insert({
      name: PRIMARY_MANAGER.name,
      email: defaultEmail,
      password: PRIMARY_MANAGER.password,
      is_active: true,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }
}

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

async function sendVolunteerWelcomeEmail(email, name, token) {
  const transporter = makeTransporter();
  const activationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/volunteer-forgot-password?token=${encodeURIComponent(token)}`;
  const subject = 'Activate your Fast Forward India volunteer account';
  const text = `Hello ${name},\n\nYour volunteer account has been created.\n\nTo set your password and activate your account, please use the link below (valid for 7 days):\n\nLink: ${activationUrl}\n\nUse your email address and the password you set to sign in.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Activate your Fast Forward India volunteer account</h2>
      <p>Hello ${name},</p>
      <p>Your volunteer account has been created.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Set Password & Activate</a></p>
      <p>Use your email address and the password you set to sign in.</p>
      <p style="color:#666;font-size:0.85em">This link is valid for 7 days.</p>
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
    } catch (error) {
      console.warn('Failed to send volunteer welcome email:', error && error.message);
    }
  }

  console.log('Volunteer welcome email fallback for', email, { activationUrl, token });
  return { sent: false, token };
}

async function sendManagerPromotionEmail(email, name) {
  const transporter = makeTransporter();
  const loginUrl = `${process.env.APP_URL || 'http://localhost:5173'}/?view=manager`;
  const subject = 'You have been promoted to Manager - Fast Forward India';
  const text = `Hello ${name},\n\nYou have been promoted to a Manager account on the Fast Forward India Blood Donation portal.\n\nUse your existing volunteer credentials to log in to the Manager portal:\n${loginUrl}\n\nNo separate credentials are required.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">You have been promoted to Manager</h2>
      <p>Hello ${name},</p>
      <p>You have been promoted to a Manager account on the Fast Forward India Blood Donation portal.</p>
      <p><a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Open manager login</a></p>
      <p>Please use your existing volunteer email and password to sign in. No separate credentials are required.</p>
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
    } catch (error) {
      console.warn('Failed to send manager promotion email:', error && error.message);
    }
  }

  console.log('Manager promotion email fallback for', email, { loginUrl });
  return { sent: false };
}

async function sendVolunteerResetEmail(email, token) {
  const transporter = makeTransporter();
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/volunteer-forgot-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset your Fast Forward India volunteer password';
  const text = `A password reset was requested for this account. Use the link below to reset your password:\n\nLink: ${resetUrl}\n\nIf you did not request this, ignore this message.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px">Reset your Fast Forward India volunteer password</h2>
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
      console.warn('Failed to send volunteer reset email:', err && err.message);
    }
  }

  console.log('Volunteer password reset token for', email, token, 'reset link:', resetUrl);
  return { sent: false, token };
}

function normalizeDonor(row, index) {
  const rawMobile = String(row.mobile || row.phone || row.mobile_no || '').trim();
  const mobileDigits = rawMobile.replace(/\D+/g, '');
  const mobile = mobileDigits.length > 10 ? mobileDigits.slice(-10) : mobileDigits;

  return {
    id: Number(row.id) || Date.now() + index + 1,
    name: String(row.name || '').trim(),
    admission: String(row.admission || row.admission_no || '').trim(),
    gender: String(row.gender || '').trim(),
    programme: String(row.programme || '').trim(),
    blood: String(row.blood || row.blood_group || '').trim(),
    mobile,
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

app.post('/api/whatsapp/alerts/send', async (request, response) => {
  try {
    const donor = request.body?.donor || null;
    const templateName = request.body?.templateName || null;
    const templateLanguageCode = request.body?.templateLanguageCode || null;
    const requestId = request.body?.requestId ? Number(request.body.requestId) : null;
    const templateParams = Array.isArray(request.body?.templateParams)
      ? request.body.templateParams.map(value => String(value ?? ''))
      : [];

    if (!donor || typeof donor !== 'object') {
      return response.status(400).json({ message: 'donor payload is required.' });
    }

    const phone = normalizePhoneNumber(donor.mobile);
    if (!phone) {
      return response.status(400).json({ message: 'A valid donor mobile number is required.' });
    }

    const alertsEnabled = await areWhatsAppAlertsEnabled();
    if (!alertsEnabled) {
      return response.status(409).json({ message: 'WhatsApp alerts are disabled by manager settings.' });
    }

    const result = await sendMetaWhatsAppTemplateMessage({
      to: phone,
      templateName,
      templateLanguageCode,
      templateParams,
    });

    // persist event (create record)
    try {
      await ensureWhatsAppEventsTable();
      const messageId = result.payload?.messages?.[0]?.id || null;
      const status = result.ok ? 'sent' : 'failed';
      const sender = request.body?.sender || null;
      const event = {
        request_id: requestId,
        student_name: donor.name || null,
        student_phone: phone || null,
        status,
        message_id: messageId,
        attempt_count: 1,
        last_error: result.ok ? null : (result.error || null),
        meta: toJsonText({
          request: {
            templateName,
            templateLanguageCode,
            templateParams,
          },
          response: result.payload,
          sender,
        }),
      };

      const [insertedId] = await db('whatsapp_events').insert(event);

      if (!result.ok) {
        return response.status(result.status || 500).json({
          message: result.error || 'Failed to send WhatsApp alert via Meta API.',
          meta: result.payload || null,
          eventId: insertedId,
        });
      }

      // mark donor as notified in sheet storage (best-effort)
      try {
        const store = await readSheetStore();
        const nextDonors = Array.isArray(store.donors)
          ? store.donors.map(currentDonor => {
              if (Number(currentDonor.id) === Number(donor.id)) {
                return { ...currentDonor, notified: true };
              }

              const currentPhone = normalizePhoneNumber(currentDonor.mobile);
              if (!donor.id && currentPhone && currentPhone === phone) {
                return { ...currentDonor, notified: true };
              }

              return currentDonor;
            })
          : [];
        await writeSheetStore({ ...store, donors: nextDonors });
      } catch (err) {
        // ignore
      }

      return response.json({
        message: `WhatsApp alert sent to ${donor.name || donor.mobile || 'donor'}.`,
        messageId: messageId,
        meta: result.payload,
        eventId: insertedId,
      });
    } catch (err) {
      return response.status(500).json({ message: 'Failed to persist WhatsApp event.' });
    }
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send WhatsApp alert.' });
  }
});

// Admin: whatsapp status
app.get('/api/admin/whatsapp/status', async (_req, res) => {
  const config = getMetaWhatsAppConfig();
  const missing = getMissingMetaWhatsAppConfig(config).filter(k => k !== 'META_WHATSAPP_VERIFY_TOKEN');
  const hasConfig = missing.length === 0;

  try {
    await ensureWhatsAppEventsTable();
    const lastSent = await db('whatsapp_events').where('status', 'sent').orderBy('created_at', 'desc').first();
    const failedCount = await db('whatsapp_events').where('status', 'failed').count('id as c').first();

    return res.json({
      ok: true,
      hasConfig,
      missing,
      templateName: config.templateName,
      templateLanguageCode: config.templateLanguageCode,
      lastSent: lastSent || null,
      failed: Number(failedCount?.c || 0),
    });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

// Admin: list events
app.get('/api/admin/whatsapp/events', async (_req, res) => {
  try {
    await ensureWhatsAppEventsTable();
    const events = await db('whatsapp_events')
      .whereNot('status', 'received')
      .orderBy('created_at', 'desc')
      .limit(200);
    return res.json({ ok: true, events });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin: retry a failed event
app.post('/api/admin/whatsapp/events/:id/retry', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'id is required' });

    await ensureWhatsAppEventsTable();
    const ev = await db('whatsapp_events').where('id', id).first();
    if (!ev) return res.status(404).json({ message: 'Event not found' });

    const phone = normalizePhoneNumber(ev.student_phone);
    if (!phone) return res.status(400).json({ message: 'Invalid phone on event' });

    let templateName = undefined;
    let templateLanguageCode = undefined;
    let templateParams = [];

    if (ev.meta) {
      try {
        const metaObj = typeof ev.meta === 'string' ? JSON.parse(ev.meta) : ev.meta;
        if (metaObj?.request) {
          templateName = metaObj.request.templateName;
          templateLanguageCode = metaObj.request.templateLanguageCode;
          templateParams = metaObj.request.templateParams;
        }
      } catch (err) {
        // ignore parsing error
      }
    }

    const result = await sendMetaWhatsAppTemplateMessage({
      to: phone,
      templateName,
      templateLanguageCode,
      templateParams,
    });

    const updates = {
      attempt_count: Number(ev.attempt_count || 0) + 1,
      updated_at: db.fn.now(),
    };

    const nextMeta = {
      request: {
        templateName,
        templateLanguageCode,
        templateParams,
      },
      response: result.payload,
    };

    if (result.ok) {
      updates.status = 'sent';
      updates.message_id = result.payload?.messages?.[0]?.id || ev.message_id;
      updates.last_error = null;
      updates.meta = toJsonText(nextMeta);
    } else {
      updates.status = 'failed';
      updates.last_error = result.error || null;
      updates.meta = toJsonText(nextMeta);
    }

    await db('whatsapp_events').where('id', id).update(updates);

    return res.json({ ok: result.ok, meta: result.payload || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/meta/whatsapp/webhook', (request, response) => {
  const mode = String(request.query['hub.mode'] || '').trim();
  const token = String(request.query['hub.verify_token'] || '').trim();
  const challenge = String(request.query['hub.challenge'] || '').trim();

  const config = getMetaWhatsAppConfig();
  if (!config.verifyToken) {
    return response.status(500).send('META_WHATSAPP_VERIFY_TOKEN is not configured.');
  }

  if (mode === 'subscribe' && token === config.verifyToken) {
    return response.status(200).send(challenge || 'OK');
  }

  return response.status(403).send('Invalid webhook verification token.');
});

async function sendMetaFreeText({ to, text }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send free text:', err.message);
  }
}

async function sendMetaInteractiveButtons({ to, text, buttons }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send interactive buttons:', err.message);
  }
}

async function sendMetaInteractiveList({ to, text, buttonText, rows }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text },
          action: {
            button: buttonText,
            sections: [
              {
                title: 'Select Option',
                rows: rows.map(r => ({
                  id: r.id,
                  title: r.title.substring(0, 24) // title must be <= 24 chars
                }))
              }
            ]
          }
        }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send interactive list:', err.message);
  }
}

app.post('/api/meta/whatsapp/webhook', (request, response) => {
  const body = request.body || {};
  const summary = summarizeMetaWebhook(body);
  console.log('Meta WhatsApp webhook received:', JSON.stringify(summary));

  // update events where possible
  try {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    (async () => {
      await ensureWhatsAppEventsTable();
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value || {};
          if (Array.isArray(value.statuses)) {
            for (const st of value.statuses) {
              const messageId = st?.id || st?.message_id || null;
              const status = st?.status || null;
              if (messageId && status) {
                // map statuses to our statuses
                const map = { sent: 'sent', delivered: 'sent', read: 'sent', failed: 'failed' };
                const newStatus = map[status] || status;
                await db('whatsapp_events').where('message_id', messageId).update({ status: newStatus, updated_at: db.fn.now(), meta: toJsonText(st) });
              }
            }
          }

          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const from = msg?.from || null;
              const msgId = msg?.id || null;
              if (msgId && from) {
                // Determine user selection
                let userChoice = null;
                let replyId = null;

                if (msg.type === 'button') {
                  // Template button click
                  const btnText = String(msg.button?.text || '').trim().toUpperCase();
                  if (btnText === 'YES' || btnText.includes('YES')) {
                    userChoice = 'Yes';
                  } else if (btnText === 'NO' || btnText.includes('NO')) {
                    userChoice = 'No';
                  } else {
                    userChoice = msg.button?.text || null;
                  }
                } else if (msg.type === 'interactive') {
                  const interactive = msg.interactive || {};
                  if (interactive.type === 'button_reply') {
                    replyId = interactive.button_reply?.id;
                    userChoice = interactive.button_reply?.title;
                  } else if (interactive.type === 'list_reply') {
                    replyId = interactive.list_reply?.id;
                    userChoice = interactive.list_reply?.title;
                  }
                } else if (msg.type === 'text') {
                  const txt = String(msg.text?.body || '').trim().toUpperCase();
                  if (txt === 'YES' || txt.startsWith('YES') || txt.includes('YES')) {
                    userChoice = 'Yes';
                  } else if (txt === 'NO' || txt.startsWith('NO') || txt.includes('NO')) {
                    userChoice = 'No';
                  }
                }

                // If we detected a response, update the latest outreach event in database
                if (userChoice) {
                  const latestEvent = await db('whatsapp_events')
                    .where('student_phone', from)
                    .whereNot('status', 'received')
                    .orderBy('created_at', 'desc')
                    .first();
                  
                  if (latestEvent) {
                    const diffMs = Date.now() - new Date(latestEvent.created_at).getTime();
                    const hours24 = 24 * 60 * 60 * 1000;
                    
                     if (diffMs <= hours24) {
                      // Bouncer check: Only consider the first reply to buttons and ignore duplicate submissions.
                      if (latestEvent.response !== null && latestEvent.response !== '') {
                        const isFinal = latestEvent.status === 'accepted' || 
                                        latestEvent.response === 'No - Other' || 
                                        latestEvent.response.startsWith('No - Donated Recently (');
                        
                        const isInitialButton = msg.type === 'button' || msg.type === 'text';
                        
                        if (isInitialButton || isFinal) {
                          console.log(`Bouncer: Ignoring duplicate response from ${from} for event ${latestEvent.id}. Current response: ${latestEvent.response}`);
                          continue;
                        }
                      }

                      let nextResponse = userChoice;
                      
                      // Format response for display
                      if (replyId === 'no_donated_recently') {
                        nextResponse = 'No - Donated Recently';
                      } else if (replyId === 'no_other') {
                        nextResponse = 'No - Other';
                      } else if (replyId && replyId.startsWith('months_')) {
                        nextResponse = `No - Donated Recently (${userChoice})`;
                      }
                      
                      await db('whatsapp_events')
                        .where('id', latestEvent.id)
                        .update({ 
                          response: nextResponse,
                          status: (userChoice === 'Yes' || userChoice.includes('YES')) ? 'accepted' : 'declined',
                          updated_at: db.fn.now() 
                        });

                      // Send auto-responses (conversation bot)
                      if (userChoice === 'Yes') {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Our volunteer will reach out to you soon if the case hasn\'t been resolved yet. Thank you for your support!'
                        });
                      } else if (userChoice === 'No') {
                        await sendMetaInteractiveButtons({
                          to: from,
                          text: 'We understand. Could you please let us know the reason?',
                          buttons: [
                            { id: 'no_donated_recently', title: 'Donated recently' },
                            { id: 'no_other', title: 'Other' }
                          ]
                        });
                      } else if (replyId === 'no_other') {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Thank you for your cooperation.'
                        });
                      } else if (replyId === 'no_donated_recently') {
                        await sendMetaInteractiveList({
                          to: from,
                          text: 'Could you tell us how many months ago it was?',
                          buttonText: 'Select Months',
                          rows: [
                            { id: 'months_1', title: '1 month' },
                            { id: 'months_2', title: '2 months' },
                            { id: 'months_3', title: '3 months' },
                            { id: 'months_other', title: 'Others' }
                          ]
                        });
                      } else if (replyId && replyId.startsWith('months_')) {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Thank you for your cooperation.'
                        });
                      }
                    } else {
                      console.log(`Received user choice ${userChoice} but it was outside the 24h window (diff: ${diffMs} ms)`);
                    }
                  }
                }

                // create inbound record for tracking
                await db('whatsapp_events')
                  .insert({ 
                    student_name: null, 
                    student_phone: from, 
                    status: 'received', 
                    message_id: msgId, 
                    attempt_count: 0, 
                    response: userChoice,
                    meta: toJsonText(msg) 
                  })
                  .catch(() => {});
              }
            }
          }
        }
      }
    })();
  } catch (err) {
    console.warn('Failed to update whatsapp_events from webhook:', err && err.message);
  }

  return response.status(200).send('EVENT_RECEIVED');
});

app.get('/api/manager', async (_request, response) => {
  try {
    const manager = await readPrimaryManager();

    response.json(serializeManager(manager));
  } catch (error) {
    response.status(500).json({ message: 'Failed to load manager account.' });
  }
});

app.get('/api/managers', async (_request, response) => {
  try {
    const managers = await readManagers();
    response.json(managers.map(serializeManager));
  } catch (error) {
    response.status(500).json({ message: 'Failed to load manager accounts.' });
  }
});

app.post('/api/managers', async (request, response) => {
  try {
    const gmail = String(request.body?.gmail || request.body?.email || '').trim().toLowerCase();

    if (!gmail) {
      return response.status(400).json({ message: 'gmail is required.' });
    }

    if (!/\S+@\S+\.\S+/.test(gmail)) {
      return response.status(400).json({ message: 'gmail must be a valid email address.' });
    }

    // 1. Verify that the volunteer exists
    const volunteer = await readVolunteerByEmail(gmail);
    if (!volunteer) {
      return response.status(400).json({ message: `Only existing volunteers can be promoted to managers. No volunteer found with email: ${gmail}` });
    }

    // 2. Check if already a manager
    const existingManager = await readManagerByEmail(gmail);
    if (existingManager) {
      if (isActiveFlag(existingManager.is_active)) {
        return response.status(409).json({ message: 'This volunteer is already an active manager.' });
      } else {
        // Reactivate inactive manager
        await db('managers').where('id', existingManager.id).update({ is_active: true, updated_at: db.fn.now() });
        await sendManagerPromotionEmail(gmail, volunteer.name);
        
        const updatedManager = await readManagerByEmail(gmail);
        const payload = serializeManager(updatedManager);
        payload.message = 'Manager account reactivated successfully.';
        payload.promoted = true;
        return response.json(payload);
      }
    }

    // 3. Promote volunteer to manager
    const createdManager = await createManagerAccount({ 
      name: volunteer.name, 
      gmail, 
      password: volunteer.password 
    });
    
    const mailResult = await sendManagerPromotionEmail(gmail, volunteer.name);

    const payload = serializeManager(createdManager);
    payload.message = 'Volunteer promoted to Manager successfully.';
    payload.promoted = true;

    response.status(201).json(payload);
  } catch (error) {
    response.status(500).json({ message: 'Failed to promote volunteer to manager.' });
  }
});

app.delete('/api/managers/:id', async (request, response) => {
  try {
    await ensureManagersTable();
    const managerId = Number(request.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return response.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return response.status(404).json({ message: 'Manager not found.' });
    }

    if (manager.is_primary) {
      return response.status(400).json({ message: 'Primary manager cannot be demoted.' });
    }

    await db('managers').where('id', managerId).del();

    return response.json({ message: `Manager account ${manager.name} (${manager.gmail}) successfully demoted to Volunteer.` });
  } catch (error) {
    return response.status(500).json({ message: 'Failed to demote manager account.' });
  }
});

app.post('/api/managers/:id/deactivate', async (request, response) => {
  try {
    await ensureManagersTable();
    const managerId = Number(request.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return response.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return response.status(404).json({ message: 'Manager not found.' });
    }

    if (manager.is_primary) {
      return response.status(400).json({ message: 'Primary manager cannot be deactivated.' });
    }

    await db('managers').where('id', managerId).update({ is_active: false, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return response.json(serializeManager(updatedManager));
  } catch (error) {
    return response.status(500).json({ message: 'Failed to deactivate manager account.' });
  }
});

app.post('/api/managers/:id/activate', async (request, response) => {
  try {
    await ensureManagersTable();
    const managerId = Number(request.params.id);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return response.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return response.status(404).json({ message: 'Manager not found.' });
    }

    await db('managers').where('id', managerId).update({ is_active: true, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return response.json(serializeManager(updatedManager));
  } catch (error) {
    return response.status(500).json({ message: 'Failed to activate manager account.' });
  }
});

app.post('/api/managers/:id/alerts', async (request, response) => {
  try {
    await ensureManagersTable();
    const managerId = Number(request.params.id);
    const enabled = Boolean(request.body?.enabled);

    if (!Number.isInteger(managerId) || managerId <= 0) {
      return response.status(400).json({ message: 'manager id is required.' });
    }

    const manager = await db('managers').where('id', managerId).first();
    if (!manager) {
      return response.status(404).json({ message: 'Manager not found.' });
    }

    await db('managers').update({ whatsapp_alerts_enabled: enabled, updated_at: db.fn.now() });
    const updatedManager = await db('managers').where('id', managerId).first();

    return response.json(serializeManager(updatedManager));
  } catch (error) {
    return response.status(500).json({ message: 'Failed to update WhatsApp alert setting.' });
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

    const manager = await readManagerByEmail(email);
    if (!manager) {
      return response.status(401).json({ message: 'Invalid manager email or password.' });
    }

    // Authenticate using matching volunteer credentials
    const volunteer = await readVolunteerByEmail(email);
    if (!volunteer || String(volunteer.password || '') !== password) {
      return response.status(401).json({ message: 'Invalid manager email or password.' });
    }

    if (!manager.is_primary && !isActiveFlag(manager.is_active)) {
      return response.status(423).json({
        message: 'Your account is deactivated. Activate it to continue.',
        inactive: true,
        manager: serializeManager(manager),
      });
    }

    response.json(serializeManager(manager));
  } catch (error) {
    response.status(500).json({ message: 'Manager login failed.' });
  }
});

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

    const manager = await readManagerByEmail(email);
    if (!manager) {
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

    // Sync to volunteer table as well
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
      // ignore file errors
    }

    try { PRIMARY_MANAGER.password = newPassword; PRIMARY_MANAGER.reset_token = null; PRIMARY_MANAGER.reset_expires = null; } catch (e) {}

    return response.json({ message: 'Password has been reset. You can now sign in with the new password.' });
  } catch (error) {
    return response.status(500).json({ message: 'Failed to confirm password reset.' });
  }
});

// ── Volunteer API routes ────────────────────────────────────

app.post('/api/volunteer/login', async (request, response) => {
  try {
    const email = String(request.body?.email || request.body?.id || '').trim().toLowerCase();
    const password = String(request.body?.password || '').trim();

    if (!email) return response.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return response.status(400).json({ message: 'email must be a valid email address.' });
    if (!password) return response.status(400).json({ message: 'password is required.' });

    const volunteer = await readVolunteerByEmail(email);

    if (!volunteer || String(volunteer.password || '') !== password) {
      return response.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!isActiveFlag(volunteer.is_active)) {
      return response.status(423).json({ message: 'Your account is deactivated. Contact a manager.', inactive: true });
    }

    response.json(serializeVolunteer(volunteer));
  } catch (error) {
    response.status(500).json({ message: 'Login failed.' });
  }
});

app.post('/api/volunteer/forgot/request', async (request, response) => {
  try {
    const email = String(request.body?.email || '').trim().toLowerCase();
    if (!email) return response.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return response.status(400).json({ message: 'email must be a valid email address.' });

    const volunteer = await readVolunteerByEmail(email);
    if (!volunteer) {
      return response.json({ message: 'If the email matches a volunteer account, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    try {
      await db('volunteers').where('id', volunteer.id).update({ reset_token: token, reset_expires: expires });
    } catch (err) {
      // ignore DB errors
    }

    const result = await sendVolunteerResetEmail(email, token);

    const resp = { message: 'If the email matches a volunteer account, a reset link has been sent.' };
    if (process.env.SHOW_RESET_TOKEN === 'true' || !result.sent) {
      resp.token = result.token || token;
    }

    return response.json(resp);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to request password reset.' });
  }
});

app.post('/api/volunteer/forgot/confirm', async (request, response) => {
  try {
    const token = String(request.body?.token || '').trim();
    const newPassword = String(request.body?.password || '').trim();

    if (!token) return response.status(400).json({ message: 'token is required.' });
    if (!newPassword) return response.status(400).json({ message: 'password is required.' });

    await ensureVolunteersTable();
    let volunteer = null;
    try {
      volunteer = await db('volunteers').where('reset_token', token).andWhere('reset_expires', '>', db.fn.now()).first();
    } catch (err) {
      // ignore DB errors
    }

    if (!volunteer) return response.status(400).json({ message: 'Invalid or expired token.' });

    try {
      await db('volunteers').where('id', volunteer.id).update({ password: newPassword, reset_token: null, reset_expires: null, updated_at: db.fn.now() });
    } catch (err) {
      // ignore DB errors
    }

    return response.json({ message: 'Password has been reset. You can now sign in with the new password.' });
  } catch (error) {
    return response.status(500).json({ message: 'Failed to confirm password reset.' });
  }
});

app.post('/api/volunteers', async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim();
    const email = String(request.body?.email || request.body?.gmail || '').trim().toLowerCase();

    if (!name) return response.status(400).json({ message: 'name is required.' });
    if (!email) return response.status(400).json({ message: 'email is required.' });
    if (!/\S+@\S+\.\S+/.test(email)) return response.status(400).json({ message: 'email must be a valid email address.' });

    const existing = await readVolunteerByEmail(email);
    if (existing) return response.status(409).json({ message: 'A volunteer with that email already exists.' });

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

    response.status(201).json(payload);
  } catch (error) {
    response.status(500).json({ message: 'Failed to create volunteer account.' });
  }
});

app.get('/api/volunteers', async (_request, response) => {
  try {
    await ensureVolunteersTable();
    const volunteers = await db('volunteers').orderBy('created_at', 'asc');
    response.json(volunteers.map(serializeVolunteer));
  } catch (error) {
    response.status(500).json({ message: 'Failed to load volunteer accounts.' });
  }
});

async function ensureManagerLogsTable() {
  try {
    const has = await db.schema.hasTable('manager_logs');
    if (!has) {
      await db.schema.createTable('manager_logs', function(table) {
        table.increments('id').primary();
        table.string('actor', 200).notNullable();
        table.string('request', 255).notNullable();
        table.text('msg').notNullable();
        table.string('status', 32).notNullable().defaultTo('accepted');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });

      const seedLogs = [
        { actor: 'Manager', request: 'Imported donor sheet', status: 'accepted', msg: 'Active Excel sheet replaced and saved to backend.', created_at: new Date(Date.now() - 5 * 60 * 1000) },
        { actor: 'Manager', request: 'Deleted donor sheet', status: 'declined', msg: 'Current active sheet was cleared from backend storage.', created_at: new Date(Date.now() - 18 * 60 * 1000) },
        { actor: 'Manager', request: 'Updated donor source', status: 'sent', msg: 'Fresh donor sheet synchronized for all users.', created_at: new Date(Date.now() - 60 * 60 * 1000) },
        { actor: 'Manager', request: 'Opened sheet preview', status: 'pending', msg: 'Viewed the active donor sheet before export.', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      ];
      await db('manager_logs').insert(seedLogs);
    }
  } catch (err) {
    console.error('Failed to ensure manager_logs table:', err.message);
  }
}

app.get('/api/admin/manager-logs', async (_req, res) => {
  try {
    await ensureManagerLogsTable();
    const logs = await db('manager_logs').orderBy('created_at', 'desc').limit(200);
    return res.json({ ok: true, logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/manager-logs', async (req, res) => {
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
});

app.listen(port, () => {
  console.log(`BDFFI backend listening on port ${port}`);
});
