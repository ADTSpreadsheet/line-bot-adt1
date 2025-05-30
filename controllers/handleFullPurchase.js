// 👉 นำเข้า Supabase ก่อน
const { supabase } = require('../utils/supabaseClient');

const handleFullPurchase = async (req, res) => {
  try {
    // 🟡 STEP 1: รับค่าจากฟอร์ม
    const {
      ref_code,
      first_name,
      last_name,
      address,
      postal_code,
      phone_number,
      email,
      national_id,
      file_name,
      file_content
    } = req.body;

    // 🔍 Logic 1: ตรวจสอบว่าข้อมูลครบหรือไม่
    if (
      !ref_code?.trim() ||
      !first_name?.trim() ||
      !last_name?.trim() ||
      !address?.trim() ||
      !postal_code?.trim() ||
      !phone_number?.trim()
    ) {
      console.log("❌ ข้อมูลไม่ครบ:", req.body);
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    }
    console.log("✅ Logic1 ผ่าน: ข้อมูลครบแล้ว");

    // 🔍 Logic 2: ตรวจสอบ ref_code ใน auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      console.log("❌ ไม่พบ ref_code ใน auth_sessions:", ref_code);
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้จาก Ref.Code' });
    }

    console.log("✅ Logic2 ผ่าน: พบ session", sessionData);

    // ✅ อัปเดตข้อมูลจากฟอร์มลงใน auth_sessions
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        first_name,
        last_name,
        phone_number,
        postal_code,
        email,
        national_id,
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.error("❌ อัปเดต auth_sessions ไม่สำเร็จ:", updateError);
      return res.status(500).json({ message: 'อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ' });
    }

    console.log("✅ อัปเดต auth_sessions สำเร็จแล้ว");

    // 🔁 Logic 3: ออก license_no ใหม่
    const { data: lastLicenseRow, error: licenseFetchError } = await supabase
      .from('license_holders')
      .select('license_no')
      .order('created_at', { ascending: false })
      .limit(1);

    if (licenseFetchError) {
      console.error('❌ ดึง license_no ล่าสุดไม่สำเร็จ:', licenseFetchError);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึง license_no ล่าสุด' });
    }

    const lastNo = lastLicenseRow?.[0]?.license_no || 'ADT000';
    const nextNum = parseInt(lastNo.replace('ADT', ''), 10) + 1;
    const newLicenseNo = `ADT${nextNum.toString().padStart(3, '0')}`;

    console.log('✅ Logic3: license_no ใหม่ =', newLicenseNo);

    // 🧾 บันทึก license ใหม่
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
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึก license ใหม่' });
    }

    console.log('✅ Logic3 เสร็จสิ้น: บันทึก license_holders สำเร็จ');

    // ✅ ตอบกลับให้เว็บรู้ว่าทำสำเร็จ
    return res.status(200).json({
      message: 'บันทึกข้อมูลสำเร็จ (Logic 1 + 2 + 3)',
      license_no: newLicenseNo
    });

  } catch (err) {
    console.error("❌ ERROR ภาพรวม:", err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = handleFullPurchase;
