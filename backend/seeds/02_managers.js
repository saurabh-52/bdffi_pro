exports.seed = async function(knex) {
  await knex('managers').del();

  await knex('managers').insert([
    {
      id: 1,
      name: 'Fast Forward India Manager',
      gmail: 'manager@fastforwardindia.org',
      is_primary: true,
    }
  ]);
};