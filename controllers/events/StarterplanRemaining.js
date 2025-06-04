const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');

// LINE CONFIG
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 📌 Starterplan Remaining Handler
const handleStarterplanRemaining = async (refCode, remainingMinutes) => {
  try {
    // ดึง line_user_id จาก ref_code
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', refCode)
      .single();

    if (error || !data) {
      console.error('❌ ไม่พบ line_user_id สำหรับ ref_code:', refCode);
      return;
    }

    const userId = data.line_user_id;

    // เช็คว่า remaining_minutes เป็น 0 หรือไม่
    if (remainingMinutes === 0) {
      // ส่งข้อความแจ้งหมดอายุ
      await client.pushMessage(userId, {
        type: 'text',
        text: 'ADTSpreadsheet Version Starter Plan ของท่านได้หมดอายุแล้ว หากต้องการใช้งานต่อเนื่องกรุณาลงทะเบียนเพิ่มครับ'
      });

      console.log('✅ ส่งข้อความหมดอายุสำเร็จ - Ref.Code:', refCode);
    } else {
      // ส่งข้อความแจ้งเวลาคงเหลือ
      await client.pushMessage(userId, {
        type: 'text',
        text: `คุณได้ทำการออกจากโปรแกรมเวลา : "${remainingMinutes}"`
      });

      console.log('✅ ส่งข้อความเวลาคงเหลือสำเร็จ - Ref.Code:', refCode, 'Remaining:', remainingMinutes);
    }

  } catch (error) {
    console.error('❌ Starterplan Remaining Error:', error.message);
  }
};

module.exports = {
  handleStarterplanRemaining
};
