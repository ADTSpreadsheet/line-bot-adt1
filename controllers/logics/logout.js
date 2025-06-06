const { supabase } = require('../../utils/supabaseClient');

async function logoutController(req, res) {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // 🔍 ดึงข้อมูลผู้ใช้ตาม username
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
    
    // คำนวณเวลาที่ใช้ในเซสชันนี้
    const usedMinutes = Math.floor((logoutTime - loginTime) / 60000);
    
    // 🔥 คำนวณเวลาคงเหลือจาก last_remaining_minutes (ถ้ามี) หรือ duration_minutes (ครั้งแรก)
    const baseMinutes = data.last_remaining_minutes ?? data.duration_minutes ?? 0;
    const remainingMinutes = Math.max(0, baseMinutes - usedMinutes);

    // ✍️ อัปเดต logout, used_minutes, remaining_minutes และ last_remaining_minutes
    const { error: updateError } = await supabase
      .from('starter_plan_users')
      .update({
        logout_at: logoutTime.toISOString(),
        used_minutes: usedMinutes,
        remaining_minutes: remainingMinutes,
        last_remaining_minutes: remainingMinutes  // 🔥 บันทึกสำหรับเซสชันต่อไป
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('❌ Error updating logout info:', updateError.message);
      return res.status(500).json({ success: false, message: 'Failed to update logout info' });
    }

    // 🔒 ถ้าเวลาเหลือน้อยกว่าหรือเท่ากับ 0 → เปลี่ยน ref_code_status เป็น invalid
    if (remainingMinutes <= 0) {
      const { error: statusUpdateError } = await supabase
        .from('starter_plan_users')
        .update({ ref_code_status: 'invalid' })
        .eq('id', data.id);

      if (statusUpdateError) {
        console.error('⚠️ ไม่สามารถอัปเดต ref_code_status ได้:', statusUpdateError.message);
      } else {
        console.log('🔒 ref_code_status ถูกอัปเดตเป็น invalid แล้ว');
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Logout time and usage recorded',
      used_minutes: usedMinutes,
      remaining_minutes: remainingMinutes,
      base_minutes: baseMinutes, // เพิ่มข้อมูลสำหรับ debug
      session_used: usedMinutes
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
