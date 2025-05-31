const line = require('@line/bot-sdk');
require('dotenv').config();

// TUMCIVIL Bot Configuration
const config = {
  channelAccessToken: process.env.TUMCIVIL_BOT_ACCESS_TOKEN,
  channelSecret: process.env.TUMCIVIL_BOT_CHANNEL_SECRET
};

const client = new line.Client(config);

// 📥 Webhook Handler สำหรับ TUMCIVIL Bot
const handleTumcivilWebhook = async (req, res) => {
  try {
    console.log('🤖 TUMCIVIL Webhook received');
    
    const events = req.body.events;
    
    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    // Process each event
    const promises = events.map(async (event) => {
      console.log('📥 Event type:', event.type);
      console.log('👤 User ID:', event.source?.userId);
      
      try {
        // Handle เมื่อมีคนส่งข้อความมา
        if (event.type === 'message' && event.message.type === 'text') {
          const userId = event.source.userId;
          const messageText = event.message.text;
          
          console.log(`💬 Message from ${userId}: ${messageText}`);
          
          // ตอบกลับพร้อม User ID
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `สวัสดีคุณตั้ม! 👋\n\n` +
                  `📋 ข้อความที่ได้รับ: ${messageText}\n\n` +
                  `🆔 User ID ของคุณ:\n${userId}\n\n` +
                  `📝 กรุณาคัดลอก User ID นี้ไปใส่ใน Environment Variables:\n` +
                  `TUMCIVIL_ADMIN_USER_ID=${userId}\n\n` +
                  `✅ หลังจากตั้งค่าแล้ว คุณจะได้รับการแจ้งเตือนจากระบบ ADT!`
          });
        }
        
        // Handle เมื่อมีคน Add Friend
        if (event.type === 'follow') {
          const userId = event.source.userId;
          
          console.log(`🎉 New follower: ${userId}`);
          
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🎉 ยินดีต้อนรับเข้าสู่ TUMCIVIL Bot!\n\n` +
                  `👤 คุณตั้ม User ID:\n${userId}\n\n` +
                  `📝 กรุณานำ User ID นี้ไปตั้งค่าใน Environment Variables:\n` +
                  `TUMCIVIL_ADMIN_USER_ID=${userId}\n\n` +
                  `🔔 ระบบพร้อมส่งการแจ้งเตือนคำสั่งซื้อใหม่แล้ว!`
          });
        }
        
        // Handle เมื่อมีคน Unfollow
        if (event.type === 'unfollow') {
          const userId = event.source.userId;
          console.log(`😢 User unfollowed: ${userId}`);
        }
        
        // Handle Postback (จากปุ่ม Flex Message)
        if (event.type === 'postback') {
          const userId = event.source.userId;
          const postbackData = event.postback.data;
          
          console.log(`🔘 Postback from ${userId}: ${postbackData}`);
          
          // Parse postback data (approve_order&ADT157&32XO)
          const [action, licenseNo, refCode] = postbackData.split('&');
          
          if (action === 'approve_order') {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `✅ คำสั่งซื้อได้รับการอนุมัติแล้ว!\n\n` +
                    `📋 License: ${licenseNo}\n` +
                    `🔖 Ref: ${refCode}\n\n` +
                    `📧 ระบบจะส่งอีเมลยืนยันให้ลูกค้าทราบ`
            });
          }
          
          if (action === 'reject_order') {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `❌ คำสั่งซื้อถูกปฏิเสธแล้ว!\n\n` +
                    `📋 License: ${licenseNo}\n` +
                    `🔖 Ref: ${refCode}\n\n` +
                    `📧 ระบบจะแจ้งให้ลูกค้าทราบและดำเนินการต่อไป`
            });
          }
        }
        
        return Promise.resolve(null);
        
      } catch (error) {
        console.error('❌ Error processing event:', error);
        return Promise.resolve(null);
      }
    });

    await Promise.all(promises);
    console.log('✅ All events processed successfully');
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ TUMCIVIL Webhook error:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      error: error.message 
    });
  }
};

// 📤 ส่ง Flex Message ไปหาคุณตั้ม (เรียกใช้จาก sendOrderFlex)
const notifyTumcivilAdmin = async (flexMessage) => {
  try {
    const targetUserId = process.env.TUMCIVIL_ADMIN_USER_ID;
    
    if (!targetUserId) {
      throw new Error('❌ ไม่พบ TUMCIVIL_ADMIN_USER_ID ใน Environment Variables');
    }
    
    console.log('📤 Sending notification to TUMCIVIL Admin:', targetUserId);
    
    await client.pushMessage(targetUserId, flexMessage);
    
    console.log('✅ Notification sent successfully to TUMCIVIL Admin');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to send notification to TUMCIVIL Admin:', error);
    return { success: false, error: error.message };
  }
};

// 🔄 ฟังก์ชันทดสอบการส่งข้อความ
const testTumcivilMessage = async (req, res) => {
  try {
    const { message } = req.body;
    
    const targetUserId = process.env.TUMCIVIL_ADMIN_USER_ID;
    
    if (!targetUserId) {
      return res.status(400).json({ 
        message: '❌ ไม่พบ TUMCIVIL_ADMIN_USER_ID' 
      });
    }
    
    await client.pushMessage(targetUserId, {
      type: 'text',
      text: message || '🧪 นี่คือข้อความทดสอบจาก TUMCIVIL Bot!'
    });
    
    res.status(200).json({ 
      message: '✅ ส่งข้อความทดสอบสำเร็จ',
      targetUserId 
    });
    
  } catch (error) {
    console.error('❌ Test message error:', error);
    res.status(500).json({ 
      message: 'ส่งข้อความทดสอบไม่สำเร็จ',
      error: error.message 
    });
  }
};

module.exports = {
  handleTumcivilWebhook,
  notifyTumcivilAdmin,
  testTumcivilMessage
};
