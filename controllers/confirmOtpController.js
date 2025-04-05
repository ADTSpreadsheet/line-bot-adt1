const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

// ✅ ยืนยัน OTP
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    // ค้นหาข้อมูลจากฐานข้อมูล auth_sessions ตาม ref_code
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, otp_code, otp_expires_at, verify_status')
      .eq('ref_code', ref_code)
      .maybeSingle();

    // ถ้าไม่พบ Ref.Code หรือพบข้อผิดพลาดในการดึงข้อมูล
    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ตรวจสอบว่า OTP ที่กรอกมาตรงกับที่บันทึกในฐานข้อมูลหรือไม่
    if (sessionData.otp_code !== otp) {
      return res.status(400).json({ status: 'error', message: 'OTP ไม่ถูกต้อง' });
    }

    // ตรวจสอบว่า OTP หมดอายุหรือยัง
    const now = new Date().toISOString();
    if (sessionData.otp_expires_at <= now) {
      return res.status(400).json({ status: 'error', message: 'OTP หมดอายุแล้ว' });
    }

    // อัปเดตสถานะให้เป็น "Verified"
    await supabase
      .from('auth_sessions')
      .update({ verify_status: 'Verified' })
      .eq('ref_code', ref_code);

    // ส่งข้อความยืนยัน OTP ไปยัง LINE
    if (sessionData.line_user_id) {
      await sendLineMessage(sessionData.line_user_id, `
📌 ยืนยันตัวตนเสร็จสมบูรณ์:
🔐 Ref.Code: ${ref_code}
✅ OTP ถูกต้องและยืนยันสำเร็จ
      `);
    }

    return res.status(200).json({ status: 'success', message: 'ยืนยัน OTP สำเร็จ' });
    
  } catch (err) {
    console.error('❌ Error during OTP confirmation:', err);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการยืนยัน OTP' });
  }
};

module.exports = {
  confirmOtp
};
