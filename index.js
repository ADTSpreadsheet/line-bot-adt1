// ==============================================
// IMPORTS & REQUIREMENTS
// ==============================================
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

// LINE SDK (ถ้ายังไม่ได้ใช้สามารถลบทิ้งได้)
// const line = require('@line/bot-sdk');

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
const confirmRegistrationRoutes = require('./routes/confirmRegistration'); // ✅ เปลี่ยนชื่อ path ให้เล็ก
const otpRoutes = require('./routes/otp');
const confirmOtpRoutes = require('./routes/confirmOtp');

// ==============================================
const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware log route
app.use((req, res, next) => {
  indexLog.debug(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// ==============================================
// ROUTES
// ==============================================

// ✅ PDPA
app.use('/router/pdpa', pdpaRoutes);

// ✅ Line Webhook
app.use('/webhook', eventLineRoutes);

// ✅ UserForm3 Label (Label5, Label6)
app.use('/router/label', userform3labelRoutes);

// ✅ ตรวจสอบ Ref.Code (ก่อนขอ OTP)
app.use('/router/verify-refcode', verifyRefcodeRoutes);

// ✅ ยืนยันการลงทะเบียนขั้นสุดท้าย
app.use('/router/confirm-registration', confirmRegistrationRoutes);

// ✅ ระบบ OTP: ขอ / resend / status
app.use('/router/otp', otpRoutes);

// ✅ ระบบ OTP: ยืนยัน OTP
app.use('/router/confirm-otp', confirmOtpRoutes);

// ==============================================
// API ENDPOINTS FOR VBA INTEGRATION
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
