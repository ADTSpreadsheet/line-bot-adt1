// ==============================================
// IMPORTS & REQUIREMENTS
// ==============================================
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const licenseRouter = require('./routes/licenseRouter');
require('dotenv').config();
const line = require('@line/bot-sdk');
const { createModuleLogger } = require('./utils/logger');
const indexLog = createModuleLogger('Index');

// ==============================================
// INITIALIZE EXPRESS + CORS
// ==============================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://adtlive-workshop-02.onrender.com' // ✅ เว็บพี่ที่ต้องการเชื่อม
}));

// ==============================================
// LINE CONFIG (ไม่กระทบ)
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

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
const confirmOtpRoutes = require('./routes/confirmOtp');
const verifyLicenseRoute = require('./routes/verifyLicenseRoute');
const setupUsernameRoute = require('./routes/setupUsernameRoute');
const setupPasswordRoutes = require('./routes/setupPasswordRoute');
const loginRoute = require('./routes/loginRoute');
const logoutRoute = require('./routes/logoutRoute');
const lineMessage3DRoutes = require('./routes/lineMessage3DRoutes');
const replyFromAdminRoutes = require('./routes/replyFromAdminRoutes');
const adtLiveWorkshopRoute = require('./routes/adtLiveWorkshopRoute');
const adtLivePublicRoute = require('./routes/adtLivePublicRoute');

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/router/license', licenseRouter);

app.use((req, res, next) => {
  indexLog.debug(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// ==============================================
// ROUTE REGISTRATION
// ==============================================
app.use('/router', pdpaRoutes);
app.use('/webhook', eventLineRoutes);
app.use('/router', userform3labelRoutes);
app.use('/verify-refcode', verifyRefcodeRoutes);
app.use('/router/ConfirmRegistration', confirmRegistrationRoutes);
app.use('/router', otpRoutes);
app.use('/router/confirmOtp', confirmOtpRoutes);
app.use('/router/verifyLicense1', verifyLicenseRoute);
app.use('/router/verifyLicense2', verifyLicenseRoute);
app.use('/router', setupUsernameRoute);
app.use('/router/user', require('./routes/userRoute'));
app.use('/router/setup-password', setupPasswordRoutes);
app.use('/router', loginRoute);
app.use('/router/logout', logoutRoute);
app.use('/router/line-message-3d', lineMessage3DRoutes);
app.use(replyFromAdminRoutes);
app.use('/adtliveworkshop', adtLiveWorkshopRoute);
app.use(adtLivePublicRoute);

// ❗ ปิด open cors ซ้ำ (ปลอดภัยกว่า)
// app.use(cors()); ❌ อันนี้ไม่ต้องแล้ว เพราะเปิดเฉพาะ origin ข้างบนไปแล้ว

// ==============================================
// FALLBACK API
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
