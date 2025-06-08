const express = require('express');
const multer = require('multer');
const { testOCRHandler } = require('../controllers/testOCRController');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/test-ocr', upload.single('slip'), testOCRHandler);

module.exports = router;
