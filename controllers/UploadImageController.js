const axios = require('axios');
const { supabase } = require('../utils/supabaseClient');
const log = require('../utils/logger').createModuleLogger('UploadImage');

const fetchImageFromLINE = async (messageId) => {
  const res = await axios.get(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );
  return res.data; // return buffer
};

const uploadToSupabase = async (refCode, buffer, tag = 'image') => {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${tag}_${timestamp}.jpg`;
  const filePath = `${refCode}/${filename}`;

  const { data, error } = await supabase
    .storage
    .from('chat-media')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    log.error("❌ Upload fail:", error.message);
    throw error;
  }

  const publicURL = supabase
    .storage
    .from('chat-media')
    .getPublicUrl(data.path).publicURL;

  return publicURL;
};

const handleImageUpload = async (messageId, refCode, tag = 'image') => {
  const buffer = await fetchImageFromLINE(messageId);
  const publicURL = await uploadToSupabase(refCode, buffer, tag);
  return publicURL;
};

module.exports = {
  handleImageUpload
};
