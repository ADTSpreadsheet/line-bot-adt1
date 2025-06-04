const { supabase } = require('../../utils/supabaseClient');

// 📌 Confirm Registration Handler
const handleConfirmRegistration = async (refCode, serialKey) => {
  try {
    console.log('=== CONFIRM REGISTRATION START ===');
    console.log('Ref Code:', refCode);
    console.log('Serial Key:', serialKey);

    // ค้นหา ref_code + serial_key ในตาราง auth_sessions
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey)
      .single();

    console.log('Database search result:', { data, error });

    if (error) {
      console.error('❌ Database Error:', error.message);
      return {
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง'
      };
    }

    if (!data) {
      console.log('❌ ไม่พบข้อมูล ref_code + serial_key');
      return {
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง'
      };
    }

    console.log('✅ พบข้อมูล - กำลังอัพเดตสถานะ...');

    // อัพเดตสถานะเป็น ACTIVE
    const { error: updateError } = await supabase
      .from('auth_sessions')
      .update({
        status: 'ACTIVE'
      })
      .eq('ref_code', refCode)
      .eq('serial_key', serialKey);

    if (updateError) {
      console.error('❌ Update Error:', updateError.message);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล'
      };
    }

    console.log('✅ อัพเดตสถานะ ACTIVE สำเร็จ');
    console.log('=== CONFIRM REGISTRATION END ===');

    return {
      success: true,
      message: 'ยืนยันตัวตนสำเร็จ'
    };

  } catch (error) {
    console.error('❌ Confirm Registration Error:', error.message);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
};

module.exports = {
  handleConfirmRegistration
};
