const express = require('express');
const router = express.Router();

const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');
const { createModuleLogger } = require('../../utils/logger');
const log = createModuleLogger('ADTLine-Bot');

const {
  getRandomWelcomeMessage,
  getRandomAnnoyedMessage
} = require('../../utils/randomMessageGenerator');

// LINE CONFIG
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 📌 ฟังก์ชันสร้าง Ref.Code + Serial Key
function generateRefCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const randLetter1 = letters.charAt(Math.floor(Math.random() * letters.length));
  const randLetter2 = letters.charAt(Math.floor(Math.random() * letters.length));
  const randDigit1 = digits.charAt(Math.floor(Math.random() * digits.length));
  const randDigit2 = digits.charAt(Math.floor(Math.random() * digits.length));
  const patterns = [
    randLetter1 + randLetter2 + randDigit1 + randDigit2,
    randDigit1 + randDigit2 + randLetter1 + randLetter2,
    randLetter1 + randDigit1 + randDigit2 + randLetter2,
    randDigit1 + randLetter1 + randDigit2 + randLetter2
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

function generateSerialKey() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let numericPart = '';
  let letterPart = '';
  for (let i = 0; i < 4; i++) {
    numericPart += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  for (let i = 0; i < 2; i++) {
    letterPart += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return numericPart + letterPart;
}

// ==============================
// 1️⃣ FOLLOW EVENT
// ==============================

const handleFollow = async (event) => {
  const userId = event.source.userId;
  const timestamp = new Date().toISOString();

  // Step 1: ดึงข้อมูลจาก Supabase
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('ref_code, expires_at, follow_count, status, source')  // เพิ่ม 'source'
    .eq('line_user_id', userId)
    .maybeSingle();

  if (error) {
    log.error(`[FOLLOW] ❌ ดึงข้อมูล Ref.Code ล้มเหลว: ${error.message}`);
    return;
  }

  let followCount = (data?.follow_count || 0) + 1;
  await supabase
    .from('auth_sessions')
    .update({
      follow_count: followCount,
      line_status: 'Follow'
    })
    .eq('line_user_id', userId);

  // Step 2: ตรวจสอบว่า source มาจากไหน
  const source = data?.source || 'Unknown';  // ค่าที่เก็บใน session ถ้าไม่มีค่าใช้ 'Unknown'
  
  // เพิ่ม log สำหรับตรวจสอบว่าได้ค่า source หรือไม่
  log.info(`[FOLLOW] 📜 ตรวจสอบ Source จาก: ${source} สำหรับผู้ใช้: ${userId}`);

  // Step 3: ตรวจสอบ source
  if (source === 'UserForm3') {
    log.info(`[FOLLOW] ✅ พบข้อมูล Source จาก UserForm3: ${userId}`);
    // ทำการดำเนินการต่อ
  } else if (source === 'VerifyLicenseForm') {
    log.info(`[FOLLOW] ✅ พบข้อมูล Source จาก VerifyLicenseForm: ${userId}`);
    // ทำการดำเนินการต่อ
  } else {
    log.warn(`[FOLLOW] ❌ ไม่พบข้อมูล Source สำหรับผู้ใช้: ${userId}`);
    // ถ้าไม่พบ source หรือไม่ตรงเงื่อนไขที่กำหนด
  }

  // Step 4: ถ้าเกิน 5 ครั้ง → BLOCK
  if (followCount >= 5) {
    await supabase
      .from('auth_sessions')
      .update({
        follow_count: followCount,
        verify_status: 'BLOCK',
        line_status: 'Follow'
      })
      .eq('line_user_id', userId);

    log.warn(`[FOLLOW] 🚫 LINE USER ${userId} ถูก BLOCK เพราะ Follow เกิน 5 ครั้ง`);
    await client.pushMessage(userId, {
      type: 'text',
      text: `คุณได้ทำการบล็อก/ปลดบล็อกบ่อยเกินไป\nระบบขอระงับสิทธิ์การใช้งานชั่วคราวครับ 😔`
    });
    return;
  }

  // Step 5: ถ้าผู้ใช้มี Ref.Code แล้ว
  if (data && data.ref_code) {
    const now = new Date().toISOString();

    // Step 6: เช็คว่า Ref.Code หมดอายุหรือยัง
    if (data.expires_at && data.expires_at <= now) {
      log.warn(`[FOLLOW] ⌛ Ref.Code ของผู้ใช้ ${userId} หมดอายุแล้ว`);

      await supabase
        .from('auth_sessions')
        .update({ follow_count: followCount, line_status: 'Follow' })
        .eq('line_user_id', userId);

      await client.pushMessage(userId, {
        type: 'text',
        text: `🔒 Ref.Code ของคุณหมดอายุแล้วครับ\nกรุณาติดต่อเจ้าหน้าที่หรือทำรายการสั่งซื้อเพื่อเปิดใช้งานอีกครั้ง 🙏`
      });

      return;
    }

    // ถ้า Ref.Code ยังไม่หมดอายุ → อัปเดตสถานะเป็น follow
    await supabase
      .from('auth_sessions')
      .update({ follow_count: followCount, line_status: 'Follow' })
      .eq('line_user_id', userId);

    log.info(`[FOLLOW] ✅ พบผู้ใช้เก่าที่ยังมี Ref.Code ใช้งานได้: ${userId}`);

    await client.pushMessage(userId, {
      type: 'text',
      text: `${getRandomWelcomeMessage()}\n\n🔐 Ref.Code ของพี่คือ: ${data.ref_code}`
    });

    return;
  }

  // Step 7: ถ้าเป็นผู้ใช้ใหม่ → สร้าง Ref.Code + Serial Key
  const refCode = generateRefCode();
  const serialKey = generateSerialKey();

  const { error: insertError } = await supabase
    .from('auth_sessions')
    .insert({
      line_user_id: userId,
      ref_code: refCode,
      serial_key: serialKey,
      status: 'PENDING',
      created_at: timestamp,
      line_status: 'Follow',
      follow_count: followCount,
      source: source // ใช้ค่าจาก source ที่ได้รับ
    });

  if (insertError) {
    log.error(`[FOLLOW] ❌ สร้าง Ref.Code ใหม่ไม่สำเร็จ: ${insertError.message}`);
    return;
  }

  await supabase
    .from('registered_machines')
    .update({ line_status: 'Follow' })
    .eq('line_user_id', userId);

  log.info(`[FOLLOW] ✅ สร้าง Ref.Code และ Serial Key สำเร็จ`);

  // Step 8: อัปเดตสถานะให้เป็น ACTIVE และบันทึกเวลา completed_at
  await supabase
    .from('auth_sessions')
    .update({
      status: 'ACTIVE',
      completed_at: new Date().toISOString()
    })
    .eq('ref_code', refCode);

  // ส่งข้อความต้อนรับจาก "น้องบอส"
  await client.pushMessage(userId, {
    type: 'text',
    text: `ยินดีต้อนรับเข้าสู่การใช้งานโปรแกรม ADTSpreadsheet\nขอบพระคุณที่เพิ่มน้องบอสมาเป็นเพื่อนครับ`
  });
};

// ==============================
// 2️⃣ MESSAGE EVENT
// ==============================
const handleMessage = async (event) => {
  const userId = event.source.userId;
  const msg = event.message;

  if (msg.type !== 'text') return;

  const text = msg.text.trim().toLowerCase();

  if (text === 'req_refcode') {
    log.info(`ให้ผู้ใช้: ${userId} ขอ [REQ_REFCODE]`);

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('ref_code')
      .eq('line_user_id', userId)
      .single();

    if (error || !data || !data.ref_code) {
      log.warn(`[REQ_REFCODE] ไม่พบ Ref.Code สำหรับ: ${userId}`);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ ไม่พบ Ref.Code ของคุณ กรุณาสแกน QR ใหม่ก่อนใช้งานครับ'
      });
      return;
    }

    log.info(`🔐 Ref.Code: ${data.ref_code}`);
    log.success('ส่ง Ref.Code สำเร็จ');

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🔐 Ref.Code ของคุณคือ: ${data.ref_code}`
    });
  }
};

// ==============================
// 3️⃣ Unfollow ADTLine-Bot
// ==============================
const handleUnfollow = async (event) => {
  const userId = event.source.userId;
  const updates = { line_status: 'unfollow' };

  log.warn(`🔥 ผู้ใช้ ${userId} เลิกติดตาม ADTLine-Bot แล้ว`);

  // อัปเดต line_status ใน auth_sessions
  const { error: authError } = await supabase
    .from('registered_machines')
    .update({
      line_status: 'Unfollow',
    })
    .eq('line_user_id', userId);

  if (authError) {
    log.error(`❌ อัปเดต line_status (auth_sessions) ล้มเหลว: ${authError.message}`);
  } else {
    log.info(`✅ อัปเดต auth_sessions -> line_status = 'unfollow' สำเร็จ`);
  }

  // อัปเดต line_status ใน registered_machines
  const { error: regError } = await supabase
    .from('registered_machines')
    .update(updates)
    .eq('line_user_id', userId);

  if (regError) {
    log.error(`❌ อัปเดต line_status (registered_machines) ล้มเหลว: ${regError.message}`);
  } else {
    log.info(`✅ อัปเดต registered_machines -> line_status = 'unfollow' สำเร็จ`);
  }
};




// ==============================
// 3️⃣ SEND SERIAL KEY AFTER REF.CODE VERIFIED
// ==============================

async function sendLineMessage(lineUserId, serialKey, refCode) {
  try {
    const message = `🔐 สำหรับ Ref.Code: ${refCode}\n➡️ Serial Key คือ   ${serialKey}`;
    await client.pushMessage(lineUserId, {
      type: 'text',
      text: message
    });
    log.info(`✅ ส่ง Serial Key ไปยัง LINE User ID: ${lineUserId}`);
  } catch (error) {
    log.error(`❌ ส่งข้อความไป LINE ไม่สำเร็จ: ${error.message}`);
    throw error;
  }
}

// ==============================
// WEBHOOK ROUTE
// ==============================
router.post('/', async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    return res.status(200).end();
  }

  for (const event of events) {
    if (event.type === 'follow') {
      await handleFollow(event);
    } else if (event.type === 'message') {
      await handleMessage(event);
    }
  }

  res.status(200).end();
});


module.exports = {
  router,
  sendLineMessage
};
