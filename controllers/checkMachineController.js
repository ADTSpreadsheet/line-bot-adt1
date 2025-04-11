// controllers/checkMachineController.js

const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//------------------------------------------------------------
// ฟังก์ชันตรวจสอบ Machine ID สำหรับ Login
//------------------------------------------------------------
const checkMachineStatus = async (req, res) => {
  const { machine_id } = req.body;

  if (!machine_id) {
    logger.warn('[CHECK MACHINE] ❌ Missing machine_id');
    return res.status(400).json({ status: 'ERROR', message: 'Missing machine_id' });
  }

  try {
    logger.info('[CHECK MACHINE] 📥 Received machine_id:', machine_id);

    // ตรวจหา Machine ID ที่ตรงในทั้ง 2 คอลัมน์
    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, machine_id_1, machine_id_2, mid_status')
      .or(`machine_id_1.eq.${machine_id},machine_id_2.eq.${machine_id}`)
      .single();

    if (error || !data) {
      logger.warn('[CHECK MACHINE] ❌ No matching machine_id found');
      return res.status(400).json({
        status: 'NOT_MATCHED',
        message: 'This device is not registered yet.'
      });
    }

    const { mid_status, license_no } = data;

    // ตรวจสอบสถานะ mid_status
    if (mid_status === false) {
      logger.info('[CHECK MACHINE] ✅ Found device - Status: First');
      return res.status(200).json({
        status: 'AUTHORIZED',
        message: 'Device registered as first machine.',
        license_no
      });
    }

    if (mid_status === true) {
      logger.info('[CHECK MACHINE] ✅ Found device - Status: Second');
      return res.status(200).json({
        status: 'AUTHORIZED',
        message: 'Device registered as second machine.',
        license_no
      });
    }

    // fallback ถ้า mid_status เป็น null หรือผิดปกติ
    logger.warn('[CHECK MACHINE] ⚠️ Unexpected mid_status');
    return res.status(200).json({
      status: 'AUTHORIZED',
      message: 'Device is authorized, but mid_status unknown.',
      license_no
    });
  } catch (err) {
    logger.error('[CHECK MACHINE] ❌ Unexpected error:', err);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Internal server error.'
    });
  }
};

module.exports = { checkMachineStatus };
