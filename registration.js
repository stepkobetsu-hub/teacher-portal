'use strict';
const REG_API='https://script.google.com/macros/s/AKfycbzYpm-16ahuZ3BRFKRT-iSvR9nThsYcTOhxplyBp4bZmVmehfTYZEEl18THzJasypOsTQ/exec';
const STAFF_AUTH='https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec';
const $=id=>document.getElementById(id);
let mode='new',token='',profile=null,pending=null,enrollmentSalt='',busy=false;
let inviteLink='',passwordChangeRequested=false;
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
function fieldsHTML(prefix){
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
  mode=value;pending=null;enrollmentSalt='';notice('');$('admin').hidden=value!=='new';
  $('review').hidden=true;$('entry').hidden=false;$('editor').hidden=true;
  $('loginForm').hidden=value!=='login';$('enrollForm').hidden=value==='login';
  $('newFields').hidden=value!=='new';$('registrationIntro').hidden=value!=='new';$('setupIntro').hidden=value!=='setup';
  $('newFields').querySelectorAll('input,select').forEach(el=>{el.disabled=value!=='new';el.required=value==='new'&&['surname','givenName','surnameKana','givenNameKana','email'].includes(el.name);});
  ['new','login'].forEach(v=>$(v+'Tab').setAttribute('aria-pressed',String(value===v)));
}
function getFields(form,isNew){
  const values={};Object.keys(labels).forEach(key=>{
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
function showProfile(result,success){
  if(result.token)token=result.token;
  profile=result.profile;pending=null;enrollmentSalt='';$('admin').hidden=true;$('admin').open=false;$('inviteForm').reset();
  $('entry').hidden=true;$('review').hidden=true;$('editor').hidden=false;
  $('teacherCodeDisplay').textContent=profile.code;$('teacherNameDisplay').textContent=profile.fullName;
  const form=$('editForm');Object.keys(labels).forEach(k=>{form.elements[k].value=k==='myNumber'?'':profile[k]||'';});
  form.elements.bankChoice.value=profile.bankCode==='9900'?'yucho':profile.bankCode?'other':'';
  bankUI('edit-',form,false);
  $('edit-myNumberState').textContent=profile.hasMyNumber?'マイナンバー：登録済み（番号は表示しません）':'マイナンバー：未登録';
  $('edit-legacyName').textContent=!profile.surname?'登録済みのお名前：'+profile.fullName+' ／ '+profile.fullKana+'。お名前を修正するときは姓・名を分けて入力してください。':'';
  $('enrollForm').reset();$('loginForm').reset();$('passwordChangeForm').reset();$('passwordChangePanel').open=passwordChangeRequested;notice(success);
}
$('newFields').innerHTML=fieldsHTML('new-');$('editFields').innerHTML=fieldsHTML('edit-');
setupFields('new-',$('enrollForm'));setupFields('edit-',$('editForm'));
['new','login'].forEach(v=>$(v+'Tab').addEventListener('click',()=>{passwordChangeRequested=false;modeChange(v);}));
$('loginForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  notice('ログインしています…');const f=e.target,code=f.elements.teacherCode.value.trim();
  const metadata=await api('Salt',{teacherCode:code});
  const proof=await passwordProof(f.elements.password.value,metadata.salt);
  const result=await api('Login',{teacherCode:code,proof,password:f.elements.password.value});showProfile(result,'ログインしました。銀行口座などを追加入力・修正できます。');
});});
$('enrollForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;if(f.elements.password.value!==f.elements.passwordConfirm.value)throw new Error('確認用パスワードが一致しません。');
  if(f.elements.password.value.length<4)throw new Error('パスワードは4文字以上で設定してください。');
  if(!enrollmentSalt)enrollmentSalt=hex(crypto.getRandomValues(new Uint8Array(16)));
  const fields=mode==='new'?getFields(f,true):{};
  pending={kind:mode,fields,registrationCode:f.elements.registrationCode.value.trim(),salt:enrollmentSalt,proof:await passwordProof(f.elements.password.value,enrollmentSalt)};
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
  const result=editing?await api('Save',{token,fields:pending.fields,revision:pending.revision}):await api('Enroll',{mode:pending.kind,fields:pending.fields,registrationCode:pending.registrationCode,salt:pending.salt,proof:pending.proof});
  showProfile(result,editing?'変更内容を保存しました。':'登録できました。講師番号は '+result.code+' です。今後はこの番号とパスワードでログインしてください。');
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
$('inviteForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const f=e.target;notice('登録コードを発行しています…');
  const login=await post(STAFF_AUTH,{action:'studentQrLogin',code:f.elements.staffCode.value.trim(),password:f.elements.staffPassword.value});
  if(!login.success||!['2','3','4'].includes(String(login.permissionLevel)))throw new Error('スタッフID・パスワードと利用権限を確認してください。');
  const result=await api('Invite',{staffLoginId:String(login.loginId||login.code||f.elements.staffCode.value.trim()),sessionToken:login.sessionToken,teacherCode:f.elements.teacherCode.value.trim()});
  f.elements.staffPassword.value='';$('inviteCode').value=result.registrationCode;$('inviteResult').hidden=false;
  $('invitePurpose').textContent=(result.teacherCode?'講師番号 '+result.teacherCode+' のパスワード設定・再設定用':'新しい講師の初期登録用')+' ／ 有効期限：'+new Date(result.expiresAt).toLocaleString('ja-JP');
  await renderInviteQr(result.registrationCode,result.teacherCode?'setup':'new');
  notice('登録コードとQRを発行しました。講師本人のスマホで読み取ってもらうか、QR画像・登録リンクを本人へ渡してください。');
});});
async function renderInviteQr(code,kind){
  $('inviteQrBox').hidden=true;inviteLink='';
  const link=TeacherInviteLinks.make(code,kind);
  await TeacherRegistrationQR.toCanvas($('inviteQr'),link,{errorCorrectionLevel:'M',margin:4,width:384,color:{dark:'#000000',light:'#ffffff'}});
  inviteLink=link;$('inviteQrBox').hidden=false;
}
$('existingInviteForm').addEventListener('submit',e=>{e.preventDefault();task(async()=>{
  const code=e.target.elements.registrationCode.value.trim(),kind=e.target.elements.mode.value;
  await renderInviteQr(code,kind);
  $('inviteCode').value=code;$('inviteResult').hidden=false;
  $('invitePurpose').textContent='発行済みコードのQRです。新しいコードの発行・有効期限の延長は行いません。';
  notice('QRを表示しました。講師本人のスマホで読み取ってください。');
  $('inviteQrBox').scrollIntoView({behavior:'smooth',block:'center'});
});});
$('copyInviteLink').addEventListener('click',()=>task(async()=>{
  if(!inviteLink)return;await navigator.clipboard.writeText(inviteLink);notice('登録コード入りのリンクをコピーしました。講師本人へ送ってください。');
}));
$('saveInviteQr').addEventListener('click',()=>{
  if(!inviteLink)return;
  const link=document.createElement('a');link.download='STEP-講師登録QR.png';link.href=$('inviteQr').toDataURL('image/png');link.click();
});
$('copyInvite').addEventListener('click',()=>task(async()=>{await navigator.clipboard.writeText($('inviteCode').value);notice('登録コードをコピーしました。');}));
window.addEventListener('pagehide',()=>{token='';profile=null;pending=null;inviteLink='';document.querySelectorAll('form').forEach(f=>f.reset());$('inviteCode').value='';$('inviteQr').getContext('2d').clearRect(0,0,384,384);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
function receiveInvite(){
  const receivedInvite=TeacherInviteLinks.read(location.hash);
  if(location.hash.includes('registrationCode'))history.replaceState(null,'',location.pathname+location.search);
  if(!receivedInvite)return;
  modeChange(receivedInvite.mode);
  $('enrollForm').elements.registrationCode.value=receivedInvite.code;
  notice(receivedInvite.mode==='setup'?'登録コードを読み込みました。ご自分のパスワードを設定してください。':'登録コードを読み込みました。ご自分のパスワードと必要事項を入力してください。');
}
modeChange('new');
receiveInvite();
window.addEventListener('hashchange',receiveInvite);
