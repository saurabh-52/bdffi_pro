exports.up = function(knex) {
  return knex.schema.alterTable('managers', function(table) {
    table.string('password', 120).notNullable().defaultTo('FFI-Manager-1234');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('managers', function(table) {
    table.dropColumn('password');
  });
};