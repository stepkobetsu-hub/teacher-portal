const API_URL = 'ここにApps ScriptのWebアプリURLを入れてください';

let teacher = null;

window.addEventListener('load', () => {
  const savedCode = localStorage.getItem('teacherCode');
  if (savedCode) document.getElementById('code').value = savedCode;

  const today = new Date();
  document.getElementById('workDate').value = today.toISOString().slice(0, 10);
  updateDateText();

  const savedPlace = localStorage.getItem('teacherPlace');
  if (savedPlace) document.getElementById('place').value = savedPlace;

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('submitBtn').addEventListener('click', submitForm);
  document.getElementById('backBtn').addEventListener('click', backToForm);
  document.getElementById('workDate').addEventListener('change', updateDateText);
  document.getElementById('koma').addEventListener('change', toggleOther);
});

async function api(action, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  });
  return await res.json();
}

async function login() {
  const code = document.getElementById('code').value.trim();
  if (!code) return showLoginMsg('講師コードを入力してください。');

  document.getElementById('loginBtn').disabled = true;
  document.getElementById('loginBtn').textContent = '確認中...';

  try {
    const res = await api('getTeacher', { code });
    if (!res.ok) {
      showLoginMsg(res.message || '講師コードが見つかりません。');
      return;
    }
    teacher = res;
    localStorage.setItem('teacherCode', code);

    document.getElementById('loginArea').classList.add('hidden');
    document.getElementById('formArea').classList.remove('hidden');
    document.getElementById('hello').textContent = res.name + 'さん、お疲れ様でした！';
    document.getElementById('headerName').textContent = res.name + 'さんとして入力中';
  } catch (e) {
    showLoginMsg('通信エラーです。時間をおいて再度お試しください。');
  } finally {
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').textContent = 'ログイン';
  }
}

function showLoginMsg(msg) {
  const el = document.getElementById('loginMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function updateDateText() {
  const value = document.getElementById('workDate').value;
  if (!value) return;
  const date = new Date(value + 'T00:00:00');
  const weeks = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('dateText').textContent =
    date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日（' + weeks[date.getDay()] + '）';
}

function toggleOther() {
  const koma = document.getElementById('koma').value;
  document.getElementById('otherBox').classList.toggle('hidden', koma !== 'その他');
}

async function submitForm() {
  const lessons = Array.from(document.querySelectorAll('.checks input:checked')).map(el => el.value);
  const data = {
    code: teacher.code,
    workDate: document.getElementById('workDate').value,
    lessons,
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

  localStorage.setItem('teacherPlace', data.place);
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('submitBtn').textContent = '送信中...';
  document.getElementById('sending').classList.remove('hidden');

  try {
    const res = await api('submitAttendance', data);
    if (!res.ok) throw new Error(res.message || '送信失敗');

    document.getElementById('formArea').classList.add('hidden');
    document.getElementById('completeArea').classList.remove('hidden');
    document.getElementById('completeMessage').textContent =
      res.name + 'さん、お疲れ様でした。出勤確認を受け付けました。';

    const messages = [
      '今日もありがとうございました😊',
      '授業お疲れ様でした！',
      'また次回もよろしくお願いします！',
      '今日も助かりました！',
      '入退くんも忘れずにお願いします！'
    ];
    document.getElementById('randomMessage').textContent = messages[Math.floor(Math.random() * messages.length)];
  } catch (e) {
    alert('送信できませんでした。もう一度お試しください。');
  } finally {
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = '送信する';
    document.getElementById('sending').classList.add('hidden');
  }
}

function backToForm() {
  document.getElementById('completeArea').classList.add('hidden');
  document.getElementById('formArea').classList.remove('hidden');
  document.querySelectorAll('.checks input').forEach(el => el.checked = false);
  document.getElementById('koma').value = '';
  document.getElementById('komaOther').value = '';
  document.getElementById('memo').value = '';
  document.getElementById('otherBox').classList.add('hidden');
  const today = new Date();
  document.getElementById('workDate').value = today.toISOString().slice(0, 10);
  updateDateText();
}
