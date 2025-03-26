const express = require('express');
const router = express.Router();

router.post('/verify-otp', async (req, res) => {
  const { ref_code, otp } = req.body;

  console.log(`📥 [VERIFY OTP] Ref.Code: ${ref_code}, OTP: ${otp}`);

  // [DEV] ตรวจสอบ OTP ตรงกับที่ฝั่ง VBA กรอกหรือไม่
  if (!otp || typeof otp !== 'string' || otp.length !== 6) {
    return res.status(400).json({ success: false, message: 'Invalid OTP format' });
  }

  // ❗สมมุติ OTP ถูกต้องเสมอในตอนนี้
  return res.status(200).json({
    success: true,
    message: `✅ OTP confirmed for Ref.Code: ${ref_code}`
  });
});

module.exports = router;
