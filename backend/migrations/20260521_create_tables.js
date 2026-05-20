/** Migration: create students, donation_requests, notification_logs **/

exports.up = function(knex) {
  return knex.schema
    .createTable('students', function(table) {
      table.increments('id').primary();
      table.string('name', 200).notNullable();
      table.string('admission_no', 50).unique();
      table.string('phone_no', 20).notNullable();
      table.string('blood_group', 5).notNullable();
      table.date('last_donation_date').nullable();
      table.enu('status', ['active','inactive']).defaultTo('active');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('donation_requests', function(table) {
      table.increments('id').primary();
      table.string('patient_name', 200).notNullable();
      table.string('hospital_name', 200).nullable();
      table.string('required_blood_group', 5).notNullable();
      table.string('contact_no', 20).nullable();
      table.enu('status', ['pending','fulfilled','cancelled']).defaultTo('pending');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('notification_logs', function(table) {
      table.increments('id').primary();
      table.integer('request_id').unsigned().notNullable();
      table.integer('student_id').unsigned().notNullable();
      table.enu('status', ['sent','accepted','declined','failed']).defaultTo('sent');
      table.string('message_id', 255).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('request_id');
      table.index('student_id');
      table.foreign('request_id').references('donation_requests.id').onDelete('CASCADE');
      table.foreign('student_id').references('students.id').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('notification_logs')
    .dropTableIfExists('donation_requests')
    .dropTableIfExists('students');
};
