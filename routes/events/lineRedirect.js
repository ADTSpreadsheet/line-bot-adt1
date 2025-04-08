// routes/events/eventLine.js
const { supabase } = require('../../utils/supabaseClient');
const line = require('@line/bot-sdk');
const { sourceData } = require('../../routes/line-redirect');  // นำเข้า sourceData

const client = new line.Client(config);

const handleFollow = async (event) => {
  const userId = event.source.userId;

  // ตรวจสอบว่า userId นี้มีข้อมูล source หรือไม่
  const source = sourceData[userId] || 'Unknown';  // ค้นหาจาก session หรือฐานข้อมูล

  if (source === 'UserForm3') {
    log.info(`[FOLLOW] 📥 มีผู้ใช้จาก UserForm3: ${userId}`);
  } else if (source === 'VerifyLicenseForm') {
    log.info(`[FOLLOW] 📥 มีผู้ใช้จาก VerifyLicenseForm: ${userId}`);
  } else {
    log.info(`[FOLLOW] 📥 ไม่มีข้อมูล source: ${userId}`);
  }

  // ดำเนินการตามขั้นตอนที่ต้องการหลังจากตรวจสอบ source
};
