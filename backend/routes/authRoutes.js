const express = require('express');
const router = express.Router();
const { loginManager, forgotRequestManager, forgotConfirmManager } = require('../controllers/managerController');
const { loginVolunteer, requestReset, confirmReset } = require('../controllers/volunteerController');

// Manager auth
router.post('/manager/login', loginManager);
router.post('/manager/forgot/request', forgotRequestManager);
router.post('/manager/forgot/confirm', forgotConfirmManager);

// Volunteer auth
router.post('/volunteer/login', loginVolunteer);
router.post('/volunteer/forgot/request', requestReset);
router.post('/volunteer/forgot/confirm', confirmReset);

module.exports = router;
