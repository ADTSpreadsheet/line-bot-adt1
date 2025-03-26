// routes/verifyOTP.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// จัดเก็บ OTP ชั่วคราวแบบ in-memory
const otpStore = new Map(); // key: ref_code, value: { otp, createdAt }

// สร้าง OTP แบบ 1 ตัวอักษร + 5 ตัวเลข (A12345)
function generateOTP() {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const numbers = Math.floor(10000 + Math.random() * 90000);
  return `${letter}${numbers}`;
}

// ✅ ตรวจสอบ Machine ID และคืนค่า Ref.Code ถ้าพบ
router.get('/check-machine-id', async (req, res) => {
  const machineID = req.query.machine_id;
  if (!machineID) {
    return res.status(400).json({ error: 'Missing machine_id' });
  }
  try {
    const { data, error } = await supabase
      .from('user_registrations')
      .select('ref_code, status')
      .eq('machine_id', machineID);
      
    console.log('Supabase Response:', { data, error });
    
    if (error) {
      console.log(`❌ Supabase error: ${JSON.stringify(error)}`);
      return res.status(500).json({ error: 'Database query error' });
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ No data found for Machine ID: ${machineID}`);
      return res.status(404).json({ error: 'Machine ID not found' });
    }
    
    const record = data[0];
    
    if (record.status === 'ACTIVE') {
      console.log(`✅ Found ACTIVE Machine ID: ${machineID}, Ref.Code: ${record.ref_code}`);
      return res.status(200).json({
        status: 'ACTIVE',
        ref_code: record.ref_code
      });
    } else {
      console.log(`❌ Machine ID found but status is not ACTIVE: ${record.status}`);
      return res.status(403).json({ error: 'Machine ID is not ACTIVE' });
    }
  } catch (err) {
    console.error('[ERROR] check-machine-id:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// รับแจ้งว่าฟอร์ม OTP เปิดแล้ว และสร้าง OTP ส่งไปให้ผู้ใช้
router.post('/otp-ready', async (req, res) => {
  console.log(`✅ Received OTP ready notification:`, req.body);
  const { ref_code, status_open_otp } = req.body;
  
  if (!ref_code || !status_open_otp) {
    console.log(`❌ Missing required fields in /otp-ready`);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  
  try {
    // 1. ค้นหา line_user_id จาก ref_code ในตาราง auth_sessions
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .single();
      
    console.log(`🔍 Supabase lookup result for auth_sessions:`, { data, error });
    
    if (error || !data || !data.line_user_id) {
      console.log(`❌ Could not find line_user_id for ref_code: ${ref_code}`);
      return res.status(404).json({ success: false, message: 'Ref code not found or no LINE user ID associated' });
    }
    
    // 2. สร้าง OTP
    const otp = generateOTP();
    console.log(`✨ Generated OTP for ref_code ${ref_code}: ${otp}`);
    
    // 3. เก็บ OTP ลงใน Map
    otpStore.set(ref_code, {
      otp,
      createdAt: new Date()
    });
    
    // 4. สร้าง LINE client และส่ง OTP ไปยังผู้ใช้
    const { Client } = require('@line/bot-sdk');
    const lineClient = new Client({
      channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN
    });
    
    const message = {
      type: 'text',
      text: `🔐 รหัส OTP ของคุณคือ: ${otp}\nรหัสนี้จะหมดอายุใน 5 นาที\nกรุณากรอกรหัสนี้ในหน้าจอยืนยันตัวตน`
    };
    
    await lineClient.pushMessage(data.line_user_id, message);
    console.log(`✅ Sent OTP to LINE user: ${data.line_user_id}`);
    
    return res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('❌ Error in /otp-ready:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ตรวจสอบ OTP
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
    // ดึง line_user_id เพื่อส่งข้อความ LINE จากตาราง auth_sessions
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .single();
      
    if (error || !data || !data.line_user_id) {
      return res.status(404).json({ success: false, message: 'LINE user not found' });
    }
    
    // ส่งข้อความแจ้งเตือนว่าเข้าสู่ระบบสำเร็จ
    const { Client } = require('@line/bot-sdk');
    const lineClient = new Client({
      channelAccessToken: process.env.LINE_BOT1_ACCESS_TOKEN
    });
    
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

// ล้าง OTP ที่หมดอายุทุก 10 นาที
setInterval(() => {
  const now = new Date();
  otpStore.forEach((record, key) => {
    if ((now - record.createdAt) / 1000 > 600) { // > 10 นาที
      console.log(`🧹 Cleared expired OTP for ref_code: ${key}`);
      otpStore.delete(key);
    }
  });
}, 10 * 60 * 1000); // 10 นาที

module.exports = router;
