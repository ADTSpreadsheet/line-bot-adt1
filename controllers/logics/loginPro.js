const { supabase } = require('../../utils/supabaseClient');

async function loginPro(username, password, res) {
  try {
    const { data, error } = await supabase
      .from('license_holders')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // ถ้าพบข้อมูลตรงกัน → Login ผ่าน
    return res.status(200).json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ (Professional Plan)',
      plan: 'professional',
      license_no: data.license_no || null,
    });

  } catch (err) {
    console.error('เกิดข้อผิดพลาดใน loginPro:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในระบบ',
    });
  }
}

// 👇 Export ไว้ล่างสุดเหมือนเดิม
module.exports = loginPro;
