// routes/otp.js
const express = require('express');
const router = express.Router();

// ✅ Import Controllers
const { requestOtp, checkOtpStatus, resendOtp } = require('../controllers/otpController');
const { confirmOtp, clearOtp } = require('../controllers/confirmOtpController'); // ✅ เพิ่ม clearOtp เข้ามาด้วย

// ✅ Import Middleware
const { validateBody, validateQueryParams } = require('../middlewares/validator');

// ==============================================
// 📌 OTP ROUTES (prefix: /router)
// ==============================================

/**
 * @route POST /router/request
 * @desc ขอ OTP ใหม่
 */
router.post(
  '/request',
  validateBody(['ref_code']),
  requestOtp
);

/**
 * @route POST /router/verify
 * @desc ยืนยัน OTP ที่ผู้ใช้กรอก
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  confirmOtp
);

/**
 * @route POST /router/clear-otp
 * @desc ล้าง OTP และอัปเดต verify_status → Active
 */
router.post(
  '/clear-otp',
  validateBody(['ref_code']),
  clearOtp
);

/**
 * @route POST /router/resend
 * @desc ส่ง OTP ซ้ำให้ผู้ใช้
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  resendOtp
);

/**
 * @route GET /router/status?ref_code=XXXX
 * @desc ตรวจสอบสถานะ OTP ว่ากรอกหรือยัง
 */
router.get(
  '/status',
  validateQueryParams(['ref_code']),
  checkOtpStatus
);

// ==============================================
// ✅ Export Router
// ==============================================
module.exports = router;
