const express = require('express');
const router = express.Router();

// ฟังก์ชั่นสำหรับบันทึก log
const { createModuleLogger } = require('../utils/logger');
const verifyLog = createModuleLogger('VerifyRefcode');

// นำเข้าการเชื่อมต่อฐานข้อมูลที่มีอยู่แล้ว (ปรับให้ตรงกับโครงสร้างของคุณ)
const db = require('../db'); // หรือเส้นทางที่ถูกต้องที่มีการเชื่อมต่อฐานข้อมูลของคุณ

// สร้าง route สำหรับ POST request
router.post('/', async (req, res) => {
  const { refCode } = req.body;
  
  // ตรวจสอบว่ามีการส่ง refCode มาหรือไม่
  if (!refCode) {
    verifyLog.error('Missing Ref.Code in request');
    return res.status(400).json({ 
      success: false, 
      message: "Missing Ref.Code" 
    });
  }
  
  verifyLog.info(`Received verification request for Ref.Code: ${refCode}`);
  
  try {
    // ค้นหา Ref.Code ในฐานข้อมูล (ปรับชื่อตารางให้ตรงกับของคุณ)
    const result = await db.query('SELECT * FROM your_actual_table_name WHERE ref_code = $1', [refCode]);
    
    // ตรวจสอบว่าพบข้อมูลหรือไม่
    if (result.rows.length === 0) {
      verifyLog.warn(`Invalid Ref.Code: ${refCode} - not found in database`);
      return res.status(404).json({ 
        success: false, 
        message: "Invalid Ref.Code or this user was not found in the system." 
      });
    }
    
    verifyLog.info(`Found Ref.Code ${refCode} in database`);
    
    // ตอบกลับว่าการยืนยันสำเร็จ
    return res.status(200).json({
      success: true,
      countdown: "Serial Key จะหมดอายุใน: 10:00 นาที",
      stage3: "Serial Key ได้ถูกส่งไปยังแชทไลน์ของคุณแล้ว กรุณาตรวจสอบและนำมากรอกด้านล่าง"
    });
    
  } catch (error) {
    verifyLog.error(`Database error: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: "Server error while verifying Ref.Code" 
    });
  }
});

module.exports = router;
