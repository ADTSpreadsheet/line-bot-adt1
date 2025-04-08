const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

// ==============================
// Endpoint สำหรับตรวจสอบ Ref.Code และ Serial Key
// ==============================
router.post('/verify-license1', async (req, res) => {
  const { ref_code, serial_key } = req.body;

  // ตรวจสอบ Ref.Code และ Serial Key
  const { data: refData, error: refError } = await supabase
    .from('auth_sessions')
    .select('ref_code, serial_key')
    .eq('ref_code', ref_code)
    .single();

  if (refError || !refData) {
    return res.status(400).json({ message: 'Invalid Ref.Code or Serial Key' });
  }

  // ตรวจสอบ Serial Key ว่าตรงหรือไม่
  if (refData.serial_key !== serial_key) {
    return res.status(400).json({ message: 'Serial Key does not match the Ref.Code' });
  }

  // ตรวจสอบข้อมูลในตาราง license_holders1
  const { data: licenseData, error: licenseError } = await supabase
    .from('license_holders1')
    .select('licenseno, firstname, lastname, phonenumber')
    .eq('licenseno', req.body.licenseno)
    .eq('firstname', req.body.first_name)
    .eq('lastname', req.body.last_name)
    .eq('phonenumber', req.body.phone_number)
    .single();

  if (licenseError || !licenseData) {
    return res.status(400).json({ message: 'No matching license found in the database' });
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
  const { first_name, last_name, phone_number, licenseno } = req.body;

  // ตรวจสอบข้อมูลจาก Textbox ทั้ง 4
  if (!licenseno || !first_name || !last_name || !phone_number) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // อัปเดตสถานะ `source` เป็น 'User_Verify_license' เมื่อข้อมูลครบถ้วน
  const { error: updateError } = await supabase
    .from('auth_sessions')
    .update({ source: 'User_Verify_license' })
    .eq('licenseno', licenseno);  // ใช้ licenseno หรือ ref_code เพื่อเชื่อมโยงข้อมูล

  if (updateError) {
    return res.status(500).json({ message: 'Failed to update source status' });
  }

  // หลังจากตรวจสอบข้อมูลแล้ว ส่ง Status 200 เพื่อดำเนินการต่อ
  res.status(200).json({ message: 'License information validated successfully' });
});

module.exports = {
  verifyLicense1: router.post('/verify-license1', verifyLicense1),
  verifyLicense2: router.post('/verify-license2', verifyLicense2)
};
