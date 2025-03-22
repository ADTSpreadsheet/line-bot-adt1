/**
 * routes/index.js
 * จัดการเส้นทางทั้งหมดของแอปพลิเคชัน
 */
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const verificationController = require('../controllers/verificationController');

// LINE Webhook
router.post('/webhook', webhookController.handleWebhook);

// Verify Ref.Code and generate Serial Key
router.post('/verify-ref-code', verificationController.verifyRefCode);

// Verify Serial Key
router.post('/verify-serial-key', verificationController.verifySerialKey);

// Send Serial Key (เพิ่มใหม่)
router.post('/send-serial-key', verificationController.sendSerialKey);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// Test VBA connection
router.get('/test-vba-connection', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'VBA connection successful' });
});

module.exports = router;
