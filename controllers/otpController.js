const { sendLineMessage } = require('../utils/lineBot');
const { supabase } = require('../utils/supabaseClient');
const OTP_EXPIRATION_MINUTES = 10;

// ✅ สร้าง OTP ใหม่
const requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, is_verified')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    if (!sessionData.is_verified) {
      return res.status(400).json({ status: 'error', message: 'Ref.Code ยังไม่ยืนยัน Serial Key' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60000);

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        otp,
        otp_created_at: now.toISOString(),
        otp_expires_at: expiresAt.toISOString(),
        otp_failed_attempts: 0
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
    }

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

// ✅ Dummy functions ไว้ก่อน (ยังไม่ใช้)
const verifyOtp = (req, res) => res.status(501).json({ message: 'ยังไม่ได้ทำ verifyOtp' });
const checkOtpStatus = (req, res) => res.status(501).json({ message: 'ยังไม่ได้ทำ checkOtpStatus' });
const resendOtp = (req, res) => res.status(501).json({ message: 'ยังไม่ได้ทำ resendOtp' });

// ✅ export ให้ครบ
module.exports = {
  requestOtp,
  verifyOtp,
  checkOtpStatus,
  resendOtp
};
