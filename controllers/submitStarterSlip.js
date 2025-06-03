const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');
const joi = require('joi');

// ตัวแปรสำหรับการตั้งค่าระบบ
const API2_URL = process.env.API2_URL || 'https://line-bot-adt2.onrender.com';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 30000; // 30 วินาที
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

// ตรวจสอบ Environment Variables ที่จำเป็น
const requiredEnvVars = ['API2_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️ ขาด Environment Variables: ${missingEnvVars.join(', ')} - ใช้ค่า default`);
}

// กำหนดกฎการตรวจสอบข้อมูลที่ส่งเข้ามา
const submitSlipSchema = joi.object({
  ref_code: joi.string().trim().required().messages({
    'string.empty': 'กรุณากรอก ref_code',
    'any.required': 'กรุณากรอก ref_code'
  }),
  first_name: joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'กรุณากรอกชื่อ',
    'string.max': 'ชื่อต้องไม่เกิน 100 ตัวอักษร',
    'any.required': 'กรุณากรอกชื่อ'
  }),
  last_name: joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'กรุณากรอกนามสกุล',
    'string.max': 'นามสกุลต้องไม่เกิน 100 ตัวอักษร',
    'any.required': 'กรุณากรอกนามสกุล'
  }),
  national_id: joi.string().pattern(/^\d{13}$/).required().messages({
    'string.pattern.base': 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก',
    'any.required': 'กรุณากรอกเลขบัตรประชาชน'
  }),
  phone_number: joi.string().pattern(/^0\d{8,9}$/).required().messages({
    'string.pattern.base': 'เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก)',
    'any.required': 'กรุณากรอกเบอร์โทรศัพท์'
  }),
  duration: joi.number().integer().min(1).max(15).required().messages({
    'number.base': 'ระยะเวลาต้องเป็นตัวเลข',
    'number.min': 'ระยะเวลาต้องอย่างน้อย 1 วัน',
    'number.max': 'ระยะเวลาต้องไม่เกิน 15 วัน',
    'any.required': 'กรุณาเลือกระยะเวลา'
  }),
  file_content: joi.string().required().messages({
    'string.empty': 'กรุณาแนบสลิปการโอนเงิน',
    'any.required': 'กรุณาแนบสลิปการโอนเงิน'
  })
});

// สร้างตัวจัดการ HTTP ที่สามารถลองใหม่ได้เมื่อเกิดข้อผิดพลาด
const createHttpClient = () => {
  const client = axios.create({
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'StarterSlip-API/1.0'
    }
  });

  // เพิ่มระบบลองใหม่อัตโนมัติ
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config;
      
      if (!config || !config.retry) {
        config.retry = 0;
      }

      // ลองใหม่เฉพาะกรณี timeout หรือ server error
      if (config.retry < MAX_RETRIES && 
          (error.code === 'ECONNABORTED' || 
           error.response?.status >= 500)) {
        
        config.retry += 1;
        const delay = Math.pow(2, config.retry) * 1000; // เพิ่มเวลารอแบบเลขยกกำลัง
        
        console.log(`🔄 กำลังลองส่งใหม่ครั้งที่ (${config.retry}/${MAX_RETRIES}) หลังจาก ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return client(config);
      }

      throw error;
    }
  );

  return client;
};

const httpClient = createHttpClient();

// ฟังก์ชันสำหรับจัดการธุรกรรมฐานข้อมูล (มีระบบ rollback เมื่อเกิดข้อผิดพลาด)
async function executeTransaction(operations) {
  try {
    // เริ่มดำเนินการทีละขั้นตอน
    const results = [];
    const compensations = [];

    for (const operation of operations) {
      try {
        console.log(`🔄 ดำเนินการ: ${operation.name || 'Unknown operation'}`);
        const result = await operation.execute();
        results.push(result);
        
        if (operation.compensate) {
          compensations.unshift({
            name: operation.name,
            compensate: operation.compensate
          }); // เก็บไว้สำหรับยกเลิกการทำงาน (LIFO)
        }
        
        console.log(`✅ สำเร็จ: ${operation.name || 'Unknown operation'}`);
      } catch (error) {
        console.error(`❌ ล้มเหลว: ${operation.name || 'Unknown operation'}`, error);
        
        // หากเกิดข้อผิดพลาด ให้ยกเลิกการทำงานทั้งหมดที่ทำไปแล้ว
        console.log('🔄 เริ่มยกเลิกการทำงานที่ทำไปแล้ว...');
        for (const comp of compensations) {
          try {
            console.log(`↩️ ยกเลิก: ${comp.name}`);
            await comp.compensate();
          } catch (compError) {
            console.error(`❌ การยกเลิกการทำงานล้มเหลว (${comp.name}):`, compError);
          }
        }
        throw error;
      }
    }

    return results;
  } catch (error) {
    throw error;
  }
}

// ระบบคิวงานเบื้องหลัง (สำหรับงานที่ไม่ต้องให้ผู้ใช้รอ)
const jobQueue = [];
let isProcessing = false;

const processJobQueue = async () => {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift();
      try {
        console.log(`🔄 ประมวลผลงานเบื้องหลัง: ${job.name || 'Unknown job'}`);
        await job.execute();
        console.log(`✅ งานเบื้องหลังสำเร็จ: ${job.name || 'Unknown job'}`);
      } catch (error) {
        console.error(`❌ งานเบื้องหลังล้มเหลว (${job.name}):`, error);
        
        // เพิ่มงานกลับเข้าคิวหาก retry < max
        if (job.retry && job.retry < (job.maxRetries || 3)) {
          job.retry += 1;
          console.log(`🔄 เพิ่มงานกลับเข้าคิว (retry: ${job.retry}/${job.maxRetries || 3})`);
          jobQueue.push(job);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

// เริ่มประมวลผลงานเบื้องหลังทุก 5 วินาที
setInterval(processJobQueue, 5000);

async function submitStarterSlip(req, res) {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🆔 [${requestId}] เริ่มประมวลผลคำขอใหม่`);
  
  let uploadedImageUrl = null;
  let insertedRecordId = null;
  let uploadedFilePath = null;

  try {
    // ✅ ขั้นตอนที่ 1: ตรวจสอบความถูกต้องของข้อมูลที่ส่งเข้ามา
    console.log(`🔍 [${requestId}] ตรวจสอบความถูกต้องของข้อมูล`);
    const { error: validationError, value: validatedData } = submitSlipSchema.validate(req.body);
    
    if (validationError) {
      console.log(`❌ [${requestId}] ข้อมูลไม่ถูกต้อง:`, validationError.details);
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง',
        errors: validationError.details.map(detail => detail.message),
        requestId
      });
    }

    const {
      ref_code,
      first_name,
      last_name,
      national_id,
      phone_number,
      duration,
      file_content
    } = validatedData;

    console.log(`✅ [${requestId}] ข้อมูลถูกต้อง - ref_code: ${ref_code}, ชื่อ: ${first_name} ${last_name}`);

    // ✅ ขั้นตอนที่ 2: ตรวจสอบ ref_code ในตาราง auth_sessions
    console.log(`🔍 [${requestId}] ตรวจสอบ ref_code ในระบบ`);
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      console.log(`❌ [${requestId}] ไม่พบ ref_code ในระบบ:`, sessionError);
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล ref_code ในระบบ',
        code: 'REF_CODE_NOT_FOUND',
        requestId
      });
    }

    const { serial_key, line_user_id } = sessionData;
    console.log(`✅ [${requestId}] พบข้อมูล ref_code - line_user_id: ${line_user_id}`);

    // ✅ ขั้นตอนที่ 3: ตรวจสอบว่าข้อมูลนี้เคยส่งมาแล้วหรือไม่
    console.log(`🔍 [${requestId}] ตรวจสอบการส่งข้อมูลซ้ำ`);
    const { data: existingSubmission, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('id, submissions_status')
      .eq('ref_code', ref_code)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = ไม่พบข้อมูล
      console.error(`❌ [${requestId}] เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล:`, checkError);
      throw new Error(`การตรวจสอบฐานข้อมูลล้มเหลว: ${checkError.message}`);
    }

    if (existingSubmission) {
      console.log(`⚠️ [${requestId}] พบข้อมูลซ้ำ - สถานะ: ${existingSubmission.submissions_status}`);
      return res.status(409).json({
        success: false,
        message: 'ข้อมูลนี้ถูกส่งไปแล้ว',
        code: 'DUPLICATE_SUBMISSION',
        data: {
          status: existingSubmission.submissions_status
        },
        requestId
      });
    }

    console.log(`✅ [${requestId}] ไม่พบข้อมูลซ้ำ - ดำเนินการต่อ`);

    const duration_minutes = duration * 1440; // แปลงวันเป็นนาที
    const slipFileName = `SP-${ref_code}-${Date.now()}.jpg`;
    const username = `ADT-${ref_code}`;
    const password = serial_key;

    // ✅ ขั้นตอนที่ 4: ดำเนินการหลักพร้อมระบบยกเลิกเมื่อเกิดข้อผิดพลาด
    console.log(`🔄 [${requestId}] เริ่มดำเนินการหลัก`);
    const transactionOperations = [
      // การทำงานที่ 1: อัปโหลดรูปภาพ
      {
        name: 'อัปโหลดรูปภาพ',
        execute: async () => {
          const uploadResult = await uploadBase64Image({
            base64String: file_content,
            fileName: slipFileName,
            bucketName: 'statercustumer',
            folderName: ref_code
          });

          if (uploadResult.error) {
            throw new Error(`การอัปโหลดรูปภาพล้มเหลว: ${uploadResult.error}`);
          }

          uploadedImageUrl = uploadResult.publicUrl;
          uploadedFilePath = uploadResult.filePath;
          
          return uploadResult;
        },
        compensate: async () => {
          if (uploadedFilePath) {
            try {
              // ลบรูปภาพที่อัปโหลดไปแล้ว
              const { error: deleteError } = await supabase.storage
                .from('statercustumer')
                .remove([uploadedFilePath]);
                
              if (deleteError) {
                console.error('❌ ไม่สามารถลบรูปภาพได้:', deleteError);
              } else {
                console.log('🗑️ ลบรูปภาพที่อัปโหลดแล้วเรียบร้อย');
              }
            } catch (error) {
              console.error('❌ ไม่สามารถลบรูปภาพได้:', error);
            }
          }
        }
      },

      // การทำงานที่ 2: บันทึกข้อมูลผู้ใช้
      {
        name: 'บันทึกข้อมูลผู้ใช้',
        execute: async () => {
          const { data, error: insertError } = await supabase
            .from('starter_plan_users')
            .insert([
              {
                ref_code,
                first_name,
                last_name,
                national_id,
                phone_number,
                duration_minutes,
                remaining_minutes: duration_minutes,
                used_minutes: 0,
                slip_image_url: uploadedImageUrl,
                submissions_status: 'pending',
                line_user_id,
                username,
                password,
                created_at: new Date().toISOString()
              }
            ])
            .select('id')
            .single();

          if (insertError) {
            throw new Error(`การบันทึกข้อมูลล้มเหลว: ${insertError.message}`);
          }

          insertedRecordId = data.id;
          return data;
        },
        compensate: async () => {
          if (insertedRecordId) {
            try {
              const { error: deleteError } = await supabase
                .from('starter_plan_users')
                .delete()
                .eq('id', insertedRecordId);
                
              if (deleteError) {
                console.error('❌ ไม่สามารถลบข้อมูลในฐานข้อมูลได้:', deleteError);
              } else {
                console.log('🗑️ ลบข้อมูลในฐานข้อมูลแล้วเรียบร้อย');
              }
            } catch (error) {
              console.error('❌ ไม่สามารถลบข้อมูลในฐานข้อมูลได้:', error);
            }
          }
        }
      }
    ];

    // ดำเนินการทั้งหมด
    await executeTransaction(transactionOperations);

    // ✅ ขั้นตอนที่ 5: ส่งผลลัพธ์กลับให้ผู้ใช้ทันที
    console.log(`✅ [${requestId}] ดำเนินการหลักสำเร็จ - ส่งผลลัพธ์กลับผู้ใช้`);
    res.status(200).json({
      success: true,
      message: 'ข้อมูลถูกส่งเรียบร้อยแล้ว กรุณารอการอนุมัติจากแอดมิน',
      data: {
        ref_code,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        username,
        duration_days: duration
      },
      requestId
    });

    // ✅ ขั้นตอนที่ 6: เพิ่มงานเบื้องหลังสำหรับส่งการแจ้งเตือน
    jobQueue.push({
      name: `ส่งการแจ้งเตือนไปยังแอดมิน [${ref_code}]`,
      retry: 0,
      maxRetries: 3,
      execute: async () => {
        try {
          console.log(`📤 [${ref_code}] กำลังส่งการแจ้งเตือนไปยังแอดมิน...`);
          
          const response = await httpClient.post(`${API2_URL}/notify-admin-slip`, {
            ref_code,
            duration
          });

          if (response.status === 200) {
            console.log(`✅ [${ref_code}] ส่งการแจ้งเตือนไปยังแอดมินสำเร็จ`);
            
            // อัปเดตสถานะเป็น 'notified_admin'
            const { error: updateError } = await supabase
              .from('starter_plan_users')
              .update({ 
                submissions_status: 'notified_admin',
                admin_notified_at: new Date().toISOString()
              })
              .eq('ref_code', ref_code);

            if (updateError) {
              console.error(`❌ [${ref_code}] ไม่สามารถอัปเดตสถานะได้:`, updateError);
            }

          } else {
            throw new Error(`การส่งการแจ้งเตือนไปยังแอดมินล้มเหลว สถานะ: ${response.status}`);
          }

        } catch (error) {
          console.error(`❌ [${ref_code}] ไม่สามารถส่งการแจ้งเตือนไปยังแอดมินได้:`, error.message);
          
          // อัปเดตสถานะเป็น 'notification_failed'
          const { error: updateError } = await supabase
            .from('starter_plan_users')
            .update({ 
              submissions_status: 'notification_failed',
              error_message: error.message,
              last_error_at: new Date().toISOString()
            })
            .eq('ref_code', ref_code);

          if (updateError) {
            console.error(`❌ [${ref_code}] ไม่สามารถอัปเดตสถานะ error ได้:`, updateError);
          }

          throw error;
        }
      }
    });

    console.log(`✅ [${requestId}] การทำงานเสร็จสิ้น งานเบื้องหลังถูกเพิ่มในคิวแล้ว`);

    // เรียกใช้ processJobQueue ทันที (ไม่ต้องรอ 5 วินาที)
    setImmediate(processJobQueue);

  } catch (error) {
    console.error(`❌ [${requestId}] ข้อผิดพลาด @ submitStarterSlip:`, error);

    // หากยังไม่ได้ส่งการตอบกลับ
    if (!res.headersSent) {
      const isValidationError = error.name === 'ValidationError';
      const statusCode = isValidationError ? 400 : 500;
      
      return res.status(statusCode).json({
        success: false,
        message: isValidationError ? 'ข้อมูลไม่ถูกต้อง' : 'เกิดข้อผิดพลาดในระบบ',
        error: process.env.NODE_ENV === 'development' ? error.message : 'เกิดข้อผิดพลาดภายในระบบ',
        code: 'INTERNAL_SERVER_ERROR',
        requestId
      });
    }
  }
}

// ✅ ฟังก์ชันแยกต่างหากสำหรับจัดการการอนุมัติจากแอดมิน (เรียกผ่าน webhook)
async function handleAdminApproval(ref_code, approved = true) {
  const requestId = `APPROVAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🆔 [${requestId}] เริ่มจัดการการอนุมัติ - ref_code: ${ref_code}, approved: ${approved}`);
  
  try {
    const { data: userData, error: fetchError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (fetchError || !userData) {
      throw new Error('ไม่พบข้อมูลผู้ใช้');
    }

    console.log(`✅ [${requestId}] พบข้อมูลผู้ใช้: ${userData.first_name} ${userData.last_name}`);

    if (approved) {
      // อัปเดตสถานะเป็นอนุมัติ
