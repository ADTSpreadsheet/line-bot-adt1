/**
 * utils/timeUtils.js
 * ฟังก์ชันแปลงเวลา UTC → เวลาไทย (รูปแบบอ่านง่าย)
 */

const toThaiTime = (datePart, timePart) => {
  try {
    let isoString;

    if (datePart && timePart) {
      // กรณีส่ง date + time แยกมา
      isoString = `${datePart}T${timePart}`;
    } else {
      // กรณีส่งเป็น object Date หรือ ISO string
      isoString = new Date(datePart || timePart || Date.now()).toISOString();
    }

    const utc = new Date(isoString);
    const thai = new Date(utc.getTime() + 7 * 60 * 60 * 1000); // +7 ชั่วโมง

    return thai.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour12: false,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (err) {
    console.error('❌ Error converting to Thai time:', err);
    return '-';
  }
};

module.exports = { toThaiTime };
