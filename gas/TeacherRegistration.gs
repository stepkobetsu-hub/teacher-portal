/**
 * Teacher self-service registration. POST only; never return a roster.
 * Deploy in the QR registration Apps Script alongside AuthCompat.gs.
 * Passwords: browser PBKDF2-SHA256 (600000) then server HMAC-SHA256 pepper.
 * Authentication records and hashed session/invitation tokens: Script Properties.
 * Private profile fields: only the existing teacher master, never logs/properties.
 */
const TR_PREFIX_ = 'TR_V1_';
const TR_BUILD_ = 'teacher-registration-20260924-approval';
const TR_SHEET_ID_ = '1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E';
const TR_TAB_ID_ = 2020620808;
const TR_REQUEST_SHEET_ = '講師登録申請';
const TR_DEFAULT_NOTIFICATION_RECIPIENTS_ = ['mintcocoajasmine@gmail.com','admin@educrest.jp'];

function trError_(message) { const e=new Error(message); e.trUser=true; throw e; }
function trProps_(){return PropertiesService.getScriptProperties();}
function trHash_(text){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function trRandom_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function trRead_(key){const text=trProps_().getProperty(TR_PREFIX_+key);return text?JSON.parse(text):null;}
function trWrite_(key,value){trProps_().setProperty(TR_PREFIX_+key,JSON.stringify(value));}
function trRemove_(key){trProps_().deleteProperty(TR_PREFIX_+key);}
function trNotificationRecipients_(){
  const saved=trRead_('NOTIFICATION_RECIPIENTS');
  return Array.isArray(saved)&&saved.length?saved.slice(0,3):TR_DEFAULT_NOTIFICATION_RECIPIENTS_.slice();
}
function trValidateNotificationRecipients_(values){
  if(!Array.isArray(values))trError_('送信先メールアドレスを確認してください。');
  const recipients=[];
  values.forEach(function(value){
    const email=trText_(String(value||''),200,'送信先メールアドレス').toLowerCase();
    if(!email)return;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))trError_('送信先メールアドレスを確認してください。');
    if(recipients.indexOf(email)<0)recipients.push(email);
  });
  if(recipients.length<1||recipients.length>3)trError_('送信先は1～3件で設定してください。');
  return recipients;
}
function trNotificationSettings_(body,save){
  if(save){const recipients=trValidateNotificationRecipients_(body.recipients);trWrite_('NOTIFICATION_RECIPIENTS',recipients);return {ok:true,recipients:recipients};}
  return {ok:true,recipients:trNotificationRecipients_()};
}
function trSendConfirmation_(profile,kind){
  if(!profile||!profile.email)return '';
  const recipients=[String(profile.email).trim()].concat(trNotificationRecipients_()).filter(function(email,index,all){return email&&all.indexOf(email)===index;});
  const action=kind==='new'?'初期登録':kind==='setup'?'パスワード設定・再設定':kind==='password'?'パスワード変更':'登録情報の変更';
  const subject='【個別指導STEP】講師'+action+'の確認';
  const base=String(profile.fullName||'講師')+' 先生\n\n講師'+action+'を受け付けました。\n講師番号：'+String(profile.code||'');
  const adminNote=kind==='new'?'\n\n管理者の方へ：講師マスターD列には在籍者を示す1を自動入力しました。B列・C列・L列・P列とQ列（QRコード）、AJ列（初期パスワード）も登録済みです。必要に応じてQ列・AJ列は直接上書きできます。':'';
  const footer='\n\n※銀行口座・マイナンバー等の登録内容は、安全のためメールには記載していません。\n個別指導STEP';
  try{recipients.forEach(function(to){MailApp.sendEmail({to:to,subject:subject,body:base+(to===String(profile.email).trim()?'':adminNote)+footer,name:'個別指導STEP'});});return '';}
  catch(e){return '登録内容は保存しましたが、確認メールの一部を送信できませんでした。教室へお知らせください。';}
}
function trEqual_(a,b){a=String(a||'');b=String(b||'');let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function trVerifier_(proof,salt){
  let pepper=trProps_().getProperty(TR_PREFIX_+'PEPPER');
  if(!pepper){pepper=trRandom_();trProps_().setProperty(TR_PREFIX_+'PEPPER',pepper);}
  return Utilities.computeHmacSha256Signature(salt+':'+proof,pepper,Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function trCode_(v){const code=String(v||'').trim();if(!/^7\d{3}$/.test(code))trError_('講師番号は7000番台の4桁で入力してください。');return code;}
function trSheet_(){
  const sheet=SpreadsheetApp.openById(TR_SHEET_ID_).getSheetByName('講師マスター');
  if(!sheet||sheet.getSheetId()!==TR_TAB_ID_)throw new Error('Teacher master mismatch');
  const h=sheet.getRange(4,1,1,16).getDisplayValues()[0];
  if(h[0]!=='コード'||h[1]!=='氏名'||h[11]!=='生年月日'||h[15]!=='メールアドレス')throw new Error('Teacher master headers changed');
  return sheet;
}
function trRequestSheet_(){
  const book=SpreadsheetApp.openById(TR_SHEET_ID_);
  let sheet=book.getSheetByName(TR_REQUEST_SHEET_);
  if(!sheet){
    sheet=book.insertSheet(TR_REQUEST_SHEET_);
    sheet.getRange(1,1,1,10).setValues([['申請ID','申請日時','姓','名','フリガナ（姓）','フリガナ（名）','生年月日','メールアドレス','状態','講師番号']]);
    sheet.hideSheet();
  }
  if(sheet.getRange(1,1).getDisplayValue()!=='申請ID')throw new Error('Teacher request headers changed');
  return sheet;
}
function trRows_(sheet){const n=Math.max(0,sheet.getLastRow()-4);return n?sheet.getRange(5,1,n,1).getDisplayValues():[];}
function trFind_(sheet,code){
  const rows=trRows_(sheet);let found=0;
  rows.forEach(function(r,i){if(String(r[0]).trim()===code){if(found)throw new Error('Duplicate teacher code');found=i+5;}});
  if(!found)trError_('講師情報を確認できません。教室へお問い合わせください。');
  return found;
}
function trCleanup_(){
  const p=trProps_(),all=p.getProperties(),now=Date.now();
  Object.keys(all).forEach(function(k){
    if(!/^TR_V1_(SESSION_|INVITE_|RATE_)/.test(k))return;
    try{if(JSON.parse(all[k]).expires<now)p.deleteProperty(k);}catch(e){}
  });
}
function trRate_(key,limit,windowMs){
  const now=Date.now();let r=trRead_('RATE_'+key);
  if(!r||r.expires<now)r={count:0,expires:now+windowMs};
  r.count++;trWrite_('RATE_'+key,r);
  if(r.count>limit)trError_('試行回数が多いため、しばらく待ってからもう一度お試しください。');
}
function trNewSession_(code){
  const token=trRandom_();const account=trRead_('ACCOUNT_'+code);
  trWrite_('SESSION_'+trHash_(token),{code:code,version:account.version,expires:Date.now()+60*60*1000});
  return token;
}
function trSession_(body){
  const token=String(body.token||'');
  if(!/^[a-f0-9]{64}$/.test(token))trError_('ログインしてください。');
  const record=trRead_('SESSION_'+trHash_(token));
  if(!record||record.expires<Date.now())trError_('ログインの有効期限が切れました。もう一度ログインしてください。');
  const account=trRead_('ACCOUNT_'+record.code);
  if(!account||account.version!==record.version)trError_('もう一度ログインしてください。');
  return record;
}
function trText_(value,max,label){
  if(typeof value!=='string')trError_(label+'を確認してください。');
  const v=value.normalize('NFKC').trim();
  if(v.length>max||/[\u0000-\u001f\u007f]/.test(v))trError_(label+'を確認してください。');
  // Reject formula-leading text instead of allowing setValues to execute it.
  if(/^[=+@]/.test(v))trError_(label+'の先頭文字を確認してください。');
  return v;
}
function trDigits_(v,min,max,label){
  const text=trText_(v,80,label).replace(/[\s-]/g,'');
  if(text&&!new RegExp('^\\d{'+min+','+max+'}$').test(text))trError_(label+'の桁数を確認してください。');
  return text;
}
function trDate_(value){
  if(!value)return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))trError_('生年月日を確認してください。');
  const d=new Date(value+'T00:00:00+09:00');
  if(isNaN(d.getTime())||Utilities.formatDate(d,'Asia/Tokyo','yyyy-MM-dd')!==value||value>Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd')||value<'1900-01-01')trError_('生年月日を確認してください。');
  return d;
}
function trFields_(raw,isNew,current){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))trError_('入力内容を確認してください。');
  const allowed=['surname','givenName','surnameKana','givenNameKana','postalCode','address','bankCode','branchCode','accountType','accountNumber','birthDate','myNumber','email'];
  if(Object.keys(raw).some(k=>allowed.indexOf(k)<0))trError_('変更できない項目が含まれています。');
  const out={};
  allowed.forEach(function(key){if(Object.prototype.hasOwnProperty.call(raw,key))out[key]=trText_(raw[key],key==='address'?300:100,key);});
  ['surname','givenName','surnameKana','givenNameKana'].forEach(function(key){
    if((isNew||key in out)&&!out[key])trError_('氏名とフリガナは姓・名を分けて入力してください。');
    if(key in out&&/\s/.test(out[key]))trError_('姓と名は別々の欄に入力してください。');
  });
  if(('surname' in out)!==('givenName' in out)||('surnameKana' in out)!==('givenNameKana' in out))trError_('姓と名を両方入力してください。');
  ['surnameKana','givenNameKana'].forEach(function(k){
    if(k in out){out[k]=out[k].replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
      if(!/^[ァ-ヺー・]+$/.test(out[k]))trError_('フリガナはカタカナで入力してください。');}
  });
  if('postalCode' in out)out.postalCode=trDigits_(out.postalCode,7,7,'郵便番号');
  if('bankCode' in out)out.bankCode=trDigits_(out.bankCode,4,4,'銀行コード');
  const bank=('bankCode' in out)?out.bankCode:String((current&&current[7])||'').padStart(4,'0');
  if('branchCode' in out)out.branchCode=trDigits_(out.branchCode,bank==='9900'?5:3,bank==='9900'?5:3,bank==='9900'?'ゆうちょの記号':'支店コード');
  if('accountNumber' in out)out.accountNumber=trDigits_(out.accountNumber,1,bank==='9900'?8:7,'口座番号');
  if('accountType' in out&&out.accountType&&!['普通','当座','貯蓄'].includes(out.accountType))trError_('口座種別を確認してください。');
  if(bank==='9900'&&['bankCode','branchCode','accountType','accountNumber'].some(k=>k in out))out.accountType='';
  if('bankCode' in out&&current&&out.bankCode!==String(current[7]||'').padStart(4,'0')&&(!('branchCode' in out)||!('accountNumber' in out)||!('accountType' in out)))trError_('銀行を変更するときは支店・種別・口座番号も入力してください。');
  if('birthDate' in out)out.birthDate=trDate_(out.birthDate);
  if('myNumber' in out)out.myNumber=trDigits_(out.myNumber,12,12,'マイナンバー');
  if(isNew&&!out.email)trError_('メールアドレスを入力してください。');
  if('email' in out&&(!out.email||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)))trError_('メールアドレスを確認してください。');
  return out;
}
function trProfile_(sheet,row){
  const r=sheet.getRange(row,1,1,16).getValues()[0];
  const split=s=>{const p=String(s||'').trim().split(/[\s　]+/);return p.length>1?[p.shift(),p.join(' ')]:['',''];};
  const name=split(r[1]),kana=split(r[2]);
  return {code:String(r[0]),fullName:String(r[1]||''),fullKana:String(r[2]||''),surname:name[0],givenName:name[1],surnameKana:kana[0],givenNameKana:kana[1],
    postalCode:String(r[4]||''),address:String(r[5]||''),bankCode:r[7]!==''?String(r[7]).padStart(4,'0'):'',
    branchCode:r[8]!==''?String(r[8]).padStart(String(r[7])==='9900'?5:3,'0'):'',accountType:String(r[9]||''),accountNumber:String(r[10]||''),
    birthDate:r[11] instanceof Date?Utilities.formatDate(r[11],'Asia/Tokyo','yyyy-MM-dd'):'',
    hasMyNumber:!!r[14],email:String(r[15]||''),revision:trVerifier_(JSON.stringify(r),'profile-revision')};
}
function trApply_(row,fields,rowNumber,isNew,code){
  const r=row.slice();
  if(isNew){r[0]=Number(code);r[3]=1;}
  if('surname' in fields)r[1]=fields.surname+' '+fields.givenName;
  if('surnameKana' in fields)r[2]=fields.surnameKana+' '+fields.givenNameKana;
  const mapping={postalCode:4,address:5,bankCode:7,branchCode:8,accountType:9,accountNumber:10,birthDate:11,myNumber:14,email:15};
  Object.keys(mapping).forEach(k=>{if(k in fields)r[mapping[k]]=fields[k];});
  if(isNew||'birthDate' in fields)r[12]='=IF(L'+rowNumber+'="","-",DATEDIF(L'+rowNumber+',$M$3,"Y")&"才"&DATEDIF(L'+rowNumber+',$M$3,"YM")&"ヶ月")';
  return r;
}
function trWriteRow_(sheet,row,values){
  // Text formats retain postal/bank/account/My Number leading zeroes.
  [5,8,9,10,11,15,16].forEach(c=>sheet.getRange(row,c).setNumberFormat('@'));
  sheet.getRange(row,7).setNumberFormat('yyyy/m/d');
  sheet.getRange(row,12).setNumberFormat('yyyy/m/d');
  sheet.getRange(row,1,1,16).setValues([values]);
  SpreadsheetApp.flush();
}
function trInitializeAccess_(sheet,row,code,birthDate){
  // Fill only empty cells: later manual overrides in Q/AJ must survive retries.
  const qr=sheet.getRange(row,17),password=sheet.getRange(row,36);
  if(qr.isBlank())qr.setValue('STEP-'+code);
  if(password.isBlank()){
    password.setNumberFormat('@');
    const date=Utilities.formatDate(birthDate,'Asia/Tokyo','MMdd');
    password.setValue("'"+date);
  }
}
function trInvite_(body,staff){
  const code=body.teacherCode?trCode_(body.teacherCode):'';
  if(code)trFind_(trSheet_(),code);
  const raw=trRandom_(),key='INVITE_'+trHash_(raw);
  trWrite_(key,{code:code,expires:Date.now()+7*24*60*60*1000,createdBy:String(staff.loginId||staff.code||'')});
  return {ok:true,registrationCode:raw,teacherCode:code,expiresAt:new Date(Date.now()+7*24*60*60*1000).toISOString()};
}
function trSubmitRequest_(body){
  const fields=trFields_(body.fields,true,null);
  if(Object.keys(fields).sort().join(',')!==['surname','givenName','surnameKana','givenNameKana','birthDate','email'].sort().join(',')||!fields.birthDate)trError_('初回登録はお名前・フリガナ・生年月日・メールアドレスを入力してください。');
  const salt=String(body.salt||''),proof=String(body.proof||'');
  if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(proof))trError_('入力内容を確認して再送してください。');
  trRate_('REQUEST_ALL',25,24*60*60*1000);
  const email=fields.email.toLowerCase(),emailKey='PENDING_EMAIL_'+trHash_(email);
  const previous=trRead_(emailKey);
  if(previous){
    const request=trRead_('REQUEST_'+previous.tokenHash);
    if(request&&request.expires>Date.now()&&trEqual_(request.proof,proof)&&trEqual_(request.salt,salt))return {ok:true,pending:true,replayed:true};
    if(request&&request.expires>Date.now())trError_('このメールアドレスの申請は確認中です。教室へお問い合わせください。');
    trRemove_(emailKey);
  }
  const master=trSheet_(),existing=master.getRange(5,16,Math.max(1,master.getLastRow()-4),1).getDisplayValues();
  if(existing.some(r=>String(r[0]).trim().toLowerCase()===email))trError_('このメールアドレスは登録済みです。教室へお問い合わせください。');
  const sheet=trRequestSheet_(),raw=trRandom_(),tokenHash=trHash_(raw),row=sheet.getLastRow()+1;
  sheet.getRange(row,1,1,10).setValues([[tokenHash,new Date(),fields.surname,fields.givenName,fields.surnameKana,fields.givenNameKana,Utilities.formatDate(fields.birthDate,'Asia/Tokyo','yyyy-MM-dd'),fields.email,'確認待ち','']]);
  trWrite_('REQUEST_'+tokenHash,{row:row,salt:salt,proof:proof,expires:Date.now()+30*24*60*60*1000});
  trWrite_(emailKey,{tokenHash:tokenHash});
  const link='https://stepkobetsu-hub.github.io/teacher-portal/registration.html#approval='+raw;
  const subject='【個別指導STEP】講師の初回登録申請';
  const message='講師の初回登録申請が届きました。\n管理者の方は以下のリンクを開き、スタッフIDとパスワードで認証して内容を確認してください。\n承認ボタンを押すまで講師マスターには登録されません。\n\n'+link+'\n\n有効期限：30日。申請内容・生年月日はメールには記載していません。';
  let notificationWarning='';
  try{trNotificationRecipients_().forEach(to=>MailApp.sendEmail({to:to,subject:subject,body:message,name:'個別指導STEP'}));}
  catch(e){notificationWarning='申請は保存しましたが、管理者へのメールを送信できませんでした。教室へ直接連絡してください。';}
  return {ok:true,pending:true,notificationWarning:notificationWarning};
}
function trApprovalRequest_(body){
  const raw=String(body.approvalToken||'');
  if(!/^[a-f0-9]{64}$/.test(raw))trError_('申請リンクを確認してください。');
  const tokenHash=trHash_(raw),request=trRead_('REQUEST_'+tokenHash);
  if(!request||request.expires<Date.now())trError_('申請が見つからないか、期限が切れています。');
  const sheet=trRequestSheet_(),values=sheet.getRange(request.row,1,1,10).getValues()[0];
  if(values[0]!==tokenHash)throw new Error('Teacher request row mismatch');
  return {tokenHash:tokenHash,request:request,sheet:sheet,values:values};
}
function trApprovalPreview_(body){
  const item=trApprovalRequest_(body),v=item.values;
  return {ok:true,status:String(v[8]),code:String(v[9]||''),applicant:{surname:String(v[2]),givenName:String(v[3]),surnameKana:String(v[4]),givenNameKana:String(v[5]),birthDate:String(v[6]),email:String(v[7])}};
}
function trApproveRequest_(body){
  const item=trApprovalRequest_(body),v=item.values,request=item.request;
  if(v[8]==='承認済み')return {ok:true,code:String(v[9]),replayed:true};
  if(v[8]!=='確認待ち')trError_('この申請は承認できません。');
  if(!request.invite){
    const master=trSheet_(),existing=master.getRange(5,16,Math.max(1,master.getLastRow()-4),1).getDisplayValues();
    if(existing.some(r=>String(r[0]).trim().toLowerCase()===String(v[7]).trim().toLowerCase()))trError_('このメールアドレスはすでに講師マスターへ登録されています。');
    request.invite=trRandom_();
    trWrite_('REQUEST_'+item.tokenHash,request);
    trWrite_('INVITE_'+trHash_(request.invite),{code:'',expires:request.expires,createdBy:'approved-request'});
  }
  const fields={surname:String(v[2]),givenName:String(v[3]),surnameKana:String(v[4]),givenNameKana:String(v[5]),birthDate:String(v[6]),email:String(v[7])};
  const result=trEnroll_({mode:'new',registrationCode:request.invite,salt:request.salt,proof:request.proof,fields:fields});
  if(result.token)trRemove_('SESSION_'+trHash_(result.token));
  item.sheet.getRange(request.row,9,1,2).setValues([['承認済み',result.code]]);
  trRemove_('PENDING_EMAIL_'+trHash_(fields.email.toLowerCase()));
  return {ok:true,code:result.code,notificationWarning:result.notificationWarning};
}
function trEnroll_(body){
  const invite=String(body.registrationCode||'').trim(),salt=String(body.salt||''),proof=String(body.proof||'');
  if(!/^[a-f0-9]{64}$/.test(invite))trError_('登録コードを確認してください。');
  if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(proof))trError_('パスワードを設定し直してください。');
  const key='INVITE_'+trHash_(invite),record=trRead_(key);
  if(!record||record.expires<Date.now())trError_('登録情報を確認できません。教室へお問い合わせください。');
  if(!record.used&&!record.pending&&((body.mode==='new'&&record.code)||(body.mode!=='new'&&!record.code)))trError_('登録コードの用途が異なります。新規登録／パスワード設定・再設定の選択を確認してください。');
  const sheet=trSheet_();
  // A retry is only accepted with the exact original credential, never as a reset.
  if(record.used){
    const a=trRead_('ACCOUNT_'+record.code);
    if(!a||!trEqual_(a.salt,salt)||!trEqual_(a.verifier,trVerifier_(proof,salt)))trError_('この登録コードは使用済みです。');
    return {ok:true,code:record.code,token:trNewSession_(record.code),profile:trProfile_(sheet,trFind_(sheet,record.code)),replayed:true};
  }
  let code=record.code,row;
  const fields=(!code||record.pending)?trFields_(body.fields,true,null):null;
  if(record.pending){
    if(!trEqual_(record.salt,salt)||!trEqual_(record.verifier,trVerifier_(proof,salt))||!trEqual_(record.fieldsHash,trHash_(JSON.stringify(fields))))trError_('途中の登録内容と一致しません。同じ内容で再送してください。');
    row=record.row;
    const existing=sheet.getRange(row,1,1,17).getValues()[0];
    if(existing.every(v=>v===''))trWriteRow_(sheet,row,trApply_(Array(16).fill(''),fields,row,true,code));
    else if(String(existing[0])!==code||existing[1]!==fields.surname+' '+fields.givenName||existing[15]!==fields.email)trError_('登録先が変更されました。教室へお問い合わせください。');
    if(body.mode==='new')trInitializeAccess_(sheet,row,code,fields.birthDate);
  }
  else if(code){row=trFind_(sheet,code);}
  else{
    const codes=trRows_(sheet);let max=7000,last=4;
    codes.forEach((r,i)=>{if(/^7\d{3}$/.test(String(r[0]).trim())){max=Math.max(max,Number(r[0]));last=i+5;}});
    max=Math.max(max,Number(trProps_().getProperty(TR_PREFIX_+'SEQUENCE')||7000));
    if(max>=7999)trError_('講師番号の採番範囲を超えました。管理者へお問い合わせください。');
    code=String(max+1);row=last+1;
    const reservedRows=Object.entries(trProps_().getProperties()).filter(([k])=>k.indexOf(TR_PREFIX_+'INVITE_')===0).map(([,v])=>JSON.parse(v)).filter(v=>v.pending).map(v=>v.row);
    // Refuse to overwrite a manually entered or formula-filled row.
    while(row<=sheet.getMaxRows()){
      const range=sheet.getRange(row,1,1,17);
      if(reservedRows.indexOf(row)<0&&range.getValues()[0].every(v=>v==='')&&range.getFormulas()[0].every(v=>v===''))break;
      row++;
    }
    if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
    const values=trApply_(Array(16).fill(''),fields,row,true,code);
    // Reservation lets retry recover after a sheet write but before account commit.
    record.code=code;record.row=row;record.pending=true;record.salt=salt;record.verifier=trVerifier_(proof,salt);record.fieldsHash=trHash_(JSON.stringify(fields));
    trProps_().setProperty(TR_PREFIX_+'SEQUENCE',code);
    trWrite_(key,record);
    trWriteRow_(sheet,row,values);
    if(body.mode==='new')trInitializeAccess_(sheet,row,code,fields.birthDate);
  }
  const old=trRead_('ACCOUNT_'+code);
  trWrite_('ACCOUNT_'+code,{salt:salt,verifier:trVerifier_(proof,salt),version:(old?old.version:0)+1});
  trWrite_(key,{code:code,used:true,expires:record.expires});
  const profile=trProfile_(sheet,row),notificationWarning=trSendConfirmation_(profile,body.mode==='new'?'new':'setup');
  return {ok:true,code:code,token:trNewSession_(code),profile:profile,notificationWarning:notificationWarning};
}
function trLogin_(body){
  const code=trCode_(body.teacherCode);
  trRate_('LOGIN_'+code,10,15*60*1000);
  const sheet=trSheet_(),row=trFind_(sheet,code);
  let a=trRead_('ACCOUNT_'+code);
  let masterPassword=String(sheet.getRange(row,36).getDisplayValues()[0][0]||'').trim();
  if(/^\d{1,3}$/.test(masterPassword))masterPassword=masterPassword.padStart(4,'0');
  if(masterPassword){
    if(typeof body.password!=='string'||!body.password||body.password.length>128||!trEqual_(masterPassword,body.password))trError_('講師番号またはパスワードを確認してください。');
    if(!a){a={version:1,salt:trHash_('teacher-registration-dummy:'+code).slice(0,32)};trWrite_('ACCOUNT_'+code,a);}
  }else if(!a||!a.verifier||!trEqual_(a.verifier,trVerifier_(String(body.proof||''),a.salt))){
    trError_('講師番号またはパスワードを確認してください。');
  }
  trRemove_('RATE_LOGIN_'+code);
  return {ok:true,code:code,token:trNewSession_(code),profile:trProfile_(sheet,row)};
}
function trSave_(body){
  const session=trSession_(body),sheet=trSheet_(),row=trFind_(sheet,session.code);
  const before=trProfile_(sheet,row);
  if(!trEqual_(before.revision,String(body.revision||'')))trError_('別の画面で情報が更新されました。再ログインして最新情報を読み込んでください。');
  const range=sheet.getRange(row,1,1,16),values=range.getValues()[0],formulas=range.getFormulas()[0];
  const fields=trFields_(body.fields,false,values);
  if(!Object.keys(fields).length)return {ok:true,code:session.code,profile:before};
  const original=values.map((v,i)=>formulas[i]||v);
  trWriteRow_(sheet,row,trApply_(original,fields,row,false,session.code));
  const profile=trProfile_(sheet,row),notificationWarning=trSendConfirmation_(profile,'edit');
  return {ok:true,code:session.code,profile:profile,notificationWarning:notificationWarning};
}
function trChangePassword_(body){
  const session=trSession_(body);
  trRate_('PASSWORD_'+session.code,10,15*60*1000);
  const sheet=trSheet_(),row=trFind_(sheet,session.code),a=trRead_('ACCOUNT_'+session.code);
  let current=String(sheet.getRange(row,36).getDisplayValues()[0][0]||'').trim();
  if(/^\d{1,3}$/.test(current))current=current.padStart(4,'0');
  if(current){
    if(typeof body.currentPassword!=='string'||!trEqual_(current,body.currentPassword))trError_('現在のパスワードを確認してください。');
  }else if(!a||!a.verifier||!trEqual_(a.verifier,trVerifier_(String(body.currentProof||''),a.salt))){
    trError_('現在のパスワードを確認してください。');
  }
  const next=body.newPassword;
  if(typeof next!=='string'||next.length<4||next.length>128||next!==next.trim()||/[\u0000-\u001f\u007f]/.test(next))trError_('新しいパスワードは前後の空白を入れず、4文字以上128文字以内で設定してください。');
  // Invalidate existing registration sessions before writing; keep old verifier for recovery if the sheet write fails.
  trWrite_('ACCOUNT_'+session.code,Object.assign({},a,{version:a.version+1}));
  // A leading apostrophe stores literal text, including zeros and formula-like characters.
  sheet.getRange(row,36).setNumberFormat('@');
  sheet.getRange(row,36).setValues([["'"+next]]);
  SpreadsheetApp.flush();
  trRemove_('RATE_PASSWORD_'+session.code);
  const profile=trProfile_(sheet,row),notificationWarning=trSendConfirmation_(profile,'password');
  return {ok:true,code:session.code,notificationWarning:notificationWarning};
}
function handleTeacherRegistration_(body){
  let lock;
  try{
    const action=String(body.action||'');
    if(action==='teacherRegistrationHealth')return {ok:true,build:TR_BUILD_,authentication:'teacher-code-password',registration:'admin-approval'};
    let staff;
    if(['teacherRegistrationInvite','teacherRegistrationNotificationSettingsGet','teacherRegistrationNotificationSettingsSave','teacherRegistrationApprovalPreview','teacherRegistrationApproveRequest'].includes(action))staff=requireQrStaffSession_(body);
    lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))trError_('ただいま処理中です。少し待ってから再度お試しください。');
    trCleanup_();
    if(action==='teacherRegistrationInvite')return trInvite_(body,staff);
    if(action==='teacherRegistrationNotificationSettingsGet')return trNotificationSettings_(body,false);
    if(action==='teacherRegistrationNotificationSettingsSave')return trNotificationSettings_(body,true);
    if(action==='teacherRegistrationSubmitRequest')return trSubmitRequest_(body);
    if(action==='teacherRegistrationApprovalPreview')return trApprovalPreview_(body);
    if(action==='teacherRegistrationApproveRequest')return trApproveRequest_(body);
    if(action==='teacherRegistrationSalt'){
      const code=trCode_(body.teacherCode),a=trRead_('ACCOUNT_'+code);
      return {ok:true,salt:a?a.salt:trHash_('teacher-registration-dummy:'+code).slice(0,32),iterations:600000};
    }
    if(action==='teacherRegistrationEnroll')return trEnroll_(body);
    if(action==='teacherRegistrationLogin')return trLogin_(body);
    if(action==='teacherRegistrationSave')return trSave_(body);
    if(action==='teacherRegistrationChangePassword')return trChangePassword_(body);
    if(action==='teacherRegistrationProfile'){const s=trSession_(body),sheet=trSheet_();return {ok:true,profile:trProfile_(sheet,trFind_(sheet,s.code))};}
    if(action==='teacherRegistrationLogout'){const token=String(body.token||'');if(/^[a-f0-9]{64}$/.test(token))trRemove_('SESSION_'+trHash_(token));return {ok:true};}
    trError_('不明な操作です。');
  }catch(e){
    // Do not log the request or exception: profile data never belongs in logs.
    return {ok:false,message:e.trUser?e.message:'保存できませんでした。少し待ってから再度お試しください。'};
  }finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
