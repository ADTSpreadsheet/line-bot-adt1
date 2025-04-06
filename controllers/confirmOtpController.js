const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

// ✅ ยืนยัน OTP
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    // ตัวอย่างโค้ดเบื้องต้น
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

    // อัปเดต verify_status เป็น ACTIVE ถ้า OTP ตรง
    await supabase
      .from('auth_sessions')
      .update({
        verify_status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    return res.status(200).json({ message: 'ยืนยัน OTP สำเร็จ' });

  } catch (err) {
    console.error('Error confirming OTP:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};

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
