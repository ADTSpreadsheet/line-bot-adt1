// controllers/relayController.js
const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// ส่งข้อความไปยัง LINE BOT 2 หรือ BOT 3
const relayMessage = async (destinationBot, messageText) => {
  try {
    let lineUserId;

    if (destinationBot === 'BOT2') {
      lineUserId = process.env.BOT2_LINE_USER_ID;
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
