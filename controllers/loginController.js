const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  logger.info(`🟨 [LOGIN] Checking login for username: ${username}`);

  if (!username || !password) {
    logger.warn(`⛔ [LOGIN] Missing username or password`);
    return res.status(400).json({ message: 'กรุณากรอก Username และ Password ให้ครบถ้วน' });
  }

  try {
    // 🔍 ดึงข้อมูลจากตาราง license_holders
    const { data, error } = await supabase
      .from('license_holders')
      .select('id, username, password, first_name, last_name, login_count')
      .eq('username', username)
      .single();

    if (error || !data) {
      logger.warn(`❌ [LOGIN] Username not found: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 🔐 ตรวจสอบรหัสผ่าน (ยังไม่ hash)
    if (data.password !== password) {
      logger.warn(`❌ [LOGIN] Incorrect password for username: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ✅ อัปเดต last_login และ login_count
    const updatedLoginCount = (data.login_count || 0) + 1;

    await supabase
      .from('license_holders')
      .update({
        last_login: new Date().toISOString(),
        login_count: updatedLoginCount
      })
      .eq('username', username);

    logger.info(`✅ [LOGIN] Success! Username: ${username} | Count: ${updatedLoginCount}`);

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
