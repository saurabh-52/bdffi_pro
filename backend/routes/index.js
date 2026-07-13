const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const donorRoutes = require('./donorRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const managerRoutes = require('./managerRoutes');

router.use('/', authRoutes);
router.use('/', donorRoutes);
router.use('/', whatsappRoutes);
router.use('/', managerRoutes);

module.exports = router;
