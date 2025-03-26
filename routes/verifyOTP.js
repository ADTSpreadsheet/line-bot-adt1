// 📁 routes/verifyOTP.js
const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');

// จัดเก็บ OTP ชั่วคราวแบบ in-memory
const otpStore = new Map(); // key: ref_code, value: { otp, createdAt }
const failedAttempts = new Map(); // key: ref_code, value: { count, lastAttemptTime }

// สร้าง OTP แบบ 1 ตัวอักษร + 5 ตัวเลข เช่น "O12568"
function generateOTP() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const numbers = Math.floor(10000 + Math.random() * 90000);
  return `${letter}${numbers}`;
}

// ส่ง OTP ให้ผู้ใช้ทาง LINE
async function sendOTPToLine(lineUserId, refCode, otp, lineClient) {
  const message = `🔐 OTP สำหรับยืนยันตัวตน\nRef.Code: ${refCode}\nOTP: ${otp}\nกรุณานำ OTP ไปกรอกเพื่อเข้าใช้งานระบบ`;
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

  // ตรวจสอบ OTP หมดอายุ (5 นาที)
  if (!record || (new Date() - record.createdAt > 5 * 60 * 1000)) {
    return res.status(400).json({ success: false, message: 'OTP expired or not found' });
  }

  if (record.otp === otp) {
    otpStore.delete(ref_code); // ลบ OTP หลังใช้แล้ว
    failedAttempts.delete(ref_code); // ล้างความพยายามเดิม

    console.log(`✅ OTP ถูกต้องสำหรับ Ref.Code: ${ref_code}`);
    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } else {
    // บันทึกความพยายาม
    const current = failedAttempts.get(ref_code) || { count: 0, lastAttemptTime: new Date() };
    current.count++;
    current.lastAttemptTime = new Date();
    failedAttempts.set(ref_code, current);

    console.log(`❌ OTP ผิดสำหรับ Ref.Code: ${ref_code} (Attempt ${current.count})`);
    return res.status(401).json({ success: false, message: 'Invalid OTP' });
  }
});

// 🧼 ล้าง OTP และความพยายามที่เก่าเกิน 30 นาที
setInterval(() => {
  const now = new Date();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  otpStore.forEach((value, key) => {
    if (now - value.createdAt > THIRTY_MINUTES) {
      otpStore.delete(key);
      console.log(`🧹 Cleared stale OTP for Ref.Code: ${key}`);
    }
  });

  failedAttempts.forEach((value, key) => {
    if (now - value.lastAttemptTime > THIRTY_MINUTES) {
      failedAttempts.delete(key);
      console.log(`🧹 Cleared stale failed attempt for Ref.Code: ${key}`);
    }
  });
}, 10 * 60 * 1000); // ทุก 10 นาที

module.exports = router;
