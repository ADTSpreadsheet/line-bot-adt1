const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const sendLineMessage = require('./events/eventLine');
const logger = require('../utils/logger'); // เผื่อใช้ log ภายหลัง

// โหลด ENV ตัวแปร
require('dotenv').config();

// สร้าง Supabase client จาก ENV
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

router.post('/', async (req, res) => {
  try {
    const { ref_code } = req.body;

    if (!ref_code) {
      logger.warn('Missing ref_code in request body');
      return res.status(400).json({ error: 'Missing ref_code in request body' });
    }

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (error || !data) {
      logger.warn('Ref.Code not found in Supabase', { ref_code });
      return res.status(404).json({ error: 'Ref.Code not found' });
    }

    const { serial_key, line_user_id } = data;

    try {
      const message = `Your Serial Key is: ${serial_key}`;
      await sendLineMessage(line_user_id, message);
      logger.info('Serial Key sent via LINE', { ref_code, line_user_id });
    } catch (lineError) {
      logger.error('LINE message failed to send', {
        ref_code,
        line_user_id,
        serial_key,
        error: lineError.message,
      });
      return res.status(500).json({ error: 'Failed to send message via LINE' });
    }

    return res.status(200).json({ message: 'Serial key sent to LINE successfully' });
  } catch (err) {
    logger.error('Unexpected error in verify-refcode', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
