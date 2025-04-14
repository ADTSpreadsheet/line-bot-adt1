const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.BOT2_LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.BOT2_LINE_SECRET
};

const client = new line.Client(config);

// 🎯 ส่งข้อความจาก BOT1 ไปยัง BOT2
const relayFromBot1ToBot2 = async (refCode, userId, messageText) => {
  try {
    const lineUserId = process.env.BOT2_LINE_USER_ID;

    const message = {
      type: 'text',
      text: `📨 [ลูกค้า]\nRef.Code: ${refCode}\n\n${messageText}`
    };

    await client.pushMessage(lineUserId, message);
    console.log('✅ ส่งข้อความไปยัง BOT2 สำเร็จ');
  } catch (error) {
    console.error('❌ ส่งข้อความไปยัง BOT2 ล้มเหลว:', error.message);
    throw error;
  }
};

// 🎯 ส่งข้อความจาก BOT1 ไปยัง BOT3
const relayFromBot1ToBot3 = async (refCode, userId, messageText) => {
  try {
    const lineUserId = process.env.BOT3_LINE_USER_ID;

    const message = {
      type: 'text',
      text: `📨 [ลูกค้า]\nRef.Code: ${refCode}\n\n${messageText}`
    };

    await client.pushMessage(lineUserId, message);
    console.log('✅ ส่งข้อความไปยัง BOT3 สำเร็จ');
  } catch (error) {
    console.error('❌ ส่งข้อความไปยัง BOT3 ล้มเหลว:', error.message);
    throw error;
  }
};

// 🎯 ส่งข้อความจาก BOT2/BOT3 → กลับไปหาลูกค้า (userId)
const relayFromBot2ToBot1 = async (userId, message) => {
  try {
    await client.pushMessage(userId, message);
    console.log('✅ ส่งข้อความกลับหาลูกค้าสำเร็จ');
  } catch (error) {
    console.error('❌ ส่งกลับหาลูกค้าล้มเหลว:', error.message);
    throw error;
  }
};

module.exports = {
  relayFromBot1ToBot2,
  relayFromBot1ToBot3,
  relayFromBot2ToBot1
};
