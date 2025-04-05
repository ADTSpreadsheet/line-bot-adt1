const express = require('express');
const router = express.Router();

const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');
const { createModuleLogger } = require('../../utils/logger');
const log = createModuleLogger('ADTLine-Bot');

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
  const refCode = generateRefCode();
  const serialKey = generateSerialKey();

  const sessionPayload = {
    line_user_id: userId,
    ref_code: refCode,
    serial_key: serialKey,
    status: 'PENDING',
    created_at: timestamp,
    line_status: 'follow' // ✅ เพิ่มตรงนี้
  };

  const machinePayload = {
    line_user_id: userId,
    line_status: 'follow' // ✅ เพิ่มตรงนี้
  };

  // ✅ อัปเดตตาราง auth_sessions
  const { error: sessionError } = await supabase
    .from('auth_sessions')
    .upsert(sessionPayload);

  if (sessionError) {
    log.error('[FOLLOW] บันทึก auth_sessions ล้มเหลว:', sessionError);
    return;
  }

  // ✅ อัปเดตตาราง registered_machines
  const { error: machineError } = await supabase
    .from('registered_machines')
    .update(machinePayload)
    .eq('line_user_id', userId);

  if (machineError) {
    log.warn('[FOLLOW] อัปเดต line_status ใน registered_machines ไม่สำเร็จ:', machineError);
  } else {
    log.info(`[FOLLOW] อัปเดต line_status = 'follow' สำเร็จใน registered_machines สำหรับ ${userId}`);
  }

  // ✅ Log สวย ๆ
  log.info('[FOLLOW] ผู้ใช้รายใหม่เพิ่ม ADTLine-Bot เป็นเพื่อน');
  log.info(`LINE USER ID: ${userId}`);
  log.info(`🔐 Ref.Code: ${refCode}`);
  log.info(`🔑 Serial Key: ${serialKey}`);
  log.success('✅ บันทึกลง Supabase สำเร็จ');
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

  log.warn(`👋 ผู้ใช้ ${userId} เลิกติดตาม ADTLine-Bot แล้ว`);

  const { error: authError } = await supabase
    .from('auth_sessions')
    .update(updates)
    .eq('line_user_id', userId);

  if (authError) {
    log.error(`❌ อัปเดต line_status (auth_sessions) ล้มเหลว: ${authError.message}`);
  } else {
    log.info(`✅ auth_sessions → line_status = 'unfollow' สำเร็จ`);
  }

  const { error: regError } = await supabase
    .from('registered_machines')
    .update(updates)
    .eq('line_user_id', userId);

  if (regError) {
    log.error(`❌ อัปเดต line_status (registered_machines) ล้มเหลว: ${regError.message}`);
  } else {
    log.info(`✅ registered_machines → line_status = 'unfollow' สำเร็จ`);
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
