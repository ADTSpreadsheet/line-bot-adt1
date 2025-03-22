const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../database');
const { generateRefCode, generateSerialKey, calculateExpiryTime } = require('../utils/helpers');
const LINE_TOKEN = process.env.LINE_BOT1_ACCESS_TOKEN;

// เส้นทางหลัก
router.get('/', (req, res) => {
  res.send('LINE Bot API is running!');
});

router.post('/webhook', async (req, res) => {
  console.log('📩 Webhook request received:', JSON.stringify(req.body).substring(0, 200) + '...');
  
  const events = req.body.events;
  if (!events || events.length === 0) {
    console.log('❌ No events received');
    return res.status(200).end();
  }
  
  for (const event of events) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;
    const messageType = event.message?.type;
    const messageText = event.message?.text;
    
    // ตรวจสอบว่า replyToken ถูกต้องหรือไม่
    if (!replyToken || replyToken === '00000000000000000000000000000000') {
      console.log('⚠️ ไม่มี replyToken หรือเป็น token สำหรับ webhook verification');
      continue; // ข้ามไปยังเหตุการณ์ถัดไป
    }
    
    console.log(`✅ Received from ${userId}: ${messageText}`);
    console.log(`📊 Event type: ${event.type}, Message type: ${messageType}`);
    
    if (messageText === 'REQ_REFCODE') {
      console.log('🔍 Processing REQ_REFCODE command');
      
      try {
        // ตรวจสอบว่ามี Ref.Code ที่ยังไม่หมดอายุ
        console.log(`🔍 Checking active sessions for user: ${userId}`);
        const existingSession = await db.findActiveSessionByUser(userId, 'PENDING');
        
        if (existingSession) {
          console.log(`📌 Found existing session: ${JSON.stringify(existingSession)}`);
          await replyText(replyToken, `📌 คุณมี Ref.Code ที่ยังใช้งานได้
รหัสคือ: ${existingSession.ref_code}`, userId);
          continue;
        }
        
        // สร้าง Ref.Code และ Serial Key ใหม่
        const refCode = generateRefCode();
        const serialKey = generateSerialKey();
        const expiresAt = calculateExpiryTime(15); // นาที
        
        // สร้างวันที่และเวลาปัจจุบัน
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentTime = now.toTimeString().split(' ')[0] + '+07'; // HH:MM:SS+07
        
        const sessionData = {
          line_user_id: userId,
          ref_code: refCode,
          serial_key: serialKey,
          status: 'PENDING',
          request_count: 1,
          verify_count: 0,
          day_created_at: currentDate,
          time_created_at: currentTime,
          updated_at: currentTime,
          verify_at: currentTime,
          expires_at: expiresAt
        };
        
        console.log('📋 Creating session with data:', JSON.stringify(sessionData));
        
        const { data, error } = await db.createSession(sessionData);
        
        if (error) {
          console.error('❌ Failed to create session:', error);
          await replyText(replyToken, 'เกิดข้อผิดพลาดในการสร้างรหัส กรุณาลองใหม่ภายหลัง', userId);
          continue;
        }
        
        console.log('✅ Session created successfully:', data);
        
        await replyText(replyToken, `✅ สร้าง Ref.Code สำเร็จแล้ว!
รหัสของคุณคือ: ${refCode}
กรุณากรอกใน Excel VBA แล้วกด Verify ครับ ✅`, userId);
      } catch (err) {
        console.error('❌ Error processing REQ_REFCODE:', err);
        await replyText(replyToken, 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง', userId);
      }
    } else if (messageText === 'PING') {
      // เพิ่มคำสั่งทดสอบการเชื่อมต่อ
      await replyText(replyToken, 'PONG! ระบบทำงานปกติ', userId);
    } else {
      // สำหรับข้อความอื่นๆ
      await replyText(replyToken, `คุณพิมพ์ว่า: ${messageText}`, userId);
    }
  }
  
  res.status(200).send('OK');
});

// เพิ่มเส้นทางสำหรับ VBA: ตรวจสอบ Ref.Code
router.get('/verify/:refCode', async (req, res) => {
  const { refCode } = req.params;
  
  console.log(`🔍 Verifying ref_code: ${refCode}`);
  
  try {
    // ค้นหา session ด้วย ref_code
    const session = await db.findSessionByRefCode(refCode);
    
    if (!session) {
      console.log(`❌ ไม่พบ ref_code: ${refCode}`);
      return res.status(404).json({
        success: false,
        message: 'Ref.Code ไม่ถูกต้อง'
      });
    }
    
    // ตรวจสอบว่าหมดอายุหรือไม่
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0] + '+07';
    
    if (session.day_created_at !== today || session.expires_at < now) {
      console.log(`❌ ref_code หมดอายุแล้ว: ${refCode}`);
      return res.status(400).json({
        success: false,
        message: 'Ref.Code หมดอายุแล้ว'
      });
    }
    
    // ตรวจสอบสถานะว่าเป็น 'PENDING' หรือไม่
    if (session.status !== 'PENDING') {
      console.log(`❌ ref_code ถูกใช้งานไปแล้ว: ${refCode}`);
      return res.status(400).json({
        success: false,
        message: 'Ref.Code นี้ถูกใช้งานไปแล้ว'
      });
    }
    
    console.log(`✅ ref_code ถูกต้อง: ${refCode}, lineId: ${session.line_user_id}`);
    
    // ส่งข้อมูลกลับไป
    return res.json({
      success: true,
      lineId: session.line_user_id,
      message: 'ยืนยัน Ref.Code สำเร็จ'
    });
  } catch (err) {
    console.error('❌ Error verifying ref_code:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// เพิ่มเส้นทางสำหรับ VBA: ส่ง Serial Key
router.post('/webhook/verify-serial-key', async (req, res) => {
  console.log('📩 Verify Serial Key request received:', JSON.stringify(req.body));
  
  const { userId, serialKey } = req.body;
  
  if (!userId || !serialKey) {
    console.log('❌ ข้อมูลไม่ครบถ้วน');
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    });
  }
  
  try {
    // ค้นหา session ที่มี line_user_id ตรงกับที่ระบุ
    const { data, error } = await db.supabase
      .from('auth_sessions')
      .select('*')
      .eq('line_user_id', userId)
      .eq('status', 'PENDING')
      .order('day_created_at', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error('❌ Error finding session:', error);
      return res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูล'
      });
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ ไม่พบ session สำหรับ userId: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้'
      });
    }
    
    const session = data[0];
    
    // อัปเดตสถานะเป็น 'VERIFIED' และเพิ่ม verify_count
    const now = new Date().toTimeString().split(' ')[0] + '+07';
    const { updateData, updateError } = await db.updateSessionByRefCode(session.ref_code, {
      status: 'VERIFIED',
      verify_count: session.verify_count + 1,
      verify_at: now,
      updated_at: now
    });
    
    if (updateError) {
      console.error('❌ Error updating session:', updateError);
    }
    
    // ส่ง Serial Key ไปยังผู้ใช้ทาง LINE
    await pushText(userId, `✅ รหัส Serial Key ของคุณคือ: ${serialKey}
โปรดป้อนรหัสนี้ในแอป Excel ของคุณเพื่อเปิดใช้งาน
รหัสนี้จะหมดอายุใน 5 นาที`);
    
    return res.json({
      success: true,
      message: 'ส่ง Serial Key สำเร็จ'
    });
  } catch (err) {
    console.error('❌ Error processing serial key verification:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

/**
 * ส่งข้อความตอบกลับไปยัง LINE
 * @param {string} replyToken - Token สำหรับตอบกลับ
 * @param {string} text - ข้อความที่ต้องการส่ง
 * @param {string} userId - ID ของผู้ใช้ (สำหรับใช้กับ Push API หากต้องใช้)
 * @returns {Promise<boolean>} - สถานะการส่งข้อความ
 */
async function replyText(replyToken, text, userId) {
  try {
    // ตรวจสอบ replyToken ก่อนส่ง
    if (!replyToken || replyToken === '00000000000000000000000000000000') {
      console.log('⚠️ ไม่สามารถใช้ Reply API: replyToken ไม่ถูกต้อง');
      // ถ้ามี userId ให้ใช้ Push API แทน
      if (userId) {
        return await pushText(userId, text);
      }
      return false;
    }
    
    console.log('📤 Sending reply with text:', text);
    
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages: [{ type: 'text', text }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    console.log('✅ Reply sent successfully:', response.status);
    return true;
  } catch (err) {
    console.error('❌ Error replying to LINE:', err.response?.data || err.message);
    
    // ถ้าเป็นข้อผิดพลาด Invalid reply token และมี userId ให้ลองใช้ Push API แทน
    if (err.response?.data?.message === 'Invalid reply token' && userId) {
      console.log('🔄 Falling back to Push API');
      return await pushText(userId, text);
    }
    
    if (err.response) {
      console.error('❌ Status:', err.response.status);
      console.error('❌ Data:', JSON.stringify(err.response.data));
    }
    
    return false;
  }
}

/**
 * ส่งข้อความแบบ push ไปยังผู้ใช้ LINE
 * @param {string} userId - ID ของผู้ใช้
 * @param {string} text - ข้อความที่ต้องการส่ง
 * @returns {Promise<boolean>} - สถานะการส่งข้อความ
 */
async function pushText(userId, text) {
  try {
    console.log('📤 Sending push message to', userId);
    
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: userId,
        messages: [{ type: 'text', text }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_TOKEN}`
        }
      }
    );
    
    console.log('✅ Push sent successfully:', response.status);
    return true;
  } catch (err) {
    console.error('❌ Error pushing to LINE:', err.response?.data || err.message);
    if (err.response) {
      console.error('❌ Push API error status:', err.response.status);
      console.error('❌ Push API error data:', JSON.stringify(err.response.data));
    }
    return false;
  }
}

module.exports = router;
