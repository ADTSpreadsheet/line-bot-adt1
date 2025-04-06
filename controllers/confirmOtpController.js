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
        verify_status: 'ACTIVE', // ✅ ใช้ตัวพิมพ์ใหญ่ให้ตรงระบบ
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateVerifyError) {
      return res.status(500).json({ message: 'อัปเดต verify_status ไม่สำเร็จ' });
    }

    // STEP 3: เคล
