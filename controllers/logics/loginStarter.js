const { supabase } = require('../../utils/supabaseClient');

async function loginStarter(username, password, res) {
  try {
    console.log('🚀 [loginStarter] เริ่มกระบวนการ Login');
    console.log('👤 username:', username);
    console.log('🔑 password:', password);

    const refCode = username.replace('ADT-', '');
    console.log('🧩 refCode ที่ได้จาก username:', refCode);

    const { data, error } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    console.log('📦 ผลลัพธ์จาก Supabase:', data);
    if (error) console.error('❌ เกิด error จาก Supabase:', error.message);

    if (error || !data) {
      console.warn('⚠️ ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      return res.status(401).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    if (data.ref_code_status === 'valid') {
      console.log('✅ รหัส ref_code_status = valid → กำลังอัปเดต login_at...');

      const { error: updateError } = await supabase
        .from('starter_plan_users')
        .update({ login_at: new Date().toISOString() })
        .eq('id', data.id);

      if (updateError) {
        console.error('⚠️ อัปเดต login_at ไม่สำเร็จ:', updateError.message);
      } else {
        console.log('🕒 login_at อัปเดตสำเร็จ');
      }

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ (Starter Plan)',
        plan: 'starter',
        expires_at: data.expired_at || null,
      });
    } else {
      console.warn('⛔️ รหัส ref_code_status ไม่ใช่ valid →', data.ref_code_status);
      return res.status(403).json({
        success: false,
        message: 'รหัสนี้หมดอายุหรือไม่สามารถใช้งานได้',
      });
    }
  } catch (err) {
    console.error('💥 เกิดข้อผิดพลาดไม่คาดคิดใน loginStarter:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในระบบ',
    });
  }
}

module.exports = loginStarter;
