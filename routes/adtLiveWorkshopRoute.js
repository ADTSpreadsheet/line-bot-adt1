const express = require('express');
const router = express.Router();

const { handleSubmitLiveWorkshop } = require('../controllers/adtLiveWorkshopSubmit');

// POST /adtliveworkshop/submit
router.post('/submit', handleSubmitLiveWorkshop);

module.exports = router;
