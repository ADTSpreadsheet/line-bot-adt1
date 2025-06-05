const { supabase } = require('../../utils/supabaseClient');

async function logoutController(req, res) {
  try {
    const { username } = req.body;

    // ✅ เช็คแค่ว่ามี username มั้ย (ไม่เช็ครูปแบบอีกแล้ว)
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // 1. ดึงข้อมูลผู้ใช้
    const { data, error } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const now = new Date();
    const loginTime = new Date(data.login_at);
    const logoutTime = now;

    // 2. คำนวณเวลาที่ใช้งาน (นาที)
    const usedMinutes = Math.floor((logoutTime - loginTime) / 60000); // 60000 ms = 1 min
    const remainingMinutes = Math.max(0, (data.duration_minutes || 0) - usedMinutes);

    // 3. อัปเดตตาราง
    const { error: updateError } = await supabase
      .from('starter_plan_users')
      .update({
        logout_at: logoutTime.toISOString(),
        used_minutes: usedMinutes,
        remaining_minutes: remainingMinutes
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('❌ Error updating logout info:', updateError.message);
      return res.status(500).json({ success: false, message: 'Failed to update logout info' });
    }

    return res.status(200).json({
      success: true,
      message: 'Logout time and usage recorded',
      used_minutes: usedMinutes,
      remaining_minutes: remainingMinutes
    });

  } catch (err) {
    console.error('💥 Exception in logoutController:', err);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error'
    });
  }
}

module.exports = logoutController;
