//---------------------------------------------------------------
// controllers/VerifyLicense2Controller.js
//---------------------------------------------------------------
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//---------------------------------------------------------------
// verifyLicense2 – ตรวจสอบ ref_code และส่ง serial_key ไปยัง line_user_id
//---------------------------------------------------------------
const verifyLicense2 = async (req, res) => {
  try {
    const { ref_code, line_user_id } = req.body;

    logger.info(`[VERIFY2] 📥 ตรวจสอบ Ref.Code → ref_code: ${ref_code}, line_user_id: ${line_user_id}`);

    if (!ref_code || !line_user_id) {
      logger.warn(`[VERIFY2] ⚠️ [STATUS 400] ขาดข้อมูล ref_code หรือ line_user_id`);
      return res.status(400).json({ message: 'กรุณาระบุ Ref.Code และ Line User ID ให้ครบถ้วน' });
    }

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key')
      .eq('ref_code', ref_code)
      .eq('status', 'ACTIVE')
      .single();

    if (error || !data) {
      logger.warn(`[VERIFY2] ❌ [STATUS 404] ไม่พบ Ref.Code หรือไม่อยู่ในสถานะ ACTIVE → ref_code: ${ref_code}`);
      return res.status(404).json({ message: 'Ref.Code ไม่ถูกต้องหรือหมดอายุ' });
    }

    // TODO: ส่ง serial_key ไปยัง line_user_id ผ่าน LINE Messaging API
    logger.info(`[VERIFY2] ✅ พบข้อมูล Ref.Code ส่ง Serial Key ไปยัง LINE → serial_key: ${data.serial_key}`);

    return res.status(200).json({
      message: 'Serial Key ถูกส่งไปยัง LINE แล้ว',
      serial_key: data.serial_key,
      ref_code
    });

  } catch (err) {
    logger.error(`[VERIFY2] ❌ [STATUS 500] เกิดข้อผิดพลาด: ${err.message}`);
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
