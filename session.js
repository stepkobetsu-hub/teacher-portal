(() => {
  "use strict";

  // 講師コードを入力したら、ログインボタンを押さなくても自動ログインする。
  // 保存済みコードからの復帰は script.js の showAttendance() → login() で行う。
  // これにより、ポータルを開いただけで授業報告画面へ勝手に遷移することはない。
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

  window.addEventListener("DOMContentLoaded", setupAutoLogin);
})();
