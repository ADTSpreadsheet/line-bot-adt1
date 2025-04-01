const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// สร้างการเชื่อมต่อกับฐานข้อมูล PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ฟังก์ชั่นสำหรับบันทึก log
const { createModuleLogger } = require('../utils/logger');
const verifyLog = createModuleLogger('VerifyRefcode');

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
    // ค้นหา Ref.Code ในฐานข้อมูล
    const query = 'SELECT * FROM public WHERE ref_code = $1';
    verifyLog.debug(`Executing query: ${query} with params: [${refCode}]`);
    
    const result = await pool.query(query, [refCode]);
    
    // ตรวจสอบว่าพบข้อมูลหรือไม่
    if (result.rows.length === 0) {
      verifyLog.warn(`Invalid Ref.Code: ${refCode} - not found in database`);
      return res.status(404).json({ 
        success: false, 
        message: "Invalid Ref.Code or this user was not found in the system." 
      });
    }
    
    const userData = result.rows[0];
    verifyLog.info(`Found Ref.Code ${refCode} in database, user: ${userData.line_user_id}`);
    
    // อัพเดตข้อมูลการใช้งาน
    try {
      await pool.query(
        'UPDATE public SET verify_count = COALESCE(verify_count, 0) + 1, verify_timestamp = NOW() WHERE ref_code = $1', 
        [refCode]
      );
      verifyLog.info(`Updated verify_count for Ref.Code: ${refCode}`);
    } catch (updateError) {
      verifyLog.error(`Error updating verify_count: ${updateError.message}`);
      // ทำการดำเนินการต่อแม้จะอัพเดตไม่สำเร็จ
    }
    
    // ตอบกลับว่าการยืนยันสำเร็จ
    verifyLog.info(`Verification successful for Ref.Code: ${refCode}`);
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
