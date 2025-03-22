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
      return res.status(400).json({ error: 'Missing refCode' });
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
    console.error
