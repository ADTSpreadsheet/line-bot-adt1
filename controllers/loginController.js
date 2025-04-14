const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  logger.info(`🟨 [LOGIN] Checking login for username: ${username}`);

  // 1. ตรวจสอบว่ารับค่ามาครบไหม
  if (!username || !password) {
    logger.warn(`⛔ [LOGIN] Missing username or password`);
    return res.status(400).json({ message: 'กรุณากรอก Username และ Password ให้ครบถ้วน' });
  }

  try {
    // 2. ดึงข้อมูลจาก Supabase
    const { data, error } = await supabase
      .from('adt_users') // ✅ เปลี่ยนเป็นชื่อจริงของตารางที่พี่ใช้
      .select('id, username, password, first_name, last_name')
      .eq('username', username)
      .single();

    // 3. ถ้าไม่เจอ username
    if (error || !data) {
      logger.warn(`❌ [LOGIN] Username not found: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 4. ตรวจสอบ password (ตรงเป๊ะ — ยังไม่ใช้ hash)
    if (data.password !== password) {
      logger.warn(`❌ [LOGIN] Incorrect password for username: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 5. สำเร็จ 🎉
    logger.info(`✅ [LOGIN] Success! Username: ${username}`);
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: data.id,
        username: data.username,
        name: `${data.first_name} ${data.last_name}`
      }
    });

  } catch (err) {
    logger.error(`🔥 [LOGIN] Unexpected error: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
};
