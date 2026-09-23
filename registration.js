'use strict';
const REG_API='https://script.google.com/macros/s/AKfycbzYpm-16ahuZ3BRFKRT-iSvR9nThsYcTOhxplyBp4bZmVmehfTYZEEl18THzJasypOsTQ/exec';
const STAFF_AUTH='https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec';
const $=id=>document.getElementById(id);
let mode='new',token='',profile=null,pending=null,enrollmentSalt='',busy=false;
let passwordChangeRequested=false,notificationStaffSession=null,approvalToken='',approvalStaffSession=null;
const labels={surname:'姓',givenName:'名',surnameKana:'フリガナ（姓）',givenNameKana:'フリガナ（名）',postalCode:'郵便番号',address:'住所',bankCode:'銀行コード',branchCode:'支店コード／ゆうちょの記号',accountType:'口座種別',accountNumber:'口座番号／ゆうちょの番号',birthDate:'生年月日',myNumber:'マイナンバー',email:'メールアドレス'};
function notice(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);$('message').hidden=!text;}
async function post(url,data){
  // A unique non-sensitive URL prevents intermediary reuse of Apps Script redirects.
  const endpoint=new URL(url);endpoint.searchParams.set('requestId',crypto.randomUUID());
  const response=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),credentials:'omit',cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('通信できませんでした。入力を残しているので、少し待ってから再度お試しください。');
  let result;try{result=await response.json();}catch{throw new Error('サーバーの応答を確認できません。少し待ってから再度お試しください。');}
  return result;
}
async function api(action,data={}){
  const result=await post(REG_API,{action:'teacherRegistration'+action,...data});
  if(!result.ok)throw new Error(result.message||'処理できませんでした。');
  return result;
}
async function task(fn){
  if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await fn();}catch(e){notice(e.name==='TimeoutError'?'通信に時間がかかっています。同じ内容で再度お試しください。':e.message,true);$('message').scrollIntoView({behavior:'smooth',block:'center'});}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
function hex(bytes){return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function passwordProof(password,salt){
  const bytes=Uint8Array.from(salt.match(/../g),x=>parseInt(x,16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:600000,hash:'SHA-256'},key,256));
}
function fieldsHTML(prefix,initial=false){
  if(initial)return '<fieldset><legend>はじめての登録</legend><div class="two">'+
    input('surname','姓',prefix,'text','family-name')+input('givenName','名',prefix,'text','given-name')+
    input('surnameKana','フリガナ（姓）',prefix)+input('givenNameKana','フリガナ（名）',prefix)+'</div>'+
    input('birthDate','生年月日',prefix,'date','bday')+input('email','メールアドレス',prefix,'email','email')+'</fieldset>';
  return '<fieldset><legend>お名前・連絡先</legend><div class="two">'+
    input('surname','姓',prefix,'text','family-name')+input('givenName','名',prefix,'text','given-name')+
    input('surnameKana','フリガナ（姓）',prefix)+input('givenNameKana','フリガナ（名）',prefix)+'</div>'+
    input('birthDate','生年月日',prefix,'date','bday')+
    input('email','メールアドレス',prefix,'email','email')+
    '<p class="hint" id="'+prefix+'legacyName"></p></fieldset>'+
    '<fieldset><legend>住所</legend>'+
    input('postalCode','郵便番号',prefix,'text','postal-code','7桁。ハイフンがあっても入力できます。')+
    input('address','住所',prefix,'text','street-address')+'</fieldset>'+
    '<fieldset><legend>給与振込口座 <small>あとから入力できます</small></legend>'+
    '<a class="lookup-button" href="https://www.bankdb.jp/" target="_blank" rel="noopener noreferrer">銀行コード・支店コードを調べる ↗</a><p class="hint">検索サイトが別のタブで開きます。銀行名から検索し、支店を選んで確認してください。</p>'+
    '<label>銀行<select name="bankChoice" id="'+prefix+'bankChoice"><option value="">選択してください</option><option value="other">ゆうちょ以外の銀行</option><option value="yucho">ゆうちょ銀行</option></select></label>'+
    '<div class="two">'+input('bankCode','銀行コード',prefix,'text','off','4桁の数字')+
    input('branchCode','支店コード',prefix,'text','off','3桁の数字')+'</div>'+
    '<label id="'+prefix+'typeLabel">口座種別<select name="accountType"><option value="">選択してください</option><option>普通</option><option>当座</option><option>貯蓄</option></select></label>'+
    input('accountNumber','口座番号',prefix,'text','off','7桁以内。先頭の0もそのまま入力してください。')+
    '<p class="hint" id="'+prefix+'bankHint"></p></fieldset>'+
    '<fieldset><legend>マイナンバー <small>あとから入力できます</small></legend>'+
    input('myNumber','マイナンバー',prefix,'password','off','12桁。登録済みの番号は表示しません。空欄のままなら登録済みの番号を保持します。')+
    '<p class="hint" id="'+prefix+'myNumberState"></p></fieldset>';
}
function input(name,label,prefix,type='text',autocomplete='off',hint=''){
  const digits=['postalCode','bankCode','branchCode','accountNumber','myNumber'].includes(name);
  return '<label id="'+prefix+name+'Label"><span>'+label+'</span><input name="'+name+'" type="'+type+'" autocomplete="'+autocomplete+'"'+(digits?' inputmode="numeric"':'')+' maxlength="'+(name==='address'?300:name==='myNumber'?16:100)+'"><small>'+hint+'</small></label>';
}
function setupFields(prefix,form){
  if(!form.elements.bankChoice)return;
  form.querySelector('[name=bankChoice]').addEventListener('change',()=>bankUI(prefix,form,true));
  form.querySelector('[name=bankCode]').addEventListener('input',()=>{
    const value=form.elements.bankCode.value.normalize('NFKC').trim();
    if(value==='9900')form.elements.bankChoice.value='yucho';
    else if(form.elements.bankChoice.value==='yucho')form.elements.bankChoice.value='other';
    bankUI(prefix,form,false);
  });
  ['postalCode','bankCode','branchCode','accountNumber','myNumber'].forEach(name=>{
    form.elements[name].addEventListener('blur',()=>{form.elements[name].value=form.elements[name].value.normalize('NFKC').replace(/[\s-]/g,'');});
  });
}
function bankUI(prefix,form,changed){
  const yucho=form.elements.bankChoice.value==='yucho';
  if(changed&&yucho)form.elements.bankCode.value='9900';
  if(changed&&!yucho&&form.elements.bankCode.value==='9900')form.elements.bankCode.value='';
  if(changed){form.elements.branchCode.value='';form.elements.accountType.value='';form.elements.accountNumber.value='';}
  form.elements.bankCode.readOnly=yucho;
  $(prefix+'branchCodeLabel').querySelector('span').textContent=yucho?'ゆうちょの記号':'支店コード';
  $(prefix+'branchCodeLabel').querySelector('small').textContent=yucho?'通帳・キャッシュカードの5桁の記号':'3桁の数字';
  $(prefix+'accountNumberLabel').querySelector('span').textContent=yucho?'ゆうちょの番号':'口座番号';
  $(prefix+'accountNumberLabel').querySelector('small').textContent=yucho?'通帳・キャッシュカードの番号（最大8桁）':'7桁以内。先頭の0もそのまま入力してください。';
  $(prefix+'typeLabel').hidden=yucho;
  if(yucho)form.elements.accountType.value='';
  $(prefix+'bankHint').textContent=yucho?'ゆうちょは銀行コード9900、記号・番号を保存します。口座種別は空欄になります。':'';
}
function modeChange(value){
  mode=value;pending=null;enrollmentSalt='';notice('');$('notificationSettingsArea').hidden=value!=='new';
  $('approval').hidden=true;
  $('review').hidden=true;$('success').hidden=true;$('entry').hidden=false;$('editor').hidden=true;
  $('loginForm').hidden=value!=='login';$('enrollForm').hidden=value==='login';
  $('newFields').hidden=value!=='new';$('registrationIntro').hidden=value!=='new';$('setupIntro').hidden=value!=='setup';
  $('enrollPasswordFields').hidden=value==='new';$('automaticPasswordNotice').hidden=value!=='new';
  $('registrationCodeLabel').hidden=value!=='setup';$('enrollForm').elements.registrationCode.required=value==='setup';
  $('enrollForm').elements.password.required=value==='setup';$('enrollForm').elements.passwordConfirm.required=value==='setup';
  $('newFields').querySelectorAll('input,select').forEach(el=>{el.disabled=value!=='new';el.required=value==='new'&&['surname','givenName','surnameKana','givenNameKana','birthDate','email'].includes(el.name);});
  ['new','login'].forEach(v=>$(v+'Tab').setAttribute('aria-pressed',String(value===v)));
}
function getFields(form,isNew){
  const values={};Object.keys(labels).forEach(key=>{
    if(!form.elements[key])return;
    const value=form.elements[key].value.normalize('NFKC').trim();
    if(isNew||value!=='')values[key]=value;
  });
  if(!isNew){
    for(const pair of [['surname','givenName'],['surnameKana','givenNameKana']]){
      if(pair.some(k=>k in values)&&!pair.every(k=>values[k]))throw new Error('姓と名は両方入力してください。');
      if(pair.every(k=>values[k]===profile[k]))pair.forEach(k=>delete values[k]);
    }
    for(const key of Object.keys(values))if(!['surname','givenName','surnameKana','givenNameKana'].includes(key)&&values[key]===String(profile[key]||''))delete values[key];
    const bankKeys=['bankCode','branchCode','accountType','accountNumber'];
    if(bankKeys.some(k=>k in values)){
      bankKeys.forEach(k=>values[k]=form.elements[k].value.normalize('NFKC').trim());
      if(!values.bankCode||!values.branchCode||!values.accountNumber||(values.bankCode!=='9900'&&!values.accountType))throw new Error('口座を変更するときは銀行・支店・種別・口座番号を確認してください。');
    }
  }
  return values;
}
function review(values,kind){
  $('reviewSave').textContent=kind==='new'?'この内容で送信する':'この内容で保存する';
  $('reviewValues').replaceChildren();
  for(const [key,value] of Object.entries(values)){
    if(!value&&kind==='new')continue;
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=labels[key]||key;dd.textContent=key==='myNumber'?(value?'●'.repeat(value.replace(/[\s-]/g,'').length):'変更なし'):String(value||'空欄');
    $('reviewValues').append(dt,dd);
  }
  if(kind==='setup'){$('reviewValues').textContent='教室から案内された講師番号に、新しいパスワードを設定します。';}
  $('entry').hidden=true;$('editor').hidden=true;$('review').hidden=false;
  $('review').scrollIntoView({behavior:'smooth'});
}
function showProfile(result,success,completed=false){
  if(result.token)token=result.token;
  profile=result.profile;pending=null;enrollmentSalt='';$('notificationSettingsArea').hidden=true;
  $('entry').hidden=true;$('review').hidden=true;$('success').hidden=!completed;$('editor').hidden=completed;
  $('teacherCodeDisplay').textContent=profile.code;$('teacherNameDisplay').textContent=profile.fullName;
  const form=$('editForm');Object.keys(labels).forEach(k=>{form.elements[k].value=k==='myNumber'?'':profile[k]||'';});
  form.elements.bankChoice.value=profile.bankCode==='9900'?'yucho':profile.bankCode?'other':'';
  bankUI('edit-',form,false);
  const myNumberInput=form.elements.myNumber;
  myNumberInput.readOnly=profile.hasMyNumber;
  myNumberInput.setAttribute('aria-readonly',String(profile.hasMyNumber));
  myNumberInput.placeholder=profile.hasMyNumber?'登録済み（変更は管理者へ連絡）':'12桁のマイナンバー';
  $('edit-myNumberState').textContent=profile.hasMyNumber?'マイナンバー：登録済みです。変更する場合は管理者に連絡してください。':'マイナンバー：未登録です。こちらから新規登録できます。';
  $('edit-legacyName').textContent=!profile.surname?'登録済みのお名前：'+profile.fullName+' ／ '+profile.fullKana+'。お名前を修正するときは姓・名を分けて入力してください。':'';
  $('enrollForm').reset();$('loginForm').reset();$('passwordChangeForm').reset();$('passwordChangePanel').open=passwordChangeRequested;
  $('successText').textContent=success;notice(completed?'':success);
  $('successHeading').textContent='保存しました';$('editAfterSave').hidden=false;
  if(completed)$('success').scrollIntoView({behavior:'smooth',block:'center'});
}
$('newFields').innerHTML=fieldsHTML('new-',true);$('editFields').innerHTML=fieldsHTML('edit-');
setupFields('new-',$('enrollForm'));setupFields('edit-',$('editForm'));
document.querySelectorAll('input[type="password"]').forEach(input=>{
  const wrap=document.createElement('div');wrap.className='password-input-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const button=document.createElement('button');button.type='button';button.className='password-toggle';
  button.textContent='👁';button.setAttribute('aria-label','パスワードを表示');
  button.addEventListener('click',()=>{
    const showing=input.type==='text';input.type=showing?'password':'text';
    button.textContent=showing?'👁':'🙈';
    button.setAttribute('aria-label',showing?'パスワードを表示':'パスワードを隠す');
  });
  wrap.appendChild(button);
});
$('editForm').elements.myNumber.addEventListener('focus',()=>{
  if(profile&&profile.hasMyNumber)notice('マイナンバーの変更は、管理者に連絡してください。',true);
});
['new','login'].forEach(v=>$(v+'Tab').addEventListener('click',()=>{passwordChangeRequested=false;modeChange(v);}));
$('loginForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  notice('ログインしています…');const f=e.target,code=f.elements.teacherCode.value.trim();
  const metadata=await api('Salt',{teacherCode:code});
  const proof=await passwordProof(f.elements.password.value,metadata.salt);
  const result=await api('Login',{teacherCode:code,proof,password:f.elements.password.value});showProfile(result,'ログインしました。銀行口座などを追加入力・修正できます。');
});});
$('enrollForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;
  const fields=mode==='new'?getFields(f,true):{};
  let enrollmentPassword=f.elements.password.value;
  if(mode==='new'){
    const match=String(fields.birthDate||'').match(/^\d{4}-(\d{2})-(\d{2})$/);
    if(!match)throw new Error('生年月日を入力してください。');
    enrollmentPassword=match[1]+match[2];
  }else{
    if(enrollmentPassword!==f.elements.passwordConfirm.value)throw new Error('確認用パスワードが一致しません。。');
    if(enrollmentPassword.length<4)throw new Error('パスワードは4文字以上で設定してください。');
  }
  if(!enrollmentSalt)enrollmentSalt=hex(crypto.getRandomValues(new Uint8Array(16)));
  pending={kind:mode,fields,registrationCode:mode==='setup'?f.elements.registrationCode.value.trim():'',salt:enrollmentSalt,password:enrollmentPassword,proof:await passwordProof(enrollmentPassword,enrollmentSalt)};
  notice('');review(fields,mode);
});});
$('passwordChangeForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;
  if(f.elements.newPassword.value!==f.elements.newPasswordConfirm.value)throw new Error('新しいパスワードの確認入力が一致しません。');
  if(f.elements.newPassword.value.length<4)throw new Error('新しいパスワードは4文字以上で設定してください。');
  const metadata=await api('Salt',{teacherCode:profile.code});
  const currentProof=await passwordProof(f.elements.currentPassword.value,metadata.salt);
  await api('ChangePassword',{token,currentPassword:f.elements.currentPassword.value,currentProof,newPassword:f.elements.newPassword.value});
  token='';profile=null;pending=null;passwordChangeRequested=false;
  document.querySelectorAll('form').forEach(form=>form.reset());
  modeChange('login');notice('パスワードを変更しました。新しいパスワードでログインしてください。他の講師アプリでも新しいパスワードを使えます。');
});});
$('editForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const fields=getFields(e.target,false);if(!Object.keys(fields).length){notice('変更された項目はありません。');return;}
  pending={kind:'edit',fields,revision:profile.revision};notice('');review(fields,'edit');
});});
$('reviewBack').addEventListener('click',()=>{
  $('review').hidden=true;$(pending?.kind==='edit'?'editor':'entry').hidden=false;
});
$('reviewSave').addEventListener('click',()=>task(async()=>{
  if(!pending)return;notice('保存しています。画面を閉じずにお待ちください…');
  const editing=pending.kind==='edit';
  if(pending.kind==='new'){
    const result=await api('SubmitRequest',{fields:pending.fields,salt:pending.salt,proof:pending.proof});
    pending=null;enrollmentSalt='';$('enrollForm').reset();$('entry').hidden=true;$('review').hidden=true;$('success').hidden=false;
    $('successHeading').textContent='申請を受け付けました';$('successText').textContent='管理者へ確認メールを送りました。承認後に講師マスターへ登録し、講師番号をメールでお知らせします。'+(result.notificationWarning?'\n'+result.notificationWarning:'');
    $('editAfterSave').hidden=true;notice('');$('success').scrollIntoView({behavior:'smooth',block:'center'});return;
  }
  const result=editing?await api('Save',{token,fields:pending.fields,revision:pending.revision}):await api('Enroll',{mode:pending.kind,fields:pending.fields,registrationCode:pending.registrationCode,salt:pending.salt,password:pending.password,proof:pending.proof});
  const completedMessage=editing?'変更内容を保存しました。':'講師番号 '+result.code+' のパスワードを設定しました。';
  showProfile(result,completedMessage+(result.notificationWarning?'\n'+result.notificationWarning:''),true);
}));
$('editAfterSave').addEventListener('click',()=>{
  $('success').hidden=true;$('editor').hidden=false;notice('');$('editor').scrollIntoView({behavior:'smooth'});
});
$('closeAfterSave').addEventListener('click',()=>task(async()=>{
  const old=token;token='';profile=null;pending=null;passwordChangeRequested=false;
  document.querySelectorAll('form').forEach(form=>form.reset());notice('閉じています…');
  try{await api('Logout',{token:old});}catch{}
  window.close();setTimeout(()=>location.replace('./'),150);
}));
$('logout').addEventListener('click',()=>task(async()=>{
  const old=token;token='';profile=null;pending=null;$('passwordChangeForm').reset();passwordChangeRequested=false;$('editForm').reset();$('enrollForm').reset();$('loginForm').reset();
  modeChange('login');notice('ログアウトしました。');
  try{await api('Logout',{token:old});}catch{notice('この画面からログアウトしました。接続できないためサーバーのセッションは有効期限で終了します。');}
}));
$('closeWithoutSaving').addEventListener('click',()=>task(async()=>{
  const old=token;token='';profile=null;pending=null;passwordChangeRequested=false;
  document.querySelectorAll('form').forEach(form=>form.reset());
  modeChange('login');notice('閉じています…');
  try{await api('Logout',{token:old});}catch{}
  window.close();
  // Browsers may keep a manually opened tab open; return to the portal in that case.
  setTimeout(()=>location.replace('./'),150);
}));
$('notificationSettingsButton').addEventListener('click',()=>{
  const panel=$('notificationSettingsPanel');panel.hidden=!panel.hidden;
  if(!panel.hidden)$('notificationSettingsLoginForm').elements.staffCode.focus();
});
$('notificationSettingsLoginForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;notice('確認メールの送信先を読み込んでいます…');
  const login=await post(STAFF_AUTH,{action:'studentQrLogin',code:f.elements.staffCode.value.trim(),password:f.elements.staffPassword.value});
  if(!login.success||!['2','3','4'].includes(String(login.permissionLevel)))throw new Error('スタッフID・パスワードと利用権限を確認してください。');
  notificationStaffSession={staffLoginId:String(login.loginId||login.code||f.elements.staffCode.value.trim()),sessionToken:login.sessionToken};
  const result=await api('NotificationSettingsGet',notificationStaffSession);
  const form=$('notificationSettingsForm');[1,2,3].forEach(index=>{form.elements['recipient'+index].value=result.recipients[index-1]||'';});
  f.elements.staffPassword.value='';f.hidden=true;form.hidden=false;notice('現在の確認メール送信先を表示しました。');
});});
$('notificationSettingsForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  if(!notificationStaffSession)throw new Error('もう一度スタッフ認証を行ってください。');
  const recipients=[1,2,3].map(index=>e.target.elements['recipient'+index].value.normalize('NFKC').trim()).filter(Boolean);
  const result=await api('NotificationSettingsSave',{...notificationStaffSession,recipients});
  [1,2,3].forEach(index=>{e.target.elements['recipient'+index].value=result.recipients[index-1]||'';});
  notice('確認メール送信先を保存しました。今後は講師本人と、この'+result.recipients.length+'件へ送信します。');
});});
$('notificationSettingsCancel').addEventListener('click',()=>{
  notificationStaffSession=null;$('notificationSettingsForm').reset();$('notificationSettingsForm').hidden=true;$('notificationSettingsLoginForm').reset();$('notificationSettingsLoginForm').hidden=false;$('notificationSettingsPanel').hidden=true;notice('');
});
function showApproval(details){
  $('approvalValues').replaceChildren();
  const fields=details.applicant||{};
  for(const [label,value] of [['お名前',fields.surname+' '+fields.givenName],['フリガナ',fields.surnameKana+' '+fields.givenNameKana],['生年月日',fields.birthDate],['メールアドレス',fields.email]]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('approvalValues').append(dt,dd);
  }
  $('approvalStatus').textContent=details.status==='承認済み'?'承認済みです。講師番号：'+details.code:'内容を確認し、登録してよい場合だけ承認してください。';
  $('approveRequest').hidden=details.status!=='確認待ち';$('approvalDetail').hidden=false;
}
$('approvalLoginForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;notice('申請を確認しています…');
  const login=await post(STAFF_AUTH,{action:'studentQrLogin',code:f.elements.staffCode.value.trim(),password:f.elements.staffPassword.value});
  if(!login.success||String(login.permissionLevel)!=='2')throw new Error('管理者権限のスタッフID・パスワードでログインしてください。');
  approvalStaffSession={staffLoginId:String(login.loginId||login.code||f.elements.staffCode.value.trim()),sessionToken:login.sessionToken};
  const details=await api('ApprovalPreview',{...approvalStaffSession,approvalToken});
  f.elements.staffPassword.value='';f.hidden=true;showApproval(details);notice('');
});});
$('approveRequest').addEventListener('click',()=>task(async()=>{
  if(!approvalStaffSession)throw new Error('スタッフ認証をやり直してください。');
  notice('講師マスターへ登録しています。画面を閉じずにお待ちください…');
  const result=await api('ApproveRequest',{...approvalStaffSession,approvalToken});
  $('approvalStatus').textContent='承認しました。講師番号：'+result.code+'。D列は自動で1になりました。'+(result.notificationWarning?' '+result.notificationWarning:'');
  $('approveRequest').hidden=true;notice('登録が完了しました。');
}));
window.addEventListener('pagehide',()=>{token='';profile=null;pending=null;notificationStaffSession=null;approvalStaffSession=null;approvalToken='';document.querySelectorAll('form').forEach(f=>f.reset());});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
function receiveInvite(){
  const approval=location.hash.match(/^#approval=([a-f0-9]{64})$/);
  if(approval){
    approvalToken=approval[1];history.replaceState(null,'',location.pathname+location.search);
    $('entry').hidden=true;$('editor').hidden=true;$('review').hidden=true;$('success').hidden=true;$('notificationSettingsArea').hidden=true;$('approval').hidden=false;
    return;
  }
  const receivedInvite=TeacherInviteLinks.read(location.hash);
  if(location.hash.includes('registrationCode'))history.replaceState(null,'',location.pathname+location.search);
  if(!receivedInvite)return;
  if(receivedInvite.mode!=='setup')return;
  modeChange('setup');
  $('enrollForm').elements.registrationCode.value=receivedInvite.code;
  notice('登録コードを読み込みました。ご自分のパスワードを設定してください。');
}
modeChange('new');
receiveInvite();
window.addEventListener('hashchange',receiveInvite);
