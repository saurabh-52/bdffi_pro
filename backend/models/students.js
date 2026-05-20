const knex = require('../db/knex');

module.exports = {
  findEligibleByBloodGroup: (bloodGroup, limit = 10) => {
    return knex('students')
      .where('blood_group', bloodGroup)
      .andWhere(function() {
        this.whereNull('last_donation_date').orWhere('last_donation_date', '<', knex.raw("DATE_SUB(NOW(), INTERVAL 90 DAY)"));
      })
      .andWhere('status', 'active')
      .limit(limit);
  },

  markDonated: (studentId, date = null) => {
    return knex('students')
      .where('id', studentId)
      .update({ last_donation_date: date || knex.fn.now() });
  }
};
