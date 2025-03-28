// middlewares/validator.js
/**
 * ตรวจสอบว่า body มี key ที่กำหนด
 * @param {string[]} keys - คีย์ที่ต้องการตรวจสอบ
 */
const validateBody = (keys) => (req, res, next) => {
  const missing = keys.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: `Missing required fields: ${missing.join(', ')}`
    });
  }
  next();
};

/**
 * ตรวจสอบ query parameters (GET)
 * @param {string[]} keys
 */
const validateQueryParams = (keys) => (req, res, next) => {
  const missing = keys.filter((key) => !req.query[key]);
  if (missing.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: `Missing query parameters: ${missing.join(', ')}`
    });
  }
  next();
};

module.exports = {
  validateBody,
  validateQueryParams
};
