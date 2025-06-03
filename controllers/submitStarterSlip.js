const { supabase } = require('../utils/supabaseClient');
const uploadBase64Image = require('../utils/uploadBase64Image');
const axios = require('axios');
const joi = require('joi');

// Environment variables
const LINE_BOT_API_URL = process.env.LINE_BOT_API_URL || 'https://line-bot-adt2.onrender.com';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 30000; // 30 seconds
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

// Validation schema
const submitSlipSchema = joi.object({
  ref_code: joi.string().required().messages({
    'string.empty': 'กรุณากรอก ref_code',
    'any.required': 'กรุณากรอก ref_code'
  }),
  first_name: joi.string().min(1).max(100).required().messages({
    'string.empty': 'กรุณากรอกชื่อ',
    'string.max': 'ชื่อต้องไม่เกิน 100 ตัวอักษร',
    'any.required': 'กรุณากรอกชื่อ'
  }),
  last_name: joi.string().min(1).max(100).required().messages({
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

// HTTP client with retry mechanism
const createHttpClient = () => {
  const client = axios.create({
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'StarterSlip-API/1.0'
    }
  });

  // Add retry interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config;
      
      if (!config || !config.retry) {
        config.retry = 0;
      }

      if (config.retry < MAX_RETRIES && 
          (error.code === 'ECONNABORTED' || 
           error.response?.status >= 500)) {
        
        config.retry += 1;
        const delay = Math.pow(2, config.retry) * 1000; // Exponential backoff
        
        console.log(`🔄 Retrying request (${config.retry}/${MAX_RETRIES}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return client(config);
      }

      throw error;
    }
  );

  return client;
};

const httpClient = createHttpClient();

// Database transaction helper
async function executeTransaction(operations) {
  const client = supabase;
  
  try {
    // Start transaction (Note: Supabase doesn't have explicit transactions, 
    // so we'll implement compensation pattern)
    const results = [];
    const compensations = [];

    for (const operation of operations) {
      try {
        const result = await operation.execute();
        results.push(result);
        
        if (operation.compensate) {
          compensations.unshift(operation.compensate); // LIFO for rollback
        }
      } catch (error) {
        // Execute compensations in reverse order
        for (const compensate of compensations) {
          try {
            await compensate();
          } catch (compError) {
            console.error('❌ Compensation failed:', compError);
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

// Background job queue (simple in-memory implementation for now)
const jobQueue = [];
const processJobQueue = async () => {
  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    try {
      await job.execute();
    } catch (error) {
      console.error('❌ Background job failed:', error);
      // Could implement retry logic here
    }
  }
};

// Start background job processor
setInterval(processJobQueue, 5000); // Process every 5 seconds

async function submitStarterSlip(req, res) {
  let uploadedImageUrl = null;
  let insertedRecordId = null;

  try {
    // ✅ Step 1: Input validation
    const { error: validationError, value: validatedData } = submitSlipSchema.validate(req.body);
    
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลไม่ถูกต้อง',
        errors: validationError.details.map(detail => detail.message)
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

    // ✅ Step 2: Check ref_code in auth_sessions
    const { data: sessionData, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('serial_key, line_user_id')
      .eq('ref_code', ref_code)
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล ref_code ในระบบ',
        code: 'REF_CODE_NOT_FOUND'
      });
    }

    const { serial_key, line_user_id } = sessionData;

    // ✅ Step 3: Check for duplicate submission
    const { data: existingSubmission, error: checkError } = await supabase
      .from('starter_plan_users')
      .select('id, submissions_status')
      .eq('ref_code', ref_code)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error(`Database check failed: ${checkError.message}`);
    }

    if (existingSubmission) {
      return res.status(409).json({
        success: false,
        message: 'ข้อมูลนี้ถูกส่งไปแล้ว',
        code: 'DUPLICATE_SUBMISSION',
        data: {
          status: existingSubmission.submissions_status
        }
      });
    }

    const duration_minutes = duration * 1440; // Convert days to minutes
    const slipFileName = `SP-${ref_code}-${Date.now()}.jpg`;

    // ✅ Step 4: Execute main transaction
    const transactionOperations = [
      // Operation 1: Upload image
      {
        execute: async () => {
          const { publicUrl, error: uploadError } = await uploadBase64Image({
            base64String: file_content,
            fileName: slipFileName,
            bucketName: 'statercustumer',
            folderName: ref_code
          });

          if (uploadError) {
            throw new Error(`Image upload failed: ${uploadError}`);
          }

          uploadedImageUrl = publicUrl;
          return { publicUrl };
        },
        compensate: async () => {
          if (uploadedImageUrl) {
            try {
              // Delete uploaded image
              await supabase.storage
                .from('statercustumer')
                .remove([`${ref_code}/${slipFileName}`]);
              console.log('🗑️ Cleaned up uploaded image');
            } catch (error) {
              console.error('Failed to cleanup image:', error);
            }
          }
        }
      },

      // Operation 2: Insert user data
      {
        execute: async () => {
          const username = `ADT-${ref_code}`;
          const password = serial_key;

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
            throw new Error(`Database insert failed: ${insertError.message}`);
          }

          insertedRecordId = data.id;
          return data;
        },
        compensate: async () => {
          if (insertedRecordId) {
            try {
              await supabase
                .from('starter_plan_users')
                .delete()
                .eq('id', insertedRecordId);
              console.log('🗑️ Cleaned up database record');
            } catch (error) {
              console.error('Failed to cleanup database record:', error);
            }
          }
        }
      }
    ];

    // Execute transaction
    await executeTransaction(transactionOperations);

    // ✅ Step 5: Return success immediately to user
    res.status(200).json({
      success: true,
      message: 'ข้อมูลถูกส่งเรียบร้อยแล้ว กรุณารอการอนุมัติจากแอดมิน',
      data: {
        ref_code,
        status: 'pending',
        submitted_at: new Date().toISOString()
      }
    });

    // ✅ Step 6: Add background jobs for notifications
    // Job 1: Send admin notification
    jobQueue.push({
      execute: async () => {
        try {
          console.log('📤 Sending admin notification...');
          
          const response = await httpClient.post(`${LINE_BOT_API_URL}/flex/send-starter-slip`, {
            ref_code,
            duration,
            first_name,
            last_name,
            phone_number,
            slip_image_url: uploadedImageUrl
          });

          if (response.status === 200) {
            console.log('✅ Admin notification sent successfully');
            
            // Update status to 'notified_admin'
            await supabase
              .from('starter_plan_users')
              .update({ 
                submissions_status: 'notified_admin',
                admin_notified_at: new Date().toISOString()
              })
              .eq('ref_code', ref_code);

          } else {
            throw new Error(`Admin notification failed with status: ${response.status}`);
          }

        } catch (error) {
          console.error('❌ Failed to send admin notification:', error.message);
          
          // Update status to 'notification_failed'
          await supabase
            .from('starter_plan_users')
            .update({ 
              submissions_status: 'notification_failed',
              error_message: error.message,
              last_error_at: new Date().toISOString()
            })
            .eq('ref_code', ref_code);

          throw error;
        }
      }
    });

    console.log('✅ Transaction completed, background jobs queued');

  } catch (error) {
    console.error('❌ ERROR @ submitStarterSlip:', error);

    // If response hasn't been sent yet
    if (!res.headersSent) {
      const isValidationError = error.name === 'ValidationError';
      const statusCode = isValidationError ? 400 : 500;
      
      return res.status(statusCode).json({
        success: false,
        message: isValidationError ? 'ข้อมูลไม่ถูกต้อง' : 'เกิดข้อผิดพลาดในระบบ',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
}

// ✅ Separate function to handle admin approval (called by webhook)
async function handleAdminApproval(ref_code, approved = true) {
  try {
    const { data: userData, error: fetchError } = await supabase
      .from('starter_plan_users')
      .select('*')
      .eq('ref_code', ref_code)
      .single();

    if (fetchError || !userData) {
      throw new Error('User data not found');
    }

    if (approved) {
      // Update status to approved
      await supabase
        .from('starter_plan_users')
        .update({ 
          submissions_status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('ref_code', ref_code);

      // Send success notification to user
      await httpClient.post(`${LINE_BOT_API_URL}/flex/notify-user-starter`, {
        ref_code,
        username: userData.username,
        password: userData.password,
        duration: Math.floor(userData.duration_minutes / 1440),
        line_user_id: userData.line_user_id,
        status: 'approved'
      });

      console.log(`✅ User ${ref_code} approved and notified`);
    } else {
      // Update status to rejected
      await supabase
        .from('starter_plan_users')
        .update({ 
          submissions_status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('ref_code', ref_code);

      // Send rejection notification to user
      await httpClient.post(`${LINE_BOT_API_URL}/flex/notify-user-starter`, {
        ref_code,
        line_user_id: userData.line_user_id,
        status: 'rejected'
      });

      console.log(`❌ User ${ref_code} rejected and notified`);
    }

  } catch (error) {
    console.error('❌ Error handling admin approval:', error);
    throw error;
  }
}

module.exports = {
  submitStarterSlip,
  handleAdminApproval
};
