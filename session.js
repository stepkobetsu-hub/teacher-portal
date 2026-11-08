(() => {
  "use strict";

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
  window.addEventListener("DOMContentLoaded", setupAutoLogin);
})();
