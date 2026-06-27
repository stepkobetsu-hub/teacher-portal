const RESPONSE_SS_ID = '1VPTdCQ2_Mws19r0xEPmic4qM65NK-BhLqmgtc-EUFVg';
const RESPONSE_SHEET = 'フォームの回答 1';

const MASTER_SS_ID = '1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E';
const MASTER_SHEET = '講師マスター';

function doGet(e) {
  const params = e.parameter || {};
  const callback = params.callback || 'callback';

  let result;
  try {
    const action = params.action || '';
    if (action === 'getTeacher') {
      result = getTeacherApi_(params.code);
    } else if (action === 'submitAttendance') {
      result = submitAttendanceApi_(params);
    } else if (action === 'saveQrData') {
      result = saveQrDataApi_(params.code, params.qrData);
    } else {
      result = { ok: false, message: 'actionが不正です。' };
    }
  } catch (err) {
    result = { ok: false, message: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getTeacherApi_(code) {
  code = String(code || '').trim();
  if (!code) return { ok: false, message: '講師コードが空です。' };

  const sh = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName(MASTER_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const masterCode = String(values[i][0] || '').trim(); // A列
    if (masterCode === code) {
      const name = String(values[i][1] || '').trim();     // B列
      const email = String(values[i][15] || '').trim();   // P列
      const qrData = String(values[i][16] || '').trim();  // Q列
      return {
        ok: true,
        teacher: {
          code,
          name,
          email,
          qrData
        }
      };
    }
  }

  return {
    ok: false,
    message: '講師コードが見つかりません。名前がない場合は、すぐに申し出てください。'
  };
}

function submitAttendanceApi_(data) {
  const teacherRes = getTeacherApi_(data.code);
  if (!teacherRes.ok) throw new Error('講師コードが見つかりません。');

  const teacher = teacherRes.teacher;
  const sh = SpreadsheetApp.openById(RESPONSE_SS_ID).getSheetByName(RESPONSE_SHEET);

  const koma = data.koma === 'その他' ? data.komaOther : data.koma;

  sh.appendRow([
    new Date(),
    teacher.code + ' ' + teacher.name,
    data.workDate,
    data.lessons,
    koma,
    data.memo || '',
    data.place,
    teacher.code
  ]);

  return { ok: true, name: teacher.name };
}

function saveQrDataApi_(code, qrData) {
  code = String(code || '').trim();
  qrData = String(qrData || '').trim();

  if (!code) throw new Error('講師コードが空です。');
  if (!qrData) throw new Error('QRデータが空です。');

  const sh = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName(MASTER_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const masterCode = String(values[i][0] || '').trim();
    if (masterCode === code) {
      sh.getRange(i + 1, 17).setValue(qrData); // Q列
      return {
        ok: true,
        code,
        name: String(values[i][1] || '').trim(),
        qrData
      };
    }
  }

  return {
    ok: false,
    message: '講師コードが講師マスターに見つかりません。'
  };
}
