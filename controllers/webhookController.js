/**
 * controllers/lineWebhookController.js
 * ตัวควบคุมสำหรับการจัดการ webhook จาก LINE
 */

const { validateLineSignature } = require('../utils/helpers');
const CONFIG = require('../config');
const lineService = require('../services/lineService');
const authService = require('../services/authService');

/**
 * จัดการคำขอที่ได้รับจาก LINE webhook
 * @param {Object} req - คำขอ HTTP
 * @param {Object} res - การตอบกลับ HTTP
 */
const handleWebhook = async (req, res) => {
  try {
    console.log('Webhook request body:', JSON.stringify(req.body));
    
    const signature = req.headers['x-line-signature'];
    const events = req.body.events;
    
    if (!events || events.length === 0) {
      console.log('No events received');
      return res.status(200).end();
    }

    // ตรวจสอบลายเซ็น
    const isValid = validateLineSignature(req.body, signature, CONFIG.LINE.BOT1.CHANNEL_SECRET);
    if (!isValid) {
      console.error('Invalid signature');
      return res.status(401).send('Invalid signature');
    }
    
    // จัดการกับแต่ละเหตุการณ์
    await Promise.all(events.map(handleEvent));
    
    return res.status(200).end();
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * จัดการกับแต่ละเหตุการณ์
 * @param {Object} event - เหตุการณ์จาก LINE
 */
const handleEvent = async (event) => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const messageText = event.message.text;
  console.log(`Received message from user ${userId}: ${messageText}`);

  if (messageText.startsWith('REQ_REFCODE')) {
    return handleRefCodeRequest(userId, event.replyToken);
  }

  if (messageText === 'myid') {
    return lineService.replyMessage(event.replyToken, {
      type: 'text',
      text: `Your LINE User ID: ${userId}`
    });
  }

  return lineService.replyMessage(event.replyToken, {
    type: 'text',
    text: 'สวัสดีครับ! พิมพ์ REQ_REFCODE เพื่อขอรหัสอ้างอิง'
  });
};

/**
 * จัดการคำขอ Ref.Code
 * @param {string} userId - LINE user ID
 * @param {string} replyToken - Token สำหรับตอบกลับข้อความ
 */
const handleRefCodeRequest = async (userId, replyToken) => {
  try {
    // ตรวจสอบว่าเคยลงทะเบียนสำเร็จแล้วหรือไม่
    const hasVerified = await authService.checkVerifiedSession(userId);
    if (hasVerified) {
      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: '✅ คุณได้ลงทะเบียนสำเร็จแล้ว\nไม่จำเป็นต้องขอ Ref.Code ใหม่อีกครับ'
      });
    }

    // ตรวจสอบว่ามี Ref.Code ที่ยังไม่หมดอายุหรือไม่
    const existingRefCode = await authService.checkActiveRefCode(userId);

    if (existingRefCode) {
      const remainingTime = new Date(existingRefCode.expires_at) - new Date();
      const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));

      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: `คุณมี Ref.Code ที่ยังไม่ได้ใช้งาน\nรหัสเดิม: ${existingRefCode.ref_code}\nจะหมดอายุใน ${remainingMinutes} นาที\nกรุณาใช้รหัสเดิมก่อน`
      });
    }

    // สร้าง Ref.Code ใหม่
    const result = await authService.createNewRefCode(userId);

    if (!result.success) {
      return lineService.replyMessage(replyToken, {
        type: 'text',
        text: result.message
      });
    }

    const messageText = `รหัสอ้างอิง (Ref.Code) ของคุณคือ: ${result.refCode}\nกรุณานำรหัสนี้ไปกรอกในฟอร์ม VBA และกด Verify`;

    return lineService.replyMessage(replyToken, {
      type: 'text',
      text: messageText
    });
  } catch (error) {
    console.error('Handle RefCode Request Error:', error);
    return lineService.replyMessage(replyToken, {
      type: 'text',
      text: 'เกิดข้อผิดพลาดในการสร้างรหัสอ้างอิง กรุณาลองใหม่อีกครั้ง'
    });
  }
};

module.exports = {
  handleWebhook
};
