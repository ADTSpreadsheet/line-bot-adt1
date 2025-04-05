const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');  // ตรวจสอบให้ import ได้ถูกต้อง
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
  otpController.requestOtp // ตรวจสอบให้เรียกฟังก์ชันที่ชื่อ requestOtp ที่ export จาก otpController
);

/**
 * @route POST /router/verify
 * @desc ตรวจสอบ OTP
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  otpController.verifyOtp // ฟังก์ชันตรวจสอบ OTP
);

/**
 * @route GET /router/status?ref_code=XXXX
 * @desc เช็คสถานะ OTP
 */
router.get(
  '/status',
  validateQueryParams(['ref_code']),
  otpController.checkOtpStatus // ฟังก์ชันเช็คสถานะ OTP
);

/**
 * @route POST /router/resend
 * @desc ส่ง OTP ซ้ำ
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  otpController.resendOtp // ฟังก์ชัน resend OTP
);

// ==============================================
// ✅ ส่งออก router
// ==============================================
module.exports = router;
