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
      // ✅ บันทึกเวลา login ลง login_at
      const { error: updateError } = await supabase
        .from('starter_plan_users')
        .update({ login_at: new Date().toISOString() })
        .eq('id', data.id); // ใช้ id ตรงๆ ปลอดภัยสุด

      if (updateError) {
        console.error('อัปเดตเวลา login ไม่สำเร็จ:', updateError.message);
        // ไม่ต้อง return error ให้ client ก็ได้ ปล่อยผ่าน
      }

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

module.exports = loginStarter;
