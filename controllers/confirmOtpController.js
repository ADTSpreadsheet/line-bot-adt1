const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

/**
 * ✅ ยืนยัน OTP
 */
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('otp_code', otp)
      .maybeSingle();
    console.log(`📩 [CONFIRM OTP] เริ่มต้นกระบวนการยืนยัน OTP`);
    
    if (error) {
      console.error(`❌ [CONFIRM OTP] Supabase Error: ${error.message}`);
      return res.status(500).json({ 
        status: 'error',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ OTP' 
      });
    }

    if (!data) {
      console.warn(`⚠️ [CONFIRM OTP] ไม่พบข้อมูล Ref.Code หรือ OTP ไม่ถูกต้อง`);
      return res.status(400).json({ 
        status: 'error',
        message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' 
      });
    }

    console.log(`✅ [CONFIRM OTP] OTP ถูกต้อง ยืนยันสำเร็จ → Ref.Code: ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ยืนยัน OTP สำเร็จแล้วครับ 🎉' 
    });

  } catch (err) {
    console.error(`🔥 [CONFIRM OTP] ข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`);
    return res.status(500).json({ 
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการยืนยัน OTP' 
    });
  }
};

/**
 * ✅ ล้างค่า OTP หลังจากยืนยันสำเร็จ
 */
const clearOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    console.log(`📩 [CLEAR OTP] เริ่มล้าง OTP → Ref.Code: ${ref_code}`);

    const { data: checkData, error: checkError } = await supabase
      .from('auth_sessions')
      .select('otp_code')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (checkError) {
      console.error(`❌ [CLEAR OTP] ตรวจสอบ OTP ก่อนล้างล้มเหลว: ${checkError.message}`);
    } else if (!checkData || checkData.otp_code === null) {
      console.warn(`⚠️ [CLEAR OTP] ไม่พบ OTP หรือถูกล้างไปแล้ว → Ref.Code: ${ref_code}`);
    } else {
      console.log(`🔍 [CLEAR OTP] พบ OTP → ${checkData.otp_code}`);
    }

    const { error: clearError } = await supabase
      .from('auth_sessions')
      .update({
        otp_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (clearError) {
      console.error(`❌ [CLEAR OTP] ล้าง OTP ไม่สำเร็จ: ${clearError.message}`);
      return res.status(500).json({ 
        status: 'error',
        message: 'ไม่สามารถล้างค่า OTP ได้' 
      });
    }

    console.log(`✅ [CLEAR OTP] ล้าง OTP สำเร็จ`);

    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        verify_status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.warn(`⚠️ [CLEAR OTP] อัปเดตสถานะไม่สำเร็จ: ${updateError.message}`);
    } else {
      console.log(`✅ [CLEAR OTP] อัปเดต verify_status → Verified สำเร็จ`);
    }

    return res.status(200).json({ 
      status: 'success',
      message: 'ล้างค่า OTP สำเร็จ' 
    });

  } catch (err) {
    console.error(`🔥 [CLEAR OTP] ข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`);
    return res.status(500).json({ 
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการล้างค่า OTP' 
    });
  }
};

module.exports = {
  confirmOtp,
  clearOtp
};
