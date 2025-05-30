const { supabase } = require('../utils/supabaseClient');
const path = require('path');

async function uploadSlipBase64(base64String, fileName) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const filePath = `${fileName}.jpg`;

  const { error } = await supabase.storage
    .from('adtpayslip')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase
    .storage
    .from('adtpayslip')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

module.exports = {
  uploadSlipBase64
};
