const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');

/**
 * ยืนยัน OTP - ตรวจสอบความถูกต้องของ OTP ที่ผู้ใช้กรอก
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} HTTP response
 */
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;
    console.log(`🔍 [CONFIRM OTP] ตรวจสอบ OTP → Ref.Code: ${ref_code}, OTP: ${otp}`);

    // STEP 1: ตรวจสอบ OTP ที่ผู้ใช้ส่งมา
    const { data, error } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('otp_code', otp)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error || !data) {
      console.warn(`❌ [CONFIRM OTP] OTP ไม่ถูกต้อง → Ref.Code: ${ref_code}`);
      return res.status(400).json({ 
        status: 'error',
        message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' 
      });
    }

    console.log(`✅ [CONFIRM OTP] ยืนยัน OTP สำเร็จ → Ref.Code: ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ยืนยัน OTP สำเร็จแล้วครับ 🎉' 
    });

  } catch (err) {
    console.error('🔥 [CONFIRM OTP ERROR] เกิดข้อผิดพลาด:', err);
    return res.status(500).json({ 
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการยืนยัน OTP' 
    });
  }
};

/**
 * เคลียร์ OTP - ล้างค่า OTP หลังจากใช้งานเสร็จสิ้น
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} HTTP response
 */
const clearOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;
    console.log(`🧹 [CLEAR OTP] เริ่มล้าง OTP → Ref.Code: ${ref_code}`);

    // ล้าง OTP ออกจาก otp_sessions
    const { error: clearError } = await supabase
      .from('otp_sessions')
      .update({ 
        otp_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (clearError) {
      console.error(`❌ [CLEAR OTP] ล้าง OTP ไม่สำเร็จ:`, clearError);
      return res.status(500).json({ 
        status: 'error',
        message: 'ไม่สามารถล้างค่า OTP ได้' 
      });
    }

    // อัปเดตสถานะใน auth_sessions (optional)
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({ 
        verify_status: 'Verified',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.warn(`⚠️ [CLEAR OTP] อัปเดตสถานะไม่สำเร็จ แต่ล้าง OTP แล้ว:`, updateError);
      // ไม่ return error เนื่องจากการล้าง OTP สำเร็จแล้ว
    }

    console.log(`✅ [CLEAR OTP] ล้าง OTP สำเร็จ → Ref.Code: ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ล้างค่า OTP สำเร็จ' 
    });

  } catch (err) {
    console.error('🔥 [CLEAR OTP ERROR] เกิดข้อผิดพลาด:', err);
    return res.status(500).json({ 
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการล้างค่า OTP' 
    });
  }
};

// ส่งออกฟังก์ชัน
module.exports = {
  confirmOtp,
  clearOtp
};
