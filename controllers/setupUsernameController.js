// controllers/setupUsernameController.js

const { supabase } = require('../utils/supabaseClient');

const setupUsername = async (req, res) => {
  try {
    const data = req.body;

    // STEP 1: ตรวจสอบข้อมูลที่รับมา
    const requiredFields = [
      'ref_code', 'license_no', 'gender', 'first_name', 'last_name', 'nickname', 'age',
      'occupation', 'phone_number', 'email', 'address', 'district', 'province',
      'postal_code', 'facebook_url', 'line_id', 'username', 'pdpa_status'
    ];

    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        return res.status(400).json({ message: `กรุณาระบุข้อมูลให้ครบถ้วน: ${field}` });
      }
    }

    // STEP 2: อัปเดตตาราง auth_sessions ด้วย ref_code
    const { error: authError } = await supabase
      .from('auth_sessions')
      .update({
        gender: data.gender,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname,
        age: data.age,
        occupation: data.occupation,
        phone_number: data.phone_number,
        email: data.email,
        address: data.address,
        district: data.district,
        province: data.province,
        postal_code: data.postal_code,
        facebook_url: data.facebook_url,
        line_id: data.line_id,
        username: data.username,
        pdpa_status: data.pdpa_status,
        source: 'license_verified',
        status: 'COMPLETED'
      })
      .eq('ref_code', data.ref_code);

    if (authError) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดต auth_sessions', error: authError.message });
    }

    // STEP 3: อัปเดต license_holders โดยใช้ ref_code และ license_no
    const { error: licenseError } = await supabase
      .from('license_holders')
      .update({
        gender: data.gender,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname,
        age: data.age,
        occupation: data.occupation,
        phone_number: data.phone_number,
        email: data.email,
        address: data.address,
        district: data.district,
        province: data.province,
        postal_code: data.postal_code,
        eng_license: data.eng_license || null,
        facebook_url: data.facebook_url,
        line_id: data.line_id,
        username: data.username,
        pdpa_status: data.pdpa_status,
        is_verify: true
      })
      .match({ ref_code: data.ref_code, license_no: data.license_no });

    if (licenseError) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดต license_holders', error: licenseError.message });
    }

    // STEP 4: ตรวจสอบว่ามี username คล้ายกันหรือไม่
    const { data: similarUsers, error: usernameError } = await supabase
      .from('license_holders')
      .select('username')
      .ilike('username', `%${data.username}%`);

    if (usernameError) {
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะตรวจสอบ Username', error: usernameError.message });
    }

    if (similarUsers && similarUsers.length > 0) {
      return res.status(409).json({ message: 'Username นี้มีความคล้ายกับผู้ใช้งานอื่นในระบบ กรุณาใช้ชื่ออื่น' });
    }

    // STEP 5: สำเร็จทุกขั้นตอน
    return res.status(200).json({ message: 'ข้อมูลถูกบันทึกและ Username ผ่านการตรวจสอบแล้ว' });
  } catch (err) {
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', error: err.message });
  }
};

module.exports = { setupUsername };
