// routes/verifyOTP.js (เพิ่มเข้าไปด้านล่าง)

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ ตรวจสอบ Machine ID และคืนค่า Ref.Code ถ้าพบ
router.get('/check-machine-id', async (req, res) => {
  const machineID = req.query.machine_id;

  if (!machineID) {
    return res.status(400).json({ error: 'Missing machine_id' });
  }

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('ref_code, status')
      .eq('machine_id', machineID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Machine ID not found' });
    }

    if (data.status === 'ACTIVE') {
      return res.status(200).json({
        status: 'ACTIVE',
        ref_code: data.ref_code
      });
    } else {
      return res.status(403).json({ error: 'Machine ID is not ACTIVE' });
    }
  } catch (err) {
    console.error('[ERROR] check-machine-id:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
