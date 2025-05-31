const { supabase } = require('../utils/supabaseClient');
const { uploadBase64ImageToSupabase } = require('../utils/uploadSlipToSupabase');

const handleFullPurchase = async (req, res) => {
  try {
    const {
      ref_code, first_name, last_name, address, postal_code,
      phone_number, email, national_id, file_name, file_content
    } = req.body;

    // Logic 1: ตรวจสอบความครบ
    if (!ref_code || !first_name || !last_name || !address || !postal_code || !phone_number) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    }

    // Logic 2: ตรวจสอบ auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้จาก Ref.Code' });
    }

    // อัปเดต auth_sessions
    await supabase
      .from('auth_sessions')
      .update({ first_name, last_name, phone_number, postal_code, email, national_id })
      .eq('ref_code', ref_code);

    // Logic 3: รัน license ใหม่
    const { data: allLicenses } = await supabase
      .from('license_holders')
      .select('license_no');

    const maxNum = allLicenses
      .map(row => parseInt(row.license_no.replace('ADT', ''), 10))
      .filter(num => !isNaN(num))
      .reduce((max, num) => Math.max(max, num), 0);

    const newLicenseNo = `ADT${(maxNum + 1).toString().padStart(3, '0')}`;

    // Logic 4: บันทึกลง license_holders
    await supabase.from('license_holders').insert([{
      license_no: newLicenseNo,
      ref_code,
      first_name,
      last_name,
      national_id,
      phone_number,
      email,
      address,
      postal_code,
      line_user_id: sessionData.line_user_id,
      pdpa_status: true,
      is_verify: true
    }]);

    // Logic 5.1: insert ข้อมูล slip เบื้องต้น
    let productSource = sessionData?.product_source || 'ADT-01-5500';

    await supabase.from('slip_submissions').insert([{
      ref_code,
      first_name,
      last_name,
      national_id,
      phone_number,
      license_no: newLicenseNo,
      product_source: productSource
    }]);

    // Logic 5.2: upload slip image → สร้างชื่อใหม่
    const slipFileName = `ADT-01-${newLicenseNo}-SLP-${ref_code}.jpg`;

    const uploadResult = await uploadBase64ImageToSupabase({
      base64String: file_content,
      fileName: slipFileName,
      bucket: 'adtpayslip'
    });

    if (!uploadResult.success) {
      return res.status(500).json({ message: 'อัปโหลดสลิปไม่สำเร็จ' });
    }

    const slipImageUrl = uploadResult.publicUrl;

    // อัปเดต slip_submissions ด้วย URL + สถานะ
    const { error: updateError } = await supabase
      .from('slip_submissions')
      .update({
        slip_image_url: slipImageUrl,
        slip_path: slipFileName,
        submissions_status: 'pending'
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      return res.status(500).json({ message: 'อัปเดตข้อมูลสลิปไม่สำเร็จ' });
    }

    return res.status(200).json({
      message: 'บันทึกข้อมูลทั้งหมดสำเร็จแล้ว',
      license_no: newLicenseNo
    });

  } catch (err) {
    console.error('❌ ERROR:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = handleFullPurchase;
