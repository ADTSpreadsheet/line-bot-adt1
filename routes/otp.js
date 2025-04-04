// routes/otp.js
const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { validateBody } = require('../middlewares/validator');

/**
 * @route POST /api/otp/request
 * @desc ขอ OTP ใหม่ (ใช้ในกรณียืนยันตัวตนซ้ำช่วงทดลอง)
 * @access Public
 */
router.post(
  '/request',
  validateBody(['ref_code']),
  otpController.requestOtp
);

/**
 * @route POST /api/otp/verify
 * @desc ตรวจสอบ OTP ที่ผู้ใช้กรอก
 * @access Public
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  otpController.verifyOtp
);

/**
 * @route GET /api/otp/status
 * @desc ตรวจสอบสถานะ OTP ว่ายังมีผลอยู่หรือไม่
 * @access Public
 */
router.get(
  '/status',
  validateBody(['ref_code']),
  otpController.checkOtpStatus
);

/**
 * @route POST /api/otp/resend
 * @desc ส่ง OTP ซ้ำไปยังผู้ใช้
 * @access Public
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  otpController.resendOtp
);

module.exports = {
  requestOtp
};
