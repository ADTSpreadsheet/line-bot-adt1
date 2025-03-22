/**
 * services/lineService.js
 * บริการที่เกี่ยวข้องกับ LINE API
 */

const line = require('@line/bot-sdk');
const CONFIG = require('../config');

// สร้าง LINE Client สำหรับ Bot 1
const lineClientBot1 = new line.Client({
  channelAccessToken: CONFIG.LINE.BOT1.ACCESS_TOKEN,
  channelSecret: CONFIG.LINE.BOT1.CHANNEL_SECRET
});

/**
 * ส่งข้อความไปยังผู้ใช้
 * @param {string} userId - LINE user ID
 * @param {Object} message - ข้อความที่จะส่ง
 * @returns {Promise}
 */
const sendMessage = async (userId, message) => {
  try {
    return await lineClientBot1.pushMessage(userId, message);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * ตอบกลับข้อความ
 * @param {string} replyToken - Token สำหรับตอบกลับข้อความ
 * @param {Object} message - ข้อความที่จะตอบกลับ
 * @returns {Promise}
 */
const replyMessage = async (replyToken, message) => {
  try {
    return await lineClientBot1.replyMessage(replyToken, message);
  } catch (error) {
    console.error('Error replying message:', error);
    throw error;
  }
};

module.exports = {
  lineClientBot1,
  sendMessage,
  replyMessage
};
