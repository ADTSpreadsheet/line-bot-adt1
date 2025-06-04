const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const log = createModuleLogger('VerifyRefcode-Route');

// Import Controller
const { handleVerifyRefcode } = require('../controllers/events/VerifyRefcodeADTLineBot');

// ==============================
// 🔐 VERIFY REFCODE ENDPOINT
// ==============================

router.post('/', async (req, res) => {
  console.log('=== VERIFY REFCODE REQUEST ===');
  
  try {
    const { ref_code } = req.body;
    
    console.log('Request body:', req.body);
    console.log('Ref Code:', ref_code);

    // เช็ค input
    if (!ref_code) {
      console.log('❌ Missing ref_code');
      return res.status(400).json({ 
        success: false,
        message: 'กรุณาระบุ Ref.Code' 
      });
    }

    // เรียก Controller เพื่อประมวลผล
    console.log('🔄 Processing verify refcode...');
    const result = await handleVerifyRefcode(ref_code);

    console.log('Result:', result);

    // ส่ง response ตามผลลัพธ์
    if (result.success) {
      console.log('✅ Verify refcode successful');
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      console.log('❌ Verify refcode failed');
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.log('💥 Verify Refcode Route Error:', error.message);
    log.error(`[VERIFY-REFCODE] Error: ${error.message}`);
    
    res.status(500).json({ 
      success: false,
      message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
    });
  }
  
  console.log('=== VERIFY REFCODE END ===');
});

module.exports = router;
