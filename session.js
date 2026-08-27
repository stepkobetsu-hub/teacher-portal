(() => {
  "use strict";

  // 授業報告：保存済みの講師コードがある場合は、ログイン画面を一瞬も表示せず
  // そのまま授業報告画面を表示する。裏側で講師情報を再確認する。
  // これにより、通信に1～2秒かかっても「授業報告ログイン」がちらつかない。
  function setupAttendanceFastRestore() {
    const originalShowAttendance = window.showAttendance;
    if (typeof originalShowAttendance !== "function") return;

    window.showAttendance = function () {
      const savedCode = localStorage.getItem("teacherCode");
      if (!savedCode) {
        originalShowAttendance();
        return;
      }

      const codeEl = document.getElementById("code");
      const name = localStorage.getItem("teacherName") || "";
      if (codeEl) codeEl.value = savedCode;

      // 保存済み情報を使って即座に画面を表示。
      // submitForm() が使えるよう、最低限の講師情報も復元する。
      window.teacher = { code: savedCode, name };
      const codeDisplay = document.getElementById("teacherCodeDisplay");
      const nameDisplay = document.getElementById("teacherNameDisplay");
      if (codeDisplay) codeDisplay.textContent = savedCode;
      if (nameDisplay) nameDisplay.textContent = name;
      if (typeof resetForm === "function") resetForm(false);
      if (typeof showPage === "function") showPage("formPage");

      // 表示後にバックグラウンドで最新の講師情報を確認。
      // 成功しても画面を切り替えたり、入力内容をリセットしたりしない。
      if (typeof jsonp === "function") {
        jsonp({ action: "getTeacher", code: savedCode })
          .then((res) => {
            if (!res || !res.ok) throw new Error((res && res.message) || "講師コードが確認できません。");
            window.teacher = res.teacher;
            localStorage.setItem("teacherCode", savedCode);
            localStorage.setItem("teacherName", res.teacher.name || "");
            if (codeDisplay) codeDisplay.textContent = savedCode;
            if (nameDisplay) nameDisplay.textContent = res.teacher.name || "";
          })
          .catch(() => {
            // 通信失敗だけなら現在の画面を維持。
            // 明らかな認証失敗の場合のみ、保存情報を消して再ログインを促す。
            // APIエラー文言だけで誤判定しないよう、ここでは画面遷移しない。
          });
      }
    };
  }

  // 講師コードを入力したら、ログインボタンを押さなくても自動ログインする。
  function setupAutoLogin() {
    const codeEl = document.getElementById("code");
    if (!codeEl || typeof login !== "function") return;

    let timer = null;
    let lastAttemptedCode = "";

    const tryLogin = () => {
      const code = codeEl.value.trim();
      if (!code || code === lastAttemptedCode) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const currentCode = codeEl.value.trim();
        if (!currentCode || currentCode === lastAttemptedCode) return;
        lastAttemptedCode = currentCode;
        login();
      }, 250);
    };

    codeEl.addEventListener("input", tryLogin);
    codeEl.addEventListener("change", tryLogin);
  }

  // script.js の showAttendance 定義後、DOMContentLoaded 実行前に差し替える。
  setupAttendanceFastRestore();
  window.addEventListener("DOMContentLoaded", setupAutoLogin);
})();
