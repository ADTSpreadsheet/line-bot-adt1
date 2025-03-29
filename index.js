// index.js - LINE Bot ตัวที่ 1 (เวอร์ชันสมบูรณ์ รองรับ rawBody แล้ว)
const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const registrationRoutes = require('./routes/registration');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// LINE config
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ✅ LINE Webhook ต้องใช้ express.raw() เพื่อให้ SDK ตรวจสอบ Signature ได้
app.post('/webhook', express.raw({ type: 'application/json' }), line.middleware(config), async (req, res) => {
  try {
    let events;
    if (Buffer.isBuffer(req.body)) {
      events = JSON.parse(req.body.toString()).events;
    } else {
      events = req.body.events;
    }

    res.status(200).end();

    // ✅ ลบการจัดการข้อความ 'REQ_REFCODE' เพราะย้ายไป controllers/registrationController.js แล้ว
    // ✅ ลบการตอบกลับ event.type === 'follow' เพราะใช้ข้อความต้อนรับจาก LINE Developer Console แล้ว

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).end();
  }
});

// ✅ ใช้ bodyParser.json() หลังจาก Webhook
app.use(bodyParser.json());
app.use('/api/registration', registrationRoutes);

// ✅ Health check
app.get('/webhook', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LINE webhook is running',
    version: 'updated-march-2025-rawbody'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LINE Bot Server running on port ${PORT}`);
});
