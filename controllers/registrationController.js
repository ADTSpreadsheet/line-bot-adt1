// controllers/registrationController.js
const { 
  createRefCodeInSupabase, 
  saveUserData, 
  getSerialKeyByRefCode, 
  resendSerialKeyToLine,
  checkRefCodeExists,
  validateTrialPeriod
} = require('../utils/database');
const { generateRefCode } = require('../utils/refCodeGenerator');
const { generateSerialKey } = require('../utils/serialKeyGenerator');
const { sendLineMessage } = require('../utils/lineBot');
const logger = require('../utils/logger');

/**
 * สร้าง Ref.Code และ Serial Key ใหม่
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createRefCode = async (req, res) => {
  try {
    const { line_user_id } = req.body;
    
    // ตรวจสอบว่ามี line_user_id ส่งมาหรือไม่
    if (!line_user_id) {
      return res.status(400).json({
        status: 'error',
        message: 'ต้องระบุ line_user_id'
      });
    }

    // ตรวจสอบว่าผู้ใช้อยู่ในช่วงทดลองหรือไม่
    const trialStatus = await validateTrialPeriod(line_user_id);
    if (trialStatus && trialStatus.isActive) {
      return res.status(400).json({
        status: 'error',
        message: `คุณกำลังอยู่ในช่วงทดลองใช้ที่มีอยู่แล้ว เหลือเวลาอีก ${trialStatus.daysLeft} วัน`,
        data: { ref_code: trialStatus.ref_code }
      });
    }

    // สร้าง Ref.Code และ Serial Key
    const ref_code = generateRefCode();
    const serial_key = generateSerialKey();
    
    // ตรวจสอบว่า Ref.Code ซ้ำหรือไม่
    const existingRefCode = await checkRefCodeExists(ref_code);
    if (existingRefCode) {
      logger.warn(`Ref.Code ${ref_code} ซ้ำกับที่มีอยู่แล้ว กำลังสร้างใหม่...`);
      return this.createRefCode(req, res); // ลองใหม่
    }
    
    // บันทึกข้อมูลลง Supabase
    const result = await createRefCodeInSupabase(ref_code, serial_key, line_user_id);
    
    // แจ้งผู้ใช้งานผ่าน LINE
    await sendLineMessage(line_user_id, `
✅ สร้าง Ref.Code สำเร็จแล้ว!
📋 รหัสของคุณคือ: ${ref_code}
กรุณากรอกใน Excel VBA แล้วกด Verify ครับ ✅
    `);
    
    logger.info(`สร้าง Ref.Code ${ref_code} สำหรับผู้ใช้ ${line_user_id} สำเร็จ`);
    
    res.status(200).json({
      status: 'success',
      message: 'Ref.Code และ Serial Key ถูกสร้างแล้ว',
      data: { ref_code }
    });
  } catch (error) {
    logger.error('❌ createRefCode ERROR:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถสร้าง Ref.Code ได้',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ตรวจสอบ Serial Key กับ Ref.Code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifySerialKey = async (req, res) => {
  try {
    const { ref_code, serial_key } = req.body;
    
    if (!ref_code || !serial_key) {
      return res.status(400).json({
        status: 'error',
        message: 'ต้องระบุทั้ง ref_code และ serial_key'
      });
    }
    
    const result = await getSerialKeyByRefCode(ref_code, serial_key);
    
    if (!result) {
      logger.warn(`การตรวจสอบ Serial Key ล้มเหลวสำหรับ Ref.Code: ${ref_code}`);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Serial Key ไม่ถูกต้องหรือหมดอายุ'
      });
    }
    
    if (result.isExpired) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Serial Key หมดอายุแล้ว กรุณาขอใหม่'
      });
    }
    
    // อัปเดตสถานะว่าได้ตรวจสอบแล้ว
    await updateVerifyStatus(ref_code);
    
    logger.info(`ตรวจสอบ Serial Key สำหรับ Ref.Code: ${ref_code} สำเร็จ`);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'ยืนยัน Serial Key สำเร็จ',
      data: { 
        ref_code,
        expires_at: result.expires_at,
        trial_period_days: 7 // จำนวนวันทดลองใช้
      }
    });
  } catch (error) {
    logger.error('❌ verifySerialKey ERROR:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถตรวจสอบ Serial Key ได้',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * บันทึกข้อมูลผู้ใช้และ Machine ID จาก Excel VBA
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.completeRegistration = async (req, res) => {
  try {
    const { ref_code, machine_id, user_data } = req.body;
    
    if (!ref_code || !machine_id) {
      return res.status(400).json({
        status: 'error',
        message: 'ต้องระบุทั้ง ref_code และ machine_id'
      });
    }
    
    // ตรวจสอบว่า Ref.Code มีอยู่และถูกตรวจสอบแล้ว
    const refCodeStatus = await getRefCodeStatus(ref_code);
    if (!refCodeStatus) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบ Ref.Code นี้'
      });
    }
    
    if (!refCodeStatus.isVerified) {
      return res.status(400).json({
        status: 'error',
        message: 'Ref.Code นี้ยังไม่ได้รับการยืนยันด้วย Serial Key'
      });
    }
    
    // บันทึกข้อมูลผู้ใช้และ Machine ID
    const result = await saveUserData(ref_code, machine_id, user_data);
    
    // สร้างระยะเวลาทดลองใช้ (7 วัน)
    const trialPeriod = {
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 วัน
    };
    
    // บันทึกข้อมูลระยะเวลาทดลองใช้
    await saveTrialPeriod(ref_code, machine_id, trialPeriod);
    
    // แจ้งผู้ใช้ทาง LINE
    await sendLineMessage(refCodeStatus.line_user_id, `
✅ ลงทะเบียนสำเร็จ!
🖥️ Machine ID: ${machine_id.substring(0, 8)}...
⏱️ ระยะเวลาทดลอง: 7 วัน (${new Date(trialPeriod.end_date).toLocaleDateString('th-TH')})
🙏 ขอบคุณที่ใช้บริการของเรา
    `);
    
    logger.info(`ลงทะเบียนสำเร็จสำหรับ Ref.Code: ${ref_code}, Machine ID: ${machine_id}`);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'บันทึกข้อมูลผู้ใช้สำเร็จ',
      data: { trial_period: trialPeriod }
    });
  } catch (error) {
    logger.error('❌ completeRegistration ERROR:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'บันทึกข้อมูลไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ส่ง Serial Key ซ้ำไปยังผู้ใช้ทาง LINE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resendSerialKey = async (req, res) => {
  try {
    const { ref_code } = req.body;
    
    if (!ref_code) {
      return res.status(400).json({
        status: 'error',
        message: 'ต้องระบุ ref_code'
      });
    }
    
    const result = await resendSerialKeyToLine(ref_code);
    
    if (!result || !result.line_user_id || !result.serial_key) {
      logger.warn(`ไม่พบข้อมูลสำหรับ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบข้อมูล Ref.Code นี้'
      });
    }
    
    // ตรวจสอบว่าหมดอายุหรือไม่
    if (result.isExpired) {
      return res.status(400).json({
        status: 'error',
        message: 'Ref.Code นี้หมดอายุแล้ว กรุณาขอใหม่'
      });
    }
    
    // ส่งข้อความไปยัง LINE
    await sendLineMessage(result.line_user_id, `
📢 ส่งซ้ำรหัสของคุณ:
🔑 Serial Key: ${result.serial_key}
📋 Ref.Code: ${ref_code}
⏱️ รหัสหมดอายุใน: ${result.expiresInMinutes} นาที
    `);
    
    logger.info(`ส่ง Serial Key ซ้ำสำหรับ Ref.Code: ${ref_code} สำเร็จ`);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'ส่ง Serial Key ซ้ำเรียบร้อย'
    });
  } catch (error) {
    logger.error('❌ resendSerialKey ERROR:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถส่ง Serial Key ซ้ำได้',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ฟังก์ชันเพิ่มเติมที่ต้องสร้างเพิ่มในไฟล์ utils/database.js
const updateVerifyStatus = async (ref_code) => {
  // อัปเดตสถานะว่า verify แล้ว
};

const getRefCodeStatus = async (ref_code) => {
  // ดึงสถานะของ Ref.Code
};

const saveTrialPeriod = async (ref_code, machine_id, trialPeriod) => {
  // บันทึกระยะเวลาทดลองใช้
};
