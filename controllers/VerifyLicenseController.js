const { supabase } = require('../utils/supabaseClient');

const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;

    // ───────────────────────────────
    // 0. ตรวจสอบว่า input ครบหรือไม่
    // ───────────────────────────────
    if (!license_no || !national_id || !phone_number) {
      console.log("⚠️ [0] ข้อมูลไม่ครบ");
      return res.status(400).json({
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
      });
    }

    // ───────────────────────────────
    // 1. ตรวจสอบว่า license_no มีอยู่หรือไม่
    // ───────────────────────────────
    const { data: licenseCheck, error: licenseError } = await supabase
      .from('license_holders')
      .select('license_no, status, verify_count')
      .eq('license_no', license_no)
      .single();

    // 1.1 ไม่พบ license_no ในระบบ
    if (licenseError || !licenseCheck) {
      console.log("❌ [1.1] ไม่พบ license_no:", license_no);
      return res.status(404).json({
        message: 'ไม่พบหมายเลขลิขสิทธิ์นี้ในระบบ'
      });
    }

    // 1.2 พบ license แต่สถานะไม่ใช่ Pending
    if (licenseCheck.status !== 'Pending') {
      console.log("🔁 [1.2] License เคยยืนยันแล้ว:", license_no);
      return res.status(409).json({
        message: 'ลิขสิทธิ์นี้ได้ทำการยืนยันแล้ว'
      });
    }

    // ───────────────────────────────
    // 2. ตรวจสอบข้อมูลผู้ใช้ว่าตรงกับ license หรือไม่
    // ───────────────────────────────
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();

    // 2.1 ข้อมูลตรง → ยืนยันสำเร็จ
    if (data) {
      console.log("✅ [2.1] ยืนยันสำเร็จ:", data.license_no);
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`,
        message: 'ยืนยันลิขสิทธิ์สำเร็จแล้ว'
      });
    }

    // 2.2 ข้อมูลผิด → ตรวจนับครั้ง
    const verifyCount = licenseCheck.verify_count || 0;

    if (verifyCount < 2) {
      const newCount = verifyCount + 1;

      await supabase
        .from('license_holders')
        .update({ verify_count: newCount })
        .eq('license_no', license_no);

      console.log(`⚠️ [2.2] ข้อมูลผิด (ครั้งที่ ${newCount}) → ${license_no}`);
      return res.status(401).json({
        message: 'ข้อมูลไม่ตรง กรุณาลองใหม่อีกครั้ง',
        verify_count: newCount,
        attempts_remaining: `กรุณาลองใหม่อีก ${3 - newCount}/3`
      });
    }

    // ───────────────────────────────
    // 3. เกิน 3 ครั้ง → บล็อกการตรวจสอบ
    // ───────────────────────────────
    await supabase
      .from('license_holders')
      .update({ verify_count: 3 })
      .eq('license_no', license_no);

    console.log("🚫 [3] ถูกบล็อก - เกิน 3 ครั้ง:", license_no);
    return res.status(403).json({
      message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด กรุณาติดต่อผู้ดูแลระบบ'
    });

  } catch (err) {
    console.error('❌ [ERROR] VERIFY LICENSE1', err);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
    });
  }
};

module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
