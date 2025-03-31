const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { createModuleLogger } = require('../utils/logger');
const log = createModuleLogger('UserForm3');

router.post('/get-message', async (req, res) => {
  const { lineUserId } = req.body;

  log.info('📥 Received request from VBA');
  log.debug('lineUserId:', lineUserId || '[Not Provided]');

  const responseMessage = {
    stage1: 'กรุณาพิมพ์ข้อความ REQ_REFCODE ในแชทไลน์เพื่อขอรับ รหัส Ref.Code',
    stage2: 'กรุณากรอกรหัส Ref.Code ที่ท่านได้จากแชท แล้วกดปุ่ม Verify Code',
    stage3: 'กรุณากรอกรหัส Serial Key ที่ได้จากแชท แล้วกดปุ่ม Confirm เพื่อทำการยืนยันตัวตน'
  };

  if (!lineUserId) {
    log.success('🔁 No Line ID — returning stage1 only');
    return res.status(200).json({
      success: true,
      message: {
        stage1: responseMessage.stage1,
        stage2: '',
        stage3: ''
      }
    });
  }

  try {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('status, ref_code, serial_key, expires_at')
      .eq('line_user_id', lineUserId)
      .single();

    if (error || !data) {
      log.warn('🟡 Line ID not found in Supabase');
      return res.status(200).json({
        success: true,
        message: {
          stage1: responseMessage.stage1,
          stage2: '',
          stage3: 'ยังไม่พบข้อมูลการลงทะเบียน กรุณาพิมพ์ REQ_REFCODE อีกครั้ง'
        }
      });
    }

    const { ref_code, serial_key, expires_at } = data;
    const remainingTime = new Date(expires_at) - new Date();

    if (remainingTime <= 0) {
      log.warn('🔴 Serial Key expired');
      return res.status(200).json({
        success: true,
        message: {
          stage1: responseMessage.stage1,
          stage2: '',
          stage3: '❌ รหัส Serial Key ของท่านหมดอายุแล้ว'
        }
      });
    }

    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    const countdownMessage = `⏳ รหัส Serial Key ของท่านจะหมดอายุภายใน ${minutes} นาที ${seconds} วินาที`;

    log.success('✅ Serial Key active - responding with full stages');

    return res.status(200).json({
      success: true,
      message: {
        stage1: responseMessage.stage1,
        stage2: responseMessage.stage2,
        stage3: countdownMessage,
        ref_code,
        serial_key
      }
    });
  } catch (err) {
    log.error('❌ Exception caught in /get-message:', err);
    return res.status(500).json({ success: false, message: 'Server error occurred.' });
  }
});

module.exports = router;
