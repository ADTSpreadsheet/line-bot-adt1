// routes/verify-refcode.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');
const { createModuleLogger } = require('../utils/logger');
const log = createModuleLogger('ADTLine-Bot');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// Verify RefCode
router.post('/', async (req, res) => {
  const { refCode } = req.body;

  // ตรวจสอบว่ามี refCode หรือไม่
  if (!refCode) {
    return res.status(400).json({ 
      success: false, 
      message: 'กรุณาระบุ Ref.Code ให้ครบถ้วน' 
    });
  }

  try {
    // ค้นหา Ref.Code และ Serial Key
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key')
      .eq('ref_code', refCode)
      .single();

    // ตรวจสอบข้อผิดพลาด
    if (error) {
      console.log('Error:', error); // log ข้อผิดพลาด
      return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }

    // เช็คผลลัพธ์จากฐานข้อมูล
    if (!data) {
      console.log('No data found for refCode:', refCode);  // log เมื่อไม่พบข้อมูล
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล Ref.Code นี้' });
    }

    // ส่งข้อมูล Serial Key กลับไป
    return res.status(200).json({ success: true, serial_key: data.serial_key });

  } catch (err) {
    console.log('Unexpected error:', err); // log ข้อผิดพลาดที่ไม่คาดคิด
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' 
    });
  }
});


module.exports = router;
