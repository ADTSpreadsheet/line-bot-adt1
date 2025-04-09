const { supabase } = require('../utils/supabaseClient');
//---------------------------------------------------------------------------------------
// ฟังก์ชันสำหรับตรวจสอบใบอนุญาตด้วย license_no + national_id + phone_number
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;
    if (!license_no || !national_id || !phone_number) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    // ตรวจสอบข้อมูลจาก license_holders
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count, is_verify')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();
    
    // ✅ เคส: ถ้าข้อมูลถูกต้อง
    if (data) {
      if (data.is_verify === true) {
        return res.status(409).json({ message: 'License already verified.' });
      }
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`
      });
    }
    
    // ❌ เคส: ข้อมูลไม่ตรง
    // ดึง verify_count จาก license_no อย่างเดียว
    const { data: fallback, error: fallbackError } = await supabase
      .from('license_holders')
      .select('verify_count')
      .eq('license_no', license_no)
      .single();
    
    // ถ้าไม่มี license นี้อยู่เลย → FrameNotFound
    if (fallbackError || !fallback) {
      return res.status(403).json({ message: 'ไม่พบหมายเลขลิขสิทธิ์นี้ในระบบ' });
    }
    
    const verifyCount = fallback.verify_count || 0;
    if (verifyCount < 3) {
      // อัปเดต verify_count
      await supabase
        .from('license_holders')
        .update({ verify_count: verifyCount + 1 })
        .eq('license_no', license_no);
      
      return res.status(404).json({
        message: 'กรุณาลองใหม่ได้อีก 1/3 ครั้ง',
        verify_count: verifyCount + 1
      });
    } else {
      return res.status(403).json({ message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด' });
    }
  } catch (err) {
    console.error('❌ [VERIFY LICENSE1 ERROR]', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ฟังก์ชันสำหรับตรวจสอบอีกเคสหนึ่ง (ตามที่จะระบุเงื่อนไขภายหลัง)
const verifyLicense2 = async (req, res) => {
  try {
    // รับพารามิเตอร์จาก request
    const { license_no, some_other_param } = req.body;
    
    if (!license_no || !some_other_param) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    // โค้ดสำหรับตรวจสอบตามเงื่อนไขที่จะระบุภายหลัง
    // ตัวอย่าง (สามารถปรับเปลี่ยนตามความต้องการ)
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, is_verify')
      .eq('license_no', license_no)
      .eq('some_other_field', some_other_param)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลที่ตรงกัน' });
    }
    
    return res.status(200).json({
      license_no: data.license_no,
      full_name: `${data.first_name} ${data.last_name}`
    });
    
  } catch (err) {
    console.error('❌ [VERIFY LICENSE2 ERROR]', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ฟังก์ชันสำหรับตรวจสอบ Ref.Code และ Serial Key
const verifyRefCodeAndSerial = async (req, res) => {
  try {
    const { ref_code, serial_key } = req.body;
    
    if (!ref_code || !serial_key) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    
    const { data, error } = await supabase
      .from('serial_keys')  // ปรับชื่อตารางตามที่ใช้จริง
      .select('ref_code, serial_key, is_activated')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ message: 'Ref Code หรือ Serial Key ไม่ถูกต้อง' });
    }
    
    if (data.is_activated) {
      return res.status(409).json({ message: 'Serial Key นี้ถูกใช้งานแล้ว' });
    }
    
    // อัปเดตสถานะเป็นใช้งานแล้ว
    await supabase
      .from('serial_keys')
      .update({ is_activated: true, activated_at: new Date() })
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key);
    
    return res.status(200).json({
      message: 'ลงทะเบียนสำเร็จ',
      ref_code: data.ref_code
    });
    
  } catch (err) {
    console.error('❌ [VERIFY REF CODE AND SERIAL ERROR]', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

//---------------------------------------------------------------------------------------

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
