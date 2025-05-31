const express = require('express');
const router = express.Router();

// Import TUMCIVIL Bot Controllers
const { 
  handleTumcivilWebhook, 
  testTumcivilMessage 
} = require('../controllers/TUMCIVILBot');

// 🔗 Webhook Endpoint สำหรับ TUMCIVIL Bot
// URL: POST /webhook
router.post('/webhook', handleTumcivilWebhook);

// 🧪 Test Endpoint สำหรับทดสอบการส่งข้อความ
// URL: POST /test-tumcivil
router.post('/test-tumcivil', testTumcivilMessage);

// 📋 GET endpoint สำหรับตรวจสอบสถานะ
// URL: GET /tumcivil/status
router.get('/status', (req, res) => {
  res.status(200).json({
    message: '✅ TUMCIVIL Bot is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: 'POST /webhook',
      test: 'POST /test-tumcivil',
      status: 'GET /tumcivil/status'
    },
    environment: {
      hasAccessToken: !!process.env.TUMCIVIL_BOT_ACCESS_TOKEN,
      hasChannelSecret: !!process.env.TUMCIVIL_BOT_CHANNEL_SECRET,
      hasAdminUserId: !!process.env.TUMCIVIL_ADMIN_USER_ID,
      adminUserId: process.env.TUMCIVIL_ADMIN_USER_ID ? 
        `${process.env.TUMCIVIL_ADMIN_USER_ID.substring(0, 5)}...` : 
        'Not set'
    }
  });
});

module.exports = router;
