const { supabase } = require('../utils/supabaseClient');

//---------------------------------------------------------------------------------------

// ฟังก์ชันตรวจสอบ Ref.Code และ Serial Key
const verifyLicense1 = async (req, res) => {
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
};

//---------------------------------------------------------------------------------------

// ฟังก์ชันตรวจสอบข้อมูลจาก TextBox 4 รายการ
const verifyLicense2 = async (req, res) => {
  const { first_name, last_name, phone_number, license_no } = req.body;
  
  // ตรวจสอบข้อมูลครบถ้วน
  if (!licenseno || !firstname || !lastname || !phonenumber) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // ค้นหาข้อมูลใบอนุญาตในฐานข้อมูล
  const { data: licenseData, error: licenseError } = await supabase
    .from('license_holders1')
    .select('licenseno, firstname, lastname, phonenumber, attempt_count')
    .eq('licenseno', licenseno.trim())
    .single();

  if (licenseError || !licenseData) {
    return res.status(400).json({ message: 'License number not found' });
  }

  // ตรวจสอบจำนวนครั้งที่ผิด
  if (licenseData.attempt_count >= 3) {
    return res.status(400).json({ message: 'Too many incorrect attempts. Please contact support.' });
  }

  // ตรวจสอบข้อมูลผู้ใช้
  const isFirstNameMatch = licenseData.firstname.trim().toLowerCase() === first_name.trim().toLowerCase();
  const isLastNameMatch = licenseData.lastname.trim().toLowerCase() === last_name.trim().toLowerCase();
  const isPhoneMatch = licenseData.phonenumber.trim() === phone_number.trim();

  // ถ้าข้อมูลไม่ตรง
  if (!isFirstNameMatch || !isLastNameMatch || !isPhoneMatch) {
    
    // เพิ่มจำนวนครั้งที่ผิด
    await supabase
      .from('license_holders1')
      .update({ attempt_count: licenseData.attempt_count + 1 })
      .eq('licenseno', licenseno);

    return res.status(400).json({ 
      message: 'Information does not match exactly. You have ' + (3 - licenseData.attempt_count) + ' attempts left.'
    });
  }

  // ถ้าข้อมูลตรงทั้งหมด
  await supabase
    .from('auth_sessions')
    .update({ source: 'User_Verify_license' })
    .eq('licenseno', licenseno);

  res.status(200).json({ message: 'License information validated successfully' });
};

//---------------------------------------------------------------------------------------

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2
};
