// routes/verifyotp.js
const express = require('express');
const router = express.Router();
const { Client } = require('@line/bot-sdk');

// ดึง Map จาก otpready ถ้าแชร์กัน หรือ duplicate ตัวแปรนี้ไว้ใช้ก็ได้
const otpStore = new Map(); // key: ref_code, value: { otp, createdAt }

// LINE Client
const lineClient = new Client({
  channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN
});

// ตรวจสอบ OTP ที่ผู้ใช้กรอกจาก VBA
router.post('/verify-otp', async (req, res) => {
  const { ref_code, otp } = req.body;

  console.log(`🔍 ตรวจสอบ OTP จาก ref_code: ${ref_code}, otp: ${otp}`);

  if (!ref_code || !otp) {
    return res.status(400).json({ success: false, message: 'Missing ref_code or otp' });
  }

  const entry = otpStore.get(ref_code);

  if (!entry) {
    return res.status(404).json({ success: false, message: 'OTP not found or expired' });
  }

  const { otp: storedOtp, createdAt } = entry;

  // ตรวจสอบว่า OTP หมดอายุหรือยัง (5 นาที)
  const now = new Date();
  const diffMs = now - createdAt;
  const expired = diffMs > 5 * 60 * 1000; // 5 นาที

  if (expired) {
    otpStore.delete(ref_code);
    return res.status(410).json({ success: false, message: 'OTP expired' });
  }

  if (otp !== storedOtp) {
    return res.status(401).json({ success: false, message: 'Incorrect OTP' });
  }

  // ✅ OTP ถูกต้อง
  otpStore.delete(ref_code); // ลบออกทันทีหลังใช้

  try {
    // ดึง line_user_id เพื่อส่งข้อความ LINE
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase
      .from('user_registrations')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (error || !data || !data.line_user_id) {
      return res.status(404).json({ success: false, message: 'LINE user not found' });
    }

    const message = {
      type: 'text',
      text: `✅ เข้าสู่ระบบสำเร็จแล้วครับนายช่าง 👷‍♂️\n🗓️ เหลือเวลาโปรโมชั่นใช้งาน 5 วัน\n🚀 ขอให้สนุกกับการออกแบบนะครับ!`
    };

    await lineClient.pushMessage(data.line_user_id, message);
    console.log(`✅ ยืนยัน OTP สำเร็จ และแจ้งเตือน LINE แล้ว`);

    return res.status(200).json({ success: true, message: 'OTP verified and user notified' });

  } catch (err) {
    console.error('❌ Error verifying OTP:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
