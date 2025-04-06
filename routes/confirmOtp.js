const express = require('express');
const router = express.Router();
const { confirmOtp, clearOtp } = require('../controllers/confirmOtpController');

// POST /router/confirm-otp/verify
router.post('/verify', confirmOtp);

// POST /router/confirm-otp/clear
router.post('/clear', clearOtp);

module.exports = router;
