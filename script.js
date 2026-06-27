// Apps Scriptを「ウェブアプリ」としてデプロイしたURLをここに貼ります。
// 例: const API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
const API_URL = 'https://script.google.com/macros/s/AKfycbwP-pEDbbHB-Ec2xO7BFiVYqwpveTnNVmPJkNV08MPD8iAHHq4S7zPyVxDwFEmaHI9-/exec';

let teacher = null;

window.addEventListener('DOMContentLoaded', () => {
  const savedCode = localStorage.getItem('teacherCode');
  if (savedCode) document.getElementById('code').value = savedCode;
  setToday();
});

function showPage(id) {
  ['homePage', 'loginPage', 'formPage', 'completePage'].forEach(pageId => {
    document.getElementById(pageId).classList.toggle('hidden', pageId !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAttendance() {
  const savedCode = localStorage.getItem('teacherCode');
  showPage('loginPage');
  if (savedCode) document.getElementById('code').value = savedCode;
}

function backHome() {
  showPage('homePage');
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!API_URL || API_URL.includes('PASTE_APPS_SCRIPT')) {
      reject(new Error('API_URLが未設定です。script.jsにApps ScriptのURLを貼ってください。'));
      return;
    }

    const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    params.callback = callbackName;

    const query = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key] ?? ''))
      .join('&');

    const script = document.createElement('script');
    script.src = API_URL + '?' + query;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('通信がタイムアウトしました。'));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (response) => {
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('通信に失敗しました。'));
    };

    document.body.appendChild(script);
  });
}

async function login() {
  const code = document.getElementById('code').value.trim();
  if (!code) {
    showLoginMsg('講師コードを入力してください。');
    return;
  }

  try {
    const res = await jsonp({ action: 'getTeacher', code });
    if (!res.ok) {
      showLoginMsg(res.message || '講師コードが見つかりません。名前がない場合は、すぐに申し出てください。');
      return;
    }

    teacher = res.teacher;
    localStorage.setItem('teacherCode', code);

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
  document.getElementById('workDate').value = today.toISOString().slice(0, 10);
  updateDateText();
}

function updateDateText() {
  const value = document.getElementById('workDate').value;
  if (!value) return;
  const date = new Date(value + 'T00:00:00');
  const weeks = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('dateText').textContent =
    date.getFullYear() + '年' +
    (date.getMonth() + 1) + '月' +
    date.getDate() + '日（' + weeks[date.getDay()] + '）';
}

function toggleOther() {
  const koma = document.getElementById('koma').value;
  document.getElementById('otherBox').classList.toggle('hidden', koma !== 'その他');
}

async function submitForm() {
  if (!teacher) {
    alert('ログインし直してください。');
    showPage('loginPage');
    return;
  }

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

  if (!data.workDate || lessons.length === 0 || !data.koma || !data.place) {
    alert('出勤日、担当授業、コマ数、勤務場所を入力してください。');
    return;
  }
  if (data.koma === 'その他' && !data.komaOther) {
    alert('その他のコマ数を入力してください。');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '送信中...';
  document.getElementById('sending').classList.remove('hidden');

  try {
    const res = await jsonp(data);
    if (!res.ok) throw new Error(res.message || '送信できませんでした。');

    const name = res.name || teacher.name;
    document.getElementById('completeMessage').textContent =
      name + 'さん、お疲れ様でした。出勤確認を受け付けました。';
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
  const messages = [
    '今日もありがとうございました😊',
    '授業お疲れ様でした！',
    'また次回もよろしくお願いします！',
    '今日も助かりました！',
    '入退くんも忘れずにお願いします！'
  ];
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

function backToForm() {
  resetForm(true);
  showPage('formPage');
}
