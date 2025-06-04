const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');

// LINE CONFIG
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 📌 Logic 2: Message Event Handler
const handleMessageEvent = async (event) => {
  const userId = event.source.userId;
  const msg = event.message;

  // เช็คว่าเป็น text message
  if (msg.type !== 'text') {
    return;
  }

  const text = msg.text.trim().toLowerCase();

  // เช็คคำสั่ง req_refcode
  if (text === 'req_refcode') {
    // ดึง ref_code จาก database
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('ref_code')
      .eq('line_user_id', userId)
      .single();

    if (data && data.ref_code) {
      // ส่งข้อความ
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `รหัส Ref.Code ของคุณคือ  "${data.ref_code}"`
      });
    }
  }
};

module.exports = {
  handleMessageEvent
};
