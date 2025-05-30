const { supabase } = require('../utils/supabaseClient');

async function getNextLicenseNumber() {
  const { data, error } = await supabase
    .from('license_holders')
    .select('license_no')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Fetch license_no failed: ${error.message}`);
  }

  const lastNo = data?.[0]?.license_no || 'ADT000';
  const num = parseInt(lastNo.replace('ADT', ''), 10);
  const nextNum = num + 1;
  const newLicenseNo = `ADT${String(nextNum).padStart(3, '0')}`;
  return newLicenseNo;
}

module.exports = {
  getNextLicenseNumber
};
