const express = require('express');
const router = express.Router();
const { pool } = require('../db/postgres');

// สร้าง Logger ถ้ามีในระบบของคุณ
const { createModuleLogger } = require('../utils/logger');
const verifyLog = createModuleLogger('VerifyRefcode');

router.post('/', async (req, res) => {
  const { refCode } = req.body;
  
  verifyLog.info(`Received verification request with Ref.Code: ${refCode}`);
  
  // ตรวจสอบว่ามีการส่ง refCode มาหรือไม่
  if (!refCode) {
    verifyLog.error('Missing Ref.Code in request');
    return res.status(400).json({ 
      success: false, 
      message: "Missing Ref.Code" 
    });
  }
  
  try {
    // ค้นหา Ref.Code ในตาราง auth_sessions
    const query = 'SELECT * FROM auth_sessions WHERE ref_code = $1';
    verifyLog.debug(`Executing query: ${query} with params: [${refCode}]`);
    
    const result = await pool.query(query, [refCode]);
    
    // ตรวจสอบว่าพบข้อมูลหรือไม่
    if (result.rows.length === 0) {
      verifyLog.warn(`Invalid Ref.Code: ${refCode} - not found in auth_sessions table`);
      return res.status(404).json({ 
        success: false, 
        message: "Invalid Ref.Code or this user was not found in the system." 
      });
    }
    
    const userData = result.rows[0];
    verifyLog.info(`Found Ref.Code ${refCode} in auth_sessions table, Line User ID: ${userData.line_user_id}, Serial Key: ${userData.serial_key}`);
    
    // อัพเดตข้อมูลการใช้งานในตาราง auth_sessions
    try {
      await pool.query(
        'UPDATE auth_sessions SET verify_count = COALESCE(verify_count, 0) + 1, verify_timestamp = NOW() WHERE ref_code = $1', 
        [refCode]
      );
      verifyLog.info(`Updated verify_count for Ref.Code: ${refCode} in auth_sessions table`);
    } catch (updateError) {
      verifyLog.error(`Error updating verify_count in auth_sessions: ${updateError.message}`);
      // ทำการดำเนินการต่อแม้จะอัพเดตไม่สำเร็จ
    }
    
    // ตอบกลับว่าการยืนยันสำเร็จ
    verifyLog.info(`Verification successful for Ref.Code: ${refCode}`);
    return res.status(200).json({
      success: true,
      serialKey: userData.serial_key, // ส่ง Serial Key กลับไปด้วย
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
