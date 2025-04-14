// routes/replyFromAdminRoutes.js

const express = require('express');
const router = express.Router();
const { replyToUser } = require('../controllers/replyFromAdminController');

// POST /admin/reply-to-user
router.post('/admin/reply-to-user', replyToUser);

module.exports = router;
