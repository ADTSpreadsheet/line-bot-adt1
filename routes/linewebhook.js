// routes/linewebhook.js
const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');

// LINE config
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);

// สุ่ม Ref.Code (4 ตัวอักษรพิมพ์ใหญ่+ตัวเลข)
function generateRefCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Webhook endpoint
router.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    
    for (const event of events) {
      // ✅ 1. ผู้ใช้เริ่มแชทกับบอท (follow)
      if (event.type === 'follow') {
        try {
          const lineUserId = event.source.userId;
          const refCode = generateRefCode();
          
          // บันทึก Ref.Code ลงใน Supabase (ตาราง auth_sessions)
          const { data, error } = await supabase
            .from('auth_sessions')
            .upsert({ 
              line_user_id: lineUserId, 
              ref_code: refCode,
              created_at: new Date().toISOString()
            });
            
          if (error) {
            console.error('❌ Supabase Error:', error.message);
            throw error;
          }
          
          console.log('🆕 ผู้ใช้ใหม่เริ่มแชทกับบอท');
          console.log('📩 LINE USER ID:', lineUserId);
          console.log('🔐 REF.CODE สร้างไว้และบันทึกใน Supabase:', refCode);
          
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `👋 สวัสดีครับ! ระบบพร้อมแล้ว คุณสามารถพิมพ์ REQ_REFCODE เพื่อรับรหัส Ref.Code ได้เลย`
          });
        } catch (error) {
          console.error('❌ Error handling follow event:', error);
        }
        continue;
      }
      
      // ✅ 2. ตรวจสอบข้อความจากผู้ใช้
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text.trim();
        const lineUserId = event.source.userId;
        
        if (userMessage === 'REQ_REFCODE') {
          try {
            // ดึง Ref.Code จาก Supabase
            const { data, error } = await supabase
              .from('auth_sessions')
              .select('ref_code')
              .eq('line_user_id', lineUserId)
              .single();
              
            if (error) {
              console.error('❌ Supabase Error:', error.message);
              throw error;
            }
            
            if (!data || !data.ref_code) {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '❌ ไม่พบรหัส Ref.Code ของคุณ กรุณาสแกน QR เพื่อเริ่มต้นใหม่ครับ'
              });
            } else {
              console.log('📩 LINE USER ID:', lineUserId);
              console.log('🔐 ส่ง REF.CODE:', data.ref_code);
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: `🔐 Ref.Code ของคุณคือ: ${data.ref_code}`
              });
            }
          } catch (error) {
            console.error('❌ Error handling REQ_REFCODE message:', error);
            
            // ส่งข้อความแจ้งว่าเกิดข้อผิดพลาด
            try {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '⚠️ เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้งในภายหลัง'
              });
            } catch (replyError) {
              console.error('❌ Error sending error message:', replyError);
            }
          }
          continue;
        }
      }
    }
    
    // ส่งคำตอบกลับ LINE Platform
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'LINE webhook is healthy' });
});

module.exports = router;
