const API_URL = 'https://script.google.com/macros/s/AKfycbz9aRZIiaV4Vcz2jEyPsaoxWojUCts13IRR9dHveM8QM8baok0Wjm1jGA_M3lkqmQWRHw/exec';

function jsonpRequest(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');
    const query = new URLSearchParams({ action, callback: callbackName, ...params });

    window[callbackName] = function(data) {
      resolve(data);
      delete window[callbackName];
      script.remove();
    };

    script.onerror = function() {
      reject(new Error('通信に失敗しました。'));
      delete window[callbackName];
      script.remove();
    };

    script.src = API_URL + '?' + query.toString();
    document.body.appendChild(script);
  });
}

function getStudentsRequest() {
  return jsonpRequest('getStudents');
}

function getHistoryRequest() {
  return jsonpRequest('getHistory');
}

function getTemplatesRequest() {
  return jsonpRequest('getTemplates');
}

async function postToApi(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('送信に失敗しました。');
  return await response.json();
}

function sendSelectedMail(payload) {
  return postToApi({ action: 'sendSelected', ...payload });
}

function saveTemplateRequest(payload) {
  return postToApi({ action: 'saveTemplate', ...payload });
}
