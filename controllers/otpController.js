// controllers/otpController.js
const { v4: uuidv4 } = require('uuid');
const { sendLineMessage } = require('../utils/lineBot');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

// ระยะเวลาหมดอายุของ OTP (นาที)
const OTP_EXPIRATION_MINUTES = 10;
// จำนวนครั้งสูงสุดที่อนุญาตให้กรอก OTP ผิด
const MAX_FAILED_ATTEMPTS = 3;

/**
 * สร้าง OTP ใหม่และบันทึกลงฐานข้อมูล
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.requestOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // ตรวจสอบว่า ref_code มีอยู่จริงหรือไม่
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('line_user_id, is_verified')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError || !sessionData) {
      logger.warn(`❌ ไม่พบ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบ Ref.Code นี้ในระบบ'
      });
    }

    // ตรวจสอบว่า ref_code ได้รับการยืนยันด้วย Serial Key แล้วหรือไม่
    if (!sessionData.is_verified) {
      logger.warn(`⚠️ Ref.Code: ${ref_code} ยังไม่ได้รับการยืนยันด้วย Serial Key`);
      return res.status(400).json({
        status: 'error',
        message: 'Ref.Code นี้ยังไม่ได้รับการยืนยันด้วย Serial Key กรุณายืนยันด้วย Serial Key ก่อน'
      });
    }

    // สร้าง OTP 6 หลัก
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    // รีเซ็ตจำนวนครั้งที่กรอกผิด
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        otp_code: otp,
        otp_created_at: now.toISOString(),
        otp_expires_at: expiresAt.toISOString(),
        otp_failed_attempts: 0
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      logger.error(`❌ ไม่สามารถอัปเดต OTP สำหรับ Ref.Code: ${ref_code}`, updateError.message);
      throw updateError;
    }

    // ส่ง OTP ไปยังผู้ใช้ผ่าน LINE
    if (sessionData.line_user_id) {
      await sendLineMessage(sessionData.line_user_id, `
📌 รหัส OTP สำหรับเข้าใช้งาน ADTSpreadsheet:
🔐 OTP: ${otp}
📋 Ref.Code: ${ref_code}
⏳ หมดอายุใน ${OTP_EXPIRATION_MINUTES} นาที
      `);
    }

    logger.info(`🔐 สร้าง OTP สำเร็จสำหรับ Ref.Code: ${ref_code}`);
    res.status(200).json({ 
      status: 'success', 
      message: 'สร้างและส่ง OTP แล้ว',
      expires_in: OTP_EXPIRATION_MINUTES * 60 // ส่งเวลาหมดอายุเป็นวินาที
    });
  } catch (err) {
    logger.error('❌ requestOtp ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถสร้าง OTP ได้',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ตรวจสอบ OTP ที่ผู้ใช้กรอก
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { ref_code, otp } = req.body;

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('otp_code, otp_expires_at, otp_failed_attempts, line_user_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error || !data) {
      logger.warn(`❌ ไม่พบข้อมูล OTP สำหรับ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบข้อมูล OTP'
      });
    }

    // ตรวจสอบว่า OTP หมดอายุหรือไม่
    const now = new Date();
    const isExpired = new Date(data.otp_expires_at) < now;

    if (isExpired) {
      logger.warn(`⚠️ OTP หมดอายุสำหรับ Ref.Code: ${ref_code}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'OTP หมดอายุแล้ว กรุณาขอ OTP ใหม่'
      });
    }

    // ตรวจสอบว่า OTP ถูกต้องหรือไม่
    const isMatch = data.otp_code === otp;

    if (!isMatch) {
      // เพิ่มจำนวนครั้งที่กรอกผิด
      const failedAttempts = (data.otp_failed_attempts || 0) + 1;
      
      await supabase
        .from('auth_sessions')
        .update({ otp_failed_attempts: failedAttempts })
        .eq('ref_code', ref_code);

      // ตรวจสอบว่าเกินจำนวนครั้งที่อนุญาตหรือไม่
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        logger.warn(`🔒 ล็อค OTP เนื่องจากกรอกผิดเกินจำนวนครั้งที่กำหนด Ref.Code: ${ref_code}`);
        
        // ทำให้ OTP หมดอายุทันที
        await supabase
          .from('auth_sessions')
          .update({ 
            otp_expires_at: now.toISOString()
          })
          .eq('ref_code', ref_code);
        
        // แจ้งเตือนผู้ใช้ทาง LINE
        if (data.line_user_id) {
          await sendLineMessage(data.line_user_id, `
⚠️ คำเตือน: มีการกรอก OTP ผิดเกินจำนวนครั้งที่กำหนด
🔒 ระบบได้ยกเลิก OTP ของคุณเพื่อความปลอดภัย
🔐 กรุณาขอ OTP ใหม่หากต้องการเข้าสู่ระบบ
          `);
        }
        
        return res.status(400).json({ 
          status: 'error', 
          message: 'กรอก OTP ผิดเกินจำนวนครั้งที่กำหนด กรุณาขอ OTP ใหม่'
        });
      }

      logger.warn(`⚠️ OTP ไม่ถูกต้องสำหรับ Ref.Code: ${ref_code} (ครั้งที่ ${failedAttempts}/${MAX_FAILED_ATTEMPTS})`);
      return res.status(400).json({ 
        status: 'error', 
        message: `OTP ไม่ถูกต้อง (ครั้งที่ ${failedAttempts}/${MAX_FAILED_ATTEMPTS})`,
        attempts_left: MAX_FAILED_ATTEMPTS - failedAttempts
      });
    }

    // OTP ถูกต้อง - รีเซ็ตจำนวนครั้งที่กรอกผิด
    await supabase
      .from('auth_sessions')
      .update({ 
        otp_verified: true,
        otp_verified_at: now.toISOString(),
        otp_failed_attempts: 0
      })
      .eq('ref_code', ref_code);

    logger.info(`✅ OTP ยืนยันสำเร็จสำหรับ Ref.Code: ${ref_code}`);
    res.status(200).json({ 
      status: 'success', 
      message: 'ยืนยัน OTP สำเร็จ',
      verified_at: now.toISOString()
    });
  } catch (err) {
    logger.error('❌ verifyOtp ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบ OTP ไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ตรวจสอบสถานะ OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkOtpStatus = async (req, res) => {
  try {
    const ref_code = req.method === 'GET' ? req.query.ref_code : req.body.ref_code;

    if (!ref_code) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ Ref.Code'
      });
    }

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('otp_code, otp_expires_at, otp_verified, otp_failed_attempts')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูล OTP สำหรับ Ref.Code: ${ref_code}`, error.message);
      throw error;
    }

    if (!data || !data.otp_code || !data.otp_expires_at) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบ OTP หรือ OTP ยังไม่ได้ถูกสร้าง'
      });
    }

    const now = new Date();
    const expiresAt = new Date(data.otp_expires_at);
    const isValid = now < expiresAt;
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    res.status(200).json({
      status: 'success',
      is_valid: isValid,
      is_verified: !!data.otp_verified,
      expires_in_seconds: remainingSeconds,
      expires_in_minutes: remainingMinutes,
      attempts_left: MAX_FAILED_ATTEMPTS - (data.otp_failed_attempts || 0)
    });
  } catch (err) {
    logger.error('❌ checkOtpStatus ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบสถานะ OTP ไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ส่ง OTP ซ้ำ (ใช้รหัสเดิม)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resendOtp = async (req, res) => {
  try {
    const { ref_code } = req.body;

    // ดึงข้อมูล OTP เดิม
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('otp_code, otp_expires_at, line_user_id, otp_resend_count')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูล OTP สำหรับ Ref.Code: ${ref_code}`, error.message);
      throw error;
    }

    if (!data || !data.otp_code || !data.line_user_id) {
      logger.warn(`❌ ไม่พบข้อมูล OTP หรือผู้ใช้สำหรับ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบ OTP หรือข้อมูลผู้ใช้'
      });
    }

    const now = new Date();
    const expiresAt = new Date(data.otp_expires_at);
    const isExpired = expiresAt < now;

    if (isExpired) {
      logger.warn(`⚠️ OTP หมดอายุแล้วสำหรับ Ref.Code: ${ref_code}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'OTP หมดอายุแล้ว กรุณาขอใหม่'
      });
    }

    // อัปเดตจำนวนครั้งที่ส่งซ้ำ
    const resendCount = (data.otp_resend_count || 0) + 1;
    
    await supabase
      .from('auth_sessions')
      .update({ otp_resend_count: resendCount })
      .eq('ref_code', ref_code);

    // คำนวณเวลาที่เหลือ
    const remainingMinutes = Math.ceil((expiresAt - now) / 60000);

    // ส่งข้อความไปยัง LINE
    await sendLineMessage(data.line_user_id, `
🔁 ส่งซ้ำรหัส OTP ของคุณ:
🔐 OTP: ${data.otp_code}
📋 Ref.Code: ${ref_code}
⏳ เหลือเวลา ${remainingMinutes} นาที
    `);

    logger.info(`🔁 ส่ง OTP ซ้ำให้ Ref.Code: ${ref_code} (ครั้งที่ ${resendCount})`);
    res.status(200).json({ 
      status: 'success', 
      message: 'ส่ง OTP ซ้ำเรียบร้อยแล้ว',
      resend_count: resendCount,
      expires_in_minutes: remainingMinutes
    });
  } catch (err) {
    logger.error('❌ resendOtp ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถส่ง OTP ซ้ำได้',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
