const refCode = generateRefCode();
const serialKey = generateSerialKey();
const eventLine = require('./events/eventLine');

// บันทึกลง Supabase
await supabase.from('auth_sessions').upsert({
  line_user_id: lineUserId,
  ref_code: refCode,
  serial_key: serialKey,
  status: 'PENDING',
  created_at: new Date().toISOString()
});
หน่วยสอดแนมอย่าพึ่ง ครับ
