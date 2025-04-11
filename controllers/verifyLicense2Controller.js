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
    const { ref_code } = req.body;

    logger.info(`[VERIFY2] 📥 ตรวจสอบ Ref.Code → ref_code: ${ref_code}`);

    if (!ref_code) {
      logger.warn(`[VERIFY2] ⚠️ [STATUS 400] ไม่มี ref_code`);
      return res.status(400).json({ message: 'กรุณาระบุ Ref.Code' });
    }

    // ดึงข้อมูลทั้ง serial_key และ line_user_id จากฐานข้อมูล
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (error || !data) {
      logger.warn(`[VERIFY2] ❌ [STATUS 404] ไม่พบ Ref.Code → ref_code: ${ref_code}, error: ${error?.message || 'ไม่พบข้อมูล'}`);
      return res.status(404).json({ message: 'Ref.Code ไม่ถูกต้องหรือหมดอายุ' });
    }

    logger.info(`[VERIFY2] ✅ พบข้อมูล Ref.Code → serial_key: ${data.serial_key}, line_user_id: ${data.line_user_id || 'ไม่มี'}`);

    // ถ้ามี line_user_id ให้ส่งข้อความไปยัง LINE
    if (data.line_user_id) {
      try {
        await client.pushMessage(data.line_user_id, {
          type: 'text',
          text: `🔐 Serial Key ของคุณคือ: ${data.serial_key}`
        });
        logger.info(`[VERIFY2] ✅ ส่ง Serial Key ไปยัง LINE สำเร็จ → line_user_id: ${data.line_user_id}`);
      } catch (lineErr) {
        logger.warn(`[VERIFY2] ⚠️ ไม่สามารถส่งข้อความไปยัง LINE ได้: ${lineErr.message}`);
        // ยังคงดำเนินการต่อแม้จะไม่สามารถส่งข้อความได้
      }
    } else {
      logger.warn(`[VERIFY2] ⚠️ ไม่พบ line_user_id สำหรับ ref_code: ${ref_code} - ไม่ได้ส่งข้อความ LINE`);
    }

    // ส่งค่า serial_key กลับไปให้ไม่ว่าจะส่ง LINE ได้หรือไม่
    return res.status(200).json({
      message: data.line_user_id ? 'Serial Key ถูกส่งไปยัง LINE แล้ว' : 'Serial Key ถูกตรวจสอบแล้ว',
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
    const { license_no, ref_code, serial_key } = req.body;

    logger.info(`[VERIFY2] 📥 รับข้อมูลตรวจสอบ Ref.Code + Serial Key → license_no: ${license_no}, ref_code: ${ref_code}`);

    if (!ref_code || !serial_key || !license_no) {
      logger.warn(`[VERIFY2] ⚠️ [STATUS 400] ข้อมูลไม่ครบถ้วน`);
      return res.status(400).json({ message: 'กรุณาระบุ License No, Ref.Code และ Serial Key ให้ครบถ้วน' });
    }

    // ตรวจสอบ ref_code และ serial_key จากตาราง auth_sessions
    const { data: authSession, error: authError } = await supabase
      .from('auth_sessions')
      .select('ref_code, serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .eq('serial_key', serial_key)
      .single();

    if (authError || !authSession) {
      logger.warn(`[VERIFY2] ❌ [STATUS 400] ไม่พบ Ref.Code หรือ Serial Key ไม่ตรง → ref_code: ${ref_code}`);
      return res.status(400).json({ message: 'Ref.Code หรือ Serial Key ไม่ถูกต้อง' });
    }

    // อัปเดตเฉพาะ ref_code ไม่ต้องอัปเดต machine_id และอื่นๆ
    const updateData = {
      ref_code: ref_code,
    };

    // เพิ่ม line_user_id ถ้ามี
    if (authSession.line_user_id) {
      updateData.line_user_id = authSession.line_user_id;
    }

    // บันทึกข้อมูลที่จะอัปเดต
    logger.info(`[VERIFY2] 🔄 ข้อมูลที่จะอัปเดต → ${JSON.stringify(updateData)}`);

    const { error: updateError } = await supabase
      .from('license_holders')
      .update(updateData)
      .eq('license_no', license_no);

    if (updateError) {
      logger.error(`[VERIFY2] ❌ [STATUS 500] อัปเดต license_holders ไม่สำเร็จ → license_no: ${license_no}`);
      return res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้' });
    }

    // ดึงข้อมูลผู้ใช้หลังอัปเดต
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, occupation, address, province, postal_code')
      .eq('license_no', license_no)
      .single();

    if (userError || !userData) {
      logger.warn(`[VERIFY2] ❌ [STATUS 404] ไม่พบข้อมูลผู้ใช้หลังอัปเดต → license: ${license_no}`);
      return res.status(404).json({ message: 'ไม่พบข้อมูลหลังการยืนยันตัวตน' });
    }

    // ถ้ามี line_user_id ให้ส่งข้อความไปยัง LINE
    if (authSession.line_user_id) {
      try {
        await client.pushMessage(authSession.line_user_id, {
          type: 'text',
          text: `✅ ยืนยันตัวตนสำเร็จ\nกรุณาอัปเดตข้อมูล และตั้งค่า Username / Password เพื่อเข้าใช้งาน ADTSpreadsheet ครับ`
        });
        logger.info(`[VERIFY2] ✅ แจ้งเตือนผ่าน LINE สำเร็จ → user: ${authSession.line_user_id}`);
      } catch (lineErr) {
        logger.warn(`[VERIFY2] ⚠️ ไม่สามารถแจ้งเตือนผ่าน LINE ได้ → ${lineErr.message}`);
      }
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
