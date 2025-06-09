function normalizeThaiText(text) {
  return text
    .replace(/([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/g, '$1$2') // รวมอักษรไทยที่ถูกเว้น
    .replace(/(\d)\s+(\d)/g, '$1$2') // รวมตัวเลข
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+บาท/g, ' บาท')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

function parseThaiAmount(text) {
  const cleaned = text
    .replace(/[^\d.,]/g, '')
    .replace(/,+/g, '.')
    .replace(/\.+/g, '.');
  const parts = cleaned.split('.');
  if (parts.length >= 3) {
    const merged = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    return parseFloat(merged);
  }
  return parseFloat(cleaned);
}

function parseThaiDate(raw) {
  const months = {
    'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5,
    'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10,
    'พ.ย.': 11, 'ธ.ค.': 12
  };
  const regex = /(\d{1,2})\s?(ม\.\w{1,2}\.|พ\.\w{1,2}\.|[ก-ฮ]{2,3}\.)\s?(\d{2})/;
  const match = raw.match(regex);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = months[match[2]];
  const year = parseInt(match[3]) + 2000;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractInfoFromText(rawText) {
  const text = normalizeThaiText(rawText);

  const amountMatch = text.match(/จำนวน[:\s]*([0-9.,]+)/);
  const amount = amountMatch ? parseThaiAmount(amountMatch[1]) : null;

  const dateMatch = text.match(/(\d{1,2} [ก-ฮ]{2,4}\.? ?\d{2})/);
  const date = dateMatch ? parseThaiDate(dateMatch[1]) : null;

  const timeMatch = text.match(/(\d{1,2}:\d{2})/);
  const time = timeMatch ? timeMatch[1] + ':00' : null;

  const nameMatches = text.match(/(นาย|นางสาว|นาง|น\.ส\.) ?[^\d\n]{2,30}/g);
  const senderName = nameMatches?.[0] || null;
  const receiverName = nameMatches?.[1] || null;

  const transactionMatch = text.match(/(?:รายการ[:\s]*)?(\d{10,})[A-Z]{3,}\d*/);
  const transactionId = transactionMatch ? transactionMatch[1] : null;

  return {
    amount,
    transfer_date: date,
    transfer_time: time,
    sender_name: senderName,
    receiver_name: receiverName,
    transaction_id: transactionId
  };
}

module.exports = extractInfoFromText;
