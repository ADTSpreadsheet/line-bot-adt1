// utils/lineBot.js
const axios = require('axios');
const logger = require('./logger');

// ใช้สำหรับ Bot ฝ่ายซักประวัติ
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API_URL = 'https://api.line.me/v2/bot';

/**
 * ส่งข้อความไปยังผู้ใช้ผ่าน LINE Messaging API
 * @param {string} userId - LINE User ID
 * @param {string} message - ข้อความที่ต้องการส่ง
 * @returns {Promise<Object>} - ผลลัพธ์การส่งข้อความ
 */
const sendLineMessage = async (userId, message) => {
  try {
    if (!LINE_TOKEN) {
      logger.error('❌ LINE token is missing in environment variables!');
      throw new Error('LINE token is missing');
    }
    
    if (!userId) {
      logger.error('❌ LINE User ID is required');
      throw new Error('LINE User ID is required');
    }
    
    const response = await axios.post(
      `${LINE_API_URL}/message/push`,
      {
        to: userId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    logger.info(`📨 ส่งข้อความถึง LINE User: ${userId.substring(0, 6)}... เรียบร้อย`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    logger.error(`❌ ส่งข้อความ LINE ไม่สำเร็จ: ${userId}`, errorMessage);
    
    // Log เพิ่มเติมสำหรับดีบัก
    if (error.response) {
      logger.debug('LINE API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
};

/**
 * ส่งรูปภาพไปยังผู้ใช้ผ่าน LINE Messaging API
 * @param {string} userId - LINE User ID
 * @param {string} originalUrl - URL ของรูปภาพขนาดเต็ม
 * @param {string} previewUrl - URL ของรูปภาพตัวอย่าง (ถ้าไม่ระบุจะใช้ originalUrl)
 * @returns {Promise<Object>} - ผลลัพธ์การส่งรูปภาพ
 */
const sendLineImage = async (userId, originalUrl, previewUrl = originalUrl) => {
  try {
    if (!LINE_TOKEN) {
      logger.error('❌ LINE token is missing in environment variables!');
      throw new Error('LINE token is missing');
    }
    
    const response = await axios.post(
      `${LINE_API_URL}/message/push`,
      {
        to: userId,
        messages: [
          {
            type: 'image',
            originalContentUrl: originalUrl,
            previewImageUrl: previewUrl
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    logger.info(`🖼️ ส่งรูปภาพถึง LINE User: ${userId.substring(0, 6)}... เรียบร้อย`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    logger.error(`❌ ส่งรูปภาพ LINE ไม่สำเร็จ: ${userId}`, errorMessage);
    throw error;
  }
};

/**
 * ส่งข้อความหลายข้อความในครั้งเดียว
 * @param {string} userId - LINE User ID
 * @param {string[]} messages - อาร์เรย์ของข้อความที่ต้องการส่ง
 * @returns {Promise<Object>} - ผลลัพธ์การส่งข้อความ
 */
const sendMultipleMessages = async (userId, messages) => {
  try {
    if (!LINE_TOKEN) {
      logger.error('❌ LINE token is missing in environment variables!');
      throw new Error('LINE token is missing');
    }
    
    const messageObjects = messages.map(msg => ({
      type: 'text',
      text: msg
    }));
    
    const response = await axios.post(
      `${LINE_API_URL}/message/push`,
      {
        to: userId,
        messages: messageObjects
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    logger.info(`📨 ส่ง ${messages.length} ข้อความถึง LINE User: ${userId.substring(0, 6)}... เรียบร้อย`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    logger.error(`❌ ส่งหลายข้อความ LINE ไม่สำเร็จ: ${userId}`, errorMessage);
    throw error;
  }
};

/**
 * ส่งข้อความพร้อมปุ่มกด (Buttons Template)
 * @param {string} userId - LINE User ID
 * @param {string} text - ข้อความหลัก
 * @param {Array} actions - อาร์เรย์ของปุ่มกด
 * @returns {Promise<Object>} - ผลลัพธ์การส่งข้อความ
 */
const sendButtonTemplate = async (userId, text, actions) => {
  try {
    if (!LINE_TOKEN) {
      logger.error('❌ LINE token is missing in environment variables!');
      throw new Error('LINE token is missing');
    }
    
    const response = await axios.post(
      `${LINE_API_URL}/message/push`,
      {
        to: userId,
        messages: [
          {
            type: 'template',
            altText: text,
            template: {
              type: 'buttons',
              text: text,
              actions: actions
            }
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    logger.info(`🔘 ส่งข้อความพร้อมปุ่มกดถึง LINE User: ${userId.substring(0, 6)}... เรียบร้อย`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    logger.error(`❌ ส่งข้อความพร้อมปุ่ม LINE ไม่สำเร็จ: ${userId}`, errorMessage);
    throw error;
  }
};

/**
 * ตรวจสอบว่า LINE User ID ยังคงใช้งานได้หรือไม่
 * @param {string} userId - LINE User ID ที่ต้องการตรวจสอบ
 * @returns {Promise<boolean>} - ผลการตรวจสอบ (true = ยังใช้งานได้)
 */
const verifyLineUser = async (userId) => {
  try {
    if (!LINE_TOKEN) {
      logger.error('❌ LINE token is missing in environment variables!');
      throw new Error('LINE token is missing');
    }
    
    // ใช้ Get Profile API เพื่อตรวจสอบว่า User ID ยังใช้งานได้อยู่
    const response = await axios.get(
      `${LINE_API_URL}/profile/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    logger.debug(`✅ LINE User ID: ${userId.substring(0, 6)}... ยังใช้งานได้`);
    return true;
  } catch (error) {
    // ถ้าเกิด 404 แสดงว่าไม่พบผู้ใช้ หรืออาจจะถูกบล็อก
    if (error.response && error.response.status === 404) {
      logger.warn(`⚠️ LINE User ID: ${userId.substring(0, 6)}... อาจไม่มีอยู่หรือบล็อกบอท`);
      return false;
    }
    
    // ถ้าเกิดข้อผิดพลาดอื่น ให้ถือว่าไม่สามารถตรวจสอบได้
    logger.error(`❌ ไม่สามารถตรวจสอบ LINE User ID: ${userId}`, error.message);
    throw error;
  }
};

module.exports = {
  sendLineMessage,
  sendLineImage,
  sendMultipleMessages,
  sendButtonTemplate,
  verifyLineUser
};
