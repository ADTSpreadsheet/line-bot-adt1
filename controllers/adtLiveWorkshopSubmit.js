const { supabase } = require('../utils/supabaseClient');
const { sendLineMessage } = require('../routes/events/eventLine'); // ฟังก์ชันยิง Flex

const handleSubmitLiveWorkshop = async (req, res) => {
  const { license_no, ref_code, serial_key } = req.body;

  if (!license_no || !ref_code || !serial_key) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // ===== Logic 1 =====
  // 1.1 ค้นชื่อจาก license_holders
  const { data: licenseData, error: licenseError } = await supabase
    .from('license_holders')
    .select('first_name, last_name')
    .eq('license_no', license_no)
    .maybeSingle();

  // 1.2 ค้น line_user_id, phone_number จาก auth_sessions
  const { data: sessionData, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('line_user_id, phone_number')
    .eq('ref_code', ref_code)
    .eq('serial_key', serial_key)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return res.status(403).json({ error: 'Invalid ref_code or serial_key.' });
  }

  const { line_user_id, phone_number } = sessionData;
  const first_name = licenseData?.first_name || '';
  const last_name = licenseData?.last_name || '';

  // ===== Logic 2 =====
  const newSource = 'adt_workshop_attendee';

  const { error: updateSourceError } = await supabase
    .from('auth_sessions')
    .update({ source: newSource })
    .eq('ref_code', ref_code);

  if (updateSourceError) {
    console.error('❌ Failed to update source:', updateSourceError.message);
  }

  // ===== Logic 3 =====
  const student_status = licenseData ? license_no : newSource;

  const { error: insertError } = await supabase
    .from('adt_workshop_attendees')
    .insert({
      ref_code,
      first_name,
      last_name,
      phone_number,
      line_user_id,
      student_status
    });

  if (insertError) {
    console.error('❌ Failed to insert workshop attendee:', insertError.message);
    return res.status(500).json({ error: 'Failed to save workshop registration.' });
  }

  // ===== Logic 4 =====
  try {
    await sendLineMessage(line_user_id, student_status, ref_code); // ฟังก์ชันนี้ต้องมีปุ่มเข้ากลุ่ม
  } catch (err) {
    console.error('❌ Failed to send LINE Flex:', err.message);
    return res.status(200).json({ message: 'Registered but failed to send Flex.' });
  }

  // ===== สำเร็จ =====
  return res.status(200).json({ message: 'Registered and Flex sent successfully.' });
};

module.exports = { handleSubmitLiveWorkshop };

