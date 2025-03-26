// index.js - Bot ตัวที่ 1 แบบสะอาด ไม่มีการปนของ Bot2

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const indexRouter = require('./routes/index');
const verifyOtpRoute = require('./routes/verifyOTP'); // ✅ เพิ่มบรรทัดนี้
const { line } = require('@line/bot-sdk');

// ตรวจสอบตัวแปรที่จำเป็น
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

const app = express();

// LINE SDK Config สำหรับ Bot1
const lineConfig = {
  channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN,
  channelSecret: process.env.LINE_BOT1_CHANNEL_SECRET
};

// เปิด CORS
app.use(cors());

// Logging ทุก request
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming request: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// ทดสอบเส้นทาง
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bot1 is alive'
  });
});

// Middleware ตรวจสอบลายเซ็นของ LINE
app.use('/webhook', (req, res, next) => {
  const signature = req.headers['x-line-signature'];

  if (!signature || !req.body) {
    bodyParser.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      }
    })(req, res, next);
    return;
  }

  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
      const hmac = crypto.createHmac('sha256', lineConfig.channelSecret)
        .update(req.rawBody)
        .digest('base64');

      if (hmac !== signature) {
        console.error('❌ Signature ไม่ถูกต้อง');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log('✅ Signature ถูกต้อง');
    }
  })(req, res, next);
});

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// เส้นทางหลัก
app.use('/', indexRouter);

app.use('/webhook', verifyOtpRoute);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 เซิร์ฟเวอร์ Bot1 ทำงานที่พอร์ต ${PORT}`);
  console.log(`🌎 URL เซิร์ฟเวอร์: ${process.env.SERVER_URL}`);
  console.log(`🤖 Webhook URL: ${process.env.SERVER_URL}/webhook`);
});

// Error handler
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
