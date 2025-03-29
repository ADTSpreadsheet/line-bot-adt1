// index.js - LINE Bot ตัวที่ 1 (ฉบับใหม่ล่าสุด เชื่อมกับ registration.js อย่างถูกต้อง)

const express = require('express');
const bodyParser = require('body-parser');
const line = require('@line/bot-sdk');
const registrationRoutes = require('./routes/registration');
const { validateLineWebhook } = require('./middlewares/lineWebhookValidator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// LINE config
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// Middleware
app.use(bodyParser.json());
app.use('/api/registration', registrationRoutes); // ✅ เส้นทาง API registration

// ✅ LINE Webhook - ต้อนรับผู้ใช้ใหม่
app.post('/webhook', validateLineWebhook(config.channelSecret), async (req, res) => {
  try {
    const events = req.body.events;
    res.status(200).end(); // ตอบกลับ LINE Platform ทันที

    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.type === 'follow') {
        const lineUserId = event.source.userId;
        // ตอบกลับข้อความต้อนรับ
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '👋 สวัสดีครับ! กรุณาพิมพ์คำว่า REQ_REFCODE เพื่อรับรหัสลงทะเบียนของคุณครับ'
        });
      }

      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text.trim();
        const lineUserId = event.source.userId;

        if (userMessage.toUpperCase() === 'REQ_REFCODE') {
          // ส่งต่อให้ registrationController.createRefCode
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

// ✅ Health check
app.get('/webhook', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LINE webhook is running',
    version: 'updated-march-2025'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LINE Bot Server running on port ${PORT}`);
});
