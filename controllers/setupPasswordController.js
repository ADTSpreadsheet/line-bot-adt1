const { supabase } = require('../utils/supabaseClient');
const bcrypt = require('bcryptjs');
const { sendLineText } = require('../utils/sendLineMessage'); // <-- ใช้ฟังก์ชันส่ง LINE ที่มีอยู่แล้ว

const setupPassword = async (req, res) => {
  try {
    const { ref_code, license_no, password } = req.body;

    if (!ref_code || !license_no || !password) {
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔍 ดึงข้อมูลผู้ใช้ก่อน (username + line_id)
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('username, line_id')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .maybeSingle();

    if (userError || !userData) {
      console.error('❌ [FETCH USER ERROR]', userError?.message);
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    // ✅ อัปเดต password และสถานะ
    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: hashedPassword,
        status: 'ACTIVATED'
      })
      .match({ ref_code, license_no });

    if (updateError) {
      console.error('❌ [UPDATE ERROR]', updateError.message);
      return res.status(500).json({ message: 'อัปเดตรหัสผ่านไม่สำเร็จ', error: updateError.message });
    }

    // ✉️ ส่งข้อความ 4 บรรทัดผ่าน LINE
    const message = [
      '✅ บัญชีของคุณถูกสร้างแล้วเรียบร้อยครับ',
      `Ref.Code: ${ref_code}`,
      `Username: ${userData.username}`,
      `Password: ${password}`
    ].join('\n');

    await sendLineText(userData.line_id, message);
    console.log('📤 ส่งข้อความไปยัง LINE แล้ว:', userData.line_id);

    // ✅ ตอบกลับให้ VBA แบบสั้น ๆ
    return res.status(200).json({
      success: true,
      message: 'บัญชีถูกสร้างแล้ว กรุณาตรวจสอบ LINE สำหรับรหัสผ่าน'
    });

  } catch (err) {
    console.error('🔥 [UNEXPECTED ERROR]', err.message);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ',
      error: err.message
    });
  }
};

module.exports = { setupPassword };
