const { supabase } = require('../utils/supabaseClient');

//---------------------------------------------------------------------------------------

const verifyLicense = async (req, res) => {
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
    console.error('❌ [VERIFY LICENSE ERROR]', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
//---------------------------------------------------------------------------------------

// Export functions
module.exports = {
  verifyLicense1,
  verifyLicense2
};
