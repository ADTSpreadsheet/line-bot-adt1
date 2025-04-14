const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  const { ref_code, username, password } = req.body;

  logger.info(`🟨 [LOGIN] Checking login for ref_code: ${ref_code} | username: ${username}`);

  // ตรวจสอบ input
  if (!ref_code || !username || !password) {
    logger.warn(`⛔ [LOGIN] Missing input fields`);
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    // 1. ค้นด้วย Ref.Code ก่อน
    const { data, error } = await supabase
      .from('license_holders')
      .select('id, ref_code, username, password, first_name, last_name, login_count')
      .eq('ref_code', ref_code)
      .single();

    if (error || !data) {
      logger.warn(`❌ [LOGIN] Ref.Code not found: ${ref_code}`);
      return res.status(404).json({ message: 'ไม่พบ Ref.Code นี้ในระบบ' });
    }

    // 2. ตรวจสอบ Username และ Password ภายใน row ที่เจอ
    if (data.username !== username || data.password !== password) {
      logger.warn(`❌ [LOGIN] Username/Password mismatch for ref_code: ${ref_code}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 3. อัปเดต Login Log
    const updatedLoginCount = (data.login_count || 0) + 1;

    await supabase
      .from('license_holders')
      .update({
        last_login: new Date().toISOString(),
        login_count: updatedLoginCount
      })
      .eq('ref_code', ref_code);

    logger.info(`✅ [LOGIN] Success! ref_code: ${ref_code} | username: ${username}`);

    // 4. ส่งข้อมูลกลับ
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
