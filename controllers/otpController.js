const { sendLineMessage } = require('../utils/lineBot');
const { supabase } = require('../utils/supabaseClient');
const OTP_EXPIRATION_MINUTES = 10; // กำหนดเวลา OTP หมดอายุ

// ✅ ฟังก์ชันสร้างรหัส OTP
const generateOtpCode = () => {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  const number = Math.floor(1000 + Math.random() * 9000); // 4 หลัก
  return ${letter}${number};
};

// ✅ ขอ OTP ใหม่
const requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, status, verify_status, expires_at, otp_count')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ตรวจสอบว่า Ref.Code ถูกบล็อกหรือหมดอายุหรือไม่
    const now = new Date();
    if (sessionData.status === 'BLOCK') {
      return res.status(400).json({ status: 'error', message: 'Ref.Code นี้ถูก BLOCK แล้ว' });
    }

    if (new Date(sessionData.expires_at) <= now) {
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'No Active' })
        .eq('ref_code', ref_code);

      return res.status(400).json({ status: 'error', message: 'Ref.Code หมดอายุแล้ว' });
    }

    // ถ้า verify_status ยังไม่ Active → อัปเดตให้เลย
    if (sessionData.verify_status !== 'Active') {
      await supabase
        .from('auth_sessions')
        .update({ verify_status: 'Active' })
        .eq('ref_code', ref_code);
    }

    // ✅ สร้าง OTP ใหม่
    const otp = generateOtpCode();
    const otpCreatedAt = now.toISOString();
    const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60000).toISOString();

    const { error: updateOtpError } = await supabase
      .from('auth_sessions')
      .update({
        otp_code: otp,
        otp_at: otpCreatedAt,
        otp_count: (sessionData.otp_count || 0) + 1
      })
      .eq('ref_code', ref_code);

    if (updateOtpError) {
      return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
    }

    // ส่ง OTP ไปยัง LINE
    if (sessionData.line_user_id) {
      await sendLineMessage(sessionData.line_user_id, 
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ หมดอายุใน ${OTP_EXPIRATION_MINUTES} นาที
      );
    }

    return res.status(200).json({ status: 'success', message: 'ส่ง OTP สำเร็จ' });

  } catch (err) {
    console.error('❌ Error during OTP request:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
};

// ✅ ตรวจสอบสถานะ OTP
const checkOtpStatus = async (req, res) => {
  try {
    const { ref_code } = req.query;

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('otp_code, otp_count verify_status')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูล OTP' });
    }

    const now = new Date();
    const isExpired = new Date(data.otp_expires_at) <= now;

    return res.status(200).json({
      status: 'success',
      verify_status: data.verify_status,
    });

  } catch (err) {
    console.error('❌ Error checking OTP status:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการตรวจสอบ OTP' });
  }
};

// ✅ ส่ง OTP ซ้ำ (logic คล้าย requestOtp)
const resendOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // เรียกใช้ requestOtp ไปเลย (หรือจะแยกก็ได้)
    req.body.ref_code = ref_code;
    return requestOtp(req, res); // ใช้ logic เดิม

  } catch (err) {
    console.error('❌ Error during OTP resend:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP ซ้ำ' });
  }
};

// ✅ ส่งออกให้ใช้งานได้
module.exports = {
  requestOtp,
  checkOtpStatus,
  resendOtp
};
