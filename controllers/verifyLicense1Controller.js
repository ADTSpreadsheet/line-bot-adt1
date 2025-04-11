//---------------------------------------------------------------
// controllers/verifyLicense1Controller.js
//---------------------------------------------------------------
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//---------------------------------------------------------------
// verifyLicense1 – ตรวจสอบจาก license_no, national_id, phone_number, machine_id
//---------------------------------------------------------------
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number, machine_id } = req.body;

    console.log("📌 ข้อมูลที่ส่งมา:", { license_no, national_id, phone_number, machine_id });

    if (!license_no || !phone_number) {
      const { data: partialMatch } = await supabase
        .from('license_holders')
        .select('license_no, first_name, last_name')
        .eq('license_no', license_no)
        .eq('phone_number', phone_number)
        .is('national_id', null)
        .single();

      if (partialMatch) {
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
      return res.status(404).json({ message: 'ไม่พบรหัสลิขสิทธิ์ในระบบ' });
    }

    if (licenseCheck.is_verify === true) {
      const { data: licenseData } = await supabase
        .from('license_holders')
        .select('machine_id_1, machine_id_2')
        .eq('license_no', license_no)
        .single();

      if (
        licenseData.machine_id_1 === machine_id ||
        licenseData.machine_id_2 === machine_id
      ) {
        return res.status(200).json({
          status: 'ALREADY_MATCHED',
          message: 'This device is already verified and authorized.',
          license_no
        });
      }

      if (
        licenseData.machine_id_1 &&
        licenseData.machine_id_2 &&
        licenseData.machine_id_1 !== machine_id &&
        licenseData.machine_id_2 !== machine_id
      ) {
        return res.status(422).json({
          status: 'DEVICE_LIMIT_REACHED',
          message: 'You have already used this license on 2 devices. Please contact ADT-Admin.'
        });
      }

      return res.status(202).json({
        status: 'NEED_CONFIRM_DEVICE_2',
        message: 'Second device detected. Please confirm registration.',
        license_no
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
        .update({ is_verify: true, status: 'ACTIVATED', machine_id_1: machine_id, mid_status: '1-DEVICE' })
        .eq('license_no', license_no);

      return res.status(200).json({
        license_no: data.license_no,
        full_name: `${data.first_name} ${data.last_name}`,
        message: 'Your copyright has been successfully verified.'
      });
    }

    const verifyCount = licenseCheck.verify_count || 0;

    if (verifyCount < 3) {
      const newCount = verifyCount + 1;
      await supabase
        .from('license_holders')
        .update({ verify_count: newCount })
        .eq('license_no', license_no);

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

    return res.status(403).json({ message: 'คุณตรวจสอบผิดเกินจำนวนที่กำหนด กรุณาติดต่อผู้ดูแลระบบ' });
  } catch (err) {
    console.error('❌ [ERROR] VERIFY LICENSE1', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};

//---------------------------------------------------------------
// confirmDevice2 – ยืนยันว่าเครื่องนี้จะถูกใช้เป็นเครื่องที่สอง
//---------------------------------------------------------------
const confirmDevice2 = async (req, res) => {
  const { license_no, machine_id } = req.body;

  try {
    const { data } = await supabase
      .from('license_holders')
      .select('machine_id_1, machine_id_2')
      .eq('license_no', license_no)
      .single();

    if (!data) {
      return res.status(404).json({ message: 'License not found.' });
    }

    if (data.machine_id_1 === machine_id || data.machine_id_2 === machine_id) {
      return res.status(200).json({ message: 'Device already registered.', status: 'ALREADY_MATCHED' });
    }

    let updateObj = {};
    if (!data.machine_id_1) updateObj = { machine_id_1: machine_id, mid_status: '1-DEVICE' };
    else if (!data.machine_id_2) updateObj = { machine_id_2: machine_id, mid_status: '2-DEVICE' };
    else return res.status(422).json({ message: 'Device limit exceeded.', status: 'DEVICE_LIMIT_REACHED' });

    await supabase
      .from('license_holders')
      .update(updateObj)
      .eq('license_no', license_no);

    return res.status(200).json({
      message: 'Device registered as second device successfully.',
      status: 'DEVICE_2_CONFIRMED'
    });

  } catch (err) {
    console.error('❌ [ERROR] CONFIRM DEVICE 2', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  verifyLicense1,
  confirmDevice2
};
