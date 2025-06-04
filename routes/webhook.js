const express = require('express');
const router = express.Router();

// Import Controllers
const { handleFollowEvent } = require('../controllers/events/FollowADTLineBot');
const { handleMessageEvent } = require('../controllers/events/MessageADTLineBot');
const { handleUnfollowEvent } = require('../controllers/events/UnfollowADTLineBot');

// ==============================
// 🎯 LINE WEBHOOK FORWARDER
// ==============================

router.post('/', async (req, res) => {
  console.log('=== LINE WEBHOOK RECEIVED ===');
  
  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      console.log('No events found');
      return res.status(200).end();
    }

    console.log('Number of events:', events.length);

    // ประมวลผลแต่ละ event
    for (const event of events) {
      console.log(`Event Type: ${event.type}, User: ${event.source.userId}`);
      
      // ส่งต่อไปยัง Controller ที่เหมาะสม
      switch (event.type) {
        case 'follow':
          console.log('🔄 Forwarding to Follow Handler');
          await handleFollowEvent(event);
          break;
          
        case 'message':
          console.log('💬 Forwarding to Message Handler');
          await handleMessageEvent(event);
          break;
          
        case 'unfollow':
          console.log('👋 Forwarding to Unfollow Handler');
          await handleUnfollowEvent(event);
          break;
          
        default:
          console.log('⚠️ Unknown event type:', event.type);
      }
    }

    res.status(200).end();
    
  } catch (error) {
    console.log('❌ Webhook Error:', error.message);
    res.status(500).end();
  }
  
  console.log('=== WEBHOOK END ===');
});

module.exports = router;
