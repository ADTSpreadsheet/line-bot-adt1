// routes/linewebhook.js
const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const { supabase } = require('../utils/supabaseClient');
const { validateLineWebhook, bypassValidation } = require('../middlewares/lineWebhookValidator');

// LINE config
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// สุ่ม Ref.Code (4 ตัวอักษรพิมพ์ใหญ่+ตัวเลข)
function generateRefCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// สร้าง serial_key
function generateSerialKey() {
  // ตัวอย่างการสร้าง serial key
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3 || i === 7 || i === 11) result += '-';
  }
  return result;
}

// ส่งข้อความ Serial Key ไปที่ผู้ใช้
async function sendSerialKey(lineUserId, refCode) {
  try {
    // ค้นหา serial key จาก ref_code
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key')
      .eq('ref_code', refCode)
      .eq('line_user_id', lineUserId);
      
    if (error || !data || data.length === 0) {
      console.error('❌ Error finding serial key:', error || 'No data found');
      return false;
    }
    
    // ส่ง serial key ไปที่ไลน์
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: `🔑 Serial Key ของคุณคือ: ${data[0].serial_key}`
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error sending serial key:', error);
    return false;
  }
}

// Webhook endpoint - ใช้ middleware ของเราเอง (แทนที่ line.middleware)
router.post('/webhook', validateLineWebhook(process.env.LINE_CHANNEL_SECRET), async (req, res) => {
  try {
    // ส่ง response กลับทันทีเพื่อให้ LINE platform รู้ว่าเราได้รับ webhook แล้ว
    res.status(200).end();
    
    const events = req.body.events;
    
    // ถ้าไม่มี events ไม่ต้องทำอะไรต่อ
    if (!events || events.length === 0) {
      return;
    }
    
    // ประมวลผล events
    for (const event of events) {
      // ✅ 1. ผู้ใช้เริ่มแชทกับบอท (follow)
      if (event.type === 'follow') {
        try {
          const lineUserId = event.source.userId;
          const refCode = generateRefCode();
          const serialKey = generateSerialKey();
          
          // บันทึก Ref.Code และ Serial Key ลงใน Supabase (ตาราง auth_sessions)
          const { data, error } = await supabase
            .from('auth_sessions')
            .upsert({ 
              line_user_id: lineUserId, 
              ref_code: refCode,
              serial_key: serialKey,
              status: 'PENDING',
              created_at: new Date().toISOString()
            });
            
          if (error) {
            console.error('❌ Supabase Error:', error.message);
            throw error;
          }
          
          console.log('🆕 ผู้ใช้ใหม่เริ่มแชทกับบอท');
          console.log('📩 LINE USER ID:', lineUserId);
          console.log('🔐 REF.CODE สร้างไว้และบันทึกใน Supabase:', refCode);
          console.log('🔑 SERIAL KEY สร้างและบันทึกแล้ว:', serialKey);
          
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `👋 สวัสดีครับ! ระบบพร้อมแล้ว คุณสามารถพิมพ์ REQ_REFCODE เพื่อรับรหัส Ref.Code ได้เลย`
          });
        } catch (error) {
          console.error('❌ Error handling follow event:', error);
        }
      }
      
      // ✅ 2. ตรวจสอบข้อความจากผู้ใช้
      else if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text.trim();
        const lineUserId = event.source.userId;
        
        if (userMessage === 'REQ_REFCODE') {
          try {
            // ดึง Ref.Code จาก Supabase
            const { data, error } = await supabase
              .from('auth_sessions')
              .select('ref_code')
              .eq('line_user_id', lineUserId);
              
            if (error) {
              console.error('❌ Supabase Error:', error.message);
              throw error;
            }
            
            if (!data || data.length === 0) {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '❌ ไม่พบรหัส Ref.Code ของคุณ กรุณาสแกน QR เพื่อเริ่มต้นใหม่ครับ'
              });
            } else {
              console.log('📩 LINE USER ID:', lineUserId);
              console.log('🔐 ส่ง REF.CODE:', data[0].ref_code);
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: `🔐 Ref.Code ของคุณคือ: ${data[0].ref_code}`
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
        }
      }
    }
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    // response ส่งไปแล้ว ไม่ต้องส่งอีก
  }
});

// API endpoint สำหรับตรวจสอบ Ref Code
router.post('/verify-refcode', async (req, res) => {
  try {
    const { refCode, lineUserId } = req.body;
    
    if (!refCode || !lineUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // ตรวจสอบว่า ref_code มีอยู่จริงและตรงกับ lineUserId หรือไม่
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('id')
      .eq('ref_code', refCode)
      .eq('line_user_id', lineUserId);
      
    if (error) {
      console.error('❌ Error verifying ref code:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid ref code or LINE user ID' 
      });
    }
    
    // ส่ง serial key ไปที่ไลน์
    const sent = await sendSerialKey(lineUserId, refCode);
    
    if (!sent) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send serial key' 
      });
    }
    
    // อัปเดตสถานะ
    await supabase
      .from('auth_sessions')
      .update({ status: 'REFCODE_VERIFIED' })
      .eq('ref_code', refCode)
      .eq('line_user_id', lineUserId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Ref code verified and serial key sent' 
    });
  } catch (error) {
    console.error('❌ Error in verify-refcode endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API endpoint สำหรับตรวจสอบ Serial Key
router.post('/verify-serialkey', async (req, res) => {
  try {
    const { refCode, serialKey } = req.body;
    
    if (!refCode || !serialKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // ตรวจสอบว่า serial_key ตรงกับ ref_code หรือไม่
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('line_user_id')
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey);
      
    if (error) {
      console.error('❌ Error verifying serial key:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid serial key or ref code' 
      });
    }
    
    // อัปเดตสถานะ
    await supabase
      .from('auth_sessions')
      .update({ 
        status: 'VERIFIED',
        verified_at: new Date().toISOString()
      })
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Serial key verified successfully',
      lineUserId: data[0].line_user_id
    });
  } catch (error) {
    console.error('❌ Error in verify-serialkey endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// API endpoint สำหรับบันทึกข้อมูลเพิ่มเติมจาก VBA
router.post('/complete-registration', async (req, res) => {
  try {
    const { refCode, userData } = req.body;
    
    if (!refCode || !userData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // อัปเดตข้อมูลเพิ่มเติม
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        ...userData,
        status: 'COMPLETED',
        machine_id: userData.machine_id || 'DEFAULT',
        completed_at: new Date().toISOString()
      })
      .eq('ref_code', refCode);
      
    if (error) {
      console.error('❌ Error completing registration:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Registration completed successfully' 
    });
  } catch (error) {
    console.error('❌ Error in complete-registration endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Webhook endpoint - เวอร์ชัน Bypass Validation สำหรับการทดสอบ
router.post('/webhook-test', bypassValidation(), async (req, res) => {
  try {
    res.status(200).end();
    console.log('📝 Test webhook received:', req.body);
  } catch (error) {
    console.error('❌ Test webhook error:', error);
  }
});

// Health check endpoint
router.get('/webhook', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'LINE webhook is accessible',
    config: {
      hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN)
    }
  });
});

// Health check endpoint (backward compatibility)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'LINE webhook is healthy' });
});

module.exports = router;
