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
  try {
    const userId = event.source.userId;
    const msg = event.message;
    
    // เช็คว่าเป็น text message
    if (msg.type !== 'text') {
      return;
    }
    
    const text = msg.text.trim().toLowerCase();
    
    // เช็คคำสั่ง req_refcode (ใช้หลายวิธีเพื่อความแน่ใจ)
    if (text === 'req_refcode' || text.includes('req_refcode') || text === 'req refcode') {
      
      // ดึง ref_code จาก database
      const { data, error } = await supabase
        .from('auth_sessions')
        .select('ref_code, status, expires_at')
        .eq('line_user_id', userId)
        .maybeSingle();
      
      if (error) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }
      
      if (data && data.ref_code) {
        // ส่งข้อความ
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🔐 รหัส Ref.Code ของคุณคือ "${data.ref_code}"`
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'ไม่พบรหัส Ref.Code ของคุณ\nกรุณาเพิ่มเป็นเพื่อนใหม่หรือติดต่อเจ้าหน้าที่'
        });
      }
    } else {
      // ส่งข้อความแนะนำการใช้งาน
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `สวัสดีครับ! 👋\n\nหากต้องการดูรหัส Ref.Code ของคุณ\nกรุณาพิมพ์: req_refcode`
      });
    }
    
  } catch (error) {
    console.error('Message Handler Error:', error.message);
    
    // ส่งข้อความ error แบบ generic
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
      });
    } catch (replyError) {
      console.error('Reply Error:', replyError.message);
    }
  }
};
};

module.exports = {
  handleMessageEvent
};
