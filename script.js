// Apps Scriptを「ウェブアプリ」としてデプロイしたURL
const API_URL = 'https://script.google.com/macros/s/AKfycbwP-pEDbbHB-Ec2xO7BFiVYqwpveTnNVmPJkNV08MPD8iAHHq4S7zPyVxDwFEmaHI9-/exec';

const QR_CODES = {
  "7076": "86188208196221787822775241",
  "7077": "86188215042177231658388975",
  "7082": "86188222858475712102785995",
  "7084": "86188218026638442757237991",
  "7085": "86188213336872337334054580",
  "7083": "86188218371903140437825946",
  "7086": "86188210622371690547408678",
  "7087": "86188215118088792262937944",
  "7002": "86188222234254945255281629",
  "7028": "86188221336842958519240544",
  "7040": "86188210604369297862655540",
  "7042": "86188215236265502308998344",
  "7043": "86188223240354099660063633",
  "7045": "86188220651129437344080452",
  "7048": "86188218425367385617847495",
  "7049": "86188214847063887464764503",
  "7052": "86188210097751385392615993",
  "7055": "86188207076554117939297447",
  "7058": "86188211276510020083622364",
  "7059": "86188206837696286607809572",
  "7061": "86188220875723403108713662",
  "7062": "86188215796560428057389654",
  "7063": "86188206301321195870398250",
  "7065": "86188210237350301474660641",
  "7067": "86188209449198723223410414",
  "7069": "86188212328081222757736620",
  "7074": "86188207466373163208427422",
  "7075": "86188206357873202444724489"
};
const QR_NAMES = {
  "7002": "大野智子",
  "7028": "伊東里紗",
  "7040": "土屋大輔",
  "7042": "西野由起",
  "7043": "酒巻裕亮",
  "7045": "田口瑠南",
  "7048": "林房子",
  "7049": "松久稜平",
  "7052": "長谷川瑠海",
  "7055": "青木央",
  "7058": "山本悠真",
  "7059": "島岡伶央那",
  "7061": "林　周悟",
  "7062": "重松澪",
  "7063": "堀尾拓巳",
  "7065": "柴田凌吾",
  "7067": "小川 真矢",
  "7069": "山口れんり",
  "7074": "早川瑛康",
  "7075": "白石亜美",
  "7076": "三井悠眞",
  "7077": "廣瀬達仁",
  "7082": "村田　真博",
  "7084": "米田拓郎",
  "7085": "岡島徠奈",
  "7083": "加藤大誠",
  "7086": "勝田裕己",
  "7087": "佐野夢空"
};

let teacher = null;

window.addEventListener('DOMContentLoaded', () => {
  const savedCode = localStorage.getItem('teacherCode');
  if (savedCode) {
    const codeEl = document.getElementById('code');
    const qrCodeEl = document.getElementById('qrCodeInput');
    if (codeEl) codeEl.value = savedCode;
    if (qrCodeEl) qrCodeEl.value = savedCode;
  }
  setToday();
});

function showPage(id) {
  ['homePage', 'loginPage', 'formPage', 'completePage', 'nyutaikunPage'].forEach(pageId => {
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
  showPage('nyutaikunPage');
  document.getElementById('qrMsg').classList.add('hidden');

  if (savedCode) {
    document.getElementById('qrCodeInput').value = savedCode;
    showMyQr();
  } else {
    document.getElementById('nyutaikunLogin').classList.remove('hidden');
    document.getElementById('qrDisplay').classList.add('hidden');
  }
}

function backHome() {
  showPage('homePage');
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!API_URL || API_URL.includes('XXXXX')) {
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
    document.getElementById('qrCodeInput').value = code;

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
  if (el) {
    el.value = today.toISOString().slice(0, 10);
    updateDateText();
  }
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

function showMyQr() {
  const code = document.getElementById('qrCodeInput').value.trim();
  const msg = document.getElementById('qrMsg');

  if (!code) {
    msg.textContent = '講師コードを入力してください。';
    msg.classList.remove('hidden');
    return;
  }

  if (!QR_CODES[code]) {
    msg.textContent = 'この講師コードの入退くんQRが登録されていません。管理者に確認してください。';
    msg.classList.remove('hidden');
    return;
  }

  localStorage.setItem('teacherCode', code);
  document.getElementById('code').value = code;

  const name = QR_NAMES[code] || '講師';
  document.getElementById('qrTeacherName').textContent = code + '　' + name + 'さん';
  document.getElementById('qrImage').src = 'images/qrcodes/' + code + '.png';

  document.getElementById('nyutaikunLogin').classList.add('hidden');
  document.getElementById('qrDisplay').classList.remove('hidden');
  msg.classList.add('hidden');
}

function logoutQr() {
  localStorage.removeItem('teacherCode');
  teacher = null;
  document.getElementById('code').value = '';
  document.getElementById('qrCodeInput').value = '';
  document.getElementById('nyutaikunLogin').classList.remove('hidden');
  document.getElementById('qrDisplay').classList.add('hidden');
  backHome();
}
