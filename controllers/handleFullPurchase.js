const { supabase } = require('../utils/supabaseClient');
const axios = require('axios');
const { getNextLicenseNumber } = require('../services/licenseService');

const handleFullPurchase = async (req, res) => {
  console.log("🟡 เริ่ม Logic1: ตรวจสอบข้อมูลที่รับจากฟอร์ม");

  const { first_name, last_name, national_id, phone_number, ref_code, product_source } = req.body;

  if (!first_name || !last_name || !national_id || !phone_number || !ref_code || !product_source) {
    console.log("❌ ข้อมูลไม่ครบ");
    return res.status(400).json({ message: 'กรอกข้อมูลไม่ครบ กรุณาลองใหม่อีกครั้ง' });
  }

  // 🔵 Logic 2: อัปเดตข้อมูลใน auth_sessions
  console.log("🟡 เริ่ม Logic2: ตรวจสอบ ref_code ใน auth_sessions");
  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('ref_code', ref_code)
    .single();

  if (sessionError || !sessionData) {
    console.log("❌ ไม่พบข้อมูล Ref.Code:", ref_code);
    return res.status(404).json({ message: 'ไม่พบ Ref.Code ในระบบ' });
  }

  const line_user_id = sessionData.line_user_id;

  const { error: updateError } = await supabase
    .from('auth_sessions')
    .update({
      first_name,
      last_name,
      national_id,
      phone_number,
      source: 'full_customer',
      pdpa_status: true
    })
    .eq('ref_code', ref_code);

  if (updateError) {
    console.log("❌ อัปเดตข้อมูลใน auth_sessions ไม่สำเร็จ");
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลลูกค้า' });
  }

  // 🟢 Logic 3: สร้าง license ใหม่ใน license_holders
  console.log("🟡 เริ่ม Logic3: สร้าง license_no ใหม่");

  const license_no = await getNextLicenseNumber();

  const { error: insertLicenseError } = await supabase
    .from('license_holders')
    .insert([{
      license_no,
      ref_code,
      national_id,
      phone_number,
      first_name,
      last_name,
      line_user_id,
      product_source,
      is_verify: true,
      pdpa_status: true
    }]);

  if (insertLicenseError) {
    console.log("❌ เกิดข้อผิดพลาดในการเพิ่ม license:", insertLicenseError);
    return res.status(500).json({ message: 'เพิ่ม license ไม่สำเร็จ' });
  }

  // 🟣 Logic 4: เพิ่มข้อมูลใน slip_submissions
  console.log("🟡 เริ่ม Logic4: บันทึกข้อมูล slip_submissions");

  const { error: insertSlipError } = await supabase
    .from('slip_submissions')
    .insert([{
      license_no,
      product_source,
      submissions_status: 'pending'
    }]);

  if (insertSlipError) {
    console.log("❌ บันทึก slip ไม่สำเร็จ");
    return res.status(500).json({ message: 'บันทึก slip ไม่สำเร็จ' });
  }

  // 🚀 ส่ง POST ไปยัง API2 เพื่อให้ Bot2 ส่ง Flex
  console.log("🟢 ส่ง POST ไปยัง API2 เพื่อให้ Bot ส่ง Flex");
  try {
    await axios.post('https://line-bot-adt2.onrender.com/flex/send-order', {
      ref_code
    });
    console.log("✅ ส่งไปยัง API2 สำเร็จ");
    return res.status(200).json({ message: 'ระบบบันทึกข้อมูลสำเร็จแล้ว และส่งแจ้งเตือนไปยังทีมงานแล้ว' });
  } catch (api2Error) {
    console.log("❌ ส่ง POST ไป API2 ไม่สำเร็จ:", api2Error.message);
    return res.status(500).json({ message: 'บันทึกข้อมูลสำเร็จ แต่ไม่สามารถแจ้งเตือนไปยังทีมงานได้' });
  }
};

module.exports = { handleFullPurchase };
