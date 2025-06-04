const { relayFromBot1ToBot2, relayFromBot1ToBot3, relayFromBot2ToBot1 } = require('./relayController');
const { handleImageUpload } = require('./UploadImageController'); // 👈 เพิ่มตรงนี้
const { client } = require('../utils/lineClient');
const log = require('../utils/logger').createModuleLogger('Line3D');
const { supabase } = require('../utils/supabaseClient');

const handleLine3DMessage = async (event) => {
  const userId = event.source.userId;
  const msg = event.message;
  const isFromAdmin = await checkIfAdmin(userId);

  log.info(`📥 Message3D | userId: ${userId} | type: ${msg.type}`);

  // 📌 กรณีลูกค้าส่งข้อความ text
  if (!isFromAdmin && msg.type === 'text') {
    
    // ✅ เพิ่มการเช็ค req_refcode เพื่อข้ามไป
    if (msg.text.trim().toLowerCase() === 'req_refcode') {
      log.info(`[3D-CONTROLLER] ข้าม req_refcode ให้ eventLine จัดการ`);
      return; // ข้ามไป ไม่ต้องประมวลผลใน 3D System
    }
    
    const refInfo = await getRefRouting(userId);
    const refCode = refInfo?.ref_code || "???";
    const source = refInfo?.source || "Unknown";
    let destination = refInfo?.destination_bot || "BOT2";

    if (msg.text.includes("สนใจ")) {
      await sendFlexSwitchToSales(event.replyToken, refCode, source);
      return;
    }

    if (msg.text === '!switch_to_sales') {
      await supabase
        .from('auth_sessions')
        .update({ destination_bot: 'BOT3' })
        .eq('ref_code', refCode);

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: "✅ ระบบจะส่งข้อความของคุณไปยังฝ่ายขายโดยตรงครับ"
      });
      return;
    }

    const { data: licenseData } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name')
      .eq('ref_code', refCode)
      .maybeSingle();

    let formattedMsg = '';
    if (source === 'license_verified' && licenseData) {
      formattedMsg = `🪪 ${licenseData.license_no} ${licenseData.first_name} ${licenseData.last_name}\n${msg.text}`;
    } else {
      formattedMsg = `📩 Ref.code : ${refCode} (${source})\n${msg.text}`;
    }

    if (destination === 'BOT3') {
      await relayFromBot1ToBot3(refCode, userId, formattedMsg);
    } else {
      await relayFromBot1ToBot2(refCode, userId, formattedMsg);
    }
    return;
  }

  // 🧠 หากเป็นประเภทอื่น
  switch (msg.type) {
    case 'text':
      await relayFromBot2ToBot1(userId, msg.text);
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
      if (!isFromAdmin) {
        const refInfo = await getRefRouting(userId);
        const refCode = refInfo?.ref_code || "unknown";
        const imageURL = await handleImageUpload(msg.id, refCode, 'chat'); // 👈 ใช้ UploadImageController

        const imageMsg = {
          type: "image",
          originalContentUrl: imageURL,
          previewImageUrl: imageURL
        };

        await relayFromBot1ToBot2(userId, imageMsg);
      } else {
        await relayFromBot2ToBot1(userId, `📎 [IMAGE] จากแอดมิน → messageId: ${msg.id}`);
      }
      break;

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

const getRefRouting = async (userId) => {
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('ref_code, source, destination_bot')
    .eq('line_user_id', userId)
    .maybeSingle();

  return data || null;
};

const sendFlexSwitchToSales = async (replyToken, refCode, source) => {
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `Ref.code : ${refCode} (${source})`,
          weight: "bold",
          color: "#1DB446",
          size: "sm"
        },
        {
          type: "text",
          text: "คุณสนใจสั่งซื้อใช่ไหมครับ?\nกดปุ่มด้านล่างเพื่อพูดคุยกับฝ่ายขายได้เลยครับ",
          wrap: true,
          margin: "md",
          size: "md"
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#0D99FF",
          action: {
            type: "message",
            label: "ส่งให้ฝ่ายขาย",
            text: "!switch_to_sales"
          }
        }
      ]
    }
  };

  await client.replyMessage(replyToken, {
    type: "flex",
    altText: "เปลี่ยนเส้นทางไปยังฝ่ายขาย",
    contents: bubble
  });
};

const checkIfAdmin = async (userId) => {
  return process.env.ADMIN_USER_ID === userId;
};

module.exports = {
  handleLine3DMessage
};
