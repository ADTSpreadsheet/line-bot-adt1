const { supabase } = require('../../utils/supabaseClient');

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
  
  // สร้าง ref_code และ serial_key
  const refCode = generateRefCode();
  const serialKey = generateSerialKey();

  // บันทึกลง auth_sessions
  const { error } = await supabase
    .from('auth_sessions')
    .insert({
      line_user_id: userId,
      ref_code: refCode,
      serial_key: serialKey
    });

  if (error) {
    console.error('❌ บันทึก auth_sessions ล้มเหลว:', error.message);
    return;
  }

  console.log('✅ Follow Event สำเร็จ - Ref.Code:', refCode, 'Serial Key:', serialKey);
};

module.exports = {
  handleFollowEvent
};
