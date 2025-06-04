const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');

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

// 📌 ฟังก์ชันสร้าง Ref.Code
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

// 📌 ฟังก์ชันสร้าง Serial Key
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

// 📌 Logic 1: Follow Event Handler
const handleFollowEvent = async (event) => {
  const userId = event.source.userId;
  const timestamp = new Date().toISOString();

  // Step 1: ดึงข้อมูลจาก Supabase
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('ref_code, expires_at, follow_count, status')
    .eq('line_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('❌ ดึงข้อมูล Ref.Code ล้มเหลว:', error.message);
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

  // Step 2: ถ้าเกิน 5 ครั้ง → BLOCK
  if (followCount >= 5) {
    await supabase
      .from('auth_sessions')
      .update({
        follow_count: followCount,
        verify_status: 'BLOCK',
        line_status: 'Follow'
      })
      .eq('line_user_id', userId);

    console.warn(`🚫 LINE USER ${userId} ถูก BLOCK เพราะ Follow เกิน 5 ครั้ง`);
    await client.pushMessage(userId, {
      type: 'text',
      text: `คุณได้ทำการบล็อก/ปลดบล็อกบ่อยเกินไป\nระบบขอระงับสิทธิ์การใช้งานชั่วคราวครับ 😔`
    });
    return;
  }

  // Step 3: ถ้าผู้ใช้มี Ref.Code แล้ว
  if (data && data.ref_code) {
    const now = new Date().toISOString();

    // Step 4: เช็คว่า Ref.Code หมดอายุหรือยัง
    if (data.expires_at && data.expires_at <= now) {
      console.warn(`⌛ Ref.Code ของผู้ใช้ ${userId} หมดอายุแล้ว`);

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

    console.log(`✅ พบผู้ใช้เก่าที่ยังมี Ref.Code ใช้งานได้: ${userId}`);

    await client.pushMessage(userId, {
      type: 'text',
      text: `${getRandomWelcomeMessage()}\n\n🔐 Ref.Code ของพี่คือ: ${data.ref_code}`
    });

    return;
  }

  // Step 5: ถ้าเป็นผู้ใช้ใหม่ → สร้าง Ref.Code + Serial Key
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
      follow_count: followCount
    });

  if (insertError) {
    console.error('❌ สร้าง Ref.Code ใหม่ไม่สำเร็จ:', insertError.message);
    return;
  }

  await supabase
    .from('registered_machines')
    .update({ line_status: 'Follow' })
    .eq('line_user_id', userId);

  // Step 6: อัปเดตสถานะให้เป็น ACTIVE และบันทึกเวลา completed_at
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

  console.log('✅ Follow Event สำเร็จ - Ref.Code:', refCode, 'Serial Key:', serialKey, 'Follow Count:', followCount);
};

module.exports = {
  handleFollowEvent
};
