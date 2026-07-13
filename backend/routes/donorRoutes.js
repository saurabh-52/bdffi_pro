const express = require('express');
const router = Router = express.Router();
const { getDonors, importDonors, deleteDonors, updateBlockFilters } = require('../controllers/donorController');

router.get('/donors', getDonors);
router.post('/donors/import', importDonors);
router.delete('/donors', deleteDonors);
router.post('/donors/block-filters', updateBlockFilters);

module.exports = router;
