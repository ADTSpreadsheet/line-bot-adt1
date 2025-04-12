const { supabase } = require('../utils/supabaseClient');
const bcrypt = require('bcryptjs');

const setupPassword = async (req, res) => {
  try {
    const { ref_code, license_no, password } = req.body;

    if (!ref_code || !license_no || !password) {
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: hashedPassword,
        status: 'ACTIVATED' // ✅ อัปเดต status ตรงนี้
      })
      .match({ ref_code, license_no });

    if (updateError) {
      return res.status(500).json({ message: 'ไม่สามารถอัปเดตรหัสผ่านได้', error: updateError.message });
    }

    return res.status(200).json({ message: 'รหัสผ่านถูกบันทึกเรียบร้อย และสถานะถูกอัปเดตเป็น ACTIVATED' });
  } catch (err) {
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', error: err.message });
  }
};

module.exports = { setupPassword };
