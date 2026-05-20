exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('students').del();
  await knex('students').insert([
    {
      id: 1,
      name: 'Asha Sharma',
      admission_no: 'A1001',
      phone_no: '+919900000001',
      blood_group: 'A+',
      last_donation_date: null
    },
    {
      id: 2,
      name: 'Ravi Kumar',
      admission_no: 'A1002',
      phone_no: '+919900000002',
      blood_group: 'B+',
      last_donation_date: '2025-12-01'
    }
  ]);
};
