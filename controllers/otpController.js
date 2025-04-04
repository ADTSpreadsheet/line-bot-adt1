exports.requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // ✅ 1. ตรวจว่า Ref.Code มีอยู่จริง
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, is_verified')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // ✅ 2. ตรวจว่า Ref.Code ผ่าน Serial Key แล้ว
    if (!sessionData.is_verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Ref.Code ยังไม่ผ่านการยืนยันด้วย Serial Key'
      });
    }

    // ✅ 3. สร้าง OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60000);

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        otp: otp,
        otp_created_at: now.toISOString(),
        otp_expires_at: expiresAt.toISOString(),
        otp_failed_attempts: 0
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.error(`❌ อัปเดต OTP ไม่สำเร็จ: ${updateError.message}`);
      return res.status(500).json({ status: 'error', message: 'อัปเดต OTP ไม่สำเร็จ' });
    }

    // ✅ 4. ส่ง OTP ไปยัง LINE
    if (sessionData.line_user_id) {
      await sendLineMessage(sessionData.line_user_id, `
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ หมดอายุใน ${OTP_EXPIRATION_MINUTES} นาที
      `);
    }

    console.log(`✅ สร้างและส่ง OTP สำเร็จ: Ref.Code ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ส่ง OTP สำเร็จ',
      expires_in: OTP_EXPIRATION_MINUTES * 60 
    });

  } catch (err) {
    console.error('❌ requestOtp ERROR:', err.message);
    return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการส่ง OTP' });
  }
};
