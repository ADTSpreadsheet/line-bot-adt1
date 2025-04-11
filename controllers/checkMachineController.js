// controllers/checkMachineController.js

const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//------------------------------------------------------------
// ฟังก์ชันตรวจสอบ Machine ID สำหรับ Login
//------------------------------------------------------------
const checkMachineStatus = async (req, res) => {
  try {
    const { machine_id } = req.body;
    logger.info(`[CHECK MACHINE] 📥 Received machine_id: ${machine_id}`);

    const { data, error } = await supabase
      .from('license_holders')
      .select('license_no, status, machine_id_1, machine_id_2')
      .or(`machine_id_1.eq.${machine_id},machine_id_2.eq.${machine_id}`)
      .single();

    if (error || !data) {
      logger.warn(`[CHECK MACHINE] ❌ ไม่พบเครื่องในระบบ → machine_id: ${machine_id}`);
      return res.status(404).json({ message: 'Device not found in system.' });
    }

    // เจอเครื่องแล้ว ตรวจสอบสถานะ
    if (data.status === 'ACTIVATED') {
      logger.info(`[CHECK MACHINE] ✅ เครื่องได้รับสิทธิ์แล้ว → license_no: ${data.license_no}`);
      return res.status(200).json({ message: 'Device is activated', license_no: data.license_no });
    } else {
      logger.warn(`[CHECK MACHINE] ⚠️ เครื่องยังไม่ถูก Activate → license_no: ${data.license_no}`);
      return res.status(400).json({ message: 'Device found but not activated yet.' });
    }

  } catch (err) {
    logger.error(`[CHECK MACHINE] ❌ ERROR: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};


module.exports = { checkMachineStatus };
