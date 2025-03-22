/**
 * services/lineService.js
 * จัดการการส่งข้อความกลับไปยังผู้ใช้ LINE
 */

const axios = require('axios');
const CONFIG = require('../config');

// ✅ ส่งข้อความตอบกลับ (Reply Message)
const replyMessage = async (replyToken, message) => {
  try {
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [message]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.LINE.BOT1.CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error replying to LINE:', error.response?.data || error.message);
  }
};

// ✅ ส่งข้อความแบบ push (Push Message ไปหาผู้ใช้โดยตรง)
const pushMessage = async (userId, message) => {
  try {
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: userId,
        messages: [message]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.LINE.BOT1.CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error pushing message to LINE:', error.response?.data || error.message);
  }
};

module.exports = {
  replyMessage,
  pushMessage
};
