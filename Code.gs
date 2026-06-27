const RESPONSE_SS_ID = '1VPTdCQ2_Mws19r0xEPmic4qM65NK-BhLqmgtc-EUFVg';
const RESPONSE_SHEET = 'フォームの回答 1';

const MASTER_SS_ID = '1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E';
const MASTER_SHEET = '講師マスター';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    let result;

    if (data.action === 'getTeacher') {
      result = getTeacher(data.code);
    } else if (data.action === 'submitAttendance') {
      result = submitAttendance(data);
    } else {
      result = { ok: false, message: '不明な処理です。' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getTeacher(code) {
  code = String(code || '').trim();
  const sh = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName(MASTER_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const masterCode = String(values[i][0]).trim();
    const name = String(values[i][1]).trim();
    const email = String(values[i][15]).trim();
    if (masterCode === code) return { ok: true, code, name, email };
  }
  return { ok: false, message: '講師コードが見つかりません。名前がない場合は、すぐに申し出てください。' };
}

function submitAttendance(data) {
  const teacher = getTeacher(data.code);
  if (!teacher.ok) throw new Error('講師コードが見つかりません。');

  const sh = SpreadsheetApp.openById(RESPONSE_SS_ID).getSheetByName(RESPONSE_SHEET);
  const lessons = Array.isArray(data.lessons) ? data.lessons.join(' / ') : data.lessons;
  const koma = data.koma === 'その他' ? data.komaOther : data.koma;

  sh.appendRow([
    new Date(),
    teacher.code + ' ' + teacher.name,
    data.workDate,
    lessons,
    koma,
    data.memo || '',
    data.place,
    teacher.code
  ]);

  return { ok: true, name: teacher.name };
}
