const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  const { ref_code, username, password } = req.body;

  logger.info(`🟨 [LOGIN] เริ่มตรวจสอบการเข้าสู่ระบบ`);
  logger.info(`[LOGIN] 📥 Received | ref_code: "${ref_code}", username: "${username}", password: "${password}"`);

  // ตรวจสอบว่าได้รับค่ามาครบไหม
  if (!ref_code || !username || !password) {
    logger.warn(`⛔ [LOGIN] Missing input → ref_code: "${ref_code}", username: "${username}", password: "${password}"`);
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const trimmedRefCode = ref_code.trim();

    logger.info(`[LOGIN] 🔍 ค้นหาจากตาราง license_holders ด้วย ref_code: "${trimmedRefCode}"`);

    const { data, error } = await supabase
      .from('license_holders')
      .select('id, ref_code, username, password, first_name, last_name, login_count')
      .eq('ref_code', trimmedRefCode)
      .single();

    if (error || !data) {
      logger.warn(`❌ [LOGIN] ไม่พบ Ref.Code นี้ในระบบ: "${trimmedRefCode}"`);
      logger.warn(`[DEBUG] 📦 Supabase error: ${JSON.stringify(error)} | data: ${JSON.stringify(data)}`);

      return res.status(404).json({
        message: 'ไม่พบ Ref.Code นี้ในระบบ',
        received_ref_code: ref_code,
        trimmed_ref_code: trimmedRefCode
      });
    }

    logger.info(`[LOGIN] ✅ พบ Ref.Code แล้ว → username ในระบบ: ${data.username}`);

    // ตรวจสอบ username/password ภายใน row ที่เจอ
    if (data.username !== username || data.password !== password) {
      logger.warn(`❌ [LOGIN] Username หรือ Password ไม่ตรง`);
      logger.warn(`[DEBUG] 👉 Expected username: "${data.username}", password: "${data.password}"`);
      logger.warn(`[DEBUG] 👉 Received username: "${username}", password: "${password}"`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // อัปเดต last_login และ login_count
    const updatedLoginCount = (data.login_count || 0) + 1;

    await supabase
      .from('license_holders')
      .update({
        last_login: new Date().toISOString(),
        login_count: updatedLoginCount
      })
      .eq('ref_code', trimmedRefCode);

    logger.info(`✅ [LOGIN] Success! RefCode: ${trimmedRefCode} | Username: ${username}`);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: data.id,
        username: data.username,
        name: `${data.first_name} ${data.last_name}`,
        login_count: updatedLoginCount
      }
    });

  } catch (err) {
    logger.error(`🔥 [LOGIN] Unexpected error: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
};
