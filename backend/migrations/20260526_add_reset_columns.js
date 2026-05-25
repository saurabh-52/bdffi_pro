/** Add columns for password reset tokens on managers table */

exports.up = function(knex) {
  return knex.schema.alterTable('managers', function(table) {
    table.string('reset_token', 128).nullable();
    table.timestamp('reset_expires').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('managers', function(table) {
    table.dropColumn('reset_token');
    table.dropColumn('reset_expires');
  });
};
