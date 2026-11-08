const API_URL = "https://script.google.com/macros/s/AKfycbwP-pEDbbHB-Ec2xO7BFiVYqwpveTnNVmPJkNV08MPD8iAHHq4S7zPyVxDwFEmaHI9-/exec";
const SUMMER_URL = "https://stepkobetsu-hub.github.io/teacher_schedule/teacher_app.html";
const PAYSLIP_WEB_APP_URL = "./salary.html";
const TEACHER_PORTAL_URL = "https://stepkobetsu-hub.github.io/teacher-portal/";

let teacher = null;
let scanStream = null;
let scanTimer = null;

window.addEventListener("DOMContentLoaded", () => {
  const savedCode = localStorage.getItem("teacherCode");
  if (savedCode) {
    const codeEl = document.getElementById("code");
    const nyuEl = document.getElementById("nyuCode");
    if (codeEl) codeEl.value = savedCode;
    if (nyuEl) nyuEl.value = savedCode;
  }
  setToday();
  setHomeDate();
  setGreeting();
  setupPortalShare();
  openRequestedView();
});

function openRequestedView() {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "attendance") showAttendance();
  if (view === "qr") showNyutaikun();
}

function clearRequestedView() {
  if (!new URLSearchParams(window.location.search).has("view")) return;
  window.history.replaceState(null, "", window.location.pathname);
}

function setGreeting() {
  const el = document.getElementById("greetingText");
  if (!el) return;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  el.textContent = minutes <= 20 * 60 + 30 ? "こんにちは！" : "お疲れ様でした！";
}

function setHomeDate() {
  const el = document.getElementById("homeDate");
  if (!el) return;
  const d = new Date();
  const weeks = ["日", "月", "火", "水", "木", "金", "土"];
  el.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weeks[d.getDay()]}）`;
}

function showPage(id) {
  stopQrScan();
  ["homePage", "loginPage", "formPage", "completePage", "nyutaikunLoginPage", "nyutaikunQrPage", "adminQrPage"].forEach((pageId) => {
    const el = document.getElementById(pageId);
    if (el) el.classList.toggle("hidden", pageId !== id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backHome() {
  clearRequestedView();
  showPage("homePage");
}

function openSummerSchedule() {
  window.location.href = SUMMER_URL;
}

function openPayslip() {
  if (!PAYSLIP_WEB_APP_URL || PAYSLIP_WEB_APP_URL === "PASTE_PAYSLIP_WEB_APP_URL_HERE") {
    showToast("準備中です", "給与明細WebアプリURLを設定してください。", "⚠️");
    return;
  }
  window.location.assign(PAYSLIP_WEB_APP_URL);
}

function showUnderConstruction() {
  openPayslip();
}

function setupPortalShare() {
  const urlEl = document.getElementById("portalShareUrl");
  const qrEl = document.getElementById("portalShareQr");
  if (urlEl) {
    urlEl.href = TEACHER_PORTAL_URL;
    urlEl.textContent = TEACHER_PORTAL_URL;
  }
  if (qrEl) {
    qrEl.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(TEACHER_PORTAL_URL);
  }
}

function togglePortalShare() {
  const box = document.getElementById("portalShareBox");
  if (!box) return;
  box.classList.toggle("hidden");
}

const ATTENDANCE_TOKEN = "stepAttendanceSession";
let attendanceSubmitting = false;
let attendanceHistoryRequest = 0;

function showAttendance() {
  const token = localStorage.getItem(ATTENDANCE_TOKEN);
  const code = localStorage.getItem("teacherCode");
  if (!token || !code || !token.startsWith(code + ".")) {
    document.getElementById("code").value = code || "";
    showPage("loginPage");
    return;
  }
  teacher = { code, name: localStorage.getItem("teacherName") || "" };
  document.getElementById("teacherCodeDisplay").textContent = teacher.code;
  document.getElementById("teacherNameDisplay").textContent = teacher.name;
  resetForm(false);
  showPage("formPage");
  loadAttendanceHistory();
}

function showNyutaikun() {
  const savedCode = localStorage.getItem("teacherCode");
  if (savedCode) {
    const nyuEl = document.getElementById("nyuCode");
    if (nyuEl) nyuEl.value = savedCode;

    const cachedQrCode = localStorage.getItem("teacherQrCode");
    const cachedQrData = localStorage.getItem("teacherQrData");
    const cachedName = localStorage.getItem("teacherName") || "";

    if (cachedQrCode === savedCode && cachedQrData) {
      renderNyutaikunQr(savedCode, cachedName, cachedQrData);
      showPage("nyutaikunQrPage");
      return;
    }

    // 既存端末にはQRデータの保存がまだないため、入力画面を挟まず
    // QR画面へ直接進み、その画面内で初回だけデータを取得する。
    document.getElementById("nyuCodeDisplay").textContent = savedCode;
    document.getElementById("nyuNameDisplay").textContent = cachedName || "確認中…";
    document.getElementById("qrDisplay").innerHTML = '<div class="sending">QRコードを準備しています…</div>';
    showPage("nyutaikunQrPage");
    loadNyutaikunQr(savedCode, true);
    return;
  }
  showPage("nyutaikunLoginPage");
}

function showAdminQr() {
  showPage("adminQrPage");
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = "jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    params.callback = cb;
    const query = Object.keys(params).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k] ?? "")).join("&");
    const s = document.createElement("script");
    s.src = API_URL + "?" + query;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("通信がタイムアウトしました。"));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (res) => {
      cleanup();
      resolve(res);
    };
    s.onerror = () => {
      cleanup();
      reject(new Error("通信に失敗しました。"));
    };
    document.body.appendChild(s);
  });
}

function showToast(title, text, icon = "✅") {
  document.getElementById("toastIcon").textContent = icon;
  document.getElementById("toastTitle").textContent = title;
  document.getElementById("toastText").textContent = text || "";
  document.getElementById("toast").classList.remove("hidden");
}

function hideToast() {
  document.getElementById("toast").classList.add("hidden");
}

async function attendanceApi(action, data = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ ...data, action }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("通信エラー");
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function login() {
  const code = document.getElementById("code").value.trim();
  const password = document.getElementById("attendancePassword");
  const button = document.getElementById("attendanceLoginBtn");
  if (button.disabled) return;
  if (!code || !password.value) {
    showLoginMsg("講師コードとパスワードを入力してください。");
    return;
  }
  button.disabled = true;
  try {
    const result = await attendanceApi("attendanceLogin", { code, password: password.value });
    if (result.status !== "ok" || !result.token) {
      const messages = {
        unauthorized: "講師コードまたはパスワードを確認してください。",
        rate_limited: "ログイン試行回数が上限に達しました。しばらくしてからお試しください。"
      };
      showLoginMsg(messages[result.status] || "通信エラー。時間をおいてお試しください。");
      return;
    }
    if (localStorage.getItem("teacherCode") !== result.code) clearTeacherSession();
    saveTeacherSession(result.code, result);
    localStorage.setItem(ATTENDANCE_TOKEN, result.token);
    password.value = "";
    document.getElementById("loginMsg").classList.add("hidden");
    showAttendance();
  } catch (_) {
    showLoginMsg("通信エラー。時間をおいてお試しください。");
  } finally {
    button.disabled = false;
  }
}

function showLoginMsg(msg) {
  const el = document.getElementById("loginMsg");
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}

function setToday() {
  const today = new Date();
  const el = document.getElementById("workDate");
  if (el) el.value = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(today);
  updateDateText();
}

function updateDateText() {
  const value = document.getElementById("workDate")?.value;
  if (!value) return;
  const d = new Date(value + "T00:00:00");
  const weeks = ["日", "月", "火", "水", "木", "金", "土"];
  document.getElementById("dateText").textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weeks[d.getDay()]}）`;
}

function openWorkDatePicker() {
  const el = document.getElementById("workDate");
  if (!el || typeof el.showPicker !== "function") return;
  try {
    el.showPicker();
  } catch (e) {}
}

function toggleOther() {
  const koma = document.getElementById("koma").value;
  document.getElementById("otherBox").classList.toggle("hidden", koma !== "その他");
}

function attendanceMessage(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
  element.classList.remove("hidden");
}

function attendanceExpired(token) {
  if (localStorage.getItem(ATTENDANCE_TOKEN) !== token) return;
  localStorage.removeItem(ATTENDANCE_TOKEN);
  teacher = null;
  document.getElementById("attendanceHistoryList").replaceChildren();
  showAttendance();
  showLoginMsg("ログインの有効期限が切れました。もう一度ログインしてください。");
}

async function loadAttendanceHistory() {
  const token = localStorage.getItem(ATTENDANCE_TOKEN);
  if (!token) return;
  const request = ++attendanceHistoryRequest;
  const status = document.getElementById("attendanceHistoryStatus");
  const list = document.getElementById("attendanceHistoryList");
  const isCurrent = () => token === localStorage.getItem(ATTENDANCE_TOKEN) &&
    request === attendanceHistoryRequest;
  list.replaceChildren();
  attendanceMessage(status, "loading", "保存先シートを照会中…");
  try {
    const result = await attendanceApi("attendanceHistory", { token });
    if (!isCurrent()) return;
    if (result.status === "unauthorized") {
      attendanceExpired(token);
      return;
    }
    if (result.status !== "ok" || !Array.isArray(result.rows)) throw new Error();
    attendanceMessage(status, "loading", result.rows.length
      ? "出勤日・校舎・コマ数・保存状況"
      : "保存先シートに表示できる報告はありません。");
    for (const row of result.rows) {
      const item = document.createElement("li");
      const state = row.status === "saved" ? "saved" : "unconfirmed";
      attendanceMessage(item, state,
        `${row.workDate} / ${row.place} / ${row.koma}コマ — ${state === "saved" ? "保存確認済み" : "保存が確認できない"}`);
      list.appendChild(item);
    }
  } catch (_) {
    if (isCurrent()) attendanceMessage(status, "error", "通信エラー。履歴を再照会してください。");
  }
}

async function submitForm() {
  const token = localStorage.getItem(ATTENDANCE_TOKEN);
  if (!teacher || !token || attendanceSubmitting) return;
  const lessons = Array.from(document.querySelectorAll(".checks input:checked")).map((el) => el.value);
  const data = {
    workDate: document.getElementById("workDate").value,
    lessons: lessons.join(" / "),
    koma: document.getElementById("koma").value,
    komaOther: document.getElementById("komaOther").value,
    place: document.getElementById("place").value,
    memo: document.getElementById("memo").value
  };

  if (!data.workDate || lessons.length === 0 || !data.koma || !data.place) {
    alert("出勤日、本日の担当授業、コマ数、勤務場所を入力してください。");
    return;
  }
  if (data.koma === "その他" && !data.komaOther) {
    alert("その他のコマ数を入力してください。");
    return;
  }


  const btn = document.getElementById("submitBtn");
  const notice = document.getElementById("attendanceSubmitStatus");
  const sending = document.getElementById("sending");
  attendanceSubmitting = true;
  btn.disabled = true;
  sending.classList.remove("hidden");
  attendanceMessage(notice, "loading", "報告を送信し、保存先を照会しています…");

  try {
    let result;
    try {
      result = await attendanceApi("attendanceSubmit", { ...data, token });
      if (result.status === "unavailable") throw new Error();
    } catch (_) {
      // A lost response may follow a committed write. Only read on this path.
      result = await attendanceApi("attendanceVerify", { ...data, token });
      if (result.status !== "saved" && result.status !== "unauthorized") {
        throw new Error();
      }
    }
    if (localStorage.getItem(ATTENDANCE_TOKEN) !== token) return;
    if (result.status === "unauthorized") {
      attendanceExpired(token);
      return;
    }
    if (result.status === "invalid") {
      attendanceMessage(notice, "unconfirmed", "保存が確認できない。日付・校舎・コマ数（数字）・備考の長さを確認してください。");
      return;
    }
    if (result.status === "saved") {
      document.getElementById("completeMessage").textContent = `${teacher.name}さん、お疲れ様でした。`;
      const details = document.getElementById("receiptCompletedDetails");
      const message = "保存確認済み。報告の保存先シートで一致する行を確認しました。";
      attendanceMessage(details, "saved",
        [message, `${data.workDate} / ${data.place} / ${data.koma === "その他" ? data.komaOther : data.koma}コマ`].join("\n"));
      document.getElementById("randomMessage").textContent = randomMessage();
      showPage("completePage");
      return;
    }
    attendanceMessage(notice, "unconfirmed", "保存が確認できない。履歴を再照会してください。");
  } catch (_) {
    if (localStorage.getItem(ATTENDANCE_TOKEN) === token) {
      attendanceMessage(notice, "error", "通信エラー。履歴を再照会してください。同じ内容で再送した場合は既存の報告を照合します。");
    }
  } finally {
    attendanceSubmitting = false;
    btn.disabled = false;
    sending.classList.add("hidden");
  }
}

function randomMessage() {
  const messages = [
    "今日もありがとうございました！",
    "授業お疲れ様でした！",
    "また次回もよろしくお願いします！",
    "今日も助かりました！"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function resetForm(resetDate = true) {
  document.querySelectorAll(".checks input").forEach((el) => { el.checked = false; });
  document.getElementById("koma").value = "";
  document.getElementById("komaOther").value = "";
  document.getElementById("memo").value = "";
  document.getElementById("otherBox").classList.add("hidden");
  document.getElementById("sending").classList.add("hidden");
  document.getElementById("submitBtn").disabled = false;
  document.getElementById("submitBtn").textContent = "送信する";
  if (resetDate) setToday();
  const status = document.getElementById("attendanceSubmitStatus");
  if (status) status.classList.add("hidden");
}

function backToForm() {
  resetForm(true);
  showPage("formPage");
  loadAttendanceHistory();
}

function logoutAttendance() {
  clearTeacherSession();
  teacher = null;
  document.getElementById("code").value = "";
  document.getElementById("nyuCode").value = "";
  backHome();
}

function saveTeacherSession(code, data) {
  if (localStorage.getItem("teacherCode") !== code) localStorage.removeItem(ATTENDANCE_TOKEN);
  localStorage.setItem("teacherCode", code);
  localStorage.setItem("teacherName", data.name || "");
  if (data.qrData) {
    localStorage.setItem("teacherQrCode", code);
    localStorage.setItem("teacherQrData", data.qrData);
  }
}

function clearTeacherSession() {
  localStorage.removeItem(ATTENDANCE_TOKEN);
  document.getElementById("attendanceHistoryList")?.replaceChildren();
  localStorage.removeItem("teacherCode");
  localStorage.removeItem("teacherName");
  localStorage.removeItem("teacherQrCode");
  localStorage.removeItem("teacherQrData");
}

function renderNyutaikunQr(code, name, qrData) {
  document.getElementById("nyuCodeDisplay").textContent = code;
  document.getElementById("nyuNameDisplay").textContent = name || "";
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=360x360&ecc=M&data=" + encodeURIComponent(qrData);
  document.getElementById("qrDisplay").innerHTML = '<img alt="出退くんQR" loading="eager" src="' + qrUrl + '">';
}

async function loadNyutaikunQr(codeOverride = "", alreadyOnQrPage = false) {
  const code = String(codeOverride || document.getElementById("nyuCode").value).trim();
  const msg = document.getElementById("nyuMsg");
  if (msg) msg.classList.add("hidden");
  if (!code) {
    if (msg) {
      msg.textContent = "講師コードを入力してください。";
      msg.classList.remove("hidden");
    }
    return;
  }

  try {
    const res = await jsonp({ action: "getTeacher", code });
    if (!res.ok) throw new Error(res.message || "講師コードが見つかりません。");
    const t = res.teacher;
    if (!t.qrData) throw new Error("この講師の出退くんQRデータが未登録です。管理者に確認してください。");
    saveTeacherSession(code, t);
    renderNyutaikunQr(code, t.name, t.qrData);
    if (!alreadyOnQrPage) showPage("nyutaikunQrPage");
  } catch (err) {
    if (alreadyOnQrPage) {
      document.getElementById("nyuNameDisplay").textContent = localStorage.getItem("teacherName") || "";
      const qrDisplay = document.getElementById("qrDisplay");
      qrDisplay.innerHTML = "";
      const errorMessage = document.createElement("div");
      errorMessage.className = "noticeMsg";
      errorMessage.textContent = err.message || "QRコードを表示できませんでした。";
      qrDisplay.appendChild(errorMessage);
    } else if (msg) {
      msg.textContent = err.message || "QRコードを表示できませんでした。";
      msg.classList.remove("hidden");
    } else {
      alert(err.message || "QRコードを表示できませんでした。");
    }
  }
}

function logoutNyutaikun() {
  clearTeacherSession();
  teacher = null;
  document.getElementById("code").value = "";
  document.getElementById("nyuCode").value = "";
  backHome();
}

async function startQrScan() {
  showToast("準備中", "QR登録機能は現在のブラウザで利用できる場合のみ動作します。", "📷");
}

function stopQrScan() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  const video = document.getElementById("qrVideo");
  if (video) video.srcObject = null;
}

async function saveAdminQrData() {
  const code = document.getElementById("adminCode").value.trim();
  const qrData = document.getElementById("adminQrData").value.trim();
  const msg = document.getElementById("adminMsg");
  if (!code || !qrData) {
    showToast("未入力です", "講師コードとQRデータを入力してください。", "⚠️");
    return;
  }

  try {
    const res = await jsonp({ action: "saveQrData", code, qrData });
    if (!res.ok) throw new Error(res.message || "保存できませんでした。");
    showToast("Q列へ保存しました", `${res.name || code} のQRデータを保存しました。`, "✅");
    if (msg) {
      msg.textContent = `${res.name || code} のQRデータを講師マスターQ列に保存しました。`;
      msg.classList.remove("hidden");
    }
    document.getElementById("adminCode").value = "";
    document.getElementById("adminQrData").value = "";
  } catch (err) {
    showToast("保存できませんでした", err.message || "保存できませんでした。", "⚠️");
    if (msg) {
      msg.textContent = err.message || "保存できませんでした。";
      msg.classList.remove("hidden");
    }
  }
}
