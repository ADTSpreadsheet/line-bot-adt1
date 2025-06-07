// routes/processOrderRoutes.js
const express = require('express');
const router = express.Router();
const { processOrder } = require('../controllers/processOrderController');

router.post('/', processOrder);

module.exports = router;
