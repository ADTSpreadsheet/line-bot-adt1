const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//---------------------------------------------------------------
// verifyLicense1 – ตรวจสอบจาก license_no, national_id, phone_number, machine_id
//---------------------------------------------------------------
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number, machine_id } = req.body;

    logger.info(`[VERIFY1] 📥 รับข้อมูลเข้ามา → license_no: ${license_no}, machine_id: ${machine_id}`);

    if (!license_no || !phone_number) {
      const { data: partialMatch } = await supabase
        .from('license_holders')
        .select('license_no, first_name, last_name')
        .eq('license_no', license_no)
        .eq('phone_number', phone_number)
        .is('national_id', null)
        .single();

      if (partialMatch) {
        logger.info(`[VERIFY1] 🟦 [STATUS 206] ยังไม่เคยกรอกเลขบัตรประชาชน → license: ${license_no}`);
        return res.status(206).json({
          license_no: partialMatch.license_no,
          full_name: `${partialMatch.first_name} ${partialMatch.last_name}`,
          message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
        });
      }
    }

    const { data: licenseCheck, error: licenseError } = await supabase
      .from('license_holders')
      .select('license_no, status, verify_count, is_verify')
      .eq('license_no', license_no)
      .single();

    if (licenseError || !licenseCheck) {
      logger.warn(`[VERIFY1] ❌ [STATUS 404] ไม่พบรหัสลิขสิทธิ์ → license: ${license_no}`);
      return res.status(404).json({ message: 'ไม่พบรหัสลิขสิทธิ์ในระบบ' });
    }

    if (licenseCheck.is_verify === true) {
      const { data: licenseData } = await supabase
        .from('license_holders')
        .select('license_no, first_name, last_name, machine_id_1, machine_id_2, mid_status')
        .eq('license_no', license_no)
        .single();

      if (
        licenseData.machine_id_1 === machine_id ||
        licenseData.machine_id_2 === machine_id
      ) {
        logger.info(`[VERIFY1] ✅ [STATUS 200] เครื่องนี้ได้รับสิทธิ์แล้ว → license: ${license_no}, is_verify: ${licenseData.mid_status}`);
        return res.status(200).json({
          is_verify: licenseData.mid_status,
          message: 'This device is already verified and authorized.',
          license_no: licenseData.license_no,
          full_name: `${licenseData.first_name} ${licenseData.last_name}`
        });
      }

      if (
        licenseData.machine_id_1 &&
        licenseData.machine_id_2 &&
        licenseData.machine_id_1 !== machine_id &&
        licenseData.machine_id_2 !== machine_id
      ) {
        logger.warn(`[VERIFY1] ❌ [STATUS 422] ใช้งานครบ 2 เครื่องแล้ว → license: ${license_no}`);
        return res.status(422).json({
          is_verify: 'DEVICE_LIMIT_REACHED',
          message: 'You have already used this license on 2 devices. Please contact ADT-Admin.'
        });
      }

      logger.info(`[VERIFY1] 🟨 [STATUS 202] พบเครื่องใหม่ ต้องยืนยันการใช้งาน → license: ${license_no}`);
      return res.status(202).json({
        is_verify: 'NEED_CONFIRM_DEVICE_2',
        message: 'Second device detected. Please confirm registration.',
        license_no: licenseData.license_no,
        full_name: `${licenseData.first_name} ${licenseData.last_name}`
      });
    }

    const { data } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, verify_count')
      .eq('license_no', license_no)
      .eq('national_id', national_id)
      .eq('phone_number', phone_number)
      .single();

    if (data) {
      await supabase
        .from('license_holders')
        .update({ is_verify: true, machine_id_1: machine_id, mid_status: '1-DEVICE' })
        .eq('license_no', license_no);

      logger.info(`[VERIFY1] 🚀 [STATUS 200] ยืนยันสิทธิ์ครั้งแรกสำเร็จ → license: ${license_no}`);
      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`,
        message: 'Your copyright has been successfully verified.',
        is_verify: '1-DEVICE'
      });
    }

    const verifyCount = licenseCheck.verify_count || 0;

    if (verifyCount < 3) {
      const newCount = verifyCount + 1;
      await supabase
        .from('license_holders')
        .update({ verify_count: newCount })
        .eq('license_no', license_no);

      logger.warn(`[VERIFY1] ❌ [STATUS 401] ข้อมูลไม่ตรง → license: ${license_no}, ความพยายามครั้งที่ ${newCount}`);
      return res.status(401).json({
        message: 'ข้อมูลไม่ตรง กรุณาลองใหม่อีกครั้ง',
        verify_count: newCount,
        attempts_remaining: `ลองใหม่ได้อีก ${4 - newCount} ครั้ง`
      });
    }

    await supabase
      .from('license_holders')
      .update({ verify_count: 4 })
      .eq('license_no', license_no);

    logger.warn(`[VERIFY1] 🚫 [STATUS 403] ถูกบล็อก - เกินจำนวนครั้งที่กำหนด → license: ${license_no}`);
    return res.status(403).json({ message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด กรุณาติดต่อผู้ดูแลระบบ' });
  } catch (err) {
    logger.error(`❌ [STATUS 500] VERIFY LICENSE1 เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};
