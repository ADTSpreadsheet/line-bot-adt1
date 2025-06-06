const { supabase } = require('../../utils/supabaseClient');

async function loginStarter(username, password, res) {
  try {
    console.log('🚀 [loginStarter] เริ่มกระบวนการ Login');
    console.log('👤 username:', username);
    console.log('🔑 password:', password);

    const { data: user, error } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !user) {
      console.warn('⚠️ ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      return res.status(401).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    if (user.ref_code_status !== 'valid') {
      console.warn('⛔️ รหัสหมดอายุ หรือถูกระงับ:', user.ref_code_status);
      return res.status(403).json({
        success: false,
        message: 'รหัสนี้หมดอายุหรือไม่สามารถใช้งานได้',
      });
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // 👉 เช็กว่ามี session เก่าค้างอยู่ไหม (logout_at = null)
    if (!user.logout_at && user.login_at) {
      const loginAt = new Date(user.login_at);
      const usedMinutes = Math.floor((now - loginAt) / (1000 * 60));
      
      // 🔥 ใช้ last_remaining_minutes แทน remaining_minutes ในการคำนวณ
      const baseMinutes = user.last_remaining_minutes ?? user.remaining_minutes ?? 0;
      const remaining = Math.max(0, baseMinutes - usedMinutes);

      console.log('⏱ เจอ session เก่า → กำลังอัปเดต logout');
      
      const { error: updateOldSessionError } = await supabase
        .from('starter_plan_users')
        .update({
          logout_at: nowISO,
          used_minutes: usedMinutes,
          remaining_minutes: remaining,
          last_remaining_minutes: remaining  // 🔥 เพิ่มบรรทัดนี้
        })
        .eq('id', user.id);

      if (updateOldSessionError) {
        console.error('❌ อัปเดต session เก่าล้มเหลว:', updateOldSessionError.message);
      } else {
        console.log('✅ อัปเดต session เก่าสำเร็จ');
      }
    }

    // 🔥 นับจำนวนครั้งการ login
    const currentLoginCount = (user.login_count || 0) + 1;
    console.log(`📊 Login Count: ${currentLoginCount}`);

    // 👉 จากนั้นเริ่ม session ใหม่: login_at = now, logout_at = null
    const { error: updateNewSessionError } = await supabase
      .from('starter_plan_users')
      .update({
        login_at: nowISO,
        logout_at: null, // reset logout
        login_count: currentLoginCount  // 🔥 อัปเดตจำนวนครั้งการ login
        // **ไม่ต้อง reset remaining_minutes ตรงนี้** ปล่อยให้ใช้จาก session เดิม
      })
      .eq('id', user.id);

    if (updateNewSessionError) {
      console.error('⚠️ อัปเดต login_at ใหม่ล้มเหลว:', updateNewSessionError.message);
    } else {
      console.log('🆕 login_at ใหม่อัปเดตเรียบร้อย');
    }

    return res.status(200).json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ (Starter Plan)',
      plan: 'starter',
      expires_at: user.expired_at || null,
      login_count: currentLoginCount  // 🔥 ส่งจำนวนครั้งกลับไปด้วย (optional)
    });

  } catch (err) {
    console.error('💥 เกิดข้อผิดพลาดไม่คาดคิดใน loginStarter:', err);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในระบบ',
    });
  }
}

module.exports = loginStarter;
