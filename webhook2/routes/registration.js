// registration.js - เส้นทางสำหรับจัดการการลงทะเบียน

const express = require('express');
const router = express.Router();
const { validateRegistrationData, sanitizeData } = require('../utils/validation');
const { saveRegistration, checkDuplicateRegistration } = require('../utils/database');
const { sendNewRegistrationNotification } = require('../utils/lineBot');

/**
 * POST /webhook2/register
 * รับข้อมูลการลงทะเบียนจาก VBA และดำเนินการลงทะเบียน
 */
router.post('/register', async (req, res) => {
  try {
    console.log('[Webhook2] Registration data received:', req.body);

    // ตรวจสอบความถูกต้องของข้อมูล
    const { isValid, errors } = validateRegistrationData(req.body);
    
    if (!isValid) {
      console.error('[Webhook2] Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง',
        errors
      });
    }

    // ทำความสะอาดข้อมูล
    const sanitizedData = sanitizeData(req.body);

    // ตรวจสอบการลงทะเบียนซ้ำ
    const isDuplicate = await checkDuplicateRegistration(
      sanitizedData.email, 
      sanitizedData.nationalId
    );

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'พบข้อมูลการลงทะเบียนซ้ำในระบบ'
      });
    }

    // บันทึกข้อมูลลงใน Supabase
    const registrationData = await saveRegistration(sanitizedData);

    // ส่งข้อความแจ้งเตือนผ่าน LINE Bot
    await sendNewRegistrationNotification(sanitizedData);

    // ตอบกลับสำเร็จ
    return res.status(200).json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
      data: {
        id: registrationData[0]?.id,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('[Webhook2] Registration error:', error);
    
    // ตอบกลับเมื่อเกิดข้อผิดพลาด
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลงทะเบียน',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /webhook2/healthcheck
 * ตรวจสอบสถานะการทำงานของ Webhook2
 */
router.get('/healthcheck', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Webhook2 is working',
    timestamp: new Date()
  });
});

module.exports = router;
