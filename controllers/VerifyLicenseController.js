//---------------------------------------------------------------
// ฟังก์ชัน verifyLicense1 – ตรวจสอบจาก license_no, national_id, phone_number
//---------------------------------------------------------------
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number, machine_id } = req.body;

    console.log("📌 ข้อมูลที่ส่งมา:", { license_no, national_id, phone_number, machine_id });

    if (!license_no || !phone_number) {
      console.log("⚠️ [0] ไม่มี license_no หรือ phone_number");

      const { data: partialMatch, error: partialError } = await supabase
        .from('license_holders')
        .select('license_no, first_name, last_name')
        .eq('license_no', license_no)
        .eq('phone_number', phone_number)
        .is('national_id', null)
        .single();

      if (partialMatch) {
        console.log("🟡 [1.3] พบ License + Phone ตรง แต่ยังไม่มีเลขบัตรประชาชนในฐานข้อมูล:", license_no);

        return res.status(206).json({
          license_no: partialMatch.license_no,
          full_name: `${partialMatch.first_name} ${partialMatch.last_name}`,
          message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
        });
      }
    }

    const { data: partialMatch2 } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name')
      .eq('license_no', license_no)
      .eq('phone_number', phone_number)
      .is('national_id', null)
      .single();

    if (partialMatch2) {
      console.log("🟡 [1.3] พบ License + Phone ตรง แต่ยังไม่มีเลขบัตรประชาชนในฐานข้อมูล:", license_no);

      return res.status(206).json({
        license_no: partialMatch2.license_no,
        full_name: `${partialMatch2.first_name} ${partialMatch2.last_name}`,
        message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
      });
    }

    const { data: licenseCheck, error: licenseError } = await supabase
      .from('license_holders')
      .select('license_no, status, verify_count, is_verify')
      .eq('license_no', license_no)
      .single();

    if (licenseError || !licenseCheck) {
      console.log("❌ [1.1] ไม่พบ license_no:", license_no);
      return res.status(404).json({
        message: 'ระบบตรวจสอบไม่พบรหัสลิขสิทธิ์ของท่าน กรุณาติดต่อ ADT-Admin'
      });
    }

    console.log("DEBUG - is_verify value:", licenseCheck.is_verify);
    console.log("DEBUG - is_verify type:", typeof licenseCheck.is_verify);

    if (licenseCheck.is_verify === true) {
      console.log("🔁 [1.2] License เคยยืนยันแล้ว:", license_no);

      const { data: licenseData } = await supabase
        .from('license_holders')
        .select('machine_id_1, machine_id_2, mid_status')
        .eq('license_no', license_no)
        .single();

      if (
        licenseData.machine_id_1 === machine_id ||
        licenseData.machine_id_2 === machine_id
      ) {
        console.log("✅ เครื่องนี้ได้รับสิทธิ์แล้ว (Login ได้เลย)");
        return res.status(200).json({
          status: 'ALREADY_MATCHED',
          message: 'This device is already verified and authorized.',
          license_no
        });
      }

      if (
        licenseData.machine_id_1 &&
        licenseData.machine_id_2 &&
        licenseData.machine_id_1 !== machine_id &&
        licenseData.machine_id_2 !== machine_id
      ) {
        console.warn("🚫 เครื่องที่ 3 พยายามเข้าใช้งาน");
        return res.status(422).json({
          status: 'DEVICE_LIMIT_REACHED',
          message: 'You have already used this license on 2 devices. Please contact ADT-Admin.'
        });
      }

      let updateObj = {};
      if (!licenseData.machine_id_1) updateObj.machine_id_1 = machine_id;
      else if (!licenseData.machine_id_2) updateObj.machine_id_2 = machine_id;
      updateObj.mid_status = !!(updateObj.machine_id_1 && updateObj.machine_id_2);

      await supabase
        .from('license_holders')
        .update(updateObj)
        .eq('license_no', license_no);

      console.log("✅ ลงทะเบียนเครื่องเพิ่มเติมสำเร็จ");
      return res.status(200).json({
        status: 'MATCHED_AND_ADDED',
        message: 'Device registered successfully.',
        license_no
      });
    }

    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();

    if (data) {
      const { error: updateError } = await supabase
        .from('license_holders')
        .update({ is_verify: true })
        .eq('license_no', license_no);

      if (updateError) {
        console.error("❌ [2.1] อัปเดตสถานะไม่สำเร็จ:", updateError);
      } else {
        console.log("✅ [2.1] อัปเดตสถานะเป็น TRUE สำเร็จ:", license_no);
      }

      console.log("✅ [2.1] ยืนยันสำเร็จ:", data.license_no);
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`,
        message: 'Your copyright has been successfully verified.'
      });
    }

    const verifyCount = licenseCheck.verify_count || 0;

    if (verifyCount < 3) {
      const newCount = verifyCount + 1;

      await supabase
        .from('license_holders')
        .update({ verify_count: newCount })
        .eq('license_no', license_no);

      console.log(`⚠️ [2.2] ข้อมูลผิด (ครั้งที่ ${newCount}) → ${license_no}`);
      return res.status(401).json({
        message: 'ข้อมูลไม่ตรง กรุณาลองใหม่อีกครั้ง',
        verify_count: newCount,
        attempts_remaining: `ลองใหม่ได้อีก ${4 - newCount} ครั้ง`
      });
    }

    await supabase
      .from('license_holders')
      .update({ verify_count: 4 })
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
  verifyLicense1
};
