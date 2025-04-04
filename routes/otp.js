// routes/otp.js
const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { validateBody, validateQueryParams } = require('../middlewares/validator');

/**
 * @route POST /router/request
 * @desc ขอ OTP ใหม่
 */
router.post(
  '/request',
  validateBody(['ref_code']),
  otpController.requestOtp || ((req, res) => res.status(501).json({ status: 'error', message: 'requestOtp ยังไม่ได้สร้าง' }))
);

/**
 * @route POST /router/verify
 * @desc ตรวจสอบ OTP
 */
router.post(
  '/verify',
  validateBody(['ref_code', 'otp']),
  otpController.verifyOtp || ((req, res) => res.status(501).json({ status: 'error', message: 'verifyOtp ยังไม่ได้สร้าง' }))
);

/**
 * @route GET /router/status?ref_code=XXXX
 * @desc เช็คสถานะ OTP
 */
router.get(
  '/status',
  validateQueryParams(['ref_code']),
  otpController.checkOtpStatus || ((req, res) => res.status(501).json({ status: 'error', message: 'checkOtpStatus ยังไม่ได้สร้าง' }))
);

/**
 * @route POST /router/resend
 * @desc ส่ง OTP ซ้ำ
 */
router.post(
  '/resend',
  validateBody(['ref_code']),
  otpController.resendOtp || ((req, res) => res.status(501).json({ status: 'error', message: 'resendOtp ยังไม่ได้สร้าง' }))
);

module.exports = router;
