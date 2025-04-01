// ==============================================
// IMPORTS & REQUIREMENTS
// ==============================================
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

// LINE SDK
const line = require('@line/bot-sdk');

// Logger
const { createModuleLogger } = require('./utils/logger');
const indexLog = createModuleLogger('Index');

// ==============================================
// ROUTES
// ==============================================
const pdpaRoutes = require('./routes/pdpaText');
const userform3labelRoutes = require('./routes/userform3label');
const statusRoutes = require('./routes/status');
const eventLineRoutes = require('./routes/events/eventLine');
const verifyRefcodeRoutes = require('./routes/verify-refcode');

// ==============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Line Bot Config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// ส่วนที่ 6: Logs สำหรับตรวจสอบข้อผิดพลาด
app.use((req, res, next) => {
  indexLog.debug(`📡 ${req.method} ${req.originalUrl}`);
  next();
});


// ==============================================
// ROUTES
// ==============================================
// ส่วนที่ 1: PDPA Routes
app.use('/router', pdpaRoutes);

// ส่วนที่ 2: Line Webhook Routes
app.use('/webhook', eventLineRoutes);

// ส่วนที่ 3: UserForm Label Routes (สำหรับ Label 5 และ 6)
app.use('/router', userform3labelRoutes);

// ส่วนที่ 4: Verify Ref.Code
app.use('/verify-refcode', verifyRefcodeRoutes);

// ส่วนที่ 5: Registration Confirmation Routes (สำหรับการลงทะเบียน)
/*app.use('/router/api/registration', confirmRegistrationRoutes);*/


// ==============================================
// API ENDPOINTS FOR VBA INTEGRATION (เก็บไว้เป็น fallback)
// ==============================================
// หมายเหตุ: endpoints เหล่านี้อาจถูกแทนที่ด้วย endpoints ใน confirmRegistrationRoutes
app.get('/get-message', (req, res) => {
  res.json({
    message: "กรุณากรอก Ref.Code เพื่อตรวจสอบและรับ Serial Key ผ่านแชทไลน์"
  });
});

app.post('/verify-refcode', async (req, res) => {
  const { refCode } = req.body;
  
  if (!refCode) {
    return res.status(400).json({ success: false, message: "Missing Ref.Code" });
  }
  
  try {
    // ตรวจสอบ Ref.Code ในฐานข้อมูล
    const result = await db.query('SELECT * FROM your_table WHERE ref_code = $1', [refCode]);
    
    if (result.rows.length === 0) {
      // ไม่พบ Ref.Code ในฐานข้อมูล
      return res.status(404).json({ success: false, message: "Invalid Ref.Code or this user was not found in the system." });
    }
    
    // พบ Ref.Code ในฐานข้อมูล
    return res.status(200).json({
      success: true,
      countdown: "Serial Key จะหมดอายุใน: 10:00 นาที",
      stage3: "Serial Key ได้ถูกส่งไปยังแชทไลน์ของคุณแล้ว กรุณาตรวจสอบและนำมากรอกด้านล่าง"
    });
  } catch (error) {
    console.error('Error verifying refCode:', error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post('/verify-serialkey', async (req, res) => {
  const { refCode, serialKey } = req.body;
  
  if (!refCode || !serialKey) {
    return res.status(400).json({ success: false, message: "Missing Ref.Code or Serial Key" });
  }
  
  return res.status(200).json({ success: true, message: "Serial Key verified successfully" });
});

// ==============================================
// ERROR HANDLING
// ==============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// ==============================================
// START SERVER
// ==============================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
