// 📁 routes/verifyOTP.js
const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');

// จัดเก็บ OTP ชั่วคราวแบบ in-memory
const otpStore = new Map(); // key: ref_code, value: { otp, createdAt }

// สร้าง OTP แบบ 1 ตัวอักษร + 5 ตัวเลข เช่น "O12568"
function generateOTP() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const numbers = Math.floor(10000 + Math.random() * 90000);
  return `${letter}${numbers}`;
}

// ส่ง OTP ให้ผู้ใช้ทาง LINE
async function sendOTPToLine(lineUserId, refCode, otp, lineClient) {
  const message = `🔐 OTP สำหรับยืนยันตัวตน
Ref.Code: ${refCode}
OTP: ${otp}\nกรุณานำ OTP ไปกรอกเพื่อเข้าใช้งานระบบ`;
  await lineClient.pushMessage(lineUserId, {
    type: 'text',
    text: message
  });
}

// ✅ Endpoint สร้าง OTP และส่งให้ LINE
router.post('/generate-otp', async (req, res) => {
  const { ref_code, line_user_id } = req.body;
  const otp = generateOTP();

  otpStore.set(ref_code, {
    otp,
    createdAt: new Date()
  });

  try {
    const lineClient = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    });

    await sendOTPToLine(line_user_id, ref_code, otp, lineClient);

    console.log(`✅ OTP Generated for ${ref_code}: ${otp}`);
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('❌ Error sending OTP:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// ✅ Endpoint ตรวจสอบ OTP
router.post('/verify-otp', (req, res) => {
  const { ref_code, otp } = req.body;
  const record = otpStore.get(ref_code);

  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP generated for this Ref.Code' });
  }

  if (record.otp === otp) {
    otpStore.delete(ref_code); // ลบ OTP หลังใช้แล้ว

    console.log(`✅ OTP ถูกต้องสำหรับ Ref.Code: ${ref_code}`);
    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } else {
    console.log(`❌ OTP ผิดสำหรับ Ref.Code: ${ref_code}`);
    return res.status(401).json({ success: false, message: 'Invalid OTP' });
  }
});

module.exports = router;
