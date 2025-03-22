const express = require('express');
const router = express.Router();

// เส้นทางรับ webhook จาก LINE
router.post('/webhook', async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    console.log('❌ No events received');
    return res.status(200).end();
  }

  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    const messageText = event.message?.text;

    console.log(`✅ Received from ${userId}: ${messageText}`);

    if (messageText === 'REQ_REFCODE') {
      await replyText(replyToken, `🎯 ระบบได้รับคำสั่งแล้วครับ\nคุณพิมพ์: ${messageText}`);
    } else {
      await replyText(replyToken, `สวัสดีครับ 👋 คุณพิมพ์ว่า: ${messageText}`);
    }
  }

  res.status(200).send('OK');
});

// ฟังก์ชันตอบกลับข้อความไปยัง LINE
const axios = require('axios');
const LINE_TOKEN = process.env.LINE_BOT1_ACCESS_TOKEN;

async function replyText(replyToken, text) {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [
          {
            type: 'text',
            text: text
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_TOKEN}`
        }
      }
    );
  } catch (err) {
    console.error('❌ Error replying to LINE:', err.response?.data || err.message);
  }
}

module.exports = router;
