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
const { router: eventLineRoutes } = require('./routes/events/eventLine');
const verifyRefcodeRoutes = require('./routes/verify-refcode');
const confirmRegistrationRoutes = require('./routes/ConfirmRegistration');
const otpRoutes = require('./routes/otp');
const confirmOtpRoutes = require('./routes/confirmOtp'); // เพิ่มเส้นทางใหม่สำหรับ ConfirmOtp

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
app.use('/router/ConfirmRegistration', confirmRegistrationRoutes);

// ส่วนที่ 6: ระบบออก OTP
app.use('/router', otpRoutes);

// ส่วนที่ 7: Confirm OTP
app.use('/router/confirmOtp', confirmOtpRoutes); // เพิ่มเส้นทางสำหรับ Confirm OTP

// ==============================================
// API ENDPOINTS FOR VBA INTEGRATION (เก็บไว้เป็น fallback)
// ==============================================
app.get('/get-message', (req, res) => {
  res.json({
    message: "กรุณากรอก Ref.Code เพื่อตรวจสอบและรับ Serial Key ผ่านแชทไลน์"
  });
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
