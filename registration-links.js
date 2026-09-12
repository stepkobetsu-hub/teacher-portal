/* Invitation values stay in the fragment, not request URLs or external QR services. */
(function(root){
  'use strict';
  const PAGE='https://stepkobetsu-hub.github.io/teacher-portal/registration.html';
  function valid(code){return /^[a-f0-9]{64}$/.test(String(code||''));}
  function make(code,mode){
    if(!valid(code)||!['new','setup'].includes(mode))throw new Error('登録コードと用途を確認してください。');
    return PAGE+'#'+new URLSearchParams({registrationCode:code,mode}).toString();
  }
  function read(hash){
    const p=new URLSearchParams(String(hash||'').replace(/^#/,''));
    const code=p.get('registrationCode'),mode=p.get('mode');
    if(!valid(code)||!['new','setup'].includes(mode))return null;
    return {code,mode};
  }
  root.TeacherInviteLinks=Object.freeze({make,read});
})(typeof window==='undefined'?globalThis:window);
