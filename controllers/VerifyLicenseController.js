const { supabase } = require('../utils/supabaseClient');

const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number } = req.body;

    console.log("📌 ข้อมูลที่ส่งมา:", { license_no, national_id, phone_number });

    // ตรวจสอบว่ามี license_no และ phone_number หรือไม่ (จำเป็นต้องมี)
    if (!license_no || !phone_number) {
      console.log("⚠️ [0] ไม่มี license_no หรือ phone_number");
      
      // ตรวจสอบกรณี 1.3: license_no + phone_number ตรง แต่ในฐานข้อมูลไม่มี national_id
      const { data: partialMatch, error: partialError } = await supabase
        .from('license_holders')
        .select('license_no, first_name, last_name')
        .eq('license_no', license_no)
        .eq('phone_number', phone_number)
        .is('national_id', null)
        .single();

      if (partialMatch) {
        console.log("🟡 [1.3] พบ License + Phone ตรง แต่ยังไม่มีเลขบัตรประชาชนในฐานข้อมูล:", license_no);
        
        // ไม่ว่ากรณี national_id ส่งมาหรือไม่ ให้ส่ง status 206 เสมอ
        return res.status(206).json({
          license_no: partialMatch.license_no,
          full_name: `${partialMatch.first_name} ${partialMatch.last_name}`,
          message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
        });
      }
    }

    // ตรวจสอบกรณี 1.3 อีกครั้ง (กรณีมีทั้ง license_no และ phone_number)
    const { data: partialMatch2, error: partialError2 } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name')
      .eq('license_no', license_no)
      .eq('phone_number', phone_number)
      .is('national_id', null)
      .single();

    if (partialMatch2) {
      console.log("🟡 [1.3] พบ License + Phone ตรง แต่ยังไม่มีเลขบัตรประชาชนในฐานข้อมูล:", license_no);
      
      // ไม่ว่ากรณี national_id ส่งมาหรือไม่ ให้ส่ง status 206 เสมอ
      return res.status(206).json({
        license_no: partialMatch2.license_no,
        full_name: `${partialMatch2.first_name} ${partialMatch2.last_name}`,
        message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
      });
    }

    // ตรวจสอบว่า license_no มีอยู่หรือไม่
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

    // ตรวจสอบข้อมูลผู้ใช้ว่าตรงกับ license หรือไม่
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();

    // ข้อมูลตรง → ยืนยันสำเร็จ
    if (data) {
      console.log("✅ [2.1] ยืนยันสำเร็จ:", data.license_no);
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`,
        message: 'Your copyright has been successfully verified.'
      });
    }

    // ข้อมูลผิด → ตรวจนับครั้ง
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

    // เกิน 3 ครั้ง → บล็อกการตรวจสอบ
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
// ฟังก์ชันสำหรับตรวจสอบ Ref.Code และ Serial Key
//---------------------------------------------------------------

const verifyLicense2 = async (req, res) => {
  try {
    const { license_no, ref_code, serial_key } = req.body;

    // STEP 1: ตรวจสอบข้อมูลที่รับเข้ามา
    if (!license_no || !ref_code || !serial_key) {
      return res.status(400).json({ message: 'กรุณาระบุ license_no, ref_code และ serial_key ให้ครบถ้วน' });
    }

    // STEP 2: ตรวจสอบ Ref.Code + Serial Key จาก auth_sessions
    const { data: sessionMatch, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();

    if (sessionError || !sessionMatch) {
      return res.status(400).json({ message: 'ไม่พบ Ref.Code หรือ Serial Key นี้ในระบบ' });
    }

    // STEP 3: ตรวจสอบ license_no ในตาราง license_holders
    const { data: licenseRow, error: licenseError } = await supabase
      .from('license_holders')
      .select('*')
      .eq('license_no', license_no)
      .single();

    if (licenseError || !licenseRow) {
      return res.status(404).json({ message: 'ไม่พบหมายเลขลิขสิทธิ์นี้ในระบบ' });
    }

    // STEP 4: อัปเดตข้อมูลใน license_holders
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

    // STEP 5: ตอบกลับเมื่อสำเร็จ
    console.log(`✅ [VERIFY LICENSE2 SUCCESS] License: ${license_no} -> RefCode: ${ref_code}`);
    return res.status(200).json({
      message: 'ยืนยันสิทธิ์สำเร็จแล้ว',
      license_no: license_no,
      ref_code: ref_code
    });

  } catch (err) {
    console.error('❌ [VERIFY LICENSE2 - SYSTEM ERROR]', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่' });
  }
};


//--------------------------------------------------------------- 
// ฟังก์ชันสำหรับตรวจสอบใบอนุญาตด้วยวิธีที่ 2 (เตรียมไว้สำหรับใช้งานในอนาคต)
//--------------------------------------------------------------- -
    
const verifyRefCodeAndSerial = async (req, res) => {
  try {
    const { ref_code, serial_key } = req.body;
    
    if (!ref_code || !serial_key) {
      return res.status(404).json({ message: 'กรุณาระบุ Ref.Code และ Serial Key' });
    }
    
    // เตรียมไว้สำหรับการตรวจสอบ Ref.Code และ Serial Key
    // เช่น ตรวจสอบว่ามีคู่ Ref.Code และ Serial Key นี้ในฐานข้อมูลหรือไม่
    
    // สำหรับตอนนี้ส่งข้อความแจ้งว่าฟังก์ชันนี้ยังไม่พร้อมใช้งาน
    return res.status(200).json({ 
      message: 'ฟังก์ชัน verifyRefCodeAndSerial อยู่ระหว่างการพัฒนา'
    });
  } catch (err) {
    console.error('❌ [VERIFY REF CODE AND SERIAL ERROR]', err);
    return res.status(404).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่อีกครั้ง' });
  }
};

module.exports = {
  verifyLicense1,
  verifyLicense2,
  verifyRefCodeAndSerial
};
