const { supabase } = require('../utils/supabaseClient');

// ฟังก์ชันหลักสำหรับตรวจสอบใบอนุญาตด้วย license_no, national_id และ phone_number
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;
    
    // ตรวจสอบว่ามีการส่งข้อมูลครบถ้วนหรือไม่
    if (!license_no || !national_id || !phone_number) {
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
      return res.status(404).json({ message: 'ลิขสิทธิ์นี้ได้ทำการยืนยันสำเร็จแล้ว' });
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
    
    if (verifyCount < 2) {  // เปลี่ยนเป็น < 2 เพราะเราจะเพิ่มค่าอีก 1 ทำให้สูงสุดเป็น 3
      // อัปเดต verify_count
      await supabase
        .from('license_holders')
        .update({ verify_count: verifyCount + 1 })
        .eq('license_no', license_no);
      
      return res.status(404).json({
        message: 'ข้อมูลลิขสิทธิ์ของคุณไม่ถูกต้อง',
        verify_count: verifyCount + 1,
        attempts_remaining: `กรุณาลองใหม่อีก ${3 - (verifyCount + 1)}/3`
      });
    } else {
      // ถ้าลองเกิน 3 ครั้ง (หลังจากอัปเดตเป็น 3 แล้ว)
      await supabase
        .from('license_holders')
        .update({ verify_count: 3 })  // ล็อคที่ 3 ครั้ง
        .eq('license_no', license_no);
        
      return res.status(403).json({  // ใช้รหัส 403 แทน 404
        message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด กรุณาติดต่อผู้ดูแลระบบ' 
      });
    }
    
  } catch (err) {
    console.error('❌ [VERIFY LICENSE1 ERROR]', err);
    return res.status(404).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง' });
  }
};

// ฟังก์ชันสำหรับตรวจสอบใบอนุญาตด้วยวิธีที่ 2 (เตรียมไว้สำหรับใช้งานในอนาคต)
const verifyLicense2 = async (req, res) => {
  try {
    // เตรียมไว้สำหรับการตรวจสอบในรูปแบบที่ 2
    // เช่น ตรวจสอบด้วย email + license_no หรือวิธีอื่นๆ
    
    // สำหรับตอนนี้ส่งข้อความแจ้งว่าฟังก์ชันนี้ยังไม่พร้อมใช้งาน
    return res.status(200).json({ 
      message: 'ฟังก์ชัน verifyLicense2 อยู่ระหว่างการพัฒนา'
    });
  } catch (err) {
    console.error('❌ [VERIFY LICENSE2 ERROR]', err);
    return res.status(404).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง' });
  }
};

// ฟังก์ชันสำหรับตรวจสอบ Ref.Code และ Serial Key
const verifyRefCodeAndSerial = async (req, res) => {
  try {
    const { ref_code, serial_key } = req.body;
    
    if (!ref_code || !serial_key) {
      return res.status(404).json({ message: 'กรุณาระบุ Ref.Code และ Serial Key' });
    }
    
    // เตรียมไว้สำหรับการตรวจสอบ Ref.Code และ Serial Key
    // เช่น ตรวจสอบว่ามีคู่ Ref.Code และ Serial Key นี้ในฐานข้อมูลหรือไม่
    
    // สำหรับตอนนี้ส่งข้อความแจ้งว่าฟังก์ชันนี้ยังไม่พร้อมใช้งาน
    return res.status(200).json({ 
      message: 'ฟังก์ชัน verifyRefCodeAndSerial อยู่ระหว่างการพัฒนา'
    });
  } catch (err) {
    console.error('❌ [VERIFY REF CODE AND SERIAL ERROR]', err);
    return res.status(404).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง' });
  }
};

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
