/**
 * Add to the deployed attendance project. See attendance-rollout.md.
 * Reads the original response sheet, and writes only through the original report writer.
 */
function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    result = attendanceRequest_(data);
  } catch (_) {
    result = { status: 'unavailable' };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function attendanceRequest_(data) {
  if (data.action === 'attendanceHealth') return { status: 'ready', version: 1 };
  if (data.action === 'attendanceLogin') return attendanceLogin_(data);
  if (!['attendanceHistory', 'attendanceSubmit', 'attendanceVerify'].includes(data.action)) {
    return { status: 'invalid' };
  }

  const code = attendanceIdentity_(data.token);
  if (!code) return { status: 'unauthorized' };
  if (data.action === 'attendanceHistory') return attendanceHistory_(code);

  const report = attendanceReport_(data);
  if (!report) return { status: 'invalid' };
  if (data.action === 'attendanceVerify') return attendanceReadback_(code, report);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const prior = attendanceReadback_(code, report);
    if (prior.status === 'saved') return prior;
    submitAttendanceApi_(Object.assign({}, report, { code }));
    SpreadsheetApp.flush();
    return attendanceReadback_(code, report);
  } finally {
    lock.releaseLock();
  }
}

function attendanceMaster_(code) {
  const sheet = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName(MASTER_SHEET);
  const count = sheet.getLastRow() - 4;
  if (count < 1) return null;
  const rows = sheet.getRange(5, 1, count, 1).createTextFinder(code).matchEntireCell(true).findAll();
  if (rows.length !== 1) return null;
  const row = rows[0].getRow();
  let password = sheet.getRange(row, 36).getDisplayValue().trim();
  if (/^\d{1,3}$/.test(password)) password = password.padStart(4, '0');
  if (!password || password === code) return null;
  return { name: sheet.getRange(row, 2).getDisplayValue(), password };
}

function attendanceLogin_(data) {
  const code = String(data.code || '').trim();
  if (!/^7\d{3}$/.test(code) || typeof data.password !== 'string' ||
      !data.password || data.password.length > 128) return { status: 'unauthorized' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const props = PropertiesService.getScriptProperties();
    const rateKey = 'attendance.rate.' + code;
    const now = Date.now();
    const old = JSON.parse(props.getProperty(rateKey) || 'null');
    const rate = old && old.expires > now ? old : { count: 0, expires: now + 3600000 };
    if (rate.count >= 6) return { status: 'rate_limited' };
    const account = attendanceMaster_(code);
    if (!account || !attendanceEqual_(data.password, account.password)) {
      rate.count++;
      props.setProperty(rateKey, JSON.stringify(rate));
      return { status: 'unauthorized' };
    }
    props.deleteProperty(rateKey);
    let secret = props.getProperty('attendance.sessionSecret');
    if (!secret) {
      secret = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('attendance.sessionSecret', secret);
    }
    const claims = code + '.' + (now + 90 * 86400000) + '.' + Utilities.getUuid();
    return { status: 'ok', code, name: account.name,
      token: claims + '.' + attendanceSignature_(claims, account.password, secret) };
  } finally {
    lock.releaseLock();
  }
}

function attendanceEqual_(a, b) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}

function attendanceSignature_(claims, password, secret) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(claims + '\n' + password, secret, Utilities.Charset.UTF_8)
  ).replace(/=+$/, '');
}

function attendanceIdentity_(token) {
  const match = /^(7\d{3})\.(\d{13})\.[a-f0-9-]{36}\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
  if (!match || Number(match[2]) <= Date.now()) return null;
  const secret = PropertiesService.getScriptProperties().getProperty('attendance.sessionSecret');
  const account = secret && attendanceMaster_(match[1]);
  const claims = token.slice(0, token.lastIndexOf('.'));
  return account && attendanceEqual_(match[3], attendanceSignature_(claims, account.password, secret))
    ? match[1] : null;
}

function attendanceDate_(value, stamp) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
  const text = String(value || '').normalize('NFKC').trim().replace(/[年月]/g, '/').replace(/日$/, '');
  const full = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  const short = /^(\d{1,2})\/(\d{1,2})$/.exec(text);
  const stampDate = stamp instanceof Date
    ? Utilities.formatDate(stamp, 'Asia/Tokyo', 'yyyy-MM-dd')
    : String(stamp || '').trim();
  if (!full && !(short && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s|$)/.test(stampDate))) return '';
  let year = Number(full ? full[1] : stampDate.slice(0, 4));
  const month = Number(full ? full[2] : short[1]);
  const day = Number(full ? full[3] : short[2]);
  // A December report can be submitted after the New Year.
  if (!full && month === 12 && Number(stampDate.split(/[-/]/)[1]) === 1) year--;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10) : '';
}

const ATTENDANCE_LESSONS_ = ['13:00～14:15', '14:20～15:35', '15:45～17:00', '17:10～18:25', '18:35～19:50', '20:00～21:15'];

function attendanceSlots_(value) {
  const slots = String(value || '').normalize('NFKC').split('/').map(slot => {
    const match = /^\s*((?:[01]\d|2[0-3]):[0-5]\d)\s*(?:[～〜~–-]\s*((?:[01]\d|2[0-3]):[0-5]\d)?)?\s*$/.exec(slot);
    if (!match) return '';
    return match[2] ? match[1] + '～' + match[2]
      : ATTENDANCE_LESSONS_.find(lesson => lesson.startsWith(match[1] + '～')) || match[1];
  });
  return slots.every(Boolean) ? slots.sort().join('/') : '';
}

function attendanceReport_(data) {
  const workDate = attendanceDate_(data.workDate);
  const koma = String(data.koma === 'その他' ? data.komaOther : data.koma || '').trim();
  const lessons = String(data.lessons || '').trim();
  const place = String(data.place || '').trim();
  const memo = String(data.memo || '');
  if (!workDate || workDate !== data.workDate || !/^\d{1,2}(?:\.\d{1,2})?$/.test(koma) ||
      Number(koma) <= 0 || !['神領校', '大手町校', 'その他'].includes(place) || memo.length > 2000) return null;
  const selected = lessons.split('/').map(s => s.trim());
  if (new Set(selected).size !== selected.length || !selected.every(s => ATTENDANCE_LESSONS_.includes(s))) return null;
  return { workDate, koma, lessons, place, memo: /^[=+\-@]/.test(memo) ? "'" + memo : memo };
}

function attendanceKey_(report) {
  return JSON.stringify([report.workDate, report.place, String(Number(report.koma)), attendanceSlots_(report.lessons)]);
}

function attendanceSourceRows_(code) {
  const sheet = SpreadsheetApp.openById(RESPONSE_SS_ID).getSheetByName(RESPONSE_SHEET);
  const count = sheet.getLastRow() - 1;
  if (count < 1) return [];
  const rows = sheet.getRange(2, 1, count, 8).getValues();
  return rows.filter(row => String(row[7]).trim() === code).map(row => ({
    workDate: attendanceDate_(row[2], row[0]),
    place: String(row[6] || '').trim(),
    koma: String(row[4] || '').normalize('NFKC').trim(),
    lessons: String(row[3] || '')
  }));
}

function attendanceReadback_(code, report) {
  const key = attendanceKey_(report);
  const verified = attendanceSourceRows_(code).some(row => attendanceKey_(row) === key);
  return { status: verified ? 'saved' : 'unconfirmed' };
}

function attendanceHistory_(code) {
  const history = new Map();
  for (const row of attendanceSourceRows_(code)) {
    if (!row.workDate || !row.place || !row.koma) continue;
    history.set(attendanceKey_(row), { workDate: row.workDate, place: row.place, koma: row.koma, status: 'saved' });
  }
  return { status: 'ok', rows: Array.from(history.values()).sort((a, b) => b.workDate.localeCompare(a.workDate)) };
}

function attendanceLegacySubmit_(data) {
  // Keep the older embedded form working while serializing writes from both entry points.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const code = String(data.code || '').trim();
    const report = attendanceReport_(data);
    if (report && attendanceSourceRows_(code).some(row => attendanceKey_(row) === attendanceKey_(report))) {
      const teacher = getTeacherApi_(code);
      return teacher.ok ? { ok: true, name: teacher.teacher.name } : teacher;
    }
    const result = submitAttendanceApi_(report ? Object.assign({}, report, { code }) : data);
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}
