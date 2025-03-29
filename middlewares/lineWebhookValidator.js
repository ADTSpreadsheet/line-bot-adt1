// middlewares/lineWebhookValidator.js
const crypto = require('crypto');

/**
 * ตรวจสอบลายเซ็น (signature) ของ LINE webhook
 * @param {string} channelSecret - Channel Secret ของ LINE Bot
 * @returns {Function} Express middleware
 */
const validateLineWebhook = (channelSecret) => (req, res, next) => {
  try {
    // 1. ตรวจสอบว่ามี X-Line-Signature header หรือไม่
    const signature = req.headers['x-line-signature'];
    if (!signature) {
      console.error('❌ Missing X-Line-Signature header');
      return res.status(401).json({
        status: 'error',
        message: 'Missing signature'
      });
    }

    // 2. ตรวจสอบ rawBody (ต้องตั้งค่า express.json() ให้เก็บ rawBody)
    if (!req.rawBody) {
      console.error('❌ Missing rawBody - Make sure express.json() is configured correctly');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error: Missing rawBody'
      });
    }

    // 3. คำนวณ HMAC-SHA256 จาก Channel Secret และ rawBody
    const hmac = crypto.createHmac('sha256', channelSecret);
    hmac.update(req.rawBody);
    const calculatedSignature = hmac.digest('base64');

    // 4. เปรียบเทียบ signature ที่คำนวณได้กับที่ LINE ส่งมา
    if (signature !== calculatedSignature) {
      console.error('❌ Invalid signature');
      console.error(`Expected: ${calculatedSignature}`);
      console.error(`Received: ${signature}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid signature'
      });
    }

    // 5. ตรวจสอบโครงสร้างของ request body
    if (!req.body || !req.body.events || !Array.isArray(req.body.events)) {
      console.error('❌ Invalid request body structure');
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body'
      });
    }

    // ผ่านการตรวจสอบทั้งหมด
    console.log('✅ Webhook signature verified');
    next();
  } catch (error) {
    console.error('❌ Error validating webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

/**
 * Bypass การตรวจสอบลายเซ็นสำหรับการทดสอบ
 * @returns {Function} Express middleware
 */
const bypassValidation = () => (req, res, next) => {
  console.log('⚠️ Bypassing webhook signature validation');
  
  // เช็คโครงสร้าง body เพื่อป้องกันข้อผิดพลาด
  if (!req.body) {
    req.body = {};
  }
  if (!req.body.events) {
    req.body.events = [];
  }
  
  next();
};

/**
 * สร้างตัวเก็บ rawBody สำหรับ express.json()
 * @returns {Function} Express verify function
 */
const saveRawBody = (req, res, buf) => {
  req.rawBody = buf.toString();
};

module.exports = {
  validateLineWebhook,
  bypassValidation,
  saveRawBody
};
