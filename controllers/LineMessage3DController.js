// controllers/LineMessage3DController.js
const { relayFromBot1ToBot2, relayFromBot2ToBot1 } = require('./relayController');
const { client } = require('../utils/lineClient');
const log = require('../utils/logger').createModuleLogger('Line3D');

const handleLine3DMessage = async (event) => {
  const userId = event.source.userId;
  const msg = event.message;
  const isFromAdmin = await checkIfAdmin(userId); // 🔍 ตรวจว่ามาจาก Bot2 (พี่เก่ง) หรือไม่

  log.info(`📥 Message3D | userId: ${userId} | type: ${msg.type}`);

  switch (msg.type) {
    case 'text':
      if (isFromAdmin) {
        await relayFromBot2ToBot1(userId, msg.text);
      } else {
        await relayFromBot1ToBot2(userId, msg.text);
      }
      break;

    case 'sticker':
      const stickerMsg = {
        type: 'sticker',
        packageId: msg.packageId,
        stickerId: msg.stickerId
      };
      if (isFromAdmin) {
        await relayFromBot2ToBot1(userId, stickerMsg);
      } else {
        await relayFromBot1ToBot2(userId, stickerMsg);
      }
      break;

    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      const mediaNotice = `📎 [${msg.type.toUpperCase()}] จาก ${isFromAdmin ? 'แอดมิน' : 'ลูกค้า'} → messageId: ${msg.id}`;
      if (isFromAdmin) {
        await relayFromBot2ToBot1(userId, mediaNotice);
      } else {
        await relayFromBot1ToBot2(userId, mediaNotice);
      }
      break;

    default:
      log.warn(`❌ ไม่รองรับข้อความประเภท: ${msg.type}`);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ข้อความประเภทนี้ยังไม่รองรับนะครับ'
      });
  }
};

const checkIfAdmin = async (userId) => {
  // 🔐 ตรงนี้พี่เก่งสามารถปรับ logic ตรวจว่า userId นี้คือแอดมินได้
  // ตัวอย่าง: เช็คจาก Supabase หรือเทียบกับ ADMIN_USER_ID ใน .env ก็ได้
  return process.env.ADMIN_USER_ID === userId;
};

module.exports = {
  handleLine3DMessage
};
