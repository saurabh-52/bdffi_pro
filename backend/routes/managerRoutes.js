const express = require('express');
const router = express.Router();
const {
  getPrimaryManager,
  getAllManagers,
  promoteVolunteer,
  demoteManager,
  deactivateManager,
  activateManager,
  updateAlertsSetting,
  getManagerLogs,
  createManagerLog,
} = require('../controllers/managerController');
const {
  createVolunteer,
  getVolunteers,
  removeVolunteer,
} = require('../controllers/volunteerController');

// Manager management
router.get('/manager', getPrimaryManager);
router.get('/managers', getAllManagers);
router.post('/managers', promoteVolunteer);
router.delete('/managers/:id', demoteManager);
router.post('/managers/:id/deactivate', deactivateManager);
router.post('/managers/:id/activate', activateManager);
router.post('/managers/:id/alerts', updateAlertsSetting);

// Manager logs/audits
router.get('/admin/manager-logs', getManagerLogs);
router.post('/admin/manager-logs', createManagerLog);

// Volunteer admin actions under managers purview
router.post('/volunteers', createVolunteer);
router.get('/volunteers', getVolunteers);
router.delete('/volunteers/:id', removeVolunteer);

module.exports = router;
