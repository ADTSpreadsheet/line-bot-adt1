const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

// ✅ ยืนยัน OTP
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    // STEP 1: ตรวจสอบ OTP ที่ผู้ใช้ส่งมา
    const { data, error } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('otp_code', otp)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' });
    }

    // STEP 2: อัปเดต verify_status และ updated_at
    const { error: updateVerifyError } = await supabase
      .from('auth_sessions')
      .update({
        verify_status: 'ACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateVerifyError) {
      return res.status(500).json({ message: 'อัปเดต verify_status ไม่สำเร็จ' });
    }

    // STEP 3: ล้าง otp_code ออกจาก auth_sessions
    const { error: clearOtpError } = await supabase
      .from('auth_sessions')
      .update({ otp_code: null })
      .eq('ref_code', ref_code);

    if (clearOtpError) {
      return res.status(500).json({ message: 'ไม่สามารถล้างค่า OTP ได้' });
    }

    // STEP 4: อัปเดต status ถ้าจำเป็น
    const { error: updateStatusError } = await supabase
      .from('auth_sessions')
      .update({ status: 'COMPLETE' })
      .eq('ref_code', ref_code);

    if (updateStatusError) {
      return res.status(500).json({ message: 'ไม่สามารถอัปเดต status ได้' });
    }

    return res.status(200).json({ message: 'ยืนยัน OTP สำเร็จแล้วครับ 🎉' });

  } catch (err) {
    console.error('Error confirming OTP:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยืนยัน OTP' });
  }
};

// ❗❗ อย่าลืม exports ด้วยนะ!
module.exports = {
  confirmOtp
};
