// 👉 นำเข้า Supabase ก่อน
const { supabase } = require('../utils/supabaseClient');

// 👉 ฟังก์ชันหลัก เรียงลำดับ logic ให้สวยงามเหมือนพี่เก่งจัดโต๊ะ
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

    // 🟢 Logic 3: สร้าง license_no ใหม่ โดยดูเลขมากสุดจริง ๆ ในคอลัมน์ license_no
const { data: allLicenses, error: licenseFetchError } = await supabase
  .from('license_holders')
  .select('license_no');

if (licenseFetchError) {
  console.error('❌ ดึง license_no ไม่ได้:', licenseFetchError);
  return res.status(500).json({ message: 'ดึง license_no ล่าสุดไม่สำเร็จ' });
}

// 🔢 หาค่าตัวเลขที่มากที่สุด
const maxNum = allLicenses
  .map(row => parseInt(row.license_no.replace('ADT', ''), 10))
  .filter(num => !isNaN(num))
  .reduce((max, num) => Math.max(max, num), 0);

// 🆕 รันเลขใหม่ต่อจากมากสุด
const newLicenseNo = `ADT${(maxNum + 1).toString().padStart(3, '0')}`;
console.log('✅ license_no ใหม่:', newLicenseNo);

    // ✅ ส่ง response กลับ
    return res.status(200).json({ message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });

  } catch (err) {
    console.error("❌ ERROR ภาพรวม:", err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = handleFullPurchase;
