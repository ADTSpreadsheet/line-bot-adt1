const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

//---------------------------------------------------------------
// verifyLicense1 – ตรวจสอบจาก license_no, national_id, phone_number, machine_id
//---------------------------------------------------------------
const verifyLicense1 = async (req, res) => {
  try {
    const { license_no, national_id, phone_number, machine_id } = req.body;

    logger.info(`[VERIFY1] 📥 รับข้อมูลเข้ามา → license_no: ${license_no}, national_id: ${national_id || 'ไม่มี'}, phone_number: ${phone_number || 'ไม่มี'}, machine_id: ${machine_id}`);

    // ตรวจสอบว่ามี license_no และ phone_number มาหรือไม่
    if (!license_no || !phone_number) {
      logger.warn(`[VERIFY1] ⚠️ [STATUS 400] ข้อมูลไม่ครบถ้วน → ไม่มี license_no หรือ phone_number`);
      return res.status(400).json({ message: 'กรุณาระบุรหัสลิขสิทธิ์และเบอร์โทรศัพท์' });
    }

    // ตรวจสอบว่า license_no และ phone_number ถูกต้องหรือไม่
    const { data: userCheck, error: userError } = await supabase
      .from('license_holders')
      .select('license_no, first_name, last_name, national_id')
      .eq('license_no', license_no)
      .eq('phone_number', phone_number)
      .single();

    // ถ้าพบข้อมูลตรงกับ license_no และ phone_number
    if (userCheck) {
      // ถ้าในฐานข้อมูลไม่มี national_id หรือเป็นค่าว่าง
      if (!userCheck.national_id || userCheck.national_id === '') {
        logger.info(`[VERIFY1] 🟦 [STATUS 206] ยังไม่เคยกรอกเลขบัตรประชาชน → license: ${license_no}`);
        return res.status(206).json({
          license_no: userCheck.license_no,
          full_name: `${userCheck.first_name} ${userCheck.last_name}`,
          message: 'ระบบตรวจสอบไม่พบเลขบัตรประชาชนของท่าน กรุณากรอกเพื่อยืนยันตัวตน'
        });
      }
    }

    // ตรวจสอบว่ามี license_no ในระบบหรือไม่
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
      return res.status(200).json({
        is_verify: 'NEED_CONFIRM_DEVICE_2',
        message: 'Second device detected. Please confirm registration.',
        license_no: licenseData.license_no,
        full_name: `${licenseData.first_name} ${licenseData.last_name}`
      });
    }

    // ถ้ามี national_id ให้ตรวจสอบข้อมูลครบถ้วน
    if (national_id) {
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
          .update({ 
            is_verify: 'TRUE', 
            machine_id_1: machine_id, 
            mid_status: '1-DEVICE' 
          })
          .eq('license_no', license_no);

        logger.info(`[VERIFY1] 🚀 [STATUS 200] ยืนยันสิทธิ์ครั้งแรกสำเร็จ → license: ${license_no}`);
        return res.status(200).json({
          license_no: data.license_no,
          full_name: `${data.first_name} ${data.last_name}`,
          message: 'Your copyright has been successfully verified.',
          is_verify: 'TRUE'
        });
      }
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
        attempts_remaining: `ลองใหม่ได้อีก ${3 - newCount} ครั้ง`
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

//---------------------------------------------------------------
// confirmDevice2 – ยืนยันว่าเครื่องนี้จะถูกใช้เป็นเครื่องที่สอง
//---------------------------------------------------------------
const confirmDevice2 = async (req, res) => {
  try {
    const { license_no, machine_id } = req.body;

    logger.info(`[CONFIRM2] 📥 รับคำร้องขอยืนยันเครื่องที่ 2 → license: ${license_no}, machine_id: ${machine_id}`);

    const { data } = await supabase
      .from('license_holders')
      .select('machine_id_1, machine_id_2')
      .eq('license_no', license_no)
      .single();

    if (!data) {
      logger.warn(`[CONFIRM2] ❌ [STATUS 404] ไม่พบ license_no: ${license_no}`);
      return res.status(404).json({ message: 'License not found.' });
    }

    if (data.machine_id_1 === machine_id || data.machine_id_2 === machine_id) {
      logger.info(`[CONFIRM2] ✅ [STATUS 200] เครื่องนี้เคยลงทะเบียนแล้ว → license: ${license_no}`);
      return res.status(200).json({
        message: 'Device already registered.',
        mid_status: data.machine_id_1 === machine_id ? '1-DEVICE' : '2-DEVICE'
      });
    }

    let updateObj = { is_verify: true }; // เพิ่ม is_verify ตรงนี้ด้วย
    let newStatus = '';
    if (!data.machine_id_1) {
      updateObj = { ...updateObj, machine_id_1: machine_id, mid_status: '1-DEVICE' };
      newStatus = '1-DEVICE';
    } else if (!data.machine_id_2) {
      updateObj = { ...updateObj, machine_id_2: machine_id, mid_status: '2-DEVICE' };
      newStatus = '2-DEVICE';
    } else {
      logger.warn(`[CONFIRM2] ❌ [STATUS 422] เครื่องครบ 2 เครื่องแล้ว → license: ${license_no}`);
      return res.status(422).json({ message: 'Device limit exceeded.', is_verify: 'DEVICE_LIMIT_REACHED' });
    }

    await supabase
      .from('license_holders')
      .update(updateObj)
      .eq('license_no', license_no);

    logger.info(`[CONFIRM2] 🎯 [STATUS 200] ลงทะเบียนเครื่องที่ 2 สำเร็จ → license: ${license_no}`);
    return res.status(200).json({
      message: 'Device registered as second device successfully.',
      is_verify: 'TRUE'
    });

  } catch (err) {
    logger.error(`[CONFIRM2] ❌ [STATUS 500] เกิดข้อผิดพลาด: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

//---------------------------------------------------------------
// submitNationalID – รับเลขบัตรประชาชนและอัปเดตสถานะเป็น is_verify: true
//---------------------------------------------------------------
// ส่วนตัวอย่างการอัพเดตข้อมูลพร้อมบันทึกล็อกโดยละเอียด
const submitNationalID = async (req, res) => {
  try {
    const { license_no, national_id, machine_id } = req.body;

    logger.info(`[SUBMIT NID] 📥 รับข้อมูล → license: ${license_no}, national_id: ${national_id}, machine_id: ${machine_id || 'ไม่มี'}`);
    
    // ตรวจสอบเงื่อนไขก่อนอัพเดต
    if (!license_no) {
      logger.warn(`[SUBMIT NID] ⚠️ ไม่มี license_no ในคำขอ`);
      return res.status(400).json({ message: 'กรุณาระบุรหัสลิขสิทธิ์' });
    }
    
    if (!machine_id) {
      logger.warn(`[SUBMIT NID] ⚠️ ไม่มี machine_id ในคำขอ → license: ${license_no}`);
      return res.status(400).json({ message: 'กรุณาระบุรหัสเครื่อง' });
    }
    
    // ตรวจสอบก่อนว่ามีข้อมูล license_no ในฐานข้อมูลหรือไม่
    const { data: checkData, error: checkError } = await supabase
      .from('license_holders')
      .select('license_no, is_verify, machine_id_1, machine_id_2, mid_status')
      .eq('license_no', license_no)
      .single();
      
    if (checkError) {
      logger.error(`[SUBMIT NID] ❌ ไม่พบข้อมูลในฐานข้อมูล → license: ${license_no}, error: ${checkError.message}`);
      return res.status(404).json({ message: 'ไม่พบข้อมูลลิขสิทธิ์ในระบบ' });
    }
    
    logger.info(`[SUBMIT NID] 🔍 ข้อมูลปัจจุบันในฐานข้อมูล → license: ${license_no}, is_verify: ${checkData.is_verify}, machine_id_1: ${checkData.machine_id_1 || 'NULL'}, machine_id_2: ${checkData.machine_id_2 || 'NULL'}, mid_status: ${checkData.mid_status || 'NULL'}`);
    
    // กำหนดข้อมูลที่จะอัพเดต
    const updateObj = { 
      national_id: national_id,
      is_verify: true
    };
    
    // ตัดสินใจว่าจะอัพเดต machine_id ไปที่คอลัมน์ไหน
    if (!checkData.machine_id_1) {
      logger.info(`[SUBMIT NID] 📝 บันทึกเป็นเครื่องแรก → license: ${license_no}, machine_id: ${machine_id}`);
      updateObj.machine_id_1 = machine_id;
      updateObj.mid_status = '1-DEVICE';
    } else if (checkData.machine_id_1 === machine_id) {
      logger.info(`[SUBMIT NID] 📝 เครื่องนี้ตรงกับเครื่องแรกที่บันทึกแล้ว → license: ${license_no}`);
      updateObj.mid_status = '1-DEVICE';
    } else if (!checkData.machine_id_2) {
      logger.info(`[SUBMIT NID] 📝 บันทึกเป็นเครื่องที่สอง → license: ${license_no}, machine_id: ${machine_id}`);
      updateObj.machine_id_2 = machine_id;
      updateObj.mid_status = '2-DEVICE';
    } else if (checkData.machine_id_2 === machine_id) {
      logger.info(`[SUBMIT NID] 📝 เครื่องนี้ตรงกับเครื่องที่สองที่บันทึกแล้ว → license: ${license_no}`);
      updateObj.mid_status = '2-DEVICE';
    } else {
      logger.warn(`[SUBMIT NID] ⚠️ มีการบันทึกครบ 2 เครื่องแล้ว และเครื่องนี้ไม่ตรงกับทั้งสองเครื่อง → license: ${license_no}`);
      return res.status(422).json({ 
        message: 'คุณได้ใช้ลิขสิทธิ์นี้กับอุปกรณ์ 2 เครื่องแล้ว กรุณาติดต่อผู้ดูแลระบบ',
        is_verify: 'DEVICE_LIMIT_REACHED'
      });
    }
    
    // บันทึกข้อมูลที่จะอัพเดต
    logger.info(`[SUBMIT NID] 🔄 ข้อมูลที่จะอัพเดต → ${JSON.stringify(updateObj)}`);
    
    // ดำเนินการอัพเดต
    const { data: updateData, error: updateError } = await supabase
      .from('license_holders')
      .update(updateObj)
      .eq('license_no', license_no)
      .select()
      .single();
    
    // ตรวจสอบผลลัพธ์
    if (updateError) {
      logger.error(`[SUBMIT NID] ❌ อัพเดตไม่สำเร็จ → license: ${license_no}, error: ${updateError.message}`);
      return res.status(500).json({ message: `เกิดข้อผิดพลาดในการอัพเดตข้อมูล: ${updateError.message}` });
    }
    
    // บันทึกข้อมูลหลังอัพเดต
    logger.info(`[SUBMIT NID] ✅ อัพเดตสำเร็จ → license: ${license_no}`);
    logger.info(`[SUBMIT NID] 📊 ข้อมูลหลังอัพเดต → is_verify: ${updateData.is_verify}, machine_id_1: ${updateData.machine_id_1 || 'NULL'}, machine_id_2: ${updateData.machine_id_2 || 'NULL'}, mid_status: ${updateData.mid_status || 'NULL'}`);
    
    return res.status(200).json({
      message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
      is_verify: 'TRUE'
    });
  } catch (err) {
    logger.error(`[SUBMIT NID] ❌ เกิดข้อผิดพลาดที่ไม่คาดคิด: ${err.message}`);
    logger.error(`[SUBMIT NID] 🔍 Stack trace: ${err.stack}`);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
  }
};

module.exports = {
  verifyLicense1,
  confirmDevice2,
  submitNationalID
};
