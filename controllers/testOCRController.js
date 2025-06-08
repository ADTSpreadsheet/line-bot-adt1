const Tesseract = require('tesseract.js');
const { supabase } = require('../utils/supabaseClient');

async function testOCRHandler(req, res) {
  try {
    const ref_code = req.body.ref_code;
    const imageBuffer = req.file.buffer;

    // OCR
    const result = await Tesseract.recognize(imageBuffer, 'tha+eng');
    const rawText = result.data.text;

    // INSERT ลง Supabase
    await supabase.from('starter_slip_ocr_logs').insert({
      ref_code,
      slip_path: 'test-upload', // กำหนดค่าไว้ก่อน ยังไม่เชื่อม bucket จริง
      raw_text,
      status: 'pending'
    });

    res.status(200).json({ success: true, rawText });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ success: false, message: 'OCR failed' });
  }
}
