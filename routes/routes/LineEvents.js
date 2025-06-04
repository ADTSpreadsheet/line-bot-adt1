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
// 👋 FOLLOW EVENT ENDPOINT
// ==============================

router.post('/FollowADTLineBot', async (req, res) => {
  console.log('=== FOLLOW EVENT RECEIVED ===');
  
  try {
    const event = req.body;
    
    console.log('Event Data:', event);
    
    // เรียก Follow handler
    await handleFollowEvent(event);

    console.log('✅ Follow event processed successfully');
    res.status(200).json({ 
      success: true,
      message: 'Follow event processed' 
    });
    
  } catch (error) {
    console.log('Follow Event Error:', error.message);
    log.error(`[FOLLOW] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
  
  console.log('=== FOLLOW EVENT END ===');
});

// ==============================
// 💬 MESSAGE EVENT ENDPOINT
// ==============================

router.post('/MessageADTLineBot', async (req, res) => {
  console.log('=== MESSAGE EVENT RECEIVED ===');
  
  try {
    const event = req.body;
    
    console.log('Event Data:', event);
    
    // เรียก Message handler
    await handleMessageEvent(event);

    console.log('✅ Message event processed successfully');
    res.status(200).json({ 
      success: true,
      message: 'Message event processed' 
    });
    
  } catch (error) {
    console.log('Message Event Error:', error.message);
    log.error(`[MESSAGE] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
  
  console.log('=== MESSAGE EVENT END ===');
});

// ==============================
// 👋 UNFOLLOW EVENT ENDPOINT
// ==============================

router.post('/UnfollowADTLineBot', async (req, res) => {
  console.log('=== UNFOLLOW EVENT RECEIVED ===');
  
  try {
    const event = req.body;
    
    console.log('Event Data:', event);
    
    // เรียก Unfollow handler
    await handleUnfollowEvent(event);

    console.log('✅ Unfollow event processed successfully');
    res.status(200).json({ 
      success: true,
      message: 'Unfollow event processed' 
    });
    
  } catch (error) {
    console.log('Unfollow Event Error:', error.message);
    log.error(`[UNFOLLOW] Error: ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
  
  console.log('=== UNFOLLOW EVENT END ===');
});

// ==============================
// 🕐 STARTERPLAN REMAINING ENDPOINT
// ==============================

router.post('/StarterplanRemaining', async (req, res) => {
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
