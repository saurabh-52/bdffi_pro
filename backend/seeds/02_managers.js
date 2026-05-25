exports.seed = async function(knex) {
  await knex('managers').del();

  await knex('managers').insert([
    {
      id: 1,
      name: 'Fast Forward India Manager',
      gmail: 'manager@fastforwardindia.org',
      password: 'FFI-Manager-1234',
      is_primary: true,
    }
  ]);
};