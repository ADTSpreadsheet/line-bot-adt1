const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');

// LINE CONFIG
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 📌 Verify Refcode Handler
const handleVerifyRefcode = async (refCode) => {
  try {
    console.log('=== VERIFY REFCODE START ===');
    console.log('Ref Code received:', refCode);

    // ค้นหา ref_code ในตาราง auth_sessions
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', refCode)
      .single();

    console.log('Database result:', { data, error });

    if (error) {
      console.error('❌ Database Error:', error.message);
      return {
        success: false,
        message: 'ไม่พบ Ref.Code ในระบบ'
      };
    }

    if (!data || !data.serial_key || !data.line_user_id) {
      console.log('❌ ไม่พบข้อมูล ref_code');
      return {
        success: false,
        message: 'ไม่พบ Ref.Code ในระบบ'
      };
    }

    const { serial_key, line_user_id } = data;
    console.log('Found data - Serial Key:', serial_key, 'Line User ID:', line_user_id);

    // ส่ง serial_key ผ่าน LINE Bot
    await client.pushMessage(line_user_id, {
      type: 'text',
      text: `🔐 สำหรับ Ref.Code: ${refCode}\n➡️ Serial Key คือ   ${serial_key}`
    });

    console.log('✅ ส่ง Serial Key สำเร็จ');
    console.log('=== VERIFY REFCODE END ===');

    return {
      success: true,
      message: 'ส่ง Serial Key ผ่าน LINE สำเร็จ'
    };

  } catch (error) {
    console.error('❌ Verify Refcode Error:', error.message);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ'
    };
  }
};

module.exports = {
  handleVerifyRefcode
};
