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
  try {
    const { first_name, last_name, phone_number, license_no } = req.body;

    // ตรวจสอบข้อมูลครบ
    if (!license_no || !first_name || !last_name || !phone_number) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ค้นหาในฐานข้อมูล
    const { data: licenseData, error: licenseError } = await supabase
      .from('license_holders1')
      .select('license_no, first_name, last_name, phone_number, attempt_count')
      .eq('license_no', license_no.trim())
      .single();

    if (licenseError || !licenseData) {
      return res.status(400).json({ message: 'License number not found' });
    }

    // ตรวจจำนวนครั้งที่ผิด
    if (licenseData.attempt_count >= 3) {
      return res.status(400).json({ message: 'Too many incorrect attempts. Please contact support.' });
    }

    // ตรวจข้อมูลตรงไหม
    const isFirstNameMatch = licenseData.first_name.trim().toLowerCase() === first_name.trim().toLowerCase();
    const isLastNameMatch = licenseData.last_name.trim().toLowerCase() === last_name.trim().toLowerCase();
    const isPhoneMatch = licenseData.phone_number.trim() === phone_number.trim();

    if (!isFirstNameMatch || !isLastNameMatch || !isPhoneMatch) {
      await supabase
        .from('license_holders1')
        .update({ attempt_count: licenseData.attempt_count + 1 })
        .eq('license_no', license_no);

      return res.status(400).json({
        message: `Information does not match. You have ${3 - licenseData.attempt_count} attempts left.`,
      });
    }

    // ถ้าผ่าน → update session
    await supabase
      .from('auth_sessions')
      .update({ source: 'User_Verify_license' })
      .eq('license_no', license_no);

    return res.status(200).json({ message: 'License information validated successfully' });
  } catch (error) {
    console.error('🔥 [VERIFY LICENSE] CRASH:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


//---------------------------------------------------------------------------------------

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2
};
