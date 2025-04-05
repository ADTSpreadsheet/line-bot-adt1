const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

// ✅ ยืนยัน OTP
const verifyOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    // ค้นหาข้อมูลจากฐานข้อมูลตาม ref_code
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('otp_code, otp_expires_at')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ตรวจสอบว่า OTP หมดอายุหรือไม่
    if (new Date() > new Date(sessionData.otp_expires_at)) {
      return res.status(400).json({ status: 'error', message: 'OTP หมดอายุแล้ว' });
    }

    // ตรวจสอบว่า OTP ที่กรอกตรงกับ OTP ที่เก็บในฐานข้อมูลหรือไม่
    if (otp !== sessionData.otp_code) {
      return res.status(400).json({ status: 'error', message: 'OTP ไม่ถูกต้อง' });
    }

    // เคลียร์ค่ารหัส OTP ในฐานข้อมูลหลังจากยืนยัน OTP สำเร็จ
    const { error: clearOtpError } = await supabase
      .from('auth_sessions')
      .update({ otp_code: null })
      .eq('ref_code', ref_code);

    if (clearOtpError) {
      return res.status(500).json({ status: 'error', message: 'ไม่สามารถเคลียร์ OTP ได้' });
    }

    // อัปเดตสถานะผู้ใช้เป็น "Active" หรือสถานะที่คุณต้องการ
    const { error: updateStatusError } = await supabase
      .from('auth_sessions')
      .update({ verify_status: 'Active' })
      .eq('ref_code', ref_code);

    if (updateStatusError) {
      return res.status(500).json({ status: 'error', message: 'ไม่สามารถอัปเดตสถานะได้' });
    }

    return res.status(200).json({ status: 'success', message: 'ยืนยัน OTP สำเร็จ' });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการยืนยัน OTP' });
  }
};

module.exports = {
  confirmOtp
};
