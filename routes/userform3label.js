const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

router.post('/get-message', async (req, res) => {
  const { lineUserId } = req.body;

  const responseMessage = {
    stage1: 'กรุณาพิมพ์ข้อความ REQ_REFCODE ในแชทไลน์เพื่อขอรับ รหัส Ref.Code',
    stage2: 'กรุณากรอกรหัส Ref.Code ที่ท่านได้จากแชท แล้วกดปุ่ม Verify Code',
    stage3: 'กรุณากรอกรหัส Serial Key ที่ได้จากแชท แล้วกดปุ่ม Confirm เพื่อทำการยืนยันตัวตน'
  };

  // ✅ กรณียังไม่มี lineUserId → ส่ง stage1 กลับไปทันที
  if (!lineUserId) {
    return res.status(200).json({
      success: true,
      message: responseMessage
    });
  }

  // ✅ ดึงข้อมูลจาก Supabase ด้วย lineUserId
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('status, ref_code, serial_key, expires_at')
    .eq('line_user_id', lineUserId)
    .single();

  // ❌ ถ้าไม่พบข้อมูล → ส่ง stage1 + แจ้งเตือนเพิ่ม
  if (error || !data) {
    return res.status(200).json({
      success: true,
      message: {
        ...responseMessage,
        stage3: 'ยังไม่พบข้อมูลการลงทะเบียน กรุณาพิมพ์ REQ_REFCODE อีกครั้ง'
      }
    });
  }

  // ✅ ถ้ามีข้อมูล → คำนวณเวลาถอยหลัง
  const { ref_code, serial_key, expires_at } = data;
  const remainingTime = new Date(expires_at) - new Date();

  if (remainingTime <= 0) {
    return res.status(200).json({
      success: true,
      message: {
        ...responseMessage,
        stage3: '❌ รหัส Serial Key ของท่านหมดอายุแล้ว'
      }
    });
  }

  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  const countdownMessage = `⏳ รหัส Serial Key ของท่านจะหมดอายุภายใน ${minutes} นาที ${seconds} วินาที`;

  return res.status(200).json({
    success: true,
    message: {
      ...responseMessage,
      ref_code,
      serial_key,
      stage2: 'กรุณากรอกรหัส Ref.Code ของท่านและกดปุ่ม Verify Code',
      stage3: countdownMessage
    }
  });
});

module.exports = router;
