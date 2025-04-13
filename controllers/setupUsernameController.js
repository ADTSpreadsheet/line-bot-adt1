const { supabase } = require('../utils/supabaseClient');

const setupUsername = async (req, res) => {
  try {
    const data = req.body;

    console.log('📥 [SETUP USERNAME] รับข้อมูลเข้ามา →', JSON.stringify(data, null, 2));

    // STEP 1: ตรวจสอบข้อมูลที่รับมา
    const requiredFields = [
      'ref_code', 'license_no', 'gender', 'first_name', 'last_name', 'nickname', 'age',
      'occupation', 'phone_number', 'email', 'address', 'district', 'province',
      'postal_code', 'facebook_url', 'line_id', 'eng_license', 'username', 'pdpa_status'
    ];

    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        console.warn(`⚠️ [VALIDATION] ข้อมูลไม่ครบ: ${field}`);
        return res.status(400).json({ message: `กรุณาระบุข้อมูลให้ครบถ้วน: ${field}` });
      }
    }

    // STEP 2: อัปเดต auth_sessions
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
        house_number: data.address,
        district: data.district,
        province: data.province,
        postal_code: data.postal_code,
        facebook_url: data.facebook_url,
        line_id: data.line_id,
        pdpa_status: data.pdpa_status,
        source: 'license_verified'
        
      })
      .eq('ref_code', data.ref_code);

    if (authError) {
      console.error('❌ [auth_sessions] อัปเดตไม่สำเร็จ:', authError.message);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดต auth_sessions', error: authError.message });
    }

    console.log('✅ [auth_sessions] อัปเดตสำเร็จแล้ว');

    // STEP 3: อัปเดต license_holders
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
        line_id: data.line_id,
        username: data.username,
        pdpa_status: data.pdpa_status,
        
      })
      .match({ ref_code: data.ref_code, license_no: data.license_no });

    if (licenseError) {
      console.error('❌ [license_holders] อัปเดตไม่สำเร็จ:', licenseError.message);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะอัปเดต license_holders', error: licenseError.message });
    }

    console.log('✅ [license_holders] อัปเดตสำเร็จแล้ว');

    // STEP 4: ตรวจสอบ username ซ้ำแบบ exact match
const { data: sameUsername, error: usernameError } = await supabase
  .from('license_holders')
  .select('username')
  .eq('username', data.username); // 🔄 แก้จาก .ilike → .eq

if (usernameError) {
  console.error('❌ [username-check] ตรวจสอบ Username ล้มเหลว:', usernameError.message);
  return res.status(500).json({
    message: 'เกิดข้อผิดพลาดขณะตรวจสอบ Username',
    error: usernameError.message
  });
}

if (sameUsername && sameUsername.length > 0) {
  console.warn('⚠️ [username-check] พบ Username ซ้ำ:', sameUsername.map(u => u.username));
  return res.status(409).json({
    message: 'Username นี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น'
  });
}

console.log('✅ [username-check] ไม่พบ Username ซ้ำ ใช้งานได้');

// STEP 5: สำเร็จ
console.log('🎉 [COMPLETE] ข้อมูลผู้ใช้งานถูกบันทึกเรียบร้อยแล้ว');
return res.status(200).json({
  message: 'Username นี้สามารถใช้งานได้'
});


module.exports = { setupUsername };
