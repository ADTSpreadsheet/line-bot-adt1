function extractInfoFromText(text) {
  const cleanedText = text.replace(/\s+/g, ' '); // ลบช่องว่างหลายตัว
  let amount = null;
  let transferDate = null;
  let transferTime = null;
  let senderName = null;

  // 👛 หา amount ที่เป็นรูปแบบยอดเงิน
  const amountMatch = cleanedText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // 🕒 หาเวลา (รูปแบบ 12:30 หรือ 18:45)
  const timeMatch = cleanedText.match(/(\d{1,2}:\d{2})/);
  if (timeMatch) {
    transferTime = timeMatch[1];
  }

  // 📆 หา "วันที่" แบบไทย เช่น 8 มิ.ย. 67 หรือ 25 พ.ค. 2567
  const dateMatch = cleanedText.match(/(\d{1,2} [ก-ฮ]{2,4}\.? ?\d{2,4})/);
  if (dateMatch) {
    transferDate = dateMatch[1];
  }

  // 🧍‍♂️ หาชื่อ เช่น "นาย สมชาย" หรือ "นางสาว กัลยา"
  const nameMatch = cleanedText.match(/(นาย|นางสาว|น.ส.|นาง)\s+[^\d\n]+/i);
  if (nameMatch) {
    senderName = nameMatch[0].trim();
  }

  return {
    amount,
    transferDate,
    transferTime,
    senderName
  };
}

module.exports = extractInfoFromText;
