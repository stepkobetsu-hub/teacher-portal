let templates = [];
let students = [];
let histories = [];
let selectedFiles = [];
const selectedStudents = new Map();

const DEFAULT_TEMPLATES = [
  {
    id: 'mada',
    name: 'まだお見えになっておりません',
    subject: 'まだお見えになっておりません',
    body: `{{生徒名}}さん\n\nお世話になります。\n★本日は　{{時間帯}}で授業です。★\nまだお見えになっておりません。\n\nご確認のほどよろしくお願いいたします。\n※ご連絡いただいてる方、行き違いなどご容赦ください。\n\nまた、ご欠席・遅刻される場合は、こちらよりご連絡いただけますと助かります。\nhttps://x.gd/WfTJM\n\n※ 本メールは送信専用です。ご返信いただいてもお答えできませんのでご了承ください。\n\n個別指導ステップ`
  },
  {
    id: 'tokkun',
    name: '特訓部屋のお知らせ',
    subject: '特訓部屋のお知らせ',
    body: `{{生徒名}}さん\n\n★{{日付}}（{{曜日}}）{{時間帯}}　★\nいつもお世話になっております。\n本日の確認テストの結果が不合格でした（2問以上間違えると不合格になります）。\n確認テストは前回指導内容の理解度の目安です。\nこのため別日程（上記日時）で特訓部屋に参加して、勉強内容の確認をさせていただきます。\n\n※ご都合が悪い場合、お手数ですが早めに教室まで「お電話」または「公式LINE」にてご連絡をいただけると幸いです。\n個別指導ステップ {{電話番号}}\n\n※ 本メールは送信専用です。ご返信いただいてもお答えできませんのでご了承ください。`
  },
  { id: 'free', name: '自由記述', subject: '', body: '' }
];

const $ = id => document.getElementById(id);

function init() {
  setToday();
  updateDateDisplay();
  bindEvents();
  setTemplates(DEFAULT_TEMPLATES);
  loadTemplates();
  loadStudents();
  loadHistory();
  updatePreview();
}

function bindEvents() {
  $('templateSelect').addEventListener('change', () => { applyTemplate(); updatePreview(); });
  $('reloadTemplateButton').addEventListener('click', loadTemplates);
  $('newTemplateButton').addEventListener('click', newTemplate);
  $('saveTemplateButton').addEventListener('click', saveCurrentTemplate);

  $('dateInput').addEventListener('change', () => { updateDateDisplay(); updatePreview(); });
  $('timeSelect').addEventListener('change', () => { toggleCustomTime(); updatePreview(); });
  $('customTimeInput').addEventListener('input', updatePreview);
  $('subjectInput').addEventListener('input', updatePreview);
  $('bodyInput').addEventListener('input', updatePreview);
  $('linkInput').addEventListener('input', updatePreview);

  ['schoolFilter', 'gradeFilter'].forEach(id => $(id).addEventListener('change', renderStudents));
  $('nameSearch').addEventListener('input', renderStudents);
  $('reloadButton').addEventListener('click', loadStudents);
  $('selectVisibleButton').addEventListener('click', selectVisibleStudents);
  $('clearSelectedButton').addEventListener('click', () => { selectedStudents.clear(); renderStudents(); updatePreview(); });
  $('sendButton').addEventListener('click', sendMail);

  $('fileInput').addEventListener('change', e => addFiles(Array.from(e.target.files || [])));
  const dz = $('dropZone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files || []));
  });

  $('historyReloadButton').addEventListener('click', loadHistory);
  $('historySearch').addEventListener('input', renderHistory);
  $('historyFromDate').addEventListener('change', renderHistory);
  $('historyToDate').addEventListener('change', renderHistory);
  $('historyClearButton').addEventListener('click', () => {
    $('historySearch').value = '';
    $('historyFromDate').value = '';
    $('historyToDate').value = '';
    renderHistory();
  });
}

function setToday() {
  const today = new Date();
  $('dateInput').value = toYmd(today);
}

function toYmd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getFullDateDisplay() {
  if (!$('dateInput').value) return '日付未選択';
  const d = new Date($('dateInput').value + 'T00:00:00');
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${yyyy}/${mm}/${dd}（${w}）`;
}

function updateDateDisplay() {
  $('dateDisplay').textContent = getFullDateDisplay();
}

async function loadTemplates() {
  try {
    const result = await getTemplatesRequest();
    if (Array.isArray(result) && result.length > 0) {
      setTemplates(result);
      applyTemplate();
      updatePreview();
    }
  } catch (e) {
    console.warn(e);
  }
}

function setTemplates(list) {
  templates = list.map(t => ({ id: String(t.id), name: String(t.name || t.id), subject: String(t.subject || ''), body: String(t.body || '') }));
  $('templateSelect').innerHTML = templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  applyTemplate();
}

function getCurrentTemplate() {
  return templates.find(t => t.id === $('templateSelect').value) || templates[0] || DEFAULT_TEMPLATES[0];
}

function applyTemplate() {
  const t = getCurrentTemplate();
  if (!t) return;
  $('subjectInput').value = t.subject || '';
  $('bodyInput').value = t.body || '';
}

function newTemplate() {
  $('templateSelect').value = 'free';
  $('subjectInput').value = '';
  $('bodyInput').value = '';
  updatePreview();
  showStatus('件名・本文を入力して「テンプレート保存」を押してください。', '');
}

async function saveCurrentTemplate() {
  const current = getCurrentTemplate();
  const defaultName = current && current.id !== 'free' ? current.name : '';
  const name = prompt('テンプレート名を入力してください。', defaultName || $('subjectInput').value || '新しいテンプレート');
  if (!name) return;
  const idBase = (current && current.id !== 'free') ? current.id : 'tpl_' + Date.now();
  try {
    const result = await saveTemplateRequest({
      id: idBase,
      name,
      subject: $('subjectInput').value,
      body: $('bodyInput').value
    });
    if (result && result.error) throw new Error(result.message || 'テンプレート保存に失敗しました。');
    showStatus('テンプレートを保存しました。', 'ok');
    await loadTemplates();
    $('templateSelect').value = result.id || idBase;
  } catch (e) {
    showStatus(e.message, 'error');
  }
}

function toggleCustomTime() {
  $('customTimeArea').classList.toggle('hidden', $('timeSelect').value !== 'その他');
}

async function loadStudents() {
  $('studentCountText').textContent = '読み込み中...';
  $('studentList').innerHTML = '';
  try {
    students = await getStudentsRequest();
    if (!Array.isArray(students)) throw new Error(students.message || '生徒一覧を取得できませんでした。');
    students.forEach(s => { if (selectedStudents.has(s.id)) selectedStudents.set(s.id, s); });
    renderStudents();
  } catch (e) {
    $('studentCountText').textContent = '取得失敗';
    $('studentList').innerHTML = `<div class="status error">${escapeHtml(e.message)}</div>`;
  }
}

function getFilteredStudents() {
  const school = $('schoolFilter').value;
  const grade = $('gradeFilter').value;
  const kw = normalizeText($('nameSearch').value);
  return students.filter(s => {
    if (school !== '全校舎' && s.school !== school) return false;
    if (grade !== '全学年' && normalizeGrade(s.grade) !== normalizeGrade(grade)) return false;
    const hay = normalizeText(`${s.name} ${s.grade} ${s.school}`);
    if (kw && !hay.includes(kw)) return false;
    return true;
  }).sort(compareStudent);
}

function renderStudents() {
  const list = getFilteredStudents();
  $('studentCountText').textContent = `${list.length}人表示 / ${students.length}人取得`;
  updateSelectedDisplay();
  if (list.length === 0) {
    $('studentList').innerHTML = '<div class="empty">該当する生徒がいません。</div>';
    return;
  }
  $('studentList').innerHTML = list.map(s => {
    const checked = selectedStudents.has(s.id) ? 'checked' : '';
    return `
      <label class="student-row ${checked ? 'checked' : ''}">
        <input type="checkbox" data-id="${escapeHtml(s.id)}" ${checked} />
        <span class="student-name">${escapeHtml(s.name)}</span>
        <span class="student-meta">${escapeHtml(s.school)} / ${escapeHtml(s.grade)}</span>
      </label>
    `;
  }).join('');
  document.querySelectorAll('#studentList input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const s = students.find(x => x.id === e.target.dataset.id);
      if (!s) return;
      if (e.target.checked) selectedStudents.set(s.id, s);
      else selectedStudents.delete(s.id);
      renderStudents();
      updatePreview();
    });
  });
}

function updateSelectedDisplay() {
  const selected = Array.from(selectedStudents.values()).sort(compareStudent);
  $('selectedCountText').textContent = `選択 ${selected.length}人`;
  $('selectedPanelCount').textContent = `${selected.length}人`;
  if (selected.length === 0) {
    $('selectedStudentList').textContent = 'まだ選択されていません。';
    return;
  }
  const summary = selected.map(s => `${s.grade} ${s.name}さん`).join('、');
  $('selectedStudentList').innerHTML = `
    <div class="selected-summary">${escapeHtml(summary)}</div>
    <div class="selected-table">
      ${selected.map(s => `
        <div class="selected-row">
          <span class="grade-pill">${escapeHtml(s.grade)}</span>
          <strong>${escapeHtml(s.name)}さん</strong>
          <span>${escapeHtml(s.school)}</span>
          <button class="remove-selected" data-id="${escapeHtml(s.id)}" type="button">解除</button>
        </div>
      `).join('')}
    </div>
  `;
  document.querySelectorAll('.remove-selected').forEach(btn => {
    btn.addEventListener('click', e => {
      selectedStudents.delete(e.currentTarget.dataset.id);
      renderStudents();
      updatePreview();
    });
  });
}

function compareStudent(a, b) {
  return gradeSortValue(a.grade) - gradeSortValue(b.grade) || String(a.school).localeCompare(String(b.school), 'ja') || String(a.name).localeCompare(String(b.name), 'ja');
}

function gradeSortValue(grade) {
  const g = normalizeGrade(grade);
  const m = g.match(/^([小中高])([1-6])$/);
  if (!m) return 999;
  return ({ 小: 0, 中: 10, 高: 20 }[m[1]] || 99) + Number(m[2]);
}

function selectVisibleStudents() {
  getFilteredStudents().forEach(s => selectedStudents.set(s.id, s));
  renderStudents();
  updatePreview();
}

function getDateText() {
  if (!$('dateInput').value) return '';
  const d = new Date($('dateInput').value + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function getWeekday() {
  if (!$('dateInput').value) return '';
  const d = new Date($('dateInput').value + 'T00:00:00');
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}
function getTimeText() {
  return $('timeSelect').value === 'その他' ? $('customTimeInput').value : $('timeSelect').value;
}
function buildBody() {
  const links = $('linkInput').value.trim();
  let body = $('bodyInput').value;
  if (links) body += `\n\n【リンク】\n${links}`;
  return body;
}
function buildPreviewBody() {
  return buildBody()
    .replaceAll('{{日付}}', getDateText())
    .replaceAll('{{曜日}}', getWeekday())
    .replaceAll('{{時間帯}}', getTimeText())
    .replaceAll('{{電話番号}}', '0568-41-8937')
    .replaceAll('{{生徒名}}', getPreviewStudentName());
}
function getPreviewStudentName() {
  const selected = Array.from(selectedStudents.values())[0];
  return selected ? selected.name : '山田太郎';
}
function updatePreview() {
  $('preview').textContent = buildPreviewBody();
}

function addFiles(files) {
  files.forEach(file => {
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
      selectedFiles.push(file);
    }
  });
  $('fileInput').value = '';
  renderAttachmentList();
}

function renderAttachmentList() {
  if (selectedFiles.length === 0) {
    $('attachmentList').textContent = '添付ファイルはありません。';
    return;
  }
  $('attachmentList').innerHTML = selectedFiles.map((f, i) => `
    <div class="attachment-row">
      <span>📎 ${escapeHtml(f.name)}（${formatFileSize(f.size)}）</span>
      <button type="button" data-index="${i}" class="remove-file">削除</button>
    </div>
  `).join('');
  document.querySelectorAll('.remove-file').forEach(btn => {
    btn.addEventListener('click', e => {
      selectedFiles.splice(Number(e.currentTarget.dataset.index), 1);
      renderAttachmentList();
    });
  });
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.ceil(size / 1024)}KB`;
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', data: base64, size: file.size });
    };
    reader.onerror = () => reject(new Error(`${file.name}を読み込めませんでした。`));
    reader.readAsDataURL(file);
  });
}

async function sendMail() {
  const selected = Array.from(selectedStudents.values()).sort(compareStudent);
  const ids = selected.map(s => s.id);
  if (ids.length === 0) return showStatus('送信対象の生徒を選択してください。', 'error');
  if (!$('subjectInput').value.trim()) return showStatus('件名を入力してください。', 'error');
  if (!buildBody().trim()) return showStatus('本文を入力してください。', 'error');

  const selectedNames = selected.map(s => `${s.grade} ${s.name}さん`).join('\n');
  const templateId = $('templateSelect').value;
  let confirmNotice = '';
  if (templateId === 'tokkun') confirmNotice = `案内日時：${getDateText()}（${getWeekday()}）${getTimeText()}`;
  else if (templateId === 'mada') confirmNotice = `未着連絡：今から「まだお見えになっておりません」を送信します。`;
  else confirmNotice = `通常連絡を送信します。`;
  const fileNotice = selectedFiles.length ? `\n添付：${selectedFiles.map(f => f.name).join('、')}` : '';
  const ok = confirm(`以下の生徒に送信します。\n\n${selectedNames}\n\n件名：${$('subjectInput').value}\n${confirmNotice}${fileNotice}\n\n送信してよろしいですか？`);
  if (!ok) return;

  $('sendButton').disabled = true;
  showStatus('送信中です...', '');
  try {
    const attachments = await Promise.all(selectedFiles.map(fileToAttachment));
    const result = await sendSelectedMail({
      templateId,
      studentIds: ids,
      subject: $('subjectInput').value,
      body: buildBody(),
      dateText: getDateText(),
      weekday: getWeekday(),
      timeText: getTimeText(),
      selectedLabels: selected.map(s => `${s.grade} ${s.name}さん`),
      attachments
    });
    if (result && result.error) throw new Error(result.message || '送信に失敗しました。');
    showStatus(`${result.sentCount}件送信しました。`, 'ok');
    selectedStudents.clear();
    selectedFiles = [];
    renderAttachmentList();
    renderStudents();
    updatePreview();
    await loadHistory();
  } catch (e) {
    showStatus(e.message, 'error');
  } finally {
    $('sendButton').disabled = false;
  }
}

async function loadHistory() {
  $('historyList').textContent = '読み込み中...';
  try {
    histories = await getHistoryRequest();
    if (!Array.isArray(histories)) throw new Error(histories.message || '履歴を取得できませんでした。');
    renderHistory();
  } catch (e) {
    $('historyList').innerHTML = `<div class="status error">${escapeHtml(e.message)}</div>`;
  }
}

function renderHistory() {
  const keyword = normalizeText($('historySearch').value);
  const from = $('historyFromDate').value;
  const to = $('historyToDate').value;
  const list = histories.filter(h => {
    const hay = normalizeText(`${h.target} ${h.subject} ${h.noticeDateText} ${h.noticeTimeText} ${h.dateDisplay || h.date}`);
    if (keyword && !hay.includes(keyword)) return false;
    if (from && (!h.sendDateYmd || h.sendDateYmd < from)) return false;
    if (to && (!h.sendDateYmd || h.sendDateYmd > to)) return false;
    return true;
  });
  if (list.length === 0) {
    $('historyList').textContent = '履歴がありません。';
    return;
  }
  $('historyList').innerHTML = list.map(buildHistoryCard).join('');
}

function buildHistoryCard(h) {
  const kind = getHistoryKind(h);
  const target = h.target || '送信先不明';
  const count = h.count || 0;
  const sendDate = h.dateDisplay || h.date || '';
  let line = '';
  if (kind === '特訓部屋') line = `特訓部屋のお知らせ${formatNoticeForHistory(h) ? '　' + formatNoticeForHistory(h) : ''}`;
  else if (kind === '未着連絡') line = 'まだお見えになっておりません。';
  else line = h.subject || '通常連絡';
  const body = h.bodyPreview || h.body || '';
  const attach = h.attachmentNames ? `\n\n【添付】\n${h.attachmentNames}` : '';
  return `
    <div class="history-item simple">
      <div class="history-line">送信日：${escapeHtml(sendDate)}</div>
      <div class="history-main-title">${escapeHtml(line)}</div>
      <div class="history-line history-target-line">送信先：${escapeHtml(target)} / ${escapeHtml(String(count))}件</div>
      <details class="history-details">
        <summary>本文・詳細を表示</summary>
        <pre>${escapeHtml(body + attach)}</pre>
      </details>
    </div>
  `;
}

function formatNoticeForHistory(h) {
  const date = h.noticeDateText || '';
  const weekday = h.weekday || '';
  const time = h.noticeTimeText || '';
  const datePart = date ? `${date}${weekday ? '（' + weekday + '）' : ''}` : '';
  return `${datePart}${time ? ' ' + time : ''}`.trim();
}
function getHistoryKind(h) {
  if (h.templateId === 'tokkun' || String(h.subject || '').includes('特訓部屋')) return '特訓部屋';
  if (h.templateId === 'mada' || String(h.subject || '').includes('まだ')) return '未着連絡';
  return '通常連絡';
}
function showStatus(message, type) {
  $('statusMessage').textContent = message;
  $('statusMessage').className = `status ${type || ''}`;
}
function normalizeGrade(v) {
  return String(v || '').replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s/g, '');
}
function normalizeText(v) {
  return String(v || '').toLowerCase().replace(/[ァ-ン]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60)).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s/g, '');
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

document.addEventListener('DOMContentLoaded', init);
