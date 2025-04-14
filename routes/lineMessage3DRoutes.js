// routes/lineMessage3DRoutes.js
const express = require('express');
const router = express.Router();

const { handleLine3DMessage } = require('../controllers/LineMessage3DController');

// LINE Webhook สำหรับรับข้อความทุกประเภทข้ามมิติ
router.post('/', async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    return res.status(200).end();
  }

  for (const event of events) {
    if (event.type === 'message') {
      await handleLine3DMessage(event);
    }
  }

  res.status(200).end();
});

module.exports = router;
