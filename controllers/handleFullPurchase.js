
const { supabase } = require('../utils/supabaseClient');
const { uploadBase64ToSupabase } = require('../services/uploadService');
const { getNextLicenseNumber } = require('../services/licenseNumberService');
const axios = require('axios');

const handleFullPurchase = async (req, res) => {
  try {
    // ================= Logic 1 =================
    // 1.1 ตรวจสอบข้อมูล
    const {
      ref_code, first_name, last_name, national_id,
      address, postal_code, phone_number, email,
      file_name, file_content
    } = req.body;

    if (!ref_code || !first_name || !last_name || !national_id ||
        !address || !postal_code || !phone_number || !email ||
        !file_name || !file_content) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    // 1.2 ตรวจสอบ ref_code จาก auth_sessions
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล Ref Code ในระบบ' });
    }

    const line_user_id = session.line_user_id;

    // 1.3 อัปเดตข้อมูลลง auth_sessions
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        first_name, last_name, national_id,
        address, postal_code, phone_number, email,
        pdpa_status: 'TRUE'
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลลูกค้า' });
    }

    // ================ Logic 2 ================
    // 2.1 สร้าง license_no ใหม่
    const license_no = await getNextLicenseNumber();

    const { error: insertLicenseError } = await supabase
      .from('license_holders')
      .insert([{
        license_no,
        ref_code,
        line_user_id,
        first_name,
        last_name,
        national_id,
        address,
        postal_code,
        phone_number,
        email,
        is_verify: true,
        pdpa_status: 'TRUE'
      }]);

    if (insertLicenseError) {
      return res.status(500).json({ message: 'บันทึก license ไม่สำเร็จ' });
    }

    // ================ Logic 3 ================
    // 3.1 อัปโหลดรูปภาพ
    const publicUrl = await uploadBase64ToSupabase(file_content, `${license_no}-${ref_code}`);
    const product_source = 'ADT01';
    const slip_ref = `SLIP-${Date.now()}`;

    const { error: insertSlipError } = await supabase
      .from('slip_submissions')
      .insert([{
        slip_ref,
        first_name,
        last_name,
        national_id,
        phone_number,
        product_source,
        slip_image_url: publicUrl,
        submissions_status: 'pending',
        license_no,
        slip_path: file_name
      }]);

    if (insertSlipError) {
      return res.status(500).json({ message: 'บันทึกข้อมูลสลิปไม่สำเร็จ' });
    }

    // ส่ง POST ไป API2
    const flexRes = await axios.post(
      'https://line-bot-adt2.onrender.com/flex/send-order',
      {
        ref_code,
        first_name,
        last_name,
        address,
        phone_number,
        license_no,
        slip_url: publicUrl
      }
    );

    if (flexRes.status === 200) {
      return res.status(200).json({ message: 'ส่งข้อมูลสำเร็จ รอการตรวจสอบจากฝ่ายขาย' });
    } else {
      return res.status(500).json({ message: 'ส่งข้อมูลไปยัง BOT2 ไม่สำเร็จ' });
    }

  } catch (error) {
    console.error('Error in handleFullPurchase:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = handleFullPurchase;
