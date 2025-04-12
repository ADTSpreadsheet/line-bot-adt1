const { supabase } = require('../utils/supabaseClient');
const bcrypt = require('bcryptjs');

const setupPassword = async (req, res) => {
  try {
    const { ref_code, license_no, password } = req.body;

    if (!ref_code || !license_no || !password) {
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ดึง username ก่อนอัปเดต เพื่อส่งกลับ
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('username')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    // อัปเดตรหัสผ่าน + สถานะ
    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: hashedPassword,
        status: 'ACTIVATED'
      })
      .match({ ref_code, license_no });

    if (updateError) {
      return res.status(500).json({ message: 'อัปเดตรหัสผ่านไม่สำเร็จ', error: updateError.message });
    }

    // ส่งค่ากลับให้ VBA ใช้แสดงผลใน FrameSuccess
    return res.status(200).json({
      message: 'บัญชีผู้ใช้ของคุณถูกสร้างเรียบร้อยแล้ว',
      ref_code,
      license_no,
      username: userData.username,
      password // ส่งกลับแบบ plain ตามที่พี่เก่งขอใช้แสดงผล
    });
  } catch (err) {
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', error: err.message });
  }
};

module.exports = { setupPassword };
