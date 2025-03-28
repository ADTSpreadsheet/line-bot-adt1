require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const indexRouter = require('./index');
const otpReadyRoute = require('./otpready');       // ✅ เพิ่มเข้ามา
const verifyOtpRoute = require('./verifyOTP');     // ✅ มีอยู่แล้ว
const { line } = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const registerSessionRoute = require("./registerSession");

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

// สร้าง Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// Logging ทุก response
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    console.log(`[RESPONSE] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    console.log(`[RESPONSE BODY] ${body}`);
    return originalSend.call(this, body);
  };
  next();
});

// ทดสอบเส้นทาง
app.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bot1 is alive'
  });
});

// Middleware ตรวจสอบลายเซ็นของ LINE (เฉพาะ /webhook)
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

// Endpoint ตรวจสอบ Machine ID (จาก VBA)
app.get('/webhook/check-machine-id', async (req, res) => {
  console.log('✅ Endpoint check-machine-id was called directly from index.js');
  const machineID = req.query.machine_id;
  if (!machineID) {
    console.log('❌ Missing machine_id in request');
    return res.status(400).json({ error: 'Missing machine_id' });
  }
  try {
    console.log(`🔍 Checking Machine ID: ${machineID}`);
    const { data, error } = await supabase
      .from('user_registrations')
      .select('ref_code, status')
      .eq('machine_id', machineID);

    console.log('Supabase Response:', { data, error });

    if (error) {
      console.log(`❌ Supabase error: ${JSON.stringify(error)}`);
      return res.status(500).json({ error: 'Database query error' });
    }

    if (!data || data.length === 0) {
      console.log(`❌ No data found for Machine ID: ${machineID}`);
      return res.status(404).json({ error: 'Machine ID not found' });
    }

    const record = data[0];

    if (record.status === 'ACTIVE') {
      console.log(`✅ Found ACTIVE Machine ID: ${machineID}, Ref.Code: ${record.ref_code}`);
      return res.status(200).json({
        status: 'ACTIVE',
        ref_code: record.ref_code
      });
    } else {
      console.log(`❌ Machine ID found but status is not ACTIVE: ${record.status}`);
      return res.status(403).json({ error: 'Machine ID is not ACTIVE' });
    }
  } catch (err) {
    console.error('❌ Error checking machine ID:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ เพิ่ม Endpoint ตรวจสอบ Ref.Code จาก VBA
app.get('/check-refcode', async (req, res) => {
  const refCode = req.query.ref_code;

  if (!refCode) {
    return res.status(400).json({ success: false, message: "Missing ref_code" });
  }

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', refCode);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ success: false, message: "Supabase query failed" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Ref.Code not found" });
    }

    // ✅ Found ref_code, ready to trigger OTP
    return res.status(200).json({ success: true, message: "Ref.Code valid" });

  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// เส้นทางหลักทั้งหมด
app.use('/', indexRouter);
app.use('/webhook', otpReadyRoute);      // ✅ เพิ่มให้รู้จัก /webhook/otp-ready
app.use('/webhook', verifyOtpRoute);     // ✅ รู้จัก /webhook/verify-otp
app.use('/register-session', registerSessionRoute);

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

module.exports = router; // ✅ ใช้ router เท่านั้น
