const Tesseract = require('tesseract.js');

async function runOCR(imageUrl) {
  try {
    const result = await Tesseract.recognize(imageUrl, 'tha+eng', {
      logger: m => console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`)
    });

    const rawText = result.data.text;
    console.log('📄 OCR raw text extracted');
    return rawText;
  } catch (err) {
    console.error('❌ OCR error:', err);
    throw new Error('OCR failed: ' + err.message);
  }
}

module.exports = runOCR;
