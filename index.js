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
const verifyRefcodeRoutes = require('./routes/verify-refcode');
const adtLiveWorkshopRoute = require('./routes/adtLiveWorkshopRoute');
const adtLivePublicRoute = require('./routes/adtLivePublicRoute');
const adtOrderRoutes = require('./routes/routes-adtOrder');
const starterSlipRoutes = require('./routes/starterSlipRoutes');
const verifyAuthRoutes = require('./routes/verify-auth');
const adtLoginRoutes = require('./routes/adt');
const logoutRoutes = require('./routes/logout');
const forgetIDRoutes = require('./routes/forgetID')
const { processOrder } = require('./controllers/processOrderController');

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/router/license', licenseRouter);

app.use((req, res, next) => {
  indexLog.debug(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// ==============================================
// ROUTE REGISTRATION
// ==============================================
app.use('/verify-refcode', verifyRefcodeRoutes);

app.use('/adtliveworkshop', adtLiveWorkshopRoute);
app.use(adtLivePublicRoute);
app.use('/', adtOrderRoutes);
app.use('/starter', starterSlipRoutes);
app.use('/api/adt', adtLoginRoutes);
app.use('/api', logoutRoutes);
app.use('/api/forget-id', forgetIDRoutes);
app.post('/processOrder', processOrder);


// ==============================================
// LINE BOT ROUTES (ใหม่)
// ==============================================
app.use('/webhook', require('./routes/webhook'));
app.use('/routes/LineEvents', require('./routes/LineEvents'));
app.use('/verify-auth', verifyAuthRoutes);

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
