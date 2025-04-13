const { lineClient } = require('./lineClient'); // ถ้าบอทเชื่อมต่อผ่าน lineClient.js

const sendLineText = async (lineId, message) => {
  try {
    if (!lineId || !message) {
      console.warn('⚠️ ข้อมูลไม่ครบสำหรับส่งข้อความ LINE');
      return;
    }

    await lineClient.pushMessage(lineId, {
      type: 'text',
      text: message
    });

    console.log('📤 ส่งข้อความผ่าน LINE สำเร็จ →', lineId);
  } catch (err) {
    console.error('❌ ส่งข้อความ LINE ไม่สำเร็จ:', err.message);
  }
};

module.exports = { sendLineText };
