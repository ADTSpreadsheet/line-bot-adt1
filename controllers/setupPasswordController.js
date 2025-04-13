const { supabase } = require('../utils/supabaseClient');
const bcrypt = require('bcryptjs');
const line = require('@line/bot-sdk');
const logger = require('../utils/logger');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

const setupPassword = async (req, res) => {
  try {
    const { ref_code, license_no, password } = req.body;

    logger.info(`[SETUP-PASSWORD] 📥 รับข้อมูล → ref_code: ${ref_code}, license_no: ${license_no}`);

    if (!ref_code || !license_no || !password) {
      logger.warn(`[SETUP-PASSWORD] ⚠️ ข้อมูลไม่ครบ`);
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔍 ดึง line_user_id จาก license_holders
    const { data: sessionData, error: sessionError } = await supabase
      .from('license_holders')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError) {
      logger.error(`[SETUP-PASSWORD] ❌ ดึง line_user_id ไม่สำเร็จ: ${sessionError.message}`);
      return res.status(500).json({ message: 'ไม่สามารถดึง line_user_id ได้' });
    }

    const lineUserId = sessionData?.line_user_id || null;

    // 🔍 ดึง username จาก license_holders
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('username')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .maybeSingle();

    if (userError || !userData) {
      logger.warn(`[SETUP-PASSWORD] ❌ ไม่พบ username จาก license_holders`);
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    // ✅ อัปเดตรหัสผ่าน
    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: hashedPassword,
        status: 'ACTIVATED'
      })
      .eq('ref_code', ref_code)
      .eq('license_no', license_no);

    if (updateError) {
      logger.error(`[SETUP-PASSWORD] ❌ อัปเดต password ล้มเหลว: ${updateError.message}`);
      return res.status(500).json({ message: 'อัปเดตรหัสผ่านไม่สำเร็จ' });
    }

    // ✉️ เตรียมข้อความ LINE
    const message = [
      '✅ บัญชีของคุณถูกสร้างแล้วเรียบร้อยครับ',
      `License No: ${license_no}`,
      `Ref.Code: ${ref_code}`,
      `Username: ${userData.username}`,
      `Password: ${password}`
    ].join('\n');

    // ✅ ส่ง LINE ถ้าเจอ line_user_id
    let messageSent = false;

    if (lineUserId) {
      try {
        await client.pushMessage(lineUserId, {
          type: 'text',
          text: message
        });
        logger.info(`[SETUP-PASSWORD] ✅ ส่ง LINE สำเร็จ → ${lineUserId}`);
        messageSent = true;
      } catch (lineErr) {
        logger.warn(`[SETUP-PASSWORD] ⚠️ ส่ง LINE ล้มเหลว: ${lineErr.message}`);
      }
    } else {
      logger.warn(`[SETUP-PASSWORD] ⚠️ ไม่พบ line_user_id สำหรับ ref_code: ${ref_code}`);
    }

    // ✅ ส่งผลลัพธ์กลับ VBA
    return res.status(200).json({
      success: true,
      message: messageSent
        ? 'สร้างบัญชีสำเร็จ และส่งรหัสผ่านผ่าน LINE แล้ว'
        : 'สร้างบัญชีสำเร็จ (ไม่สามารถส่ง LINE ได้)'
    });

  } catch (err) {
    logger.error(`[SETUP-PASSWORD] ❌ Exception: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: err.message
    });
  }
};

module.exports = { setupPassword };
