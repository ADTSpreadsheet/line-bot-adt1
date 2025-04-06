const { sendLineMessage } = require('../utils/lineBot');
const { supabase } = require('../utils/supabaseClient');
const OTP_EXPIRATION_MINUTES = 10;

// ✅ ฟังก์ชันสร้าง OTP
const generateOtpCode = () => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${letter}${number}`;
};

// ✅ ขอ OTP ใหม่
const requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;
    console.log(`📩 [OTP] Request received → Ref.Code: ${ref_code}`);

    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status, verify_status, expires_at, otp_count')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      console.warn('⚠️ ไม่พบ Ref.Code หรือเกิด error:', sessionError);
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    console.log('✅ พบ Ref.Code แล้ว:', sessionData);

    const now = new Date();

    if (sessionData.status === 'BLOCK') {
      console.warn(`🚫 Ref.Code: ${ref_code} ถูกบล็อก`);
      return res.status(400).json({ status: 'error', message: 'Ref.Code นี้ถูก BLOCK แล้ว' });
    }

    if (new Date(sessionData.expires_at) <= now) {
      console.warn(`⏳ Ref.Code: ${ref_code} หมดอายุแล้ว`);
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'No Active' })
        .eq('ref_code', ref_code);

      return res.status(400).json({ status: 'error', message: 'Ref.Code หมดอายุแล้ว' });
    }

    if (sessionData.verify_status !== 'Active') {
      console.log(`🔄 อัปเดต verify_status → Active`);
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'Active' })
        .eq('ref_code', ref_code);
    }

    // ✅ สร้าง OTP
    const otp = generateOtpCode();

    const { error: updateOtpError } = await supabase
      .from('auth_sessions')
      .update({
        otp_code: otp,
        otp_count: (sessionData.otp_count || 0) + 1
      })
      .eq('ref_code', ref_code);

    if (updateOtpError) {
      console.error('❌ อัปเดต OTP ไม่สำเร็จ:', updateOtpError);
      return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
    }

    console.log('✅ บันทึก OTP สำเร็จแล้วใน Supabase');

    if (sessionData.line_user_id) {
      console.log(`📤 ส่ง OTP ไปยัง LINE USER: ${sessionData.line_user_id}`);
      await sendLineMessage(sessionData.line_user_id, `
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ กรุณาใช้ภายใน 10 นาที (หากหมดเวลา ร้องขอใหม่ได้)
      `);
    } else {
      console.warn('⚠️ ไม่พบ line_user_id สำหรับ Ref.Code นี้');
    }

    return res.status(200).json({ status: 'success', message: 'ส่ง OTP สำเร็จ' });

  } catch (err) {
    console.error('🔥 [OTP ERROR] ไม่สามารถดำเนินการได้:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
};


// ✅ EXPORT
module.exports = {
  requestOtp,
  checkOtpStatus,
  resendOtp
};
