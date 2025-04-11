const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//------------------------------------------------------------
// ฟังก์ชันตรวจสอบสิทธิ์การใช้งานจาก Machine ID
//------------------------------------------------------------
const checkMachineID = async (req, res) => {
  const { machine_id } = req.body;

  logger.info('[CHECK MACHINE] 📥 Request received:', { machine_id });

  if (!machine_id) {
    logger.warn('[CHECK MACHINE] ❌ Missing machine_id in request');
    return res.status(400).json({ status: 'ERROR', message: 'Missing machine_id' });
  }

  try {
    // ดึงข้อมูลทั้งหมดที่มี machine_id ตรงกับเครื่องนี้
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, machine_id_1, machine_id_2, is_verify, status')
      .or(`machine_id_1.eq.${machine_id},machine_id_2.eq.${machine_id}`);

    if (error) {
      logger.error('[CHECK MACHINE] ❌ Supabase error:', error.message || error);
      return res.status(500).json({ status: 'ERROR', message: 'Supabase error' });
    }

    // 📌 เคส 1: พบเครื่องนี้แล้วในระบบ
    if (data && data.length > 0) {
      const license = data[0];

      logger.info(`[CHECK MACHINE] ✅ Authorized machine found → License: ${license.license_no}`);
      return res.status(200).json({
        status: 'MATCHED',
        message: 'This machine is authorized.',
        license_no: license.license_no,
      });
    }

    // 📌 เคส 2: ไม่พบเครื่องนี้เลย → ไปเช็คว่ามี license ไหนบ้างที่ยังไม่ลงเครื่องเลย
    const { data: unverified, error: unverifiedErr } = await supabase
      .from('license_holders')
      .select('license_no')
      .eq('is_verify', false)
      .is('machine_id_1', null)
      .is('machine_id_2', null)
      .limit(1);

    if (unverifiedErr) {
      logger.error('[CHECK MACHINE] ❌ Supabase error (unverified check):', unverifiedErr.message || unverifiedErr);
      return res.status(500).json({ status: 'ERROR', message: 'Supabase error during verify check' });
    }

    if (unverified && unverified.length > 0) {
      logger.info('[CHECK MACHINE] 📩 Need to verify license first (new machine)');
      return res.status(200).json({
        status: 'NEED_VERIFY',
        message: 'This machine has not been verified yet.',
      });
    }

    // 📌 เคส 3: มี license ที่ใช้ครบ 2 เครื่องแล้ว → ปฏิเสธ
    logger.warn('[CHECK MACHINE] ⛔ Unauthorized machine – license already used on 2 devices');
    return res.status(403).json({
      status: 'UNAUTHORIZED',
      message: 'This device is not registered with your ADTSpreadsheet license.',
    });
  } catch (err) {
    logger.error('[CHECK MACHINE] ❌ Unexpected error:', err);
    return res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
};

module.exports = { checkMachineID };
