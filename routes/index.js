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
          expires_at: expiresAt,
          failed_attempts: 0
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
    
    // ตรวจสอบว่าถูกบล็อคหรือไม่
    if (session.failed_attempts !== null && session.failed_attempts >= 3) {
      console.log(`❌ ref_code ถูกบล็อคแล้ว: ${refCode}`);
      return res.status(403).json({
        success: false,
        message: 'Ref.Code นี้ถูกระงับการใช้งานเนื่องจากมีการพยายามใช้ผิดพลาดหลายครั้ง'
      });
    }
    
    console.log(`✅ ref_code ถูกต้อง: ${refCode}, lineId: ${session.line_user_id}`);
    
    // อัปเดตสถานะเป็น 'VERIFIED'
    await db.updateSessionByRefCode(refCode, {
      status: 'VERIFIED',
      verify_count: session.verify_count + 1,
      verify_at: now,
      updated_at: now
    });
    
    // ส่ง Serial Key ไปยังผู้ใช้ LINE
    await pushText(session.line_user_id, `✅ รหัส Serial Key ของคุณคือ: ${session.serial_key}
โปรดป้อนรหัสนี้ในแอป Excel ของคุณเพื่อเปิดใช้งาน
รหัสนี้จะหมดอายุใน 5 นาที`);
    
    // ส่งข้อมูลกลับไป
    return res.json({
      success: true,
      message: 'ยืนยัน Ref.Code สำเร็จ และได้ส่ง Serial Key ไปยัง LINE ของคุณแล้ว'
    });
  } catch (err) {
    console.error('❌ Error verifying ref_code:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// เพิ่มเส้นทางสำหรับตรวจสอบ Serial Key
router.post('/verify-serial-key', async (req, res) => {
  const { refCode, serialKey } = req.body;
  console.log('📩 Verify Serial Key request received:', JSON.stringify(req.body));
  
  if (!refCode || !serialKey) {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    });
  }
  
  try {
    // ค้นหา session ด้วย ref_code
    const session = await db.findSessionByRefCode(refCode);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ Ref.Code'
      });
    }
    
    // ตรวจสอบว่าถูกบล็อคหรือไม่
    if (session.failed_attempts !== null && session.failed_attempts >= 3) {
      return res.status(403).json({
        success: false,
        message: 'Ref.Code นี้ถูกระงับการใช้งานเนื่องจากมีการพยายามใช้ผิดพลาดหลายครั้ง'
      });
    }
    
    // ตรวจสอบว่าหมดอายุหรือไม่
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0] + '+07';
    
    if (session.day_created_at !== today || session.expires_at < now) {
      return res.status(400).json({
        success: false,
        message: 'Ref.Code หมดอายุแล้ว'
      });
    }
    
    // ตรวจสอบสถานะว่าเป็น 'VERIFIED' หรือไม่
    if (session.status !== 'VERIFIED') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาตรวจสอบ Ref.Code ก่อน'
      });
    }
    
    // ตรวจสอบว่า Serial Key ตรงกับในฐานข้อมูลหรือไม่
    if (session.serial_key !== serialKey) {
      // Serial Key ไม่ถูกต้อง เพิ่มจำนวนความพยายาม
      const failedAttempts = (session.failed_attempts === null ? 0 : session.failed_attempts) + 1;
      
      const updateData = {
        failed_attempts: failedAttempts,
        updated_at: now
      };
      
      // ถ้าล้มเหลว 3 ครั้ง ให้ล็อคบัญชี
      if (failedAttempts >= 3) {
        updateData.status = 'BLOCKED';
        
        // ส่งข้อความแจ้งเตือนไปยังผู้ใช้ LINE
        await pushText(session.line_user_id, `⚠️ มีการพยายามใช้ Ref.Code ${refCode} ของคุณกรอก Serial Key ผิด 3 ครั้ง ระบบได้ระงับการใช้งานแล้ว`);
      }
      
      await db.updateSessionByRefCode(refCode, updateData);
      
      return res.status(400).json({
        success: false,
        message: 'Serial Key ไม่ถูกต้อง',
        failedAttempts: failedAttempts,
        isBlocked: failedAttempts >= 3
      });
    }
    
    // อัปเดตสถานะเป็น 'ACTIVATED'
    await db.updateSessionByRefCode(refCode, {
      status: 'ACTIVATED',
      updated_at: now
    });
    
    // ส่งข้อความแจ้งเตือนไปยังผู้ใช้ LINE
    await pushText(session.line_user_id, `✅ ยืนยันการลงทะเบียนสำเร็จ! คุณสามารถใช้งาน ADTSpreadsheet ได้ 7 วัน ขอบคุณที่ใช้บริการ`);
    
    return res.json({
      success: true,
      message: 'ยืนยัน Serial Key สำเร็จ'
    });
  } catch (err) {
    console.error('❌ Error verifying serial key:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
});

// เพิ่มเส้นทางสำหรับบันทึกความพยายามที่ล้มเหลว
router.post('/log-failed-attempt', async (req, res) => {
  const { refCode, attemptedKey } = req.body;
  console.log('📩 Log failed attempt request received:', JSON.stringify(req.body));
  
  if (!refCode) {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    });
  }
  
  try {
    // ค้นหา session ด้วย ref_code
    const session = await db.findSessionByRefCode(refCode);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ Ref.Code'
      });
    }
    
    // เพิ่มจำนวนครั้งที่พยายาม
    const failedAttempts = (session.failed_attempts === null ? 0 : session.failed_attempts) + 1;
    
    // อัปเดตสถานะและจำนวนครั้งที่พยายาม
    const now = new Date().toTimeString().split(' ')[0] + '+07';
    let updateData = {
      failed_attempts: failedAttempts,
      updated_at: now
    };
    
    // ถ้าล้มเหลว 3 ครั้ง ให้ล็อคบัญชี
    if (failedAttempts >= 3) {
      updateData.status = 'BLOCKED';
      
      // ส่งข้อความแจ้งเตือนไปยังผู้ใช้ LINE
      const userId = session.line_user_id;
      if (userId) {
        await pushText(userId, `⚠️ มีการพยายามใช้ Ref.Code ${refCode} ของคุณกรอก Serial Key ผิด 3 ครั้ง ระบบได้ระงับการใช้งานแล้ว`);
      }
    }
    
    await db.updateSessionByRefCode(refCode, updateData);
    
    return res.json({
      success: true,
      message: 'บันทึกความพยายามเรียบร้อย',
      failedAttempts: failedAttempts,
      isBlocked: failedAttempts >= 3
    });
  } catch (err) {
    console.error('❌ Error logging failed attempt:', err);
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
