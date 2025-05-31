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

    // 🔍 Logic 1: ตรวจสอบข้อมูลครบ
    if (!ref_code?.trim() || !first_name?.trim() || !last_name?.trim() || 
        !address?.trim() || !postal_code?.trim() || !phone_number?.trim()) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    }

    if (!file_content || !file_content.trim()) {
      return res.status(400).json({ message: 'กรุณาอัพโหลดสลิปการโอนเงิน' });
    }

    // 🔍 Logic 2: ตรวจสอบ ref_code
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้จาก Ref.Code' });
    }

    // 🟢 อัปเดต auth_sessions
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
    console.log('✅ License No ใหม่:', newLicenseNo);

    // 🟢 Logic 4: บันทึก license_holders
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

    // ✅ เตรียม productSource
    let productSource = sessionData?.product_source;
    if (!productSource || typeof productSource !== 'string') {
      productSource = 'ADT-01-5500';
    }

    // ✅ อัปโหลดไฟล์
    const slipFileName = `ADT-01-${newLicenseNo}-SLP-${ref_code}.jpg`;

    let processedFileContent = file_content;
    if (!file_content.startsWith('data:image/')) {
      processedFileContent = `data:image/jpeg;base64,${file_content}`;
    }

    const uploadResult = await uploadBase64ImageToSupabase({
      base64String: processedFileContent,
      fileName: slipFileName,
      bucket: 'adtpayslip'
    });

    if (!uploadResult.success) {
      console.error("❌ อัปโหลดสลิปไม่สำเร็จ:", uploadResult.error);
      await supabase.from('license_holders').delete().eq('license_no', newLicenseNo);
      return res.status(500).json({ 
        message: 'อัปโหลดสลิปไม่สำเร็จ', 
        error: uploadResult.error 
      });
    }

    const slipImageUrl = uploadResult.publicUrl;

    // ✅ บันทึก slip_submissions
    const { data: insertedSlip, error: slipInsertError } = await supabase
      .from('slip_submissions')
      .insert([
        {
          ref_code,
          first_name,
          last_name,
          national_id,
          phone_number,
          license_no: newLicenseNo,
          product_source: productSource,
          slip_image_url: slipImageUrl,
          submissions_status: 'pending'
        }
      ])
      .select();

    if (slipInsertError) {
      console.error("❌ Insert slip_submissions failed:", slipInsertError);
      await supabase.storage.from('adtpayslip').remove([slipFileName]);
      await supabase.from('license_holders').delete().eq('license_no', newLicenseNo);
      return res.status(500).json({ message: 'บันทึกข้อมูล slip ไม่สำเร็จ' });
    }

    // 🚀 Logic 5: ส่งสัญญาณไป API2
    try {
      const api2Payload = { ref_code, license_no: newLicenseNo };

      const api2Response = await fetch(process.env.API2_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api2Payload)
      });

      if (!api2Response.ok) {
        console.warn("⚠️ การแจ้ง Admin ล้มเหลว แต่ข้อมูลบันทึกสำเร็จแล้ว");
      } else {
        console.log("✅ แจ้ง Admin สำเร็จ");
      }

    } catch (api2Error) {
      console.warn("⚠️ การแจ้ง Admin ล้มเหลว แต่ข้อมูลบันทึกสำเร็จแล้ว");
    }

    // 🎉 ส่งผลลัพธ์กลับ
    console.log("🎉 บันทึกข้อมูลสำเร็จ - License:", newLicenseNo);
    return res.status(200).json({ 
      message: 'บันทึกข้อมูลสำเร็จแล้ว', 
      license_no: newLicenseNo,
      slip_url: slipImageUrl
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในระบบ',
      error: err.message 
    });
  }
};

module.exports = handleFullPurchase;
