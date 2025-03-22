// utils/timeUtils.js

/**
 * แปลงเวลาจาก UTC เป็นเวลาไทย (UTC+7)
 * @param {string} utcString - เวลาที่อยู่ในรูปแบบสตริง UTC
 * @returns {string} - เวลาที่ถูกแปลงเป็นรูปแบบวันที่และเวลาของไทย
 */
function toThaiTime(utcString) {
  const utcDate = new Date(utcString);
  const bangkokOffset = 7 * 60; // Offset +07:00
  const localTime = new Date(utcDate.getTime() + bangkokOffset * 60 * 1000);
  return localTime.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

module.exports = {
  toThaiTime,
};
