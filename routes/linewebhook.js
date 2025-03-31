const express = require('express');
const router = express.Router();
const eventLine = require('./events/eventLine'); // เรียกใช้ฟังก์ชันแยก

router.post('/webhook', async (req, res) => {
  try {
    res.status(200).end(); // ตอบให้ LINE รู้ว่าเรารับแล้ว

    const events = req.body.events;
    if (!events || events.length === 0) return;

    for (const event of events) {
      if (event.type === 'follow') {
        await eventLine.handleFollow(event);
      } else if (event.type === 'unfollow') {
        await eventLine.handleUnfollow(event);
      } else if (event.type === 'message') {
        await eventLine.handleMessage(event);
      }
    }

  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
  }
});

module.exports = router;
