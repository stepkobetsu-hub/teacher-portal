// ==================================================
// STEP配信システム Code.gs Ver.10
// 個別送信・実物添付・テンプレート管理・履歴詳細
// ==================================================

const SHEET_SETTING = '設定';
const SHEET_TEMPLATE = 'テンプレート';
const SHEET_HISTORY = '配信履歴';
const SHEET_RESERVATION = '予約送信';
const MASTER_SHEET_NAME = '☆マスタ';

const HISTORY_HEADERS = [
  '送信日時',
  'テンプレートID',
  '件名',
  '本文',
  '対象',
  '送信件数',
  '結果',
  '案内日付',
  '案内曜日',
  '案内時間帯',
  '送信先ID',
  '送信先表示',
  '本文プレビュー',
  '添付ファイル名'
];

function setupStepMailSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSettingSheet_(ss);
  createTemplateSheet_(ss);
  createHistorySheet_(ss);
  createReservationSheet_(ss);
  SpreadsheetApp.getUi().alert('STEP配信システム Ver.10 の初期設定が完了しました。');
}

function createSettingSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_SETTING);
  if (!sheet) sheet = ss.insertSheet(SHEET_SETTING);

  const current = sheet.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < current.length; i++) existing[current[i][0]] = current[i][1];

  sheet.clear();
  sheet.appendRow(['設定名', '値']);
  sheet.appendRow(['生徒マスタID', existing['生徒マスタID'] || '1CIJkTlYUcUkbb8jBdFc6L8D5ubTGsxwNxFv01ten-Zk']);
  sheet.appendRow(['神領校電話', existing['神領校電話'] || '0568-41-8937']);
  sheet.appendRow(['大手町校電話', existing['大手町校電話'] || '0568-27-9581']);
  sheet.appendRow(['送信者名', existing['送信者名'] || '個別指導STEP']);
  sheet.setFrozenRows(1);
}

function createTemplateSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) sheet = ss.insertSheet(SHEET_TEMPLATE);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['テンプレートID', 'テンプレート名', '件名', '本文', '使用']);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    sheet.appendRow([
      'mada',
      'まだお見えになっておりません',
      'まだお見えになっておりません',
`{{生徒名}}さん

お世話になります。
★本日は　{{時間帯}}で授業です。★
まだお見えになっておりません。

ご確認のほどよろしくお願いいたします。
※ご連絡いただいてる方、行き違いなどご容赦ください。

また、ご欠席・遅刻される場合は、こちらよりご連絡いただけますと助かります。
https://x.gd/WfTJM

※ 本メールは送信専用です。ご返信いただいてもお答えできませんのでご了承ください。

個別指導ステップ`,
      true
    ]);

    sheet.appendRow([
      'tokkun',
      '特訓部屋のお知らせ',
      '特訓部屋のお知らせ',
`{{生徒名}}さん

★{{日付}}（{{曜日}}）{{時間帯}}　★
いつもお世話になっております。
本日の確認テストの結果が不合格でした（2問以上間違えると不合格になります）。
確認テストは前回指導内容の理解度の目安です。
このため別日程（上記日時）で特訓部屋に参加して、勉強内容の確認をさせていただきます。

※ご都合が悪い場合、お手数ですが早めに教室まで「お電話」または「公式LINE」にてご連絡をいただけると幸いです。
個別指導ステップ {{電話番号}}

※ 本メールは送信専用です。ご返信いただいてもお答えできませんのでご了承ください。`,
      true
    ]);

    sheet.appendRow(['free', '自由記述', '', '', true]);
  }
  sheet.setFrozenRows(1);
}

function createHistorySheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_HISTORY);
  if (!sheet) sheet = ss.insertSheet(SHEET_HISTORY);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HISTORY_HEADERS);
  } else {
    const lastCol = Math.max(sheet.getLastColumn(), HISTORY_HEADERS.length);
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (header[0] !== '送信日時') {
      sheet.clear();
      sheet.appendRow(HISTORY_HEADERS);
    } else {
      for (let i = 0; i < HISTORY_HEADERS.length; i++) {
        if (!header[i]) sheet.getRange(1, i + 1).setValue(HISTORY_HEADERS[i]);
      }
    }
  }
  sheet.setFrozenRows(1);
}

function createReservationSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_RESERVATION);
  if (!sheet) sheet = ss.insertSheet(SHEET_RESERVATION);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['予約日時', 'テンプレートID', '件名', '本文', '対象', '送信状態', '送信日時']);
  }
  sheet.setFrozenRows(1);
}

function getSettings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SETTING);
  if (!sheet) throw new Error('設定シートがありません。setupStepMailSystemを実行してください。');
  const values = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < values.length; i++) settings[values[i][0]] = values[i][1];
  return settings;
}

function getTemplateList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createTemplateSheet_(ss);
  const sheet = ss.getSheetByName(SHEET_TEMPLATE);
  const values = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const use = values[i][4];
    if (use === false || String(use).toUpperCase() === 'FALSE') continue;
    if (!values[i][0]) continue;
    list.push({
      id: String(values[i][0]),
      name: String(values[i][1] || values[i][0]),
      subject: String(values[i][2] || ''),
      body: String(values[i][3] || '')
    });
  }
  return list;
}

function saveTemplate(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createTemplateSheet_(ss);
  const sheet = ss.getSheetByName(SHEET_TEMPLATE);
  const id = String(data.id || ('tpl_' + new Date().getTime()));
  const name = String(data.name || '新しいテンプレート');
  const subject = String(data.subject || '');
  const body = String(data.body || '');

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[name, subject, body, true]]);
      return { ok: true, id: id };
    }
  }
  sheet.appendRow([id, name, subject, body, true]);
  return { ok: true, id: id };
}

function getStudentList() {
  const settings = getSettings_();
  const masterId = settings['生徒マスタID'];
  if (!masterId) throw new Error('設定シートの「生徒マスタID」が未入力です。');

  const masterSS = SpreadsheetApp.openById(masterId);
  const masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
  if (!masterSheet) throw new Error('生徒マスタに「☆マスタ」シートがありません。');

  const values = masterSheet.getDataRange().getValues();
  const header = values[0];
  const col = {
    active: 1,
    id: header.indexOf('生徒番号'),
    name: header.indexOf('生徒氏名'),
    school: header.indexOf('校舎'),
    grade: header.indexOf('学年'),
    mail1: header.indexOf('メールアドレス（保護者）'),
    mail2: header.indexOf('メールアドレス２')
  };

  const students = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const activeFlag = row[col.active];
    if (activeFlag !== 1 && activeFlag !== 0 && activeFlag !== '1' && activeFlag !== '0') continue;

    const id = row[col.id];
    const name = row[col.name];
    const schoolRaw = row[col.school];
    const gradeRaw = row[col.grade];
    const mail1 = row[col.mail1];
    const mail2 = row[col.mail2];
    if (!id || !name) continue;
    if (!mail1 && !mail2) continue;

    let school = schoolRaw;
    if (schoolRaw === '神領') school = '神領校';
    if (schoolRaw === '大手') school = '大手町校';

    students.push({
      id: String(id),
      name: String(name),
      school: String(school || ''),
      grade: normalizeGrade_(gradeRaw),
      hasMail: true
    });
  }
  return students;
}

function sendStepMailToSelected(data) {
  const settings = getSettings_();
  const masterId = settings['生徒マスタID'];
  if (!data.studentIds || data.studentIds.length === 0) throw new Error('送信対象の生徒が選択されていません。');

  const attachments = buildAttachments_(data.attachments || []);
  const attachmentNames = attachments.map(b => b.getName()).join('、');

  const masterSS = SpreadsheetApp.openById(masterId);
  const masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
  const values = masterSheet.getDataRange().getValues();
  const header = values[0];
  const col = {
    id: header.indexOf('生徒番号'),
    name: header.indexOf('生徒氏名'),
    school: header.indexOf('校舎'),
    grade: header.indexOf('学年'),
    mail1: header.indexOf('メールアドレス（保護者）'),
    mail2: header.indexOf('メールアドレス２')
  };

  const targetIds = data.studentIds.map(String);
  let sentCount = 0;
  const errors = [];
  const sentNames = [];
  const sentLabels = [];
  const sentIds = [];
  let firstRenderedBody = '';

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const studentId = String(row[col.id]);
    if (!targetIds.includes(studentId)) continue;

    const studentName = row[col.name];
    const school = row[col.school];
    const grade = normalizeGrade_(row[col.grade]);
    const mail1 = row[col.mail1];
    const mail2 = row[col.mail2];

    const recipients = [];
    if (mail1) recipients.push(mail1);
    if (mail2) recipients.push(mail2);
    if (recipients.length === 0) {
      errors.push(studentName + '：メールアドレスなし');
      continue;
    }

    const phone = getSchoolPhone_(school, settings);
    const body = String(data.body || '')
      .replaceAll('{{生徒名}}', studentName)
      .replaceAll('{{日付}}', data.dateText || '')
      .replaceAll('{{曜日}}', data.weekday || '')
      .replaceAll('{{時間帯}}', data.timeText || '')
      .replaceAll('{{電話番号}}', phone);

    try {
      MailApp.sendEmail({
        to: recipients.join(','),
        subject: data.subject || '',
        body: body,
        name: settings['送信者名'] || '個別指導STEP',
        attachments: attachments
      });
      sentCount++;
      sentNames.push(studentName);
      sentLabels.push(grade ? `${grade} ${studentName}さん` : `${studentName}さん`);
      sentIds.push(studentId);
      if (!firstRenderedBody) firstRenderedBody = body;
    } catch (e) {
      errors.push(studentName + '：' + e.message);
    }
  }

  saveHistory_({
    templateId: data.templateId || '',
    subject: data.subject || '',
    body: data.body || '',
    bodyPreview: firstRenderedBody || data.body || '',
    target: sentLabels.join('、') || sentNames.join('、'),
    sentCount: sentCount,
    errors: errors,
    noticeDateText: data.dateText || '',
    weekday: data.weekday || '',
    noticeTimeText: data.timeText || '',
    studentIds: sentIds.join(','),
    studentLabels: sentLabels.join('、') || sentNames.join('、'),
    attachmentNames: attachmentNames
  });

  return { ok: true, sentCount: sentCount, sentNames: sentNames, sentLabels: sentLabels, errors: errors };
}

function buildAttachments_(items) {
  const blobs = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.data || !item.name) continue;
    const bytes = Utilities.base64Decode(item.data);
    const mimeType = item.mimeType || 'application/octet-stream';
    blobs.push(Utilities.newBlob(bytes, mimeType, item.name));
  }
  return blobs;
}

function getHistoryList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_HISTORY);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const lastRow = sheet.getLastRow();
  const startRow = Math.max(2, lastRow - 499);
  const numRows = lastRow - startRow + 1;
  const lastCol = Math.max(sheet.getLastColumn(), HISTORY_HEADERS.length);
  const values = sheet.getRange(startRow, 1, numRows, lastCol).getValues().reverse();

  return values.map(row => {
    const sentDate = row[0] ? new Date(row[0]) : null;
    const sentDateText = sentDate ? formatDateTimeForDisplay_(sentDate) : '';
    const sentDateYmd = sentDate ? Utilities.formatDate(sentDate, 'Asia/Tokyo', 'yyyy-MM-dd') : '';
    return {
      date: sentDateText,
      sendDateYmd: sentDateYmd,
      templateId: String(row[1] || ''),
      subject: String(row[2] || ''),
      body: String(row[3] || ''),
      target: String(row[11] || row[4] || ''),
      count: row[5] || 0,
      result: String(row[6] || ''),
      noticeDateText: formatNoticeDateValue_(row[7]),
      weekday: String(row[8] || ''),
      noticeTimeText: String(row[9] || ''),
      studentIds: String(row[10] || ''),
      bodyPreview: String(row[12] || row[3] || ''),
      attachmentNames: String(row[13] || '')
    };
  });
}

function formatDateTimeForDisplay_(date) {
  const ymd = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
  const hm = Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
  const w = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return ymd + '（' + w + '） ' + hm;
}

function formatNoticeDateValue_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    const m = Number(Utilities.formatDate(value, 'Asia/Tokyo', 'M'));
    const d = Number(Utilities.formatDate(value, 'Asia/Tokyo', 'd'));
    return m + '月' + d + '日';
  }
  const text = String(value);
  const dateMatch = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (dateMatch) return Number(dateMatch[2]) + '月' + Number(dateMatch[3]) + '日';
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime()) && /GMT|\d{4}/.test(text)) return (parsed.getMonth() + 1) + '月' + parsed.getDate() + '日';
  return text;
}

function getSchoolPhone_(school, settings) {
  if (school === '神領' || school === '神領校') return settings['神領校電話'];
  if (school === '大手' || school === '大手町校') return settings['大手町校電話'];
  return '';
}

function normalizeGrade_(grade) {
  if (!grade) return '';
  return String(grade).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replaceAll('　', '').replaceAll(' ', '').trim();
}

function saveHistory_(h) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createHistorySheet_(ss);
  const sheet = ss.getSheetByName(SHEET_HISTORY);
  sheet.appendRow([
    new Date(),
    h.templateId,
    h.subject,
    h.body,
    h.target,
    h.sentCount,
    h.errors.length ? h.errors.join('\n') : 'OK',
    h.noticeDateText,
    h.weekday,
    h.noticeTimeText,
    h.studentIds,
    h.studentLabels,
    h.bodyPreview,
    h.attachmentNames
  ]);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    const callback = e.parameter.callback || 'callback';
    let result;
    try {
      if (e.parameter.action === 'getStudents') result = getStudentList();
      else if (e.parameter.action === 'getHistory') result = getHistoryList();
      else if (e.parameter.action === 'getTemplates') result = getTemplateList();
      else result = { error: true, message: '不明なactionです。' };
    } catch (err) {
      result = { error: true, message: err.message };
    }
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput('STEP配信システム Apps Script Ver.10 is running.').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'sendSelected') result = sendStepMailToSelected(data);
    else if (data.action === 'saveTemplate') result = saveTemplate(data);
    else result = { error: true, message: '不明なactionです。' };
  } catch (err) {
    result = { error: true, message: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
