// นำเข้าตัวแปรสภาพแวดล้อมจากไฟล์ .env
require('dotenv').config();

// นำเข้าโมดูลที่จำเป็น
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// กำหนดค่า Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// กำหนดค่าสำหรับ LINE Bot
const lineBots = {
  bot1: {
    id: process.env.LINE_BOT1_ID,
    accessToken: process.env.LINE_BOT1_ACCESS_TOKEN,
    channelSecret: process.env.LINE_BOT1_CHANNEL_SECRET
  },
  bot2: {
    id: process.env.LINE_BOT2_ID,
    accessToken: process.env.LINE_BOT2_ACCESS_TOKEN,
    channelSecret: process.env.LINE_BOT2_CHANNEL_SECRET
  },
  bot3: {
    id: process.env.LINE_BOT3_ID,
    accessToken: process.env.LINE_BOT3_ACCESS_TOKEN,
    channelSecret: process.env.LINE_BOT3_CHANNEL_SECRET
  }
};

// ค่าคงที่สำหรับการตั้งค่าการยืนยันตัวตน
const AUTH_SETTINGS = {
  refCodeExpiryMinutes: parseInt(process.env.REF_CODE_EXPIRY_MINUTES || '15'),
  serialKeyExpiryMinutes: parseInt(process.env.SERIAL_KEY_EXPIRY_MINUTES || '15'),
  maxRequestCount: parseInt(process.env.MAX_REQUEST_COUNT || '3'),
  maxVerifyCount: parseInt(process.env.MAX_VERIFY_COUNT || '3')
};

// เส้นทางหลัก
router.get('/', (req, res) => {
  res.send('LINE Bot API is running!');
});

// เส้นทางสำหรับสถานะเซิร์ฟเวอร์
router.get('/status', (req, res) => {
  res.json({
    status: 'active',
    server: process.env.SERVER_URL,
    timestamp: new Date()
  });
});

// เพิ่มเส้นทางสำหรับ /webhook เพื่อรองรับ LINE
router.post('/webhook', async (req, res) => {
  const bot = lineBots.bot1; // ใช้ bot1 เป็น default

  // ตรวจสอบและตอบกลับได้ตรงนี้
  console.log('📡 LINE Webhook received:', req.body);

  res.status(200).send('OK'); // ต้องส่ง 200 กลับ
});

  // TODO: ตรวจสอบลายเซ็นของ LINE และประมวลผลเหตุการณ์
  // ตัวอย่างเท่านั้น โค้ดจริงต้องมีการประมวลผลเหตุการณ์จาก LINE

  res.status(200).send('OK');
});

// ส่งออกเส้นทางทั้งหมด
module.exports = router;
