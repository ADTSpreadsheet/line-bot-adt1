const express = require('express');
const router = express.Router();
const { pool } = require('../db/postgres');
const line = require('@line/bot-sdk');

// Logger สำหรับการบันทึกข้อมูล
const { createModuleLogger } = require('../utils/logger');
const verifyLog = createModuleLogger('VerifyRefcode');

// ตั้งค่า LINE API
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// POST: /verify-refcode
router.post('/', async (req, res) => {
  const { refCode } = req.body;

  // Log ข้อมูลการเข้ามาของคำขอ
  verifyLog.info(`Received verification request with Ref.Code: ${refCode}`);

  // ตรวจสอบว่าได้รับ refCode หรือไม่
  if (!refCode) {
    verifyLog.error('Missing Ref.Code in request');
    return res.status(400).json({ 
      success: false, 
      message: 'Missing Ref.Code' 
    });
  }

  try {
    // ค้นหาข้อมูลจากฐานข้อมูล
    const query = 'SELECT * FROM auth_sessions WHERE ref_code = $1';
    verifyLog.debug(`Executing query: ${query} with params: [${refCode}]`);

    const result = await pool.query(query, [refCode]);

    // ถ้าไม่พบข้อมูล
    if (result.rows.length === 0) {
      verifyLog.warn(`Invalid Ref.Code: ${refCode} - not found in auth_sessions table`);
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid Ref.Code or this user was not found in the system.' 
      });
    }

    // ข้อมูลผู้ใช้ที่พบ
    const userData = result.rows[0];
    verifyLog.info(`Found Ref.Code ${refCode} in auth_sessions table, Line User ID: ${userData.line_user_id}, Serial Key: ${userData.serial_key}`);

    // อัปเดตข้อมูลการใช้งาน
    try {
      await pool.query(
        'UPDATE auth_sessions SET verify_count = COALESCE(verify_count, 0) + 1, verify_timestamp = NOW() WHERE ref_code = $1', 
        [refCode]
      );
      verifyLog.info(`Updated verify_count for Ref.Code: ${refCode}`);
    } catch (updateError) {
      verifyLog.error(`Error updating verify_count in auth_sessions: ${updateError.message}`);
    }

    // ส่ง Serial Key ไปที่ LINE
    try {
      await client.pushMessage(userData.line_user_id, {
        type: 'text',
        text: `🔐 Serial Key ของคุณคือ: ${userData.serial_key}`
      });
      verifyLog.info(`Sent Serial Key to Line User ID: ${userData.line_user_id}`);
    } catch (lineError) {
      verifyLog.error(`Error sending Serial Key to Line: ${lineError.message}`);
    }

    // ตอบกลับการยืนยันสำเร็จ
    verifyLog.info(`Verification successful for Ref.Code: ${refCode}`);
    return res.status(200).json({
      success: true,
      serialKey: userData.serial_key,
      countdown: 'Serial Key จะหมดอายุใน: 10:00 นาที',
      stage3: 'Serial Key ได้ถูกส่งไปยังแชทไลน์ของคุณแล้ว กรุณาตรวจสอบและนำมากรอกด้านล่าง'
    });

  } catch (error) {
    verifyLog.error(`Database error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying Ref.Code'
    });
  }
});

module.exports = router;
