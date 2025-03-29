// index.js
const express = require('express');
const dotenv = require('dotenv');
const registrationRoutes = require('./routes/registration');
const otpRoutes = require('./routes/otp');
const statusRoutes = require('./routes/status');
const lineWebhookRoutes = require('./routes/linewebhook');
const pdpaTextRouter = require('./routes/pdpaText'); // นำเข้า PDPA router
const { saveRawBody } = require('./middlewares/lineWebhookValidator');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// ต้องตั้งค่า express.json() ให้เก็บ rawBody ไว้ (สำคัญสำหรับการตรวจสอบลายเซ็น LINE)
app.use(express.json({
  verify: saveRawBody
}));
app.use(express.urlencoded({ extended: true })); // เพิ่มการรองรับ URL-encoded bodies

// Routes
app.use('/api/registration', registrationRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/status', statusRoutes);
app.use('/', lineWebhookRoutes);
app.use('/api/pdpa', pdpaTextRouter); // เพิ่ม PDPA router

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to ADT API 1 - Verification Service',
    version: '1.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`❌ ERROR: ${err.stack}`);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error'
  });
});

// Not found middleware
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API 1 is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

module.exports = app; // สำหรับการทดสอบหรือการนำไปใช้ในไฟล์อื่น
