/**
 * controllers/lineWebhookController.js
 * จัดการ webhook จาก LINE Messaging API
 */

const { validateLineSignature } = require('../utils/helpers');
const CONFIG = require('../config');
const lineService = require('../services/lineService');
const authService = require('../services/authService');

/**
 * รับ Webhook จาก LINE
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-line-signature'];
    const events = req.body.events;

    // ตรวจสอบลายเซ็น
    const isValid = validateLineSignature(req.body, signature, CONFIG.LINE.BOT1.CHANNEL_SECRET);
    if (!isValid) {
      console.error('❌ Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    if (!events || events.length === 0) {
      return res.status(200).end();
    }

    // จัดการกับทุก event ที่เข้ามา
    await Promise.all(events.map(handleEvent));
    return res.status(200).end();
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

/**
 * จัดการกับแต่ละ event
 */
const handleEvent = async (event) => {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  const messageText = event.message.text.trim();

  console.log(`📩 Received message from ${userId}: ${messageText}`);

  if (messageText === 'REQ_REFCODE') {
    return handleRefCodeRequest(userId, event.replyToken);
  }

  if (messageText === 'myid') {
    return lineService.replyMessage(event.replyToken, {
      type: 'text',
      text: `🆔 LINE User ID ของคุณคือ:\n${userId}`
    });
  }

  return lineService.replyMessage(event.replyToken, {
    type: 'text',
    text: 'สวัสดีครับ! พิมพ์ REQ_REFCODE เพื่อขอรหัสอ้างอิง'
  });
};

/**
 * จัดการคำขอ Ref.Code (พร้อม Serial Key)
 */
const handleRefCodeRequest = async (userId, replyToken) => {
  try {
    // ตรวจสอบว่ามี Ref Code ที่ยังใช้ได้หรือไม่
    const existingSession = await authService.checkActiveRefCode(userId);

    // ถ้าเคยลงทะเบียนสำเร็จแล้ว ให้แจ้งว่าไม่สามารถขอใหม่ได้
    if (existingSession && existingSession.status === 'SUCCESS') {
      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: `✅ คุณลงทะเบียนเรียบร้อยแล้ว\nSerial Key: ${existingSession.serial_key}`
      });
    }

    // ถ้ายังมี Ref Code ค้างอยู่และยังไม่หมดอายุ
    if (existingSession && existingSession.status === 'PENDING') {
      const remainingMs = new Date(existingSession.expires_at) - new Date();
      const minutes = Math.ceil(remainingMs / 60000);

      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: `คุณมี Ref.Code ที่ยังใช้งานได้อยู่\nรหัส: ${existingSession.ref_code}\nหมดอายุในอีก ${minutes} นาที`
      });
    }

    // สร้าง Ref Code + Serial Key ใหม่
    const result = await authService.createNewRefCode(userId);

    if (!result.success) {
      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: result.message
      });
    }

    const message = `รหัสอ้างอิงของคุณคือ: ${result.refCode}\nกรุณากรอกใน VBA และกดปุ่ม Verify\nSerial Key จะถูกส่งให้หลังจากยืนยัน`;

    return lineService.replyMessage(replyToken, {
      type: 'text',
      text: message
    });
  } catch (error) {
    console.error('Error in handleRefCodeRequest:', error);
    return lineService.replyMessage(replyToken, {
      type: 'text',
      text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง'
    });
  }
};

module.exports = {
  handleWebhook
};
