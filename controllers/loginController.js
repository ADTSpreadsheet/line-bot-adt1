const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  const { ref_code, username, password } = req.body;

  logger.info(`🟨 [LOGIN] เริ่มตรวจสอบ | ref_code: "${ref_code}", username: "${username}"`);

  if (!ref_code || !username || !password) {
    logger.warn(`⛔ [LOGIN] ข้อมูลไม่ครบ`);
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const trimmedRefCode = ref_code.trim();

    const { data, error } = await supabase
      .from('license_holders')
      .select('ref_code, username, password, first_name, last_name, login_count')
      .eq('ref_code', trimmedRefCode)
      .single();

    if (error || !data) {
      logger.warn(`❌ [LOGIN] ไม่พบ Ref.Code: "${trimmedRefCode}"`);
      return res.status(404).json({ message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    if (data.username !== username || data.password !== password) {
      logger.warn(`❌ [LOGIN] Username หรือ Password ไม่ตรง`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const updatedLoginCount = (data.login_count || 0) + 1;

    await supabase
      .from('license_holders')
      .update({
        last_login: new Date().toISOString(),
        login_count: updatedLoginCount
      })
      .eq('ref_code', trimmedRefCode);

    logger.info(`✅ [LOGIN] สำเร็จ → username: ${username}`);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        username: data.username,
        name: `${data.first_name} ${data.last_name}`,
        login_count: updatedLoginCount
      }
    });

  } catch (err) {
    logger.error(`🔥 [LOGIN] ERROR: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
};
