// controllers/relayController.js
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.pkTLXAp+M+m+7wZ+Wx1j8PzpzN7wpH9UWaPtosU6utEdmQylQjxIalKVX4kPqhTU1Tj4HjRxMzQu0V9eFYXH78QVYfxLftp6uqyzZsLACPb41tdH7MDARHoFBn/QAlLaoQ+PAwOU5tpKXJ6Iq+fWaQdB04t89/1O/w1cDnyilFU=,
  channelSecret: process.env.3558642df20f8e7e357c70c5ffd826f4
};

const client = new line.Client(config);

// ส่งข้อความไปยัง LINE BOT 2 หรือ BOT 3
const relayMessage = async (destinationBot, messageText) => {
  try {
    let lineUserId;

    // จำลองว่าเราหา userId ปลายทางตามระบบจริง (เช่น BOT2)
    if (destinationBot === 'BOT2') {
      lineUserId = process.env.Ua1cd02be16435b311c4a90cea9bee87e;
    } else if (destinationBot === 'BOT3') {
      lineUserId = process.env.BOT3_LINE_USER_ID;
    } else {
      throw new Error('Unknown destination bot');
    }

    await client.pushMessage(lineUserId, {
      type: 'text',
      text: messageText
    });

    console.log(`✅ ส่งข้อความไปยัง ${destinationBot} สำเร็จ`);
  } catch (error) {
    console.error('❌ relayMessage error:', error.message);
    throw error;
  }
};

module.exports = { relayMessage };
