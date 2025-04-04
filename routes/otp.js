// routes/otp.js
const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { validateBody } = require('../middlewares/validator');

/**
 * @route POST /router/request
 * @desc ขอ OTP ใหม่
 * @access Public
 */
router.post(
  '/request',
  validateBody(['ref_code']),
  otpController.requestOtp
);

/**
 * @route POST /router/verify
 * @desc ตรวจสอบ OTP
 * @access Public
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  otpController.verifyOtp || ((req, res) => res.status(501).json({ status: 'error', message: 'verifyOtp ยังไม่ได้สร้าง' }))
);

/**
 * @route GET /router/status
 * @desc เช็คสถานะ OTP
 * @access Public
 */
router.get(
  '/status',
  validateBody(['ref_code']),
  otpController.checkOtpStatus || ((req, res) => res.status(501).json({ status: 'error', message: 'checkOtpStatus ยังไม่ได้สร้าง' }))
);

/**
 * @route POST /router/resend
 * @desc ส่ง OTP ซ้ำ
 * @access Public
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  otpController.resendOtp || ((req, res) => res.status(501).json({ status: 'error', message: 'resendOtp ยังไม่ได้สร้าง' }))
);

module.exports = {
  requestOtp
};
