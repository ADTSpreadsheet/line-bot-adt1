// 👉 นำเข้า Supabase และฟังก์ชันอัปโหลดภาพ
const { supabase } = require('../utils/supabaseClient');
const { uploadBase64ImageToSupabase } = require('../utils/uploadSlipToSupabase');

// 👉 ฟังก์ชันหลัก
const handleFullPurchase = async (req, res) => {
  try {
    // 🟡 STEP 1: รับค่าจากฟอร์ม
    const {  
      ref_code, first_name, last_name, address, postal_code, 
      phone_number, email, national_id, file_name, file_content 
    } = req.body;

    // 🔍 Logic 1: ตรวจสอบว่าข้อมูลครบหรือไม่
    if (!ref_code?.trim() || !first_name?.trim() || !last_name?.trim() || 
        !address?.trim() || !postal_code?.trim() || !phone_number?.trim()) {
      console.log("❌ ข้อมูลไม่ครบ:", req.body);
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    }
    console.log("✅ Logic1 ผ่าน: ข้อมูลครบแล้ว");

    // 🔍 Logic 2: ตรวจสอบว่า ref_code มีอยู่ใน auth_sessions หรือไม่
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      console.log("❌ ไม่พบ ref_code ใน auth_sessions:", ref_code);
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้จาก Ref.Code' });
    }

    // 🟢 อัปเดตข้อมูลจากฟอร์มลงใน auth_sessions
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        first_name,
        last_name,
        phone_number, 
        postal_code, 
        email,
        national_id      
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.error("❌ อัปเดต auth_sessions ไม่สำเร็จ:", updateError);
      return res.status(500).json({ message: 'อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ' });
    }

    console.log("✅ อัปเดต auth_sessions สำเร็จแล้ว");

    // 🟢 Logic 3: สร้าง license_no ใหม่
    const { data: allLicenses, error: licenseFetchError } = await supabase
      .from('license_holders')
      .select('license_no');

    if (licenseFetchError) {
      console.error('❌ ดึง license_no ไม่ได้:', licenseFetchError);
      return res.status(500).json({ message: 'ดึง license_no ล่าสุดไม่สำเร็จ' });
    }

    const maxNum = allLicenses
      .map(row => parseInt(row.license_no.replace('ADT', ''), 10))
      .filter(num => !isNaN(num))
      .reduce((max, num) => Math.max(max, num), 0);

    const newLicenseNo = `ADT${(maxNum + 1).toString().padStart(3, '0')}`;
    console.log('✅ license_no ใหม่:', newLicenseNo);

    // 🟢 Logic 4: บันทึกลง license_holders
    const { error: insertLicenseError } = await supabase
      .from('license_holders')
      .insert([
        {
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
        }
      ]);

    if (insertLicenseError) {
      console.error('❌ บันทึก license ไม่สำเร็จ:', insertLicenseError);
      return res.status(500).json({ message: 'บันทึก license ไม่สำเร็จ' });
    }

    console.log("✅ Logic4 สำเร็จ: บันทึก license_holders แล้วเรียบร้อย");

    // 🟢 Logic 5: อัปโหลดสลิปและบันทึก slip_submissions
    const slipFileName = `ADT-01-${newLicenseNo}-SLP-${ref_code}.jpg`;

    // ✅ ป้องกันค่าหลุด / undefined / null
    let productSource = sessionData?.product_source;
    if (!productSource || typeof productSource !== 'string') {
      console.warn("⚠️ ไม่มี product_source หรือไม่ใช่ string → ใช้ default");
      productSource = 'ADT-01-5500';
    }

    const uploadResult = await uploadBase64ImageToSupabase({
      base64String: file_content,
      fileName: slipFileName,
      bucket: 'adtpayslip'
    });

    if (!uploadResult.success) {
      console.error("❌ Upload slip fail:", uploadResult.error);
      return res.status(500).json({ message: 'อัปโหลดสลิปไม่สำเร็จ' });
    }

    const slipImageUrl = uploadResult.publicUrl;

    // ✅ Debug log ก่อน insert จริง
    console.log("📦 Insert slip payload:", {
      ref_code,
      license_no: newLicenseNo,
      product_source: productSource,
      slip_image_url: slipImageUrl,
      slip_path: slipFileName,
      submissions_status: 'pending'
    });
      console.log("🔎 RLS DEBUG DATA:");
      console.log("ref_code:", ref_code);
      console.log("license_no:", newLicenseNo);
      console.log("product_source:", productSource);
      console.log("slip_image_url:", slipImageUrl);
      console.log("slip_path:", slipFileName);
      console.log("submissions_status:", 'pending');
    const { error: insertSlipError } = await supabase
      .from('slip_submissions')

      .insert([
        {
          ref_code,
          license_no: newLicenseNo,
          product_source: productSource,
          slip_image_url: slipImageUrl,
          slip_path: slipFileName,
          submissions_status: 'pending'
        }
      ]);

    if (insertSlipError) {
      console.error('❌ Insert slip data fail:', insertSlipError);
      return res.status(500).json({ message: 'บันทึกข้อมูลสลิปไม่สำเร็จ' });
    }

    console.log("✅ Logic5 สำเร็จ: บันทึกสลิปเรียบร้อยแล้ว");

    // 🎉 ส่งผลลัพธ์กลับ
    return res.status(200).json({ message: 'บันทึกข้อมูลสำเร็จแล้ว', license_no: newLicenseNo });

  } catch (err) {
    console.error("❌ ERROR ภาพรวม:", err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = handleFullPurchase;
