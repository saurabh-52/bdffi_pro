const db = require('./knex');
const { PRIMARY_MANAGER, readManagerStore } = require('../models/store');

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

  // Seed fake managers
  const managerCount = await db('managers').count('* as cnt').first();
  if (managerCount && Number(managerCount.cnt) <= 1) {
    const FAKE_MANAGERS = [
      { name: 'Aarav Sharma', gmail: 'aarav.sharma@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true },
      { name: 'Diya Patel', gmail: 'diya.patel@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true },
      { name: 'Karan Malhotra', gmail: 'karan.malhotra@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true },
      { name: 'Ananya Iyer', gmail: 'ananya.iyer@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: false },
      { name: 'Rohan Gupta', gmail: 'rohan.gupta@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true },
      { name: 'Neha Verma', gmail: 'neha.verma@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true },
      { name: 'Aditya Rao', gmail: 'aditya.rao@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: false },
      { name: 'Sneha Reddy', gmail: 'sneha.reddy@fastforwardindia.org', password: 'FFI-Manager-1234', is_primary: false, is_active: true }
    ];

    for (const m of FAKE_MANAGERS) {
      const existingM = await db('managers').whereRaw('LOWER(gmail) = ?', [m.gmail.toLowerCase()]).first();
      if (!existingM) {
        await db('managers').insert({
          name: m.name,
          gmail: m.gmail.toLowerCase(),
          password: m.password,
          is_primary: m.is_primary,
          is_active: m.is_active,
          whatsapp_alerts_enabled: true,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
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

  // Seed fake volunteers
  const volunteerCount = await db('volunteers').count('* as cnt').first();
  if (Number(volunteerCount.cnt) <= 1) {
    const FAKE_VOLUNTEERS = [
      { name: 'Aarav Sharma', email: 'aarav.sharma@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Diya Patel', email: 'diya.patel@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Ishaan Sen', email: 'ishaan.sen@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Kabir Kapoor', email: 'kabir.kapoor@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Meera Nair', email: 'meera.nair@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Rohan Gupta', email: 'rohan.gupta@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Sneha Reddy', email: 'sneha.reddy@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Vikram Joshi', email: 'vikram.joshi@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Pooja Bhatia', email: 'pooja.bhatia@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true },
      { name: 'Arjun Verma', email: 'arjun.verma@fastforwardindia.org', password: 'FFI-Volunteer-1234', is_active: true }
    ];

    for (const v of FAKE_VOLUNTEERS) {
      const existingV = await db('volunteers').whereRaw('LOWER(email) = ?', [v.email.toLowerCase()]).first();
      if (!existingV) {
        await db('volunteers').insert({
          name: v.name,
          email: v.email.toLowerCase(),
          password: v.password,
          is_active: v.is_active,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
    }
  }
}

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

async function ensureAllTables() {
  await ensureManagersTable();
  await ensureWhatsAppEventsTable();
  await ensureVolunteersTable();
  await ensureManagerLogsTable();
}

module.exports = {
  ensureManagersTable,
  ensureWhatsAppEventsTable,
  ensureVolunteersTable,
  ensureManagerLogsTable,
  ensureAllTables,
};
