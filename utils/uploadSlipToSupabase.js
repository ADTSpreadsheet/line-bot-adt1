const { supabase } = require('./supabaseClient');

async function uploadBase64ImageToSupabase({ base64String, fileName, bucket }) {
  const base64Data = base64String.split(';base64,').pop();
  const buffer = Buffer.from(base64Data, 'base64');

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    return { success: false, error };
  }

  const { data: publicUrlData } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(fileName);

  return {
    success: true,
    publicUrl: publicUrlData.publicUrl
  };
}

module.exports = {
  uploadBase64ImageToSupabase
};
