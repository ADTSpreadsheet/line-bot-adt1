// routes/events/eventLine.js
const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ==============================
// 1️⃣ FOLLOW EVENT
// ==============================
const handleFollow = async (event) => {
  const userId = event.source.userId;
  const timestamp = new Date().toISOString();

  await supabase.from('auth_sessions').upsert({
    line_user_id: lineUserId,
    ref_code: refCode,
    serial_key: serialKey,
    status: 'PENDING',
    created_at: timestamp
  });

  // บันทึกผู้ใช้ใหม่ลงฐานข้อมูล
  await supabase.from('auth_sessions').upsert({
    line_user_id: userId,
    status: 'NEW',
    created_at: timestamp
  });

  console.log(`[FOLLOW] ผู้ใช้ใหม่: ${userId}`);
};

// ==============================
// 2️⃣ UNFOLLOW EVENT
// ==============================
const handleUnfollow = async (event) => {
  const userId = event.source.userId;

  // อัปเดตสถานะในฐานข้อมูล
  await supabase.from('auth_sessions')
    .update({
      status: 'BLOCKED',
      unfollowed_at: new Date().toISOString()
    })
    .eq('line_user_id', userId);

  console.log(`[UNFOLLOW] ผู้ใช้บล็อกบอท: ${userId}`);
};

// ==============================
// 3️⃣ MESSAGE EVENT
// ==============================
const handleMessage = async (event) => {
  const userId = event.source.userId;
  const msg = event.message;

  // กรองเฉพาะข้อความเท่านั้น
  if (msg.type !== 'text') {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '📛 ระบบรองรับเฉพาะข้อความเท่านั้น รอการพัฒนานะครับ'
    });
    return;
  }

  const text = msg.text.trim().toLowerCase();

  switch (text) {
    case 'req_refcode':
      // ให้ไปเขียน handler จริงในภายหลัง
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🔐 โปรดกรอก Ref.Code ของคุณในช่อง Excel เพื่อดำเนินการต่อครับ'
      });
      break;

    /*case 'ออกแบบคาน':
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📐 แบบคานมาตรฐาน: https://adtspreadsheet.com/beam-template'
      });
      break;

    case 'คู่มือ':
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📘 คู่มือการใช้งาน: https://adtspreadsheet.com/manual'
      });
      break;*/

    default:
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❓ คำสั่งไม่ถูกต้อง กรุณาพิมพ์ "คู่มือ" เพื่อดูคำสั่งที่รองรับครับ'
      });
      break;
  }

  console.log(`[MESSAGE] จากผู้ใช้ ${userId}: ${text}`);
};

// ==============================
module.exports = {
  handleFollow,
  handleUnfollow,
  handleMessage
};
