// utils/uploadSlipToSupabase.js
const { supabase } = require('./supabaseClient');

/**
 * Upload base64 image to Supabase Storage
 * @param {Object} params
 * @param {string} params.base64String - Image in base64 format (data:image/jpeg;base64,...)
 * @param {string} params.fileName - Desired filename (e.g. ADT-01-ADT123-SLP-0001.jpg)
 * @param {string} params.bucket - Supabase Storage bucket name (e.g. 'adtpayslip')
 */
async function uploadBase64ImageToSupabase({ base64String, fileName, bucket }) {
  try {
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true // ป้องกันซ้ำชื่อจะ overwrite
      });

    if (error) return { success: false, error };

    const { data: publicUrlData } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      success: true,
      publicUrl: publicUrlData.publicUrl
    };
  } catch (err) {
    return { success: false, error: err };
  }
}

module.exports = {
  uploadBase64ImageToSupabase
};
