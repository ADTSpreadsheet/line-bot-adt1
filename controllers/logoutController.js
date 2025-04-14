const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const logger = require('../utils/logger');

exports.logout = async (req, res) => {
  const { ref_code } = req.body;

  if (!ref_code) {
    logger.warn(`[LOGOUT] ❌ Missing ref_code`);
    return res.status(400).json({ message: 'Missing ref_code' });
  }

  const { error } = await supabase
    .from('license_holders')
    .update({ last_logout: new Date().toISOString() })
    .eq('ref_code', ref_code);

  if (error) {
    logger.error(`[LOGOUT] 🔥 Failed to update logout: ${error.message}`);
    return res.status(500).json({ message: 'Logout update failed' });
  }

  logger.info(`[LOGOUT] ✅ Logout time updated for ref_code: ${ref_code}`);
  return res.status(200).json({ message: 'Logout time updated' });
};
