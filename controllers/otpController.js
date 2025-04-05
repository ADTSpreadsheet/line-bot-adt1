const { sendLineMessage } = require('../utils/lineBot');
const { supabase } = require('../utils/supabaseClient');
const OTP_EXPIRATION_MINUTES = 10;

// ✅ สร้าง OTP ใหม่
const requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // ค้นหาข้อมูลจากฐานข้อมูล auth_sessions ตาม ref_code
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status, is_verified')
      .eq('ref_code', ref_code)
      .maybeSingle();

    // ถ้าไม่พบ Ref.Code หรือพบข้อผิดพลาดในการดึงข้อมูล
    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ตรวจสอบสถานะว่าเป็น "BLOCK" หรือไม่
    if (sessionData.status === 'BLOCK') {
      // ถ้า Ref.Code ถูก Blocked แล้ว
      return res.status(400).json({ status: 'error', message: 'Ref.Code นี้ถูก BLOCK แล้ว' });
    }

    // ตรวจสอบว่าผู้ใช้ยืนยัน Serial Key แล้วหรือยัง
    if (!sessionData.is_verified) {
      return res.status(400).json({ status: 'error', message: 'Ref.Code ยังไม่ยืนยัน Serial Key' });
    }

    // สร้าง OTP แบบสุ่ม
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // กำหนดเวลา OTP หมดอายุ
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60000);

    // อัปเดต OTP ในฐานข้อมูล
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        otp,
        otp_created_at: now.toISOString(),
        otp_expires_at: expiresAt.toISOString(),
        otp_failed_attempts: 0
      })
      .eq('ref_code', ref_code);

    // ถ้ามีข้อผิดพลาดในการอัปเดต OTP
    if (updateError) {
      return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
    }

    // ส่ง OTP ไปยัง LINE ของผู้ใช้
    if (sessionData.line_user_id) {
      await sendLineMessage(sessionData.line_user_id, `
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ หมดอายุใน ${OTP_EXPIRATION_MINUTES} นาที
      `);
    }

    return res.status(200).json({ status: 'success', message: 'ส่ง OTP สำเร็จ' });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
};

module.exports = {
  requestOtp
};
