const { supabase } = require('../../utils/supabaseClient');

// 📌 Logic 3: Unfollow Event Handler
const handleUnfollowEvent = async (event) => {
  const userId = event.source.userId;

  // อัปเดต line_status เป็น Unfollow
  const { error } = await supabase
    .from('auth_sessions')
    .update({
      line_status: 'Unfollow'
    })
    .eq('line_user_id', userId);

  if (error) {
    console.error('❌ อัปเดต line_status ล้มเหลว:', error.message);
    return;
  }

  console.log('✅ Unfollow Event สำเร็จ - User:', userId, 'Status: Unfollow');
};

module.exports = {
  handleUnfollowEvent
};
