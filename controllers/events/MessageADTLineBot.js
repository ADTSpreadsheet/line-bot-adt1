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
  console.log('🔥 Message Handler เริ่มทำงาน');
  
  try {
    const userId = event.source.userId;
    const msg = event.message;
    
    console.log(`📝 User: ${userId}, Message Type: ${msg.type}`);
    
    // เช็คว่าเป็น text message
    if (msg.type !== 'text') {
      console.log('⚠️ ไม่ใช่ text message - ข้าม');
      return;
    }
    
    const text = msg.text.trim().toLowerCase();
    console.log(`💬 Text Message: "${text}"`);
    
    // เช็คคำสั่ง req_refcode
    if (text === 'req_refcode') {
      console.log('🔍 ค้นหา ref_code ใน database...');
      
      // ดึง ref_code จาก database
      const { data, error } = await supabase
        .from('auth_sessions')
        .select('ref_code')
        .eq('line_user_id', userId)
        .maybeSingle(); // ใช้ maybeSingle แทน single
      
      if (error) {
        console.log('❌ Database Error:', error.message);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
        });
        return;
      }
      
      if (data && data.ref_code) {
        console.log(`✅ พบ ref_code: ${data.ref_code}`);
        
        // ส่งข้อความ
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🔐 รหัส Ref.Code ของคุณคือ "${data.ref_code}"`
        });
        
        console.log('📤 ส่งข้อความ ref_code สำเร็จ');
      } else {
        console.log('⚠️ ไม่พบ ref_code สำหรับผู้ใช้นี้');
        
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'ไม่พบรหัส Ref.Code ของคุณ\nกรุณาเพิ่มเป็นเพื่อนใหม่หรือติดต่อเจ้าหน้าที่'
        });
        
        console.log('📤 ส่งข้อความแจ้งไม่พบ ref_code สำเร็จ');
      }
    } else {
      console.log(`ℹ️ ข้อความ "${text}" ไม่ตรงกับคำสั่งใดๆ`);
      
      // ส่งข้อความแนะนำการใช้งาน
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `สวัสดีครับ! 👋\n\nหากต้องการดูรหัส Ref.Code ของคุณ\nกรุณาพิมพ์: req_refcode`
      });
      
      console.log('📤 ส่งข้อความแนะนำการใช้งานสำเร็จ');
    }
    
  } catch (error) {
    console.log('❌ Message Handler Error:', error.message);
    console.log('❌ Error Stack:', error.stack);
    
    // ส่งข้อความ error แบบ generic
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
      });
    } catch (replyError) {
      console.log('❌ ส่งข้อความ error ไม่สำเร็จ:', replyError.message);
    }
  }
  
  console.log('✅ Message Handler สิ้นสุด');
};

module.exports = {
  handleMessageEvent
};
