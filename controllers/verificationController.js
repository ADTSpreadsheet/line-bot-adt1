/**
 * controllers/verificationController.js
 * ตัวควบคุมสำหรับการยืนยัน Ref.Code และ Serial Key
 */

const authService = require('../services/authService');
const lineService = require('../services/lineService');

/**
 * ยืนยัน Ref.Code และสร้าง Serial Key
 * @param {Object} req - คำขอ HTTP
 * @param {Object} res - การตอบกลับ HTTP
 */
const verifyRefCode = async (req, res) => {
  try {
    const { refCode } = req.body;
    
    if (!refCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing refCode' 
      });
    }
    
    // ตรวจสอบ Ref.Code และสร้าง Serial Key
    const result = await authService.verifyRefCodeAndGenerateSerialKey(refCode);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        error: result.message
      });
    }
    
    // ส่ง Serial Key ไปยังผู้ใช้
    await lineService.sendMessage(result.userId, {
      type: 'text',
      text: `Serial Key ของคุณคือ: ${result.serialKey}\nกรุณานำ Serial Key นี้ไปกรอก และกด Enter เพื่อยืนยัน\n(Serial Key นี้จะหมดอายุใน 30 นาที)`
    });
    
    // ตอบกลับไปยัง API
    return res.status(200).json({
      success: true,
      message: 'Serial Key generated and sent to user'
    });
  } catch (error) {
    console.error('Verify RefCode Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

/**
 * ยืนยัน Serial Key
 * @param {Object} req - คำขอ HTTP
 * @param {Object} res - การตอบกลับ HTTP
 */
const verifySerialKey = async (req, res) => {
  try {
    const { serialKey } = req.body;
    
    if (!serialKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing serialKey' 
      });
    }
    
    // ยืนยัน Serial Key
    const result = await authService.verifySerialKey(serialKey);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        error: result.message
      });
    }
    
    // ส่งข้อความยืนยันไปยังผู้ใช้
    await lineService.sendMessage(result.userId, {
      type: 'text',
      text: `การยืนยันสำเร็จ! ขอบคุณที่ใช้บริการของเรา`
    });
    
    // ตอบกลับไปยัง API
    return res.status(200).json({
      success: true,
      message: 'Serial Key verified successfully'
    });
  } catch (error) {
    console.error('Verify Serial Key Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

module.exports = {
  verifyRefCode,
  verifySerialKey
};
