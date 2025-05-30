const { supabase } = require('../utils/supabaseClient');
const line = require('@line/bot-sdk');
const { uploadBase64ToSupabase } = require('../services/uploadService');
const { getNextLicenseNumber } = require('../services/licenseNumberService');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const handleFullPurchase = async (req, res) => {
  try {
    // ===================== Logic 1 =====================
    // 1.1 ตรวจสอบข้อมูล
    const {
      ref_code, first_name, last_name, national_id,
      address, postal_code, phone_number, email,
      file_name, file_content
    } = req.body;

    if (!ref_code || !first_name || !last_name || !national_id || !address || !postal_code || !phone_number || !email || !file_name || !file_content) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    // 1.2 ตรวจสอบ ref_code จาก auth_sessions
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ message: 'ไม่พบข้อมูล ref_code นี้ในระบบ' });
    }

    // 1.3 อัปเดตข้อมูลใหม่ลงใน auth_sessions
    await supabase
      .from('auth_sessions')
      .update({
        first_name,
        last_name,
        national_id,
        address,
        postal_code,
        phone_number,
        email,
        source: 'full_license_user'
      })
      .eq('ref_code', ref_code);

    // ===================== Logic 2 =====================
    // 2.1 ออกหมายเลข License ใหม่
    const license_no = await getNextLicenseNumber();

    // 2.2 บันทึกลง license_holders
    await supabase.from('license_holders').insert({
      license_no,
      first_name,
      last_name,
      national_id,
      address,
      postal_code,
      phone_number,
      email,
      line_user_id: session.line_user_id,
      is_verify: true,
      pdpa_status: true
    });

    // ===================== Logic 3 =====================
    // 3.1 อัปโหลดภาพสลิป
    const uploadResult = await uploadBase64ToSupabase(file_name, file_content, `adtpayslip/ADT-${license_no}-${ref_code}.jpg`);
    if (!uploadResult || !uploadResult.publicURL) {
      return res.status(500).json({ message: 'อัปโหลดภาพสลิปไม่สำเร็จ' });
    }

    // 3.2 บันทึกลง slip_submissions
    await supabase.from('slip_submissions').insert({
      license_no,
      ref_code,
      product_source: 'ADTSpreadsheet',
      submissions_status: 'pending',
      slip_image_url: uploadResult.publicURL
    });

    // ===================== Logic 4 =====================
    // 4.1 ส่ง Flex Message ให้คุณตั้ม
    const flexMessage = {
      type: 'flex',
      altText: 'มีคำสั่งซื้อใหม่จากลูกค้า',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'คำสั่งซื้อใหม่',
              weight: 'bold',
              size: 'lg'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: `👤 ${first_name} ${last_name}`, size: 'md', weight: 'bold' },
            { type: 'text', text: `📞 ${phone_number}` },
            { type: 'text', text: `📮 ${address}, ${postal_code}` },
            { type: 'text', text: `📧 ${email}` },
            {
              type: 'image',
              url: uploadResult.publicURL,
              size: 'full',
              aspectRatio: '4:3',
              aspectMode: 'cover'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              action: {
                type: 'postback',
                label: '✅ อนุมัติ',
                data: `approve|${license_no}|${ref_code}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'postback',
                label: '❌ ปฏิเสธ',
                data: `reject|${license_no}|${ref_code}`
              }
            }
          ]
        }
      }
    };

    await client.pushMessage(process.env.ADMIN_USER_ID, flexMessage);

    // ตอบกลับหน้าเว็บ
    res.status(200).json({ message: 'ส่งข้อมูลสำเร็จ' });

  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};

module.exports = handleFullPurchase;
