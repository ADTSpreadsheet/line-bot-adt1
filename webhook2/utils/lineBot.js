// lineBot.js - ฟังก์ชันสำหรับส่งข้อความผ่าน LINE Messaging API

const axios = require('axios');
const config = require('../config');

/**
 * ส่งข้อความแจ้งเตือนไปยัง Admin เมื่อมีการลงทะเบียนใหม่
 * @param {Object} registrationData - ข้อมูลการลงทะเบียนที่จะส่งไปแจ้งเตือน
 * @returns {Promise} ผลลัพธ์การส่งข้อความ
 */
async function sendNewRegistrationNotification(registrationData) {
  try {
    const message = createRegistrationMessage(registrationData);
    
    const response = await axios({
      method: 'post',
      url: 'https://api.line.me/v2/bot/message/push',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      data: {
        to: config.ADMIN_LINE_USER_ID,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      }
    });

    console.log('[Webhook2] LINE notification sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('[Webhook2] Error sending LINE notification:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * สร้างข้อความแจ้งเตือนการลงทะเบียนใหม่
 * @param {Object} data - ข้อมูลการลงทะเบียน
 * @returns {string} ข้อความที่จะส่งไปยัง LINE
 */
function createRegistrationMessage(data) {
  // สร้างรูปแบบข้อความแจ้งเตือน
  const message = `${config.NEW_REGISTRATION_MESSAGE}\n\n` +
    `ชื่อ: ${data.name || '-'}\n` +
    `นามสกุล: ${data.lastName || '-'}\n` +
    `ที่อยู่: ${data.houseNumber || '-'} ${data.district || '-'} ${data.province || '-'}\n` +
    `โทรศัพท์: ${data.phone || '-'}\n` +
    `อีเมล: ${data.email || '-'}\n` +
    `เลขบัตรประชาชน: ${maskNationalId(data.nationalId || '-')}\n` +
    `วันที่ลงทะเบียน: ${new Date().toLocaleString('th-TH')}\n` +
    `หมดอายุ: ${new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString('th-TH')}`;
  
  return message;
}

/**
 * ปกปิดเลขบัตรประชาชนบางส่วนเพื่อความปลอดภัย
 * @param {string} nationalId - เลขบัตรประชาชน
 * @returns {string} เลขบัตรประชาชนที่ถูกปกปิดบางส่วน
 */
function maskNationalId(nationalId) {
  if (nationalId.length !== 13) return nationalId;
  
  // แสดงเฉพาะ 4 ตัวแรกและ 4 ตัวสุดท้าย ส่วนตรงกลางแทนด้วย X
  return `${nationalId.substring(0, 4)}XXXXX${nationalId.substring(9)}`;
}

module.exports = {
  sendNewRegistrationNotification
};
