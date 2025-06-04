const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const log = createModuleLogger('LineEvents-Route');

// Import Controllers
const { handleFollowEvent } = require('../controllers/events/FollowADTLineBot');
const { handleMessageEvent } = require('../controllers/events/MessageADTLineBot');
const { handleUnfollowEvent } = require('../controllers/events/UnfollowADTLineBot');
const { handleStarterplanRemaining } = require('../controllers/events/StarterplanRemaining');

// ==============================
// 🎯 MAIN WEBHOOK ROUTE
// ==============================

router.post('/webhook', async (req, res) => {
  console.log('=== LINE WEBHOOK RECEIVED ===');
  
  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      console.log('No events found');
      return res.status(200).end();
    }

    console.log('Number of events:', events.length);

    for (const event of events) {
      console.log(`Event Type: ${event.type}, User: ${event.source.userId}`);
      
      // แยกการจัดการตาม event type
      switch (event.type) {
        case 'follow':
          console.log('🔄 Processing Follow Event');
          await handleFollowEvent(event);
          break;
          
        case 'message':
          console.log('💬 Processing Message Event');
          await handleMessageEvent(event);
          break;
          
        case 'unfollow':
          console.log('👋 Processing Unfollow Event');
          await handleUnfollowEvent(event);
          break;
          
        default:
          console.log('Unknown event type:', event.type);
      }
    }

    res.status(200).end();
    
  } catch (error) {
    console.log('Webhook Critical Error:', error.message);
    log.error(`[WEBHOOK] Critical Error: ${error.message}`);
    res.status(500).end();
  }
  
  console.log('=== WEBHOOK END ===');
});

// ==============================
// 🕐 STARTERPLAN REMAINING ENDPOINT
// ==============================

router.post('/starterplan-remaining', async (req, res) => {
  console.log('=== STARTERPLAN REMAINING RECEIVED ===');
  
  try {
    const { ref_code, remaining_minutes } = req.body;
    
    console.log('Ref Code:', ref_code);
    console.log('Remaining Minutes:', remaining_minutes);

    if (!ref_code || remaining_minutes === undefined) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing ref_code or remaining_minutes' 
      });
    }

    // เรียก StarterplanRemaining handler
    await handleStarterplanRemaining(ref_code, remaining_minutes);

    console.log('✅ Starterplan remaining processed successfully');
    res.status(200).json({ 
      success: true,
      message: 'Starterplan remaining processed' 
    });
    
  } catch (error) {
    console.log('Starterplan Remaining Error:', error.message);
    log.error(`[STARTERPLAN] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
  
  console.log('=== STARTERPLAN REMAINING END ===');
});

module.exports = router;
