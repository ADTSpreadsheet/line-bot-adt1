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

    if (!ref_code || !license_no || !password) {
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ดึงข้อมูล line_user_id และ username
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('username, line_id')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .maybeSingle();

    if (userError || !userData) {
      logger.warn(`[SETUP-PASSWORD] ❌ ไม่พบข้อมูลผู้ใช้สำหรับ ref_code: ${ref_code}`);
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    // อัปเดตรหัสผ่าน
    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: hashedPassword,
        status: 'ACTIVATED'
      })
      .eq('ref_code', ref_code)
      .eq('license_no', license_no);

    if (updateError) {
      logger.error(`[SETUP-PASSWORD] ❌ อัปเดตรหัสผ่านล้มเหลว: ${updateError.message}`);
      return res.status(500).json({ message: 'อัปเดตรหัสผ่านไม่สำเร็จ' });
    }

    // ส่งข้อความทางไลน์
    const message = [
      '✅ บัญชีของคุณถูกสร้างแล้วเรียบร้อยครับ',
      `Ref.Code: ${ref_code}`,
      `Username: ${userData.username}`,
      `Password: ${password}`
    ].join('\n');

    let messageSent = false;
    if (userData.line_id) {
      try {
        await client.pushMessage(userData.line_id, {
          type: 'text',
          text: message
        });
        logger.info(`[SETUP-PASSWORD] ✅ ส่งข้อความผ่าน LINE สำเร็จ → ${userData.line_id}`);
        messageSent = true;
      } catch (lineErr) {
        logger.warn(`[SETUP-PASSWORD] ⚠️ ไม่สามารถส่ง LINE ได้: ${lineErr.message}`);
      }
    } else {
      logger.warn(`[SETUP-PASSWORD] ⚠️ ไม่พบ line_id สำหรับ ref_code: ${ref_code}`);
    }

    return res.status(200).json({
      success: true,
      message: messageSent
        ? 'สร้างบัญชีสำเร็จ และส่งข้อมูลไปยัง LINE แล้ว'
        : 'สร้างบัญชีสำเร็จ (ไม่สามารถส่ง LINE ได้)'
    });

  } catch (err) {
    logger.error(`[SETUP-PASSWORD] ❌ เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = { setupPassword };
