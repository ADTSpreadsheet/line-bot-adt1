//---------------------------------------------------------------
// controllers/VerifyLicense2Controller.js
//---------------------------------------------------------------
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//---------------------------------------------------------------
// verifyLicense2 – ตรวจสอบ Ref.Code และ Serial Key จากฝั่ง VBA
//---------------------------------------------------------------
const verifyLicense2 = async (req, res) => {
  try {
    const { ref_code, serial_key } = req.body;

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('ref_code, serial_key')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล Ref.Code หรือ Serial Key ไม่ถูกต้อง' });
    }

    return res.status(200).json({
      ref_code: data.ref_code,
      serial_key: data.serial_key,
      message: 'Serial Key ตรวจสอบผ่านแล้ว'
    });
  } catch (err) {
    console.error('❌ [ERROR] VERIFY LICENSE2', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};

//---------------------------------------------------------------
// verifyRefCodeAndSerial – ตรวจสอบ Ref.Code เพื่อส่ง Serial Key ไป LINE
//---------------------------------------------------------------
const verifyRefCodeAndSerial = async (req, res) => {
  try {
    const { ref_code } = req.body;

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Ref.Code ไม่ถูกต้องหรือหมดอายุ' });
    }

    logger.info('[LINE BOT] กำลังส่ง Serial Key ผ่าน LINE', data);

    return res.status(200).json({
      ref_code,
      serial_key: data.serial_key,
      message: 'Serial Key ถูกส่งไปยัง LINE แล้ว'
    });
  } catch (err) {
    console.error('❌ [ERROR] VERIFY REF CODE AND SERIAL', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่ง Serial Key' });
  }
};

module.exports = {
  verifyLicense2,
  verifyRefCodeAndSerial
};
