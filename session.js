(() => {
  "use strict";

  function getSavedCode() {
    return String(localStorage.getItem("teacherCode") || "").trim();
  }

  async function restoreTeacherSession() {
    const savedCode = getSavedCode();
    if (!savedCode || typeof login !== "function") return;

    const codeEl = document.getElementById("code");
    if (codeEl) codeEl.value = savedCode;

    // 保存済み講師コードがあれば、ログインボタンを押さずに自動復帰。
    await login();
  }

  function setupAutoLogin() {
    const codeEl = document.getElementById("code");
    if (!codeEl || typeof login !== "function") return;

    let timer = null;
    const tryLogin = () => {
      const code = codeEl.value.trim();
      if (!code) return;
      clearTimeout(timer);
      timer = setTimeout(() => login(), 450);
    };

    codeEl.addEventListener("input", tryLogin);
    codeEl.addEventListener("change", tryLogin);
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupAutoLogin();
    restoreTeacherSession();
  });
})();
