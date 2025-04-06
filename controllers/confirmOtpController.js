const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../utils/lineBot');
const { createModuleLogger } = require('../utils/logger');
const otpLogger = createModuleLogger('ConfirmOTP');

/**
 * ยืนยัน OTP - ตรวจสอบความถูกต้องของ OTP ที่ผู้ใช้กรอก
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} HTTP response
 */
const confirmOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;
    
    otpLogger.info(`📩 ได้รับคำขอยืนยัน OTP | Ref.Code: ${ref_code} | OTP: ${otp}`);
    
    // STEP 1: ตรวจสอบ OTP ที่ผู้ใช้ส่งมา
    otpLogger.debug(`🔍 กำลังค้นหาในฐานข้อมูล | Ref.Code: ${ref_code}`);
    
    const { data, error } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('otp_code', otp)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    
    if (error) {
      otpLogger.error(`❌ เกิดข้อผิดพลาดในการค้นหา OTP | Error: ${error.message} | Ref.Code: ${ref_code}`);
      return res.status(500).json({ 
        status: 'error',
        message: 'เกิดข้อผิดพลาดในการตรวจสอบ OTP' 
      });
    }
    
    if (!data) {
      otpLogger.warn(`⚠️ OTP ไม่ถูกต้องหรือไม่พบข้อมูล | Ref.Code: ${ref_code}`);
      return res.status(400).json({ 
        status: 'error',
        message: 'OTP ไม่ถูกต้องหรือหมดอายุแล้ว' 
      });
    }
    
    otpLogger.info(`✅ ยืนยัน OTP สำเร็จ | Ref.Code: ${ref_code} | Session ID: ${data.id}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ยืนยัน OTP สำเร็จแล้วครับ 🎉' 
    });
    
  } catch (err) {
    otpLogger.error(`🔥 เกิดข้อผิดพลาดไม่คาดคิด | Error: ${err.message} | Stack: ${err.stack}`);
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
    
    otpLogger.info(`📩 ได้รับคำขอล้าง OTP | Ref.Code: ${ref_code}`);
    
    // ล้าง OTP ออกจาก otp_sessions
    otpLogger.debug(`🧹 กำลังล้าง OTP จาก otp_sessions | Ref.Code: ${ref_code}`);
    
    const { data: checkData, error: checkError } = await supabase
      .from('otp_sessions')
      .select('otp_code')
      .eq('ref_code', ref_code)
      .maybeSingle();
      
    if (checkError) {
      otpLogger.error(`❌ ไม่สามารถตรวจสอบ OTP ก่อนล้าง | Error: ${checkError.message} | Ref.Code: ${ref_code}`);
    } else if (!checkData || checkData.otp_code === null) {
      otpLogger.warn(`⚠️ ไม่พบ OTP หรือ OTP ถูกล้างไปแล้ว | Ref.Code: ${ref_code}`);
    }
    
    const { error: clearError } = await supabase
      .from('otp_sessions')
      .update({ 
        otp_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);
      
    if (clearError) {
      otpLogger.error(`❌ ล้าง OTP ไม่สำเร็จ | Error: ${clearError.message} | Ref.Code: ${ref_code}`);
      return res.status(500).json({ 
        status: 'error',
        message: 'ไม่สามารถล้างค่า OTP ได้' 
      });
    }
    
    // อัปเดตสถานะใน auth_sessions (optional)
    otpLogger.debug(`🔄 กำลังอัปเดตสถานะใน auth_sessions | Ref.Code: ${ref_code}`);
    
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({ 
        verify_status: 'Verified',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);
      
    if (updateError) {
      otpLogger.warn(`⚠️ อัปเดตสถานะใน auth_sessions ไม่สำเร็จ | Error: ${updateError.message} | Ref.Code: ${ref_code}`);
    } else {
      otpLogger.debug(`✓ อัปเดตสถานะใน auth_sessions สำเร็จ | Ref.Code: ${ref_code}`);
    }
    
    otpLogger.info(`✅ ล้าง OTP และอัปเดตสถานะสำเร็จ | Ref.Code: ${ref_code}`);
    return res.status(200).json({ 
      status: 'success',
      message: 'ล้างค่า OTP สำเร็จ' 
    });
    
  } catch (err) {
    otpLogger.error(`🔥 เกิดข้อผิดพลาดไม่คาดคิด | Error: ${err.message} | Stack: ${err.stack}`);
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
