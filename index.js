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
    const events = JSON.parse(req.body.toString()).events;
    res.status(200).end();

    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.type === 'follow') {
        const lineUserId = event.source.userId;
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '👋 สวัสดีครับ! กรุณาพิมพ์คำว่า REQ_REFCODE เพื่อรับรหัสลงทะเบียนของคุณครับ'
        });
      }

      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text.trim();
        const lineUserId = event.source.userId;

        if (userMessage.toUpperCase() === 'REQ_REFCODE') {
          const axios = require('axios');
          try {
            const response = await axios.post(
              `${process.env.API_BASE_URL}/api/registration/create-ref`,
              { line_user_id: lineUserId }
            );

            if (response.data && response.data.ref_code) {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: `🔐 Ref.Code ของคุณคือ: ${response.data.ref_code}`
              });
            } else {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '❌ ไม่สามารถสร้าง Ref.Code ได้ กรุณาลองใหม่ครับ'
              });
            }
          } catch (err) {
            console.error('❌ Error calling create-ref API:', err);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '⚠️ เกิดข้อผิดพลาดจากระบบ กรุณาลองใหม่ภายหลังครับ'
            });
          }
        }
      }
    }
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
