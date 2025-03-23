// นำเข้าตัวแปรสภาพแวดล้อมจากไฟล์ .env
require('dotenv').config();
// นำเข้าโมดูลที่จำเป็น
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const indexRouter = require('./routes/index');
const { line } = require('@line/bot-sdk');
// นำเข้า router ของ Webhook2 (เพิ่มใหม่)
const webhook2Router = require('./webhook2/index');
// ตรวจสอบตัวแปรสภาพแวดล้อมที่จำเป็น
const requiredEnvVars = [
  'LINE_BOT1_ACCESS_TOKEN',
  'LINE_BOT1_CHANNEL_SECRET',
  'SUPABASE_URL',
  'SUPABASE_KEY'
];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ ไม่พบตัวแปรสภาพแวดล้อม: ${envVar}`);
    process.exit(1);
  }
});
// สร้างแอปพลิเคชัน Express
const app = express();
// กำหนดค่า LINE SDK
const lineConfig = {
  channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN,
  channelSecret: process.env.LINE_BOT1_CHANNEL_SECRET
};

// กำหนดค่า LINE SDK สำหรับ Bot 2
const lineConfig2 = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN_BOT2 || 'VcdMebbh7xEnFBj3t58u/vjAOfjBbrelQs0pLGPTUmvrc3wHYjyWhAA98hy/SkWE1Tj4HjRxMzQu0V9eFYXH78QVYfxLftp6uqyzZsLACPZMbXIkjxqyqJPVYbcg507U3TwgUjZh+Y/7zpy/IzmZpQdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET_BOT2 || '3558642df20f8e7e357c70c5ffd826f4'
};

// ติดตั้ง middleware
app.use(cors());

// เพิ่ม debug logging สำหรับทุก request
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming request: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// จัดการกับ webhook2 verification โดยตรง (รวมจาก 2 handler ที่ซ้ำกันให้เป็นอันเดียว)
app.post('/webhook2', (req, res) => {
  console.log('[ROOT] Webhook2 verification request received');
  // ตอบกลับทันทีด้วย 200 OK
  return res.status(200).end();
});

// Middleware สำหรับตรวจสอบลายเซ็น LINE สำหรับ Bot 1
app.use('/webhook', (req, res, next) => {
  const signature = req.headers['x-line-signature'];
  
  // ถ้าไม่มี body หรือไม่ได้ส่ง signature มา ให้ผ่านไป
  if (!signature || !req.body) {
    // ใช้ body-parser แบบ raw ก่อนเพื่อให้ได้ข้อมูลดิบ
    bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      }
    })(req, res, next);
    return;
  }
  
  // ตรวจสอบลายเซ็น (ถ้ามี signature)
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
      const signature = req.headers['x-line-signature'];
      const hmac = crypto.createHmac('sha256', lineConfig.channelSecret)
        .update(req.rawBody)
        .digest('base64');
      
      // ถ้าลายเซ็นไม่ตรงกัน
      if (hmac !== signature) {
        console.error('❌ Signature ไม่ถูกต้อง');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      console.log('✅ Signature ถูกต้อง');
    }
  })(req, res, next);
});

// ใช้ body-parser สำหรับเส้นทางอื่นๆ
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// สร้าง test endpoint ที่ root level
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Root test endpoint is working'
  });
});

// ใช้เส้นทางหลัก
app.use('/', indexRouter);

// เพิ่มเส้นทางของ Webhook2 (เพิ่มใหม่) - ยกเว้น POST '/webhook2'
app.use('/webhook2', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') {
    console.log('[ROOT] Skipping webhook2Router for POST /webhook2');
    return;
  }
  webhook2Router(req, res, next);
});

console.log(`🤖 Webhook2 URL: ${process.env.SERVER_URL}/webhook2`);

// กำหนดพอร์ตและเริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 เซิร์ฟเวอร์ทำงานที่พอร์ต ${PORT}`);
  console.log(`🌎 URL เซิร์ฟเวอร์: ${process.env.SERVER_URL}`);
  console.log(`🤖 Webhook URL: ${process.env.SERVER_URL}/webhook`);
});

// จัดการข้อผิดพลาด
app.use((err, req, res, next) => {
  console.error(`[ERROR] Unhandled error in main app: ${err.stack}`);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
