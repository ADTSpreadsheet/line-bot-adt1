// routes/pdpa.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

// เพิ่มข้อความ PDPA ลงใน Supabase
router.post('/pdpa-text', async (req, res) => {
  const { text } = req.body;

  try {
    const { data, error } = await supabase
      .from('contents')
      .upsert([
        {
          key: 'pdpa-text',
          value: { text: text },  // เก็บข้อความ PDPA แบบ JSON
        },
      ]);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'PDPA text added successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
