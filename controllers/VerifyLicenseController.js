const { supabase } = require('../utils/supabaseClient');
//---------------------------------------------------------------------------------------
// ฟังก์ชันสำหรับตรวจสอบใบอนุญาตด้วย license_no + national_id + phone_number
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;
    
    // ตรวจสอบว่ามีการส่งข้อมูลครบถ้วนหรือไม่
    if (!license_no || !national_id || !phone_number) {
      // เปลี่ยนจาก 400 เป็น 404
      return res.status(404).json({ message: 'Missing required fields.' });
    }
    
    // 1. ตรวจสอบหมายเลข license_no และสถานะ Pending
    const { data: licenseCheck, error: licenseError } = await supabase
      .from('license_holders')
      .select('license_no, status, verify_count')
      .eq('license_no', license_no)
      .single();
    
    // 1.1 ถ้าไม่พบหมายเลข license_no ในระบบ
    if (licenseError || !licenseCheck) {
      return res.status(404).json({ message: 'ไม่พบหมายเลขลิขสิทธิ์นี้ในระบบ' });
    }
    
    // 1.2 ถ้าสถานะไม่ใช่ Pending
    if (licenseCheck.status !== 'Pending') {
      return res.status(404).json({ message: 'ลิขสิทธิ์นี้ไม่อยู่ในสถานะที่สามารถตรวจสอบได้' });
    }
    
    // 2. ตรวจสอบ national_id และ phone_number
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();
    
    // 2.1 ถ้าข้อมูลครบถ้วนและถูกต้อง
    if (data) {
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`
      });
    }
    
    // 2.2 ถ้าข้อมูล national_id หรือ phone_number ไม่ตรง
    const verifyCount = licenseCheck.verify_count || 0;
    
    if (verifyCount < 3) {
      // อัปเดต verify_count
      await supabase
        .from('license_holders')
        .update({ verify_count: verifyCount + 1 })
        .eq('license_no', license_no);
      
      return res.status(404).json({
        message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง',
        verify_count: verifyCount + 1
      });
    } else {
      return res.status(404).json({ 
        message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด กรุณาติดต่อผู้ดูแลระบบ' 
      });
    }
    
  } catch (err) {
    console.error('❌ [VERIFY LICENSE1 ERROR]', err);
    // เปลี่ยนจาก 500 เป็น 404
    return res.status(404).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง' });
  }
};
//---------------------------------------------------------------------------------------

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
