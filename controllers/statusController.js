// controllers/statusController.js
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const { sendLineMessage } = require('../utils/lineBot');

/**
 * ตรวจสอบว่า Ref.Code มีอยู่และสถานะเป็นอะไร
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkRefCodeStatus = async (req, res) => {
  try {
    const ref_code = req.method === 'GET' ? req.query.ref_code : req.body.ref_code;

    if (!ref_code) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ Ref.Code' 
      });
    }

    const { data, error } = await supabase
      .from('auth_sessions')
      .select('status, is_verified, expires_at, created_at, line_user_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูล Ref.Code: ${ref_code}`, error.message);
      throw error;
    }

    if (!data) {
      logger.warn(`⚠️ ไม่พบ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบ Ref.Code นี้' 
      });
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    const isExpired = expiresAt < now;
    
    // คำนวณเวลาที่เหลือในหน่วยนาที
    const remainingMinutes = isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60));

    // ดึงข้อมูลเพิ่มเติมเกี่ยวกับการลงทะเบียนเครื่อง (ถ้ามี)
    const { data: machineData } = await supabase
      .from('registered_machines')
      .select('machine_id, status')
      .eq('ref_code', ref_code)
      .maybeSingle();

    logger.info(`✅ ตรวจสอบ Ref.Code: ${ref_code} สำเร็จ`);
    res.status(200).json({
      status: 'success',
      data: {
        ref_code,
        ref_status: data.status,
        is_verified: data.is_verified,
        is_expired: isExpired,
        created_at: data.created_at,
        expires_at: data.expires_at,
        remaining_minutes: remainingMinutes,
        machine_registered: !!machineData,
        machine_id: machineData?.machine_id,
        license_status: machineData?.status
      }
    });
  } catch (err) {
    logger.error('❌ checkRefCodeStatus ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบ Ref.Code ไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ตรวจสอบว่า Machine ID เคยลงทะเบียนแล้วหรือไม่
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkMachineStatus = async (req, res) => {
  try {
    const machine_id = req.method === 'GET' ? req.query.machine_id : req.body.machine_id;

    if (!machine_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ Machine ID' 
      });
    }

    const { data, error } = await supabase
      .from('registered_machines')
      .select('ref_code, status, trial_start_date, trial_end_date, registered_at, last_active')
      .eq('machine_id', machine_id)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูล Machine ID: ${machine_id}`, error.message);
      throw error;
    }

    if (!data) {
      logger.info(`ℹ️ ยังไม่พบการลงทะเบียนเครื่อง: ${machine_id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ยังไม่พบการลงทะเบียนเครื่องนี้' 
      });
    }

    const now = new Date();
    let trialInfo = null;
    
    if (data.trial_start_date && data.trial_end_date) {
      const endDate = new Date(data.trial_end_date);
      const startDate = new Date(data.trial_start_date);
      const isExpired = endDate < now;
      const daysLeft = isExpired ? 0 : Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      trialInfo = {
        is_active: !isExpired,
        days_left: daysLeft,
        total_days: totalDays,
        start_date: data.trial_start_date,
        end_date: data.trial_end_date
      };
    }

    logger.info(`✅ ตรวจสอบ Machine ID: ${machine_id} สำเร็จ - สถานะ: ${data.status}`);
    res.status(200).json({
      status: 'success',
      data: {
        machine_id,
        ref_code: data.ref_code,
        license_status: data.status,
        registered_at: data.registered_at,
        last_active: data.last_active,
        trial: trialInfo
      }
    });
  } catch (err) {
    logger.error('❌ checkMachineStatus ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบ Machine ID ไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ตรวจสอบสถานะ License (PENDING, ACTIVE, BLOCKED)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkLicenseStatus = async (req, res) => {
  try {
    const { ref_code } = req.body;

    if (!ref_code) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ Ref.Code' 
      });
    }

    const { data, error } = await supabase
      .from('registered_machines')
      .select('status, machine_id, last_active, registered_at')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูล License สำหรับ Ref.Code: ${ref_code}`, error.message);
      throw error;
    }

    if (!data) {
      logger.warn(`⚠️ ไม่พบข้อมูล License สำหรับ Ref.Code: ${ref_code}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบสถานะ License ของ Ref.Code นี้' 
      });
    }

    // อัปเดตเวลาการเช็คล่าสุด
    await supabase
      .from('registered_machines')
      .update({ last_active: new Date().toISOString() })
      .eq('ref_code', ref_code);

    logger.info(`✅ ตรวจสอบ License สำหรับ Ref.Code: ${ref_code} สำเร็จ - สถานะ: ${data.status}`);
    res.status(200).json({
      status: 'success',
      data: {
        ref_code,
        license_status: data.status,
        machine_id: data.machine_id,
        last_active: data.last_active,
        registered_at: data.registered_at
      }
    });
  } catch (err) {
    logger.error('❌ checkLicenseStatus ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบ License ไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ตรวจสอบระยะเวลาทดลองใช้งาน
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkTrialPeriod = async (req, res) => {
  try {
    const machine_id = req.method === 'GET' ? req.query.machine_id : req.body.machine_id;

    if (!machine_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุ Machine ID' 
      });
    }

    const { data, error } = await supabase
      .from('registered_machines')
      .select('trial_start_date, trial_end_date, status, ref_code, line_user_id')
      .eq('machine_id', machine_id)
      .maybeSingle();

    if (error) {
      logger.error(`❌ ไม่สามารถดึงข้อมูลการทดลองใช้สำหรับ Machine ID: ${machine_id}`, error.message);
      throw error;
    }

    if (!data || !data.trial_start_date || !data.trial_end_date) {
      logger.warn(`⚠️ ไม่พบข้อมูลระยะทดลองของเครื่อง: ${machine_id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบข้อมูลระยะทดลองของเครื่องนี้' 
      });
    }

    const now = new Date();
    const end = new Date(data.trial_end_date);
    const start = new Date(data.trial_start_date);
    const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    const isExpired = end < now;
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const usedDays = Math.min(totalDays, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));

    // อัปเดตเวลาการเช็คล่าสุด
    await supabase
      .from('registered_machines')
      .update({ last_active: now.toISOString() })
      .eq('machine_id', machine_id);

    logger.info(`✅ ตรวจสอบระยะทดลองสำหรับเครื่อง: ${machine_id} สำเร็จ - เหลือ ${daysLeft} วัน`);
    res.status(200).json({
      status: 'success',
      data: {
        trial_active: !isExpired,
        days_left: daysLeft,
        days_used: usedDays,
        total_days: totalDays,
        trial_start_date: data.trial_start_date,
        trial_end_date: data.trial_end_date,
        license_status: data.status,
        ref_code: data.ref_code
      }
    });
  } catch (err) {
    logger.error('❌ checkTrialPeriod ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ตรวจสอบระยะทดลองไม่สำเร็จ',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ขยายเวลาทดลองใช้ (Admin หรือระบบเท่านั้น)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.extendTrialPeriod = async (req, res) => {
  try {
    const { ref_code, machine_id, days = 7 } = req.body;

    if (!ref_code || !machine_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุทั้ง Ref.Code และ Machine ID' 
      });
    }

    // ตรวจสอบข้อมูลเดิม
    const { data: machineData, error: fetchError } = await supabase
      .from('registered_machines')
      .select('trial_end_date, line_user_id')
      .eq('ref_code', ref_code)
      .eq('machine_id', machine_id)
      .maybeSingle();

    if (fetchError || !machineData) {
      logger.error(`❌ ไม่พบข้อมูลเครื่องที่ต้องการขยายเวลา: ${machine_id}`, fetchError?.message);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบข้อมูลเครื่องที่ต้องการขยายเวลา' 
      });
    }

    // คำนวณวันสิ้นสุดใหม่
    const currentEndDate = new Date(machineData.trial_end_date);
    const now = new Date();
    
    // ใช้วันที่มากกว่าระหว่างวันปัจจุบันกับวันสิ้นสุดเดิม เป็นฐานในการคำนวณ
    const baseDate = currentEndDate > now ? currentEndDate : now;
    const newEndDate = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000));

    // อัปเดตวันสิ้นสุดใหม่
    const { data, error } = await supabase
      .from('registered_machines')
      .update({
        trial_end_date: newEndDate.toISOString(),
        last_active: now.toISOString()
      })
      .eq('ref_code', ref_code)
      .eq('machine_id', machine_id)
      .select();

    if (error || !data || data.length === 0) {
      logger.error(`❌ ไม่สามารถขยายเวลาได้สำหรับเครื่อง: ${machine_id}`, error?.message);
      return res.status(500).json({ 
        status: 'error', 
        message: 'ไม่สามารถขยายเวลาได้' 
      });
    }

    // ส่งข้อความแจ้งผู้ใช้
    if (machineData.line_user_id) {
      await sendLineMessage(machineData.line_user_id, `
🎉 ขยายระยะเวลาทดลองใช้สำเร็จ!
⏳ เพิ่มอีก ${days} วัน
📅 วันสิ้นสุดใหม่: ${newEndDate.toLocaleDateString('th-TH')}
🖥️ เครื่อง: ${machine_id.substring(0, 8)}...
      `);
    }

    logger.info(`✅ ขยายระยะเวลาทดลองใช้สำเร็จสำหรับเครื่อง: ${machine_id} - เพิ่ม ${days} วัน`);
    res.status(200).json({
      status: 'success',
      message: `ขยายระยะเวลาทดลองอีก ${days} วันสำเร็จ`,
      data: {
        ref_code,
        machine_id,
        previous_end_date: machineData.trial_end_date,
        new_end_date: newEndDate.toISOString(),
        days_added: days
      }
    });
  } catch (err) {
    logger.error('❌ extendTrialPeriod ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถขยายเวลาทดลองได้',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * ปรับเปลี่ยนสถานะ License
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateLicenseStatus = async (req, res) => {
  try {
    const { ref_code, status, reason } = req.body;

    if (!ref_code || !status) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'กรุณาระบุทั้ง Ref.Code และสถานะใหม่' 
      });
    }

    // ตรวจสอบว่าสถานะที่ระบุถูกต้อง
    const validStatuses = ['ACTIVE', 'BLOCKED', 'EXPIRED', 'PENDING'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'สถานะไม่ถูกต้อง โปรดระบุเป็น ACTIVE, BLOCKED, EXPIRED หรือ PENDING' 
      });
    }

    // ตรวจสอบข้อมูลเดิม
    const { data: existingData, error: fetchError } = await supabase
      .from('registered_machines')
      .select('status, line_user_id, machine_id')
      .eq('ref_code', ref_code)
      .maybeSingle();

    if (fetchError || !existingData) {
      logger.error(`❌ ไม่พบข้อมูล License สำหรับ Ref.Code: ${ref_code}`, fetchError?.message);
      return res.status(404).json({ 
        status: 'error', 
        message: 'ไม่พบข้อมูล License สำหรับ Ref.Code นี้' 
      });
    }

    // อัปเดตสถานะ
    const { data, error } = await supabase
      .from('registered_machines')
      .update({
        status,
        status_updated_at: new Date().toISOString(),
        status_reason: reason || null
      })
      .eq('ref_code', ref_code)
      .select();

    if (error || !data) {
      logger.error(`❌ ไม่สามารถอัปเดตสถานะ License สำหรับ Ref.Code: ${ref_code}`, error?.message);
      return res.status(500).json({ 
        status: 'error', 
        message: 'ไม่สามารถอัปเดตสถานะ License ได้' 
      });
    }

    // ส่งข้อความแจ้งผู้ใช้เมื่อสถานะเปลี่ยน
    if (existingData.line_user_id && existingData.status !== status) {
      let message = '';
      
      switch (status) {
        case 'ACTIVE':
          message = `
✅ License ของคุณถูกเปิดใช้งานแล้ว
🖥️ เครื่อง: ${existingData.machine_id.substring(0, 8)}...
🙏 ขอบคุณที่ใช้บริการของเรา`;
          break;
        case 'BLOCKED':
          message = `
⚠️ License ของคุณถูกระงับชั่วคราว
🖥️ เครื่อง: ${existingData.machine_id.substring(0, 8)}...
📝 สาเหตุ: ${reason || 'ติดต่อผู้ดูแลระบบ'}`;
          break;
        case 'EXPIRED':
          message = `
⏱️ License ของคุณหมดอายุแล้ว
🖥️ เครื่อง: ${existingData.machine_id.substring(0, 8)}...
📞 โปรดติดต่อเพื่อต่ออายุ License`;
          break;
        default:
          message = `
ℹ️ สถานะ License ของคุณถูกเปลี่ยนเป็น: ${status}
🖥️ เครื่อง: ${existingData.machine_id.substring(0, 8)}...`;
      }
      
      await sendLineMessage(existingData.line_user_id, message);
    }

    logger.info(`✅ อัปเดตสถานะ License สำหรับ Ref.Code: ${ref_code} เป็น ${status} สำเร็จ`);
    res.status(200).json({
      status: 'success',
      message: `อัปเดตสถานะ License เป็น ${status} สำเร็จ`,
      data: {
        ref_code,
        previous_status: existingData.status,
        new_status: status,
        reason: reason || null
      }
    });
  } catch (err) {
    logger.error('❌ updateLicenseStatus ERROR:', err.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'ไม่สามารถอัปเดตสถานะ License ได้',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
