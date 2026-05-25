/** Migration: create a single-manager table */

exports.up = function(knex) {
  return knex.schema.createTable('managers', function(table) {
    table.increments('id').primary();
    table.string('name', 120).notNullable();
    table.string('gmail', 255).notNullable().unique();
    table.string('password', 120).notNullable().defaultTo('FFI-Manager-1234');
    table.boolean('is_primary').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('managers');
};