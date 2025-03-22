/**
 * routes/index.js
 * กำหนดเส้นทาง API ทั้งหมดของระบบ
 */

const express = require('express');
const router = express.Router();

// Controllers
const webhookController = require('../controllers/lineWebhookController');
const verificationController = require('../controllers/verificationController');

// ✅ เส้นทางหลัก
router.post('/webhook', webhookController.handleWebhook);
router.post('/verify-ref-code', verificationController.verifyRefCode);
router.post('/verify-serial-key', verificationController.verifySerialKey);
router.post('/send-serial-key', verificationController.sendSerialKey);

module.exports = router;
