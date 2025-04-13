const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');

// LINE Client
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

const setupPassword = async (req, res) => {
  try {
    const { ref_code, license_no, password } = req.body;

    if (!ref_code || !license_no || !password) {
      console.warn(`[SETUP-PASSWORD] ⚠️ ข้อมูลไม่ครบ`);
      return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    // 🔍 ดึง line_user_id จาก license_holders
    const { data: sessionData, error: sessionError } = await supabase
      .from('license_holders')
      .select('line_user_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (sessionError) {
      console.error(`[SETUP-PASSWORD] ❌ ดึง line_user_id ไม่สำเร็จ: ${sessionError.message}`);
      return res.status(500).json({ message: 'ไม่สามารถดึง line_user_id ได้' });
    }

    const lineUserId = sessionData?.line_user_id || null;

    // 🔍 ดึงข้อมูล username และชื่อจริง
    const { data: userData, error: userError } = await supabase
      .from('license_holders')
      .select('username, first_name, last_name')
      .eq('ref_code', ref_code)
      .eq('license_no', license_no)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
    }

    // ✅ full name สำหรับส่งให้ VBA
    const fullName = `${userData.first_name} ${userData.last_name}`;

    // ✅ อัปเดตรหัสผ่านแบบ plain-text และสถานะ
    const { error: updateError } = await supabase
      .from('license_holders')
      .update({
        password: password, // ❗ บันทึก plain-text password
        status: 'ACTIVATED'
      })
      .match({ ref_code, license_no });

    if (updateError) {
      console.error(`[SETUP-PASSWORD] ❌ อัปเดต password ล้มเหลว: ${updateError.message}`);
      return res.status(500).json({ message: 'ไม่สามารถอัปเดตรหัสผ่านได้' });
    }

    // 📩 ส่ง LINE แจ้ง username + password
    const message = [
      `✅ บัญชีของคุณถูกสร้างแล้วเรียบร้อยครับ`,
      `License No: ${license_no}`,
      `Ref.Code: ${ref_code}`,
      `Username: ${userData.username}`,
      `Password: ${password}`
    ].join('\n');

    let messageSent = false;
    if (lineUserId) {
      try {
        await client.pushMessage(lineUserId, {
          type: 'text',
          text: message
        });
        console.log(`[SETUP-PASSWORD] ✅ ส่งข้อความไปยัง LINE: ${lineUserId}`);
        messageSent = true;
      } catch (lineErr) {
        console.warn(`[SETUP-PASSWORD] ⚠️ ส่ง LINE ไม่สำเร็จ: ${lineErr.message}`);
      }
    }

    // ✅ ส่งข้อมูลกลับไปให้ VBA
    return res.status(200).json({
      license_no,
      ref_code,
      fullName,
      message: 'บัญชีนี้ทำการ Activate License โดยสมบูรณ์ กรุณาดู Username และ Password ในไลน์ เพื่อเข้าสู่ระบบของคุณ',
      messageSent
    });

  } catch (err) {
    console.error(`[SETUP-PASSWORD] ❌ [STATUS 500] เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', error: err.message });
  }
};

module.exports = { setupPassword };
