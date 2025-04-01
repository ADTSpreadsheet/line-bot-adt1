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
  const { refCode, lineUserId } = req.body;

  if (!refCode || !lineUserId) {
    return res.status(400).json({ 
      success: false, 
      message: 'กรุณาระบุ Ref.Code และ Line User ID ให้ครบถ้วน' 
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

    // ส่ง Serial Key ไปที่ไลน์
    const serialKey = data.serial_key;
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: `🔐 Serial Key ของคุณคือ: ${serialKey}`
    });

    // อัปเดตสถานะในฐานข้อมูล
    await supabase
      .from('auth_sessions')
      .update({ status: 'REFCODE_VERIFIED' })
      .eq('ref_code', refCode)
      .eq('line_user_id', lineUserId);

    // Log & Response
    log.success(`✅ ยืนยัน Ref.Code เรียบร้อย: ${refCode}`);
    res.status(200).json({ 
      success: true, 
      message: 'ยืนยัน Ref.Code สำเร็จ และส่ง Serial Key ไปทางไลน์แล้ว' 
    });

  } catch (err) {
    log.error('เกิดข้อผิดพลาดใน /verify-refcode:', err);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' 
    });
  }
});


module.exports = router;
