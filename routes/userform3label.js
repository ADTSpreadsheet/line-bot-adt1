const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

// ฟังก์ชันที่ใช้ในการดึงข้อความที่เกี่ยวกับการนับถอยหลังจาก API
router.post('/get-message', async (req, res) => {
  try {
    const { lineUserId } = req.body;

    if (!lineUserId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: lineUserId',
      });
    }

    // ดึงข้อมูลที่เกี่ยวข้องจาก Supabase
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('status, ref_code, serial_key, expires_at')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !data) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch data from the database.',
      });
    }

    const { ref_code, serial_key, status, expires_at } = data;

    // คำนวณเวลาหมดอายุ
    const remainingTime = new Date(expires_at) - new Date();

    // ถ้าเวลาหมดอายุแล้ว
    if (remainingTime <= 0) {
      return res.status(200).json({
        success: true,
        message: '❌ รหัส Serial Key ของท่านหมดอายุแล้ว',
      });
    }

    // ส่งข้อความการนับถอยหลัง
    const minutesRemaining = Math.floor(remainingTime / 60000); // นาที
    const secondsRemaining = Math.floor((remainingTime % 60000) / 1000); // วินาที

    const countdownMessage = `⏳ รหัส Serial Key ของท่านจะหมดอายุภายใน ${minutesRemaining} นาที ${secondsRemaining} วินาที`;

    // ส่งข้อมูล Ref.Code, Serial Key, และข้อความการนับถอยหลัง
    return res.status(200).json({
      success: true,
      message: {
        stage1: 'กรุณาพิมพ์ข้อความ REQ_CODE ในแชทไลน์เพื่อขอรับ รหัส Ref.Code',
        stage2: 'กรุณากรอกรหัส Ref.Code ของท่านและกดปุ่ม Verify Code',
        stage3: countdownMessage,
        ref_code,
        serial_key,
      },
    });
  } catch (error) {
    console.error('Error in get-message:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred.',
    });
  }
});

module.exports = router;
