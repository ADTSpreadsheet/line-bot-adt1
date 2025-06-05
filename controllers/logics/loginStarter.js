const supabase = require('../../utils/supabaseClient');

async function loginStarter(username, password, res) {
  try {
    const refCode = username.replace('ADT-', '');

    const { data, error } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('ref_code', refCode)
      .single();

    if (error || !data) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    if (data.ref_code_status === 'valid') {
      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ (Starter Plan)',
        plan: 'starter',
        expires_at: data.expired_at || null,
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'รหัสนี้หมดอายุหรือไม่สามารถใช้งานได้',
      });
    }
  } catch (err) {
    console.error('เกิดข้อผิดพลาดใน loginStarter:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในระบบ',
    });
  }
}

// 👇 export ไว้ล่างสุดแบบเท่ ๆ
module.exports = loginStarter;
