const express = require('express');
const router = express.Router();
const {
  sendAlert,
  getWhatsappStatus,
  getWhatsappEvents,
  retryWhatsappEvent,
  verifyWebhook,
  receiveWebhook,
} = require('../controllers/whatsappController');

router.post('/whatsapp/alerts/send', sendAlert);
router.get('/admin/whatsapp/status', getWhatsappStatus);
router.get('/admin/whatsapp/events', getWhatsappEvents);
router.post('/admin/whatsapp/events/:id/retry', retryWhatsappEvent);
router.get('/meta/whatsapp/webhook', verifyWebhook);
router.post('/meta/whatsapp/webhook', receiveWebhook);

module.exports = router;
