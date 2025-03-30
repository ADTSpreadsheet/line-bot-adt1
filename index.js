// ==============================================
// IMPORTS & REQUIREMENTS
// ==============================================
const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import Routes
const registrationRoutes = require('./routes/registration');
const pdpaRoutes = require('./routes/pdpaText');
const lineWebhookRoutes = require('./routes/linewebhook');
const otpRoutes = require('./routes/otp');
const userform3labelRoutes = require('./routes/userform3label');
const statusRoutes = require('./routes/status');

// ==============================================
// APP CONFIGURATION
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

// ==============================================
// ROUTES
// ==============================================
// ส่วนที่ 1: PDPA Routes - จัดการข้อความและการยอมรับ PDPA
app.use('/', pdpaRoutes);

// ส่วนที่ 2: Registration Routes - จัดการการลงทะเบียนผู้ใช้ใหม่
app.use('/', registrationRoutes);

// ส่วนที่ 3: LINE Webhook Routes - จัดการการเชื่อมต่อกับ LINE Bot
app.use('/', lineWebhookRoutes);

// ส่วนที่ 4: OTP Routes - จัดการระบบ OTP สำหรับผู้ใช้เก่า
app.use('/', otpRoutes);

// ส่วนที่ 5: UserForm Routes - จัดการข้อมูลสำหรับฟอร์ม VBA
app.use('/', userform3labelRoutes);

// ส่วนที่ 6: Status Routes - จัดการการตรวจสอบสถานะระบบ
app.use('/', statusRoutes);

// ==============================================
// API ENDPOINTS FOR VBA INTEGRATION
// ==============================================
// API endpoint สำหรับดึงข้อความไปแสดงใน Label6 ตอนเปิดฟอร์ม
app.get('/get-message', (req, res) => {
  res.json({
    message: "กรุณากรอก Ref.Code เพื่อตรวจสอบและรับ Serial Key ผ่านแชทไลน์"
  });
});

// API endpoint สำหรับตรวจสอบ Ref.Code และส่ง Serial Key ทางไลน์
app.post('/verify-refcode', async (req, res) => {
  const { refCode } = req.body;
  
  // ตรวจสอบว่ามี refCode ส่งมาหรือไม่
  if (!refCode) {
    return res.status(400).json({ success: false, message: "Missing Ref.Code" });
  }
  
  try {
    // ในอนาคตเพิ่มโค้ดสำหรับตรวจสอบ Ref.Code กับฐานข้อมูล Supabase
    // และส่ง Serial Key ผ่าน LINE Bot ไปยังผู้ใช้
    
    // ส่งข้อความสำหรับ Label5 (นับถอยหลัง) และ Label6 (ข้อความสถานะ)
    return res.status(200).json({
      success: true,
      countdown: "Serial Key จะหมดอายุใน: 10:00 นาที",
      stage3: "Serial Key ได้ถูกส่งไปยังแชทไลน์ของคุณแล้ว กรุณาตรวจสอบและนำมากรอกด้านล่าง"
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Error verifying Ref.Code", 
      error: error.message 
    });
  }
});

// API endpoint สำหรับตรวจสอบ Serial Key
app.post('/verify-serialkey', async (req, res) => {
  const { refCode, serialKey } = req.body;
  
  // ตรวจสอบว่ามีข้อมูลครบหรือไม่
  if (!refCode || !serialKey) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing Ref.Code or Serial Key" 
    });
  }
  
  try {
    // ในอนาคตเพิ่มโค้ดสำหรับตรวจสอบ Ref.Code และ Serial Key กับฐานข้อมูล Supabase
    
    // ตอบกลับเมื่อตรวจสอบสำเร็จ
    return res.status(200).json({ 
      success: true, 
      message: "Serial Key verified successfully" 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Error verifying Serial Key", 
      error: error.message 
    });
  }
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
