const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

// ==============================
// Endpoint สำหรับตรวจสอบ Ref.Code และ Serial Key
// ==============================
router.post('/verify-license1', async (req, res) => {
  const { ref_code, serial_key } = req.body;

  // ตรวจสอบ Ref.Code และ Serial Key
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('ref_code, serial_key')
    .eq('ref_code', ref_code)
    .single();

  if (error || !data) {
    return res.status(400).json({ message: 'Invalid Ref.Code or Serial Key' });
  }

  // ตรวจสอบ Serial Key ว่าตรงหรือไม่
  if (data.serial_key !== serial_key) {
    return res.status(400).json({ message: 'Serial Key does not match the Ref.Code' });
  }

  // อัปเดตสถานะ `source` เป็น 'User_Verify_license' เมื่อข้อมูลถูกต้อง
  const { error: updateError } = await supabase
    .from('auth_sessions')
    .update({ source: 'User_Verify_license' })
    .eq('ref_code', ref_code);

  if (updateError) {
    return res.status(500).json({ message: 'Failed to update source status' });
  }

  // เมื่อได้รับข้อมูลถูกต้อง ให้ส่ง Status 200
  res.status(200).json({ message: 'Ref.Code and Serial Key validated successfully' });
});

// ==============================
// Endpoint สำหรับตรวจสอบข้อมูลจาก TextBox 4 รายการ
// ==============================
router.post('/verify-license2', async (req, res) => {
  const { first_name, last_name, phone_number, email } = req.body;

  // ตรวจสอบข้อมูลจาก Textbox ทั้ง 4
  if (!first_name || !last_name || !phone_number || !email) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // คุณสามารถเพิ่มการตรวจสอบอื่น ๆ ตามที่ต้องการที่นี่
  // เช่นการตรวจสอบ email หรือ phone_number format หรืออื่น ๆ

  // อัปเดตสถานะ `source` เป็น 'User_Verify_license' เมื่อข้อมูลครบถ้วน
  const { error: updateError } = await supabase
    .from('auth_sessions')
    .update({ source: 'User_Verify_license' })
    .eq('line_user_id', req.body.line_user_id);  // ใช้ line_user_id หรือ ref_code เพื่อเชื่อมโยงข้อมูล

  if (updateError) {
    return res.status(500).json({ message: 'Failed to update source status' });
  }

  // หลังจากตรวจสอบข้อมูลแล้ว ส่ง Status 200 เพื่อดำเนินการต่อ
  res.status(200).json({ message: 'License information validated successfully' });
});

module.exports = router;
