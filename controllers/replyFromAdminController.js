// controllers/replyFromAdminController.js
const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger').createModuleLogger('ReplyFromAdmin');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

exports.replyToUser = async (req, res) => {
  const { ref_code, message } = req.body;

  if (!ref_code || !message) {
    logger.warn('⛔ Missing ref_code or message');
    return res.status(400).json({ message: 'กรุณาระบุ ref_code และข้อความ' });
  }

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error || !data?.line_user_id) {
      logger.error(`❌ ไม่พบ line_user_id สำหรับ Ref: ${ref_code}`);
      return res.status(404).json({ message: 'ไม่พบผู้ใช้ที่ตรงกับ Ref.Code นี้' });
    }

    const lineUserId = data.line_user_id;

    await client.pushMessage(lineUserId, {
      type: 'text',
      text: message
    });

    logger.info(`✅ ส่งข้อความจากแอดมินถึงผู้ใช้สำเร็จ → Ref: ${ref_code}`);
    return res.status(200).json({ message: 'ส่งข้อความเรียบร้อยแล้ว' });

  } catch (err) {
    logger.error(`🔥 เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'Server Error' });
  }
};
