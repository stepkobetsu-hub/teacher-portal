const RESPONSE_SS_ID = '1VPTdCQ2_Mws19r0xEPmic4qM65NK-BhLqmgtc-EUFVg';
const RESPONSE_SHEET = 'フォームの回答 1';

const MASTER_SS_ID = '1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E';
const MASTER_SHEET = '講師マスター';

function doGet(e) {
  const p = e.parameter || {};
  const callback = sanitizeCallback_(p.callback || 'callback');

  let result;
  try {
    if (p.action === 'getTeacher') {
      result = getTeacherForApi_(p.code);
    } else if (p.action === 'submitAttendance') {
      result = submitAttendanceForApi_(p);
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

function sanitizeCallback_(callback) {
  callback = String(callback || 'callback');
  if (/^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) return callback;
  return 'callback';
}

function getTeacherForApi_(code) {
  code = String(code || '').trim();
  if (!code) return { ok: false, message: '講師コードを入力してください。' };

  const sh = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName(MASTER_SHEET);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const masterCode = String(values[i][0]).trim();
    const name = String(values[i][1]).trim();
    const email = String(values[i][15]).trim();

    if (masterCode === code) {
      return {
        ok: true,
        teacher: { code: masterCode, name, email }
      };
    }
  }

  return {
    ok: false,
    message: '講師コードが見つかりません。名前がない場合は、すぐに申し出てください。'
  };
}

function submitAttendanceForApi_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const teacherRes = getTeacherForApi_(p.code);
    if (!teacherRes.ok) return teacherRes;

    const teacher = teacherRes.teacher;
    const sh = SpreadsheetApp.openById(RESPONSE_SS_ID).getSheetByName(RESPONSE_SHEET);

    const koma = p.koma === 'その他' ? p.komaOther : p.koma;

    sh.appendRow([
      new Date(),
      teacher.code + ' ' + teacher.name,
      p.workDate || '',
      p.lessons || '',
      koma || '',
      p.memo || '',
      p.place || '',
      teacher.code
    ]);

    return { ok: true, name: teacher.name };
  } finally {
    lock.releaseLock();
  }
}
