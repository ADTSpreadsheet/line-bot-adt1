function extractInfoFromText(text) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const lines = cleanText.split('\n').map(line => line.trim());

  const result = {
    sender_name: null,
    receiver_name: null,
    amount: null,
    transfer_date: null,
    transfer_time: null,
    transaction_id: null
  };

  // ✅ 1. ชื่อผู้โอนและผู้รับ (มักอยู่ติดกัน 2 บรรทัด)
  const nameRegex = /นาย\s?[^\d]+/g;
  const names = cleanText.match(nameRegex);
  if (names?.length >= 2) {
    result.sender_name = names[0].trim();
    result.receiver_name = names[1].trim();
  }

  // ✅ 2. วันที่และเวลา (เช่น "31 พ.ค. 68 19:30 น.")
  const dateTimeRegex = /(\d{1,2})\s?(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s?(\d{2})\s?(\d{1,2}:\d{2})/;
  const matchDate = cleanText.match(dateTimeRegex);
  if (matchDate) {
    const [_, day, thMonth, yearShort, time] = matchDate;
    const thMonths = {
      'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
      'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
      'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
    };
    const month = thMonths[thMonth] || '01';
    const year = '25' + yearShort;
    result.transfer_date = `${year}-${month}-${day.padStart(2, '0')}`;
    result.transfer_time = `${time}:00`;
  }

  // ✅ 3. จำนวนเงิน
  const amountRegex = /(\d{1,3}(,\d{3})*(\.\d{2})?)/g;
  const matches = cleanText.match(amountRegex);
  if (matches) {
    // ใช้ค่าที่มากที่สุดเป็นยอดเงิน
    const amounts = matches.map(a => parseFloat(a.replace(/,/g, ''))).filter(n => !isNaN(n));
    if (amounts.length > 0) {
      result.amount = Math.max(...amounts);
    }
  }

  // ✅ 4. หมายเลขรายการ
  const txIdRegex = /[0-9]{5,}[A-Z]{2}[0-9A-Z]+/;
  const txMatch = cleanText.match(txIdRegex);
  if (txMatch) {
    result.transaction_id = txMatch[0];
  }

  return result;
}

module.exports = extractInfoFromText;
