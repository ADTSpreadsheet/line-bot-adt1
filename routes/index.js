const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');
const { generateRefCode, generateSerialKey, calculateExpiryTime } = require('../utils/helpers');

const LINE_TOKEN = process.env.LINE_BOT1_ACCESS_TOKEN;

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
      // ตรวจสอบว่ามี Ref.Code ที่ยังไม่หมดอายุ
      const existingSession = await db.findActiveSessionByUser(userId, 'PENDING');

      if (existingSession) {
        return await replyText(replyToken, `📌 คุณมี Ref.Code ที่ยังใช้งานได้
รหัสคือ: ${existingSession.ref_code}`);
      }

      // สร้าง Ref.Code และ Serial Key ใหม่
      const refCode = generateRefCode();
      const serialKey = generateSerialKey();
      const expiresAt = calculateExpiryTime(15); // นาที

      const sessionData = {
        line_user_id: userId,
        ref_code: refCode,
        serial_key: serialKey,
        status: 'PENDING',
        request_count: 1,
        verify_count: 0,
        day_created_at: new Date().toISOString().split('T')[0],
        time_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        verify_at: new Date().toISOString(),
        expires_at: expiresAt
      };

      const { data, error } = await db.createSession(sessionData);

      if (error) {
        console.error('❌ Failed to create session:', error);
        return await replyText(replyToken, 'เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่ภายหลัง');
      }

      return await replyText(replyToken, `✅ สร้าง Ref.Code สำเร็จแล้ว!
รหัสของคุณคือ: ${refCode}
กรุณากรอกใน Excel VBA แล้วกด Verify ครับ ✅`);
    } else {
      await replyText(replyToken, `คุณพิมพ์ว่า: ${messageText}`);
    }
  }

  res.status(200).send('OK');
});

async function replyText(replyToken, text) {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [{ type: 'text', text }]
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
