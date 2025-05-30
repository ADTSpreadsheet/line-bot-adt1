// 👉 นำเข้า Supabase ก่อน
const { supabase } = require('../utils/supabaseClient');

// 👉 ฟังก์ชันหลัก เรียงลำดับ logic ให้สวยงามเหมือนพี่เก่งจัดโต๊ะ
const handleFullPurchase = async (req, res) => {
  try {
    // 🟡 STEP 1: รับค่าจากฟอร์ม
    const { ref_code, serial_key, first_name, last_name, phone_number, slip_image_url } = req.body;

    // 🔍 Logic 1: ตรวจสอบว่าข้อมูลครบหรือไม่
    if (!ref_code || !serial_key || !first_name || !last_name || !phone_number || !slip_image_url) {
      console.log("❌ ข้อมูลไม่ครบ:", req.body);
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ กรุณากรอกให้ครบทุกช่อง' });
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
    console.log("✅ Logic2 ผ่าน: พบ session", sessionData);

    // 🟢 อัปเดตข้อมูลจากฟอร์มลงใน auth_sessions
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        first_name,
        last_name,
        phone_number,
        serial_key,
        source: 'adt_purchase',
        updated_at: new Date().toISOString()
      })
      .eq('ref_code', ref_code);

    if (updateError) {
      console.error("❌ อัปเดต auth_sessions ไม่สำเร็จ:", updateError);
      return res.status(500).json({ message: 'อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ' });
    }

    console.log("✅ อัปเดต auth_sessions สำเร็จแล้ว");

    // 🟢 ตอบกลับไปให้ Frontend / VBA
    return res.status(200).json({ message: 'รับข้อมูลเรียบร้อยแล้ว (Logic 1+2)' });

  } catch (err) {
    console.error("❌ ERROR ภาพรวม:", err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

// ✅ ส่งออกฟังก์ชันแบบถูกตำแหน่ง
module.exports = handleFullPurchase;
