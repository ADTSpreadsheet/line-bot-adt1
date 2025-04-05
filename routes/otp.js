// routes/otp.js
const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const confirmOtpController = require('../controllers/confirmOtpController'); // เพิ่มการ import ใหม่
const { validateBody, validateQueryParams } = require('../middlewares/validator');

// ==============================================
// 📌 OTP ROUTES (ใช้ /router เป็น prefix จาก index.js)
// ==============================================

/**
 * @route POST /router/request
 * @desc ขอ OTP ใหม่
 */
router.post(
  '/request',
  validateBody(['ref_code']),
  otpController.requestOtp
);

/**
 * @route POST /router/verify
 * @desc ตรวจสอบ OTP
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  confirmOtpController.confirmOtp  // เชื่อมกับฟังก์ชันใหม่ที่เราสร้างขึ้น
);

/**
 * @route GET /router/status?ref_code=XXXX
 * @desc เช็คสถานะ OTP
 */
router.get(
  '/status',
  validateQueryParams(['ref_code']),
  otpController.checkOtpStatus
);

/**
 * @route POST /router/resend
 * @desc ส่ง OTP ซ้ำ
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  otpController.resendOtp
);

// ==============================================
// ✅ ส่งออก router
// ==============================================
module.exports = router;
