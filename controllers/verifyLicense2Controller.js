//---------------------------------------------------------------
// controllers/VerifyLicense2Controller.js
//---------------------------------------------------------------
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

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

    logger.info(`[VERIFY2] ✅ พบข้อมูล Ref.Code ส่ง Serial Key ไปยัง LINE → serial_key: ${data.serial_key}`);

    await client.pushMessage(line_user_id, {
      type: 'text',
      text: `🔐 Serial Key ของคุณคือ: ${data.serial_key}`
    });

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
// verifyRefCodeAndSerial – ตรวจสอบ Ref.Code และ Serial Key และอัปเดตข้อมูล
//---------------------------------------------------------------
const verifyRefCodeAndSerial = async (req, res) => {
  try {
    const { license_no, national_id, ref_code, serial_key, machine_id } = req.body;

    logger.info(`[VERIFY2] 📥 รับข้อมูลตรวจสอบ Ref.Code + Serial Key → license_no: ${license_no}, ref_code: ${ref_code}`);

    const { data: authSession, error: authError } = await supabase
      .from('auth_sessions')
      .select('ref_code, serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .eq('status', 'ACTIVE')
      .single();

    if (authError || !authSession) {
      logger.warn(`[VERIFY2] ❌ [STATUS 400] ไม่พบ Ref.Code หรือ Serial Key ไม่ตรง → ref_code: ${ref_code}`);
      return res.status(400).json({ message: 'Ref.Code หรือ Serial Key ไม่ถูกต้อง' });
    }

    const updateResult = await supabase
      .from('license_holders')
      .update({
        ref_code: ref_code,
        national_id: national_id,
        line_user_id: authSession.line_user_id,
        is_verify: true,
        machine_id_1: machine_id,
        mid_status: '1-DEVICE'
      })
      .eq('license_no', license_no);

    if (updateResult.error) {
      logger.error(`[VERIFY2] ❌ [STATUS 500] อัปเดต license_holders ไม่สำเร็จ → license_no: ${license_no}`);
      return res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้' });
    }

    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, occupation, address, province, postal_code')
      .eq('license_no', license_no)
      .single();

    if (userError || !userData) {
      logger.warn(`[VERIFY2] ❌ [STATUS 404] ไม่พบข้อมูลผู้ใช้หลังอัปเดต → license: ${license_no}`);
      return res.status(404).json({ message: 'ไม่พบข้อมูลหลังการยืนยันตัวตน' });
    }

    try {
      await client.pushMessage(authSession.line_user_id, {
        type: 'text',
        text: `✅ ยืนยันตัวตนสำเร็จ\nกรุณาอัปเดตข้อมูล และตั้งค่า Username / Password เพื่อเข้าใช้งาน ADTSpreadsheet ครับ`
      });
      logger.info(`[VERIFY2] ✅ แจ้งเตือนผ่าน LINE สำเร็จ → user: ${authSession.line_user_id}`);
    } catch (err) {
      logger.warn(`[VERIFY2] ⚠️ ไม่สามารถแจ้งเตือนผ่าน LINE ได้ → ${err.message}`);
    }

    return res.status(200).json({
      license_no: userData.license_no,
      first_name: userData.first_name,
      last_name: userData.last_name,
      occupation: userData.occupation,
      address: userData.address,
      province: userData.province,
      postal_code: userData.postal_code,
      message: '✅ ยืนยันตัวตนสำเร็จ และส่งข้อมูลกลับ VBA เรียบร้อยแล้ว'
    });

  } catch (err) {
    logger.error(`[VERIFY2] ❌ [STATUS 500] เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};

module.exports = {
  verifyLicense2,
  verifyRefCodeAndSerial
};
