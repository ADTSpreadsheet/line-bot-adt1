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
    
    console.log(`📩 [CONFIRM OTP] ได้รับคำขอยืนยัน OTP → Ref.Code: ${ref_code}, OTP: ${otp}`);
    
    // STEP 1: ตรวจสอบ OTP ที่ผู้ใช้ส่งมา
    console.log(`🔍 [CONFIRM OTP] กำลังค้นหาในฐานข้อมูล → Ref.Code: ${ref_code}`);
    
    const { data, error } = await supabase
      .from('auth_sessions')  // เปลี่ยนจาก otp_sessions เป็น auth_sessions
      .select('*')
      .eq('ref_code', ref_code)
      .eq('otp_code', otp)
      .maybeSingle();
    
    if (error) {
      console.error(`❌ [CONFIRM OTP] เกิดข้อผิดพลาดในการค้นหา OTP: ${error.message}`);
      return res.status(500).json({ 
        status: 'error',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ OTP' 
      });
    }
    
    if (!data) {
      console.warn(`⚠️ [CONFIRM OTP] OTP ไม่ถูกต้องหรือไม่พบข้อมูล → Ref.Code: ${ref_code}`);
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
    console.error(`🔥 [CONFIRM OTP] เกิดข้อผิดพลาดไม่คาดคิด: ${err.message}`);
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
    
    console.log(`📩 [CLEAR OTP] ได้รับคำขอล้าง OTP → Ref.Code: ${ref_code}`);
    
    // ล้าง OTP ออกจาก auth_sessions
    console.log(`🧹 [CLEAR OTP] กำลังล้าง OTP จากฐานข้อมูล → Ref.Code: ${ref_code}`);
    
    // ตรวจสอบก่อนล้าง
    const { data: checkData, error: checkError } = await supabase
      .from('auth_sessions')  // เปลี่ยนจาก otp_sessions เป็น auth_sessions
      .select('otp_code')
      .eq('ref_code', ref_code)
      .maybeSingle();
      
    if (checkError) {
      console.error(`❌ [CLEAR OTP] ไม่สามารถตรวจสอบ OTP ก่อนล้าง: ${checkError.message}`);
    } else if (!checkData || checkData.otp_code === null) {
      console.warn(`⚠️ [CLEAR OTP] ไม่พบ OTP หรือ OTP ถูกล้างไปแล้ว → Ref.Code: ${ref_code}`);
    } else {
      console.log(`🔍 [CLEAR OTP] พบ OTP → Ref.Code: ${ref_code}, OTP: ${checkData.otp_code}`);
    }
    
    // ดำเนินการล้าง OTP
    const { error: clearError } = await supabase
      .from('auth_sessions')  // เปลี่ยนจาก otp_sessions เป็น auth_sessions
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
    
    // อัปเดตสถานะใน auth_sessions
    console.log(`🔄 [CLEAR OTP] อัปเดตสถานะเป็น Verified → Ref.Code: ${ref_code}`);
    
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({ 
        verify_status: 'Verified',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);
      
    if (updateError) {
      console.warn(`⚠️ [CLEAR OTP] อัปเดตสถานะไม่สำเร็จ: ${updateError.message}`);
    }
    
    console.log(`✅ [CLEAR OTP] ล้าง OTP และอัปเดตสถานะสำเร็จ → Ref.Code: ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ล้างค่า OTP สำเร็จ' 
    });
    
  } catch (err) {
    console.error(`🔥 [CLEAR OTP] เกิดข้อผิดพลาดไม่คาดคิด: ${err.message}`);
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
