const { sendLineMessage } = require('../utils/lineBot'); // ใช้ส่งข้อความไปยัง LINE
const { supabase } = require('../utils/supabaseClient'); // ใช้เชื่อมต่อกับ Supabase
const OTP_EXPIRATION_MINUTES = 10; // กำหนดเวลา OTP หมดอายุ 10 นาที

// ✅ สร้าง OTP ใหม่
const requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // ค้นหาข้อมูลจากฐานข้อมูล auth_sessions ตาม ref_code
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status, verify_status, expires_at')
      .eq('ref_code', ref_code)
      .maybeSingle();

    // ถ้าไม่พบ Ref.Code หรือพบข้อผิดพลาดในการดึงข้อมูล
    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ตรวจสอบสถานะว่าเป็น "BLOCK" หรือไม่
    if (sessionData.status === 'BLOCK') {
      return res.status(400).json({ status: 'error', message: 'Ref.Code นี้ถูก BLOCK แล้ว' });
    }

    // ตรวจสอบว่า Ref.Code นี้หมดอายุหรือยัง
    const now = new Date().toISOString();
    if (sessionData.expires_at <= now) {
      // ถ้าหมดอายุ ให้เปลี่ยนสถานะเป็น "No Active"
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'No Active' })
        .eq('ref_code', ref_code);

      return res.status(400).json({ status: 'error', message: 'Ref.Code หมดอายุแล้ว' });
    } else {
      // ถ้ายังไม่หมดอายุ ให้ตั้งสถานะเป็น "ACTIVE"
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'ACTIVE' })
        .eq('ref_code', ref_code);
    }

    // ถ้า verify_status เป็น ACTIVE, ทำการ Generate OTP
    if (sessionData.verify_status === 'ACTIVE') {
      const otp = generateOtpCode(); // ฟังก์ชั่นที่ใช้ในการสร้าง OTP
      const otpCreatedAt = new Date().toISOString();
      const otpExpiresAt = new Date(new Date().getTime() + OTP_EXPIRATION_MINUTES * 60000).toISOString(); // OTP หมดอายุใน 10 นาที

      // อัปเดต OTP และข้อมูลต่างๆ ใน Supabase
      const { error: updateOtpError } = await supabase
        .from('auth_sessions')
        .update({
          otp_code: otp,
          otp_at: otpCreatedAt,
          otp_expires_at: otpExpiresAt,
          otp_count: (sessionData.otp_count || 0) + 1 // เพิ่มจำนวนการขอ OTP
        })
        .eq('ref_code', ref_code);

      if (updateOtpError) {
        return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
      }

      // ส่ง OTP ให้ผู้ใช้ผ่าน LINE
      if (sessionData.line_user_id) {
        await sendLineMessage(sessionData.line_user_id, `
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ หมดอายุใน ${OTP_EXPIRATION_MINUTES} นาที
        `);
      }

      return res.status(200).json({ status: 'success', message: 'ส่ง OTP สำเร็จ' });
    }

  } catch (err) {
    console.error('❌ Error during OTP request:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
};

// ฟังก์ชั่นสำหรับสร้าง OTP (ตัวอักษร 1 ตัว + ตัวเลข 4 ตัว)
const generateOtpCode = () => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // สร้างตัวอักษร A-Z
  const number = Math.floor(1000 + Math.random() * 9000); // สร้างตัวเลข 4 หลัก
  return `${letter}${number}`;
};

module.exports = {
  requestOtp
};
