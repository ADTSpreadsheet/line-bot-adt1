const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

// ✅ ฟังก์ชันสำหรับ Welcome Form
const checkMachineStatus = async (req, res) => {
  try {
    const { machine_id } = req.body;
    logger.info(`[CHECK MACHINE] 🔍 Checking machine_id: ${machine_id}`);

    const { data, error } = await supabase
      .from('license_holders')
      .select('ref_code, username, machine_id_1, machine_id_2') // ✅ เพิ่ม username
      .or(`machine_id_1.eq.${machine_id},machine_id_2.eq.${machine_id}`)
      .single();

    if (error || !data) {
      logger.warn(`[CHECK MACHINE] ❌ Not found → machine_id: ${machine_id}`);
      return res.status(404).json({ message: 'Device not found' });
    }

    logger.info(`[CHECK MACHINE] ✅ Found → ref_code: ${data.ref_code}, username: ${data.username}`);
    return res.status(200).json({
      ref_code: data.ref_code,
      username: data.username // ✅ ส่งกลับมาด้วย
    });

  } catch (err) {
    logger.error(`[CHECK MACHINE] ❌ Error: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { checkMachineStatus };
