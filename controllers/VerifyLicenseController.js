const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../routes/events/eventLine');
const logger = require('../utils/logger').createModuleLogger('verifyRefCodeAndSerial');

//---------------------------------------------------------------
// ฟังก์ชัน verifyLicense1 – ตรวจสอบจาก license_no, national_id, phone_number
//---------------------------------------------------------------
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;

    console.log("📌 ข้อมูลที่ส่งมา:", { license_no, national_id, phone_number });

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
      .select('license_no, status, verify_count')
      .eq('license_no', license_no)
      .single();

    if (licenseError || !licenseCheck) {
      console.log("❌ [1.1] ไม่พบ license_no:", license_no);
      return res.status(404).json({
        message: 'ระบบตรวจสอบไม่พบรหัสลิขสิทธิ์ของท่าน กรุณาติดต่อ ADT-Admin'
      });
    }

    if (licenseCheck.status !== 'Pending') {
      console.log("🔁 [1.2] License เคยยืนยันแล้ว:", license_no);
      return res.status(409).json({
        message: 'รหัสลิขสิทธิ์ได้รับการยืนยันเรียบร้อยแล้ว'
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

//---------------------------------------------------------------
// ฟังก์ชัน verifyRefCodeAndSerial – ตรวจสอบจาก Ref.Code + Serial Key + ส่ง serial key ใน Line
//---------------------------------------------------------------

const verifyRefCodeAndSerial = async (req, res) => {
  logger.info('📩 [START] ตรวจสอบ Ref.Code');

  try {
    const { ref_code } = req.body;
    logger.info('📥 [REQUEST BODY]', { ref_code });

    if (!ref_code) {
      logger.warn('⚠️ [MISSING DATA] ต้องระบุ ref_code');
      return res.status(400).json({ message: 'กรุณาระบุ Ref.Code ให้ครบถ้วน' });
    }

    // ดึงข้อมูลจากตาราง auth_sessions โดยใช้เฉพาะ ref_code
    logger.info('🔍 [QUERY] ค้นหา Ref.Code ใน Supabase');
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .eq('status', 'ACTIVE')
      .single();

    if (error) {
      logger.error('❌ [SUPABASE ERROR]', error.message || error);
    }

    if (!data) {
      logger.warn('🛑 [NOT FOUND] ไม่พบ Ref.Code ในระบบ', { ref_code });
      return res.status(404).json({ message: 'ไม่พบ Ref.Code ที่ระบุในระบบ' });
    }

    const { serial_key: matchedSerialKey, line_user_id } = data;
    logger.info('✅ [DATA FOUND]', { matchedSerialKey, line_user_id });

    // ส่งข้อความผ่าน LINE Bot
    try {
      logger.info('📤 [LINE BOT] กำลังส่ง Serial Key ผ่าน LINE', {
        ref_code,
        line_user_id,
        serial_key: matchedSerialKey,
      });

      await sendLineMessage(line_user_id, matchedSerialKey, ref_code);

      logger.info('✅ [LINE SENT] ส่งข้อความเรียบร้อยแล้ว', { ref_code, line_user_id });
      return res.status(200).json({ message: 'ส่ง Serial Key ไปยัง LINE เรียบร้อยแล้ว' });

    } catch (lineError) {
      logger.error('❌ [LINE FAILED] ส่ง LINE ไม่สำเร็จ', {
        ref_code,
        line_user_id,
        serial_key: matchedSerialKey,
        error: lineError.message,
      });
      return res.status(500).json({ message: 'ไม่สามารถส่ง Serial Key ทาง LINE ได้' });
    }

  } catch (err) {
    logger.error('🔥 [UNEXPECTED ERROR] ระบบมีปัญหาภายใน', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};

//---------------------------------------------------------------
// ฟังก์ชัน verifyLicense2 – ตรวจสอบจาก Ref.Code + Serial Key + License No
//---------------------------------------------------------------
const verifyLicense2 = async (req, res) => {
  try {
    const { license_no, ref_code, serial_key } = req.body;

    if (!license_no || !ref_code || !serial_key) {
      return res.status(400).json({ message: 'กรุณาระบุ license_no, ref_code และ serial_key ให้ครบถ้วน' });
    }

    const { data: sessionMatch, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();

    if (sessionError || !sessionMatch) {
      return res.status(400).json({ message: 'ไม่พบ Ref.Code หรือ Serial Key นี้ในระบบ' });
    }

    const { data: licenseRow, error: licenseError } = await supabase
      .from('license_holders')
      .select('*')
      .eq('license_no', license_no)
      .single();

    if (licenseError || !licenseRow) {
      return res.status(404).json({ message: 'ไม่พบหมายเลขลิขสิทธิ์นี้ในระบบ' });
    }

    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        ref_code: ref_code,
        serial_key: serial_key,
        is_verify: true
      })
      .eq('license_no', license_no);

    if (updateError) {
      console.error('❌ [VERIFY LICENSE2 - UPDATE ERROR]', updateError);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
    }

    const { data: licenseHolderInfo, error: infoError } = await supabase
      .from('license_holders')
      .select('first_name, last_name, occupation, address, province, postal_code')
      .eq('license_no', license_no)
      .single();

    if (infoError || !licenseHolderInfo) {
      console.error('❌ [VERIFY LICENSE2 - FETCH INFO ERROR]', infoError);
      return res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลสำหรับตอบกลับได้' });
    }

    console.log(`✅ [VERIFY LICENSE2 SUCCESS] License: ${license_no} -> RefCode: ${ref_code}`);
    return res.status(200).json({
      message: 'ยืนยันสิทธิ์สำเร็จแล้ว',
      license_no: license_no,
      ref_code: ref_code,
      first_name: licenseHolderInfo.first_name,
      last_name: licenseHolderInfo.last_name,
      occupation: licenseHolderInfo.occupation,
      address: licenseHolderInfo.address,
      province: licenseHolderInfo.province,
      postal_code: licenseHolderInfo.postal_code
    });

  } catch (err) {
    console.error('❌ [VERIFY LICENSE2 - SYSTEM ERROR]', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' });
  }
};



module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
