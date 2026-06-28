const API_URL = "https://script.google.com/macros/s/AKfycbwP-pEDbbHB-Ec2xO7BFiVYqwpveTnNVmPJkNV08MPD8iAHHq4S7zPyVxDwFEmaHI9-/exec";

let teacher = null;
let scanStream = null;
let scanTimer = null;

window.addEventListener('DOMContentLoaded', () => {
  const savedCode = localStorage.getItem('teacherCode');
  if (savedCode) {
    const codeEl = document.getElementById('code');
    const nyuEl = document.getElementById('nyuCode');
    if (codeEl) codeEl.value = savedCode;
    if (nyuEl) nyuEl.value = savedCode;
  }
  setToday();
  setHomeDate();
  setGreeting();
});

function setGreeting() {
  const el = document.getElementById('greetingText');
  if (!el) return;
  const hour = new Date().getHours();
  if (hour < 11) el.textContent = 'おはようございます！';
  else if (hour < 17) el.textContent = '今日も一緒にがんばりましょう！';
  else el.textContent = '今日もお疲れ様でした！';
}

function setHomeDate() {
  const el = document.getElementById('homeDate');
  if (!el) return;
  const d = new Date();
  const weeks = ['日','月','火','水','木','金','土'];
  el.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${weeks[d.getDay()]}）`;
}

function showPage(id) {
  stopQrScan();
  ['homePage','loginPage','formPage','completePage','nyutaikunLoginPage','nyutaikunQrPage','adminQrPage'].forEach(pageId => {
    document.getElementById(pageId).classList.toggle('hidden', pageId !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAttendance() {
  const savedCode = localStorage.getItem('teacherCode');
  showPage('loginPage');
  if (savedCode) document.getElementById('code').value = savedCode;
}

function showNyutaikun() {
  const savedCode = localStorage.getItem('teacherCode');
  if (savedCode) {
    showPage('nyutaikunLoginPage');
    const nyuEl = document.getElementById('nyuCode');
    if (nyuEl) nyuEl.value = savedCode;
    loadNyutaikunQr();
    return;
  }
  showPage('nyutaikunLoginPage');
}

function showAdminQr() { showPage('adminQrPage'); }
function backHome() { showPage('homePage'); }
function openSummerSchedule() { window.location.href = "https://script.google.com/macros/s/AKfycbys7A1hwDTvpJms24uUJQLiD-oN8trVFMBfUEaU-99RePefcemkkA754rxBW0cnnY6o/exec"; }

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    params.callback = callbackName;
    const query = Object.keys(params).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key] ?? '')).join('&');
    const script = document.createElement('script');
    script.src = API_URL + '?' + query;
    const timer = setTimeout(() => { cleanup(); reject(new Error('通信がタイムアウトしました。')); }, 20000);
    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[callbackName] = (response) => { cleanup(); resolve(response); };
    script.onerror = () => { cleanup(); reject(new Error('通信に失敗しました。')); };
    document.body.appendChild(script);
  });
}

function showToast(title, text, icon = '✅') {
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastText').textContent = text || '';
  document.getElementById('toast').classList.remove('hidden');
}
function hideToast() { document.getElementById('toast').classList.add('hidden'); }

async function login() {
  const code = document.getElementById('code').value.trim();
  if (!code) { showLoginMsg('講師コードを入力してください。'); return; }
  try {
    const res = await jsonp({ action: 'getTeacher', code });
    if (!res.ok) { showLoginMsg(res.message || '講師コードが見つかりません。名前がない場合は、すぐに申し出てください。'); return; }
    teacher = res.teacher;
    localStorage.setItem('teacherCode', code);
    localStorage.setItem('teacherName', teacher.name || '');
    document.getElementById('hello').textContent = teacher.name + 'さん、お疲れ様でした！';
    document.getElementById('headerName').textContent = teacher.name + 'さんとして入力中';
    resetForm(false);
    showPage('formPage');
  } catch (err) {
    showLoginMsg(err.message || 'エラーが発生しました。もう一度お試しください。');
  }
}

function showLoginMsg(msg) {
  const el = document.getElementById('loginMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setToday() {
  const today = new Date();
  const el = document.getElementById('workDate');
  if (el) el.value = today.toISOString().slice(0, 10);
  updateDateText();
}

function updateDateText() {
  const value = document.getElementById('workDate')?.value;
  if (!value) return;
  const date = new Date(value + 'T00:00:00');
  const weeks = ['日','月','火','水','木','金','土'];
  document.getElementById('dateText').textContent =
    date.getFullYear() + '年' + (date.getMonth()+1) + '月' + date.getDate() + '日（' + weeks[date.getDay()] + '）';
}

function toggleOther() {
  const koma = document.getElementById('koma').value;
  document.getElementById('otherBox').classList.toggle('hidden', koma !== 'その他');
}

async function submitForm() {
  if (!teacher) { alert('ログインし直してください。'); showPage('loginPage'); return; }
  const lessons = Array.from(document.querySelectorAll('.checks input:checked')).map(el => el.value);
  const data = {
    action: 'submitAttendance',
    code: teacher.code,
    workDate: document.getElementById('workDate').value,
    lessons: lessons.join(' / '),
    koma: document.getElementById('koma').value,
    komaOther: document.getElementById('komaOther').value,
    place: document.getElementById('place').value,
    memo: document.getElementById('memo').value
  };
  if (!data.workDate || lessons.length === 0 || !data.koma || !data.place) { alert('出勤日、担当授業、コマ数、勤務場所を入力してください。'); return; }
  if (data.koma === 'その他' && !data.komaOther) { alert('その他のコマ数を入力してください。'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '送信中...';
  document.getElementById('sending').classList.remove('hidden');

  try {
    const res = await jsonp(data);
    if (!res.ok) throw new Error(res.message || '送信できませんでした。');
    const name = res.name || teacher.name;
    document.getElementById('completeMessage').textContent = name + 'さん、お疲れ様でした。出勤確認を受け付けました。';
    document.getElementById('randomMessage').textContent = randomMessage();
    showPage('completePage');
  } catch (err) {
    alert(err.message || '送信できませんでした。もう一度お試しください。');
    btn.disabled = false;
    btn.textContent = '送信する';
    document.getElementById('sending').classList.add('hidden');
  }
}

function randomMessage() {
  const messages = ['今日もありがとうございました😊','授業お疲れ様でした！','また次回もよろしくお願いします！','今日も助かりました！','入退くんも忘れずにお願いします！'];
  return messages[Math.floor(Math.random() * messages.length)];
}

function resetForm(resetDate = true) {
  document.querySelectorAll('.checks input').forEach(el => el.checked = false);
  document.getElementById('koma').value = '';
  document.getElementById('komaOther').value = '';
  document.getElementById('memo').value = '';
  document.getElementById('otherBox').classList.add('hidden');
  document.getElementById('sending').classList.add('hidden');
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').textContent = '送信する';
  if (resetDate) setToday();
}
function backToForm() { resetForm(true); showPage('formPage'); }

async function loadNyutaikunQr() {
  const code = document.getElementById('nyuCode').value.trim();
  const msg = document.getElementById('nyuMsg');
  msg.classList.add('hidden');
  if (!code) { msg.textContent = '講師コードを入力してください。'; msg.classList.remove('hidden'); return; }

  try {
    const res = await jsonp({ action: 'getTeacher', code });
    if (!res.ok) throw new Error(res.message || '講師コードが見つかりません。');
    const t = res.teacher;
    localStorage.setItem('teacherCode', code);
    localStorage.setItem('teacherName', t.name || '');
    if (!t.qrData) throw new Error('この講師の入退くんQRデータが未登録です。管理者に確認してください。');
    const codeDisplay = document.getElementById('nyuCodeDisplay');
    const nameDisplay = document.getElementById('nyuNameDisplay');
    if (codeDisplay) codeDisplay.textContent = code;
    if (nameDisplay) nameDisplay.textContent = t.name || '';
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=' + encodeURIComponent(t.qrData);
    document.getElementById('qrDisplay').innerHTML = '<img alt="入退くんQR" src="' + qrUrl + '">';
    document.getElementById('qrRaw').textContent = t.qrData;
    showPage('nyutaikunQrPage');
  } catch (err) {
    msg.textContent = err.message || 'QRコードを表示できませんでした。';
    msg.classList.remove('hidden');
  }
}

function logoutNyutaikun() {
  localStorage.removeItem('teacherCode');
  localStorage.removeItem('teacherName');
  document.getElementById('nyuCode').value = '';
  document.getElementById('code').value = '';
  backHome();
}

async function startQrScan() {
  const msg = document.getElementById('adminMsg');
  msg.classList.add('hidden');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'この端末ではカメラが使えません。QRリーダーで読んだ文字列を手入力してください。';
    msg.classList.remove('hidden');
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('qrVideo');
    video.srcObject = scanStream;
    video.setAttribute('playsinline', true);
    await video.play();
    const canvas = document.getElementById('qrCanvas');
    const ctx = canvas.getContext('2d');
    scanTimer = setInterval(() => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (code && code.data) {
        document.getElementById('adminQrData').value = code.data;
        showToast('QRを読み取りました', '講師コードを確認して、Q列へ保存してください。', '📷');
        stopQrScan();
      }
    }, 350);
  } catch (err) {
    msg.textContent = 'カメラを開始できませんでした。ブラウザのカメラ許可を確認してください。';
    msg.classList.remove('hidden');
  }
}

function stopQrScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach(track => track.stop()); scanStream = null; }
  const video = document.getElementById('qrVideo');
  if (video) video.srcObject = null;
}

async function saveAdminQrData() {
  const code = document.getElementById('adminCode').value.trim();
  const qrData = document.getElementById('adminQrData').value.trim();
  const msg = document.getElementById('adminMsg');
  msg.classList.add('hidden');

  if (!code || !qrData) { showToast('未入力です', '講師コードとQRデータを入力してください。', '⚠️'); return; }

  try {
    const res = await jsonp({ action: 'saveQrData', code, qrData });
    if (!res.ok) throw new Error(res.message || '保存できませんでした。');
    showToast('Q列へ保存しました', (res.name || code) + ' の入退くんQRデータを保存しました。', '✅');
    msg.textContent = (res.name || code) + ' のQRデータを講師マスターQ列に保存しました。';
    msg.classList.remove('hidden');
    document.getElementById('adminCode').value = '';
    document.getElementById('adminQrData').value = '';
  } catch (err) {
    showToast('保存できませんでした', err.message || '保存できませんでした。', '⚠️');
    msg.textContent = err.message || '保存できませんでした。';
    msg.classList.remove('hidden');
  }
}
