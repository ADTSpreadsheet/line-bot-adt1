// index.js - จุดเริ่มต้นของ Webhook2

const express = require('express');
const router = express.Router();
const registrationRoutes = require('./routes/registration');

// Middleware สำหรับ logging
router.use((req, res, next) => {
  console.log(`[Webhook2] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// จัดการกับ LINE webhook verification
router.post('/', (req, res) => {
  console.log('[Webhook2] Webhook verification handler called');
  console.log('[Webhook2] Request body:', req.body);
  // ตอบกลับ LINE ด้วย 200 OK
  res.status(200).end();
});

// เส้นทางทดสอบ
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook2 test endpoint is working'
  });
});

// Middleware สำหรับการ parse body
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// เพิ่มเส้นทางการลงทะเบียน
router.use('/', registrationRoutes);

// เส้นทางหลักของ Webhook2
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Webhook2 API - Registration System',
    version: '1.0.0',
    endpoints: {
      register: '/webhook2/register',
      healthcheck: '/webhook2/healthcheck',
      test: '/webhook2/test'
    }
  });
});

// Handler สำหรับเส้นทางที่ไม่มี
router.use('*', (req, res) => {
  console.log('[Webhook2] 404 Not Found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
router.use((err, req, res, next) => {
  console.error('[Webhook2] Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;
