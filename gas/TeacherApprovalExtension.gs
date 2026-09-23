/**
 * Add this as a separate file to the existing QR registration Apps Script.
 * The doPost registration dispatcher must route SubmitRequest, ApprovalPreview,
 * and ApproveRequest here after requireQrStaffSession_ for the latter two.
 * Do not replace the live teacher registration/audit wrappers.
 */
const TA_REQUEST_SHEET_ = '講師登録申請';

function taBirthDate_(value){
  const date=value instanceof Date?Utilities.formatDate(value,'Asia/Tokyo','yyyy-MM-dd'):String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))trError_('生年月日を確認してください。');
  return date;
}

function taRequestSheet_(){
  const book=SpreadsheetApp.openById(TR_SHEET_ID_);
  let sheet=book.getSheetByName(TA_REQUEST_SHEET_);
  if(!sheet){
    sheet=book.insertSheet(TA_REQUEST_SHEET_);
    sheet.getRange(1,1,1,10).setValues([['申請ID','申請日時','姓','名','フリガナ（姓）','フリガナ（名）','生年月日','メールアドレス','状態','講師番号']]);
    sheet.hideSheet();
  }
  if(sheet.getRange(1,1).getDisplayValue()!=='申請ID')throw new Error('Teacher request headers changed');
  return sheet;
}

function taSubmitRequest_(body){
  const fields=trFields_(body.fields,true,null);
  const required=['surname','givenName','surnameKana','givenNameKana','birthDate','email'];
  if(Object.keys(fields).sort().join(',')!==required.sort().join(',')||!fields.birthDate)trError_('初回登録はお名前・フリガナ・生年月日・メールアドレスを入力してください。');
  const salt=String(body.salt||''),proof=String(body.proof||'');
  if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(proof))trError_('入力内容を確認して再送してください。');
  trRate_('REQUEST_ALL',25,24*60*60*1000);
  const email=fields.email.toLowerCase(),emailKey='PENDING_EMAIL_'+trHash_(email);
  const previous=trRead_(emailKey);
  if(previous){
    const request=trRead_('REQUEST_'+previous.tokenHash);
    if(request&&request.expires>Date.now()&&request.proof===proof&&request.salt===salt)return {ok:true,pending:true,replayed:true};
    if(request&&request.expires>Date.now())trError_('このメールアドレスは申請済みです。先に届いた管理者向けメールの承認リンクから手続きを続けてください。再登録は不要です。');
    trRemove_(emailKey);
  }
  const master=trSheet_(),existing=master.getRange(5,16,Math.max(1,master.getLastRow()-4),1).getDisplayValues();
  if(existing.some(r=>String(r[0]).trim().toLowerCase()===email))trError_('このメールアドレスは登録済みです。教室へお問い合わせください。');
  const sheet=taRequestSheet_(),raw=trRandom_(),tokenHash=trHash_(raw),row=sheet.getLastRow()+1;
  sheet.getRange(row,7).setNumberFormat('@');
  sheet.getRange(row,1,1,10).setValues([[tokenHash,new Date(),fields.surname,fields.givenName,fields.surnameKana,fields.givenNameKana,Utilities.formatDate(fields.birthDate,'Asia/Tokyo','yyyy-MM-dd'),fields.email,'確認待ち','']]);
  trWrite_('REQUEST_'+tokenHash,{row:row,salt:salt,proof:proof,expires:Date.now()+30*24*60*60*1000});
  trWrite_(emailKey,{tokenHash:tokenHash});
  const link='https://stepkobetsu-hub.github.io/teacher-portal/registration.html#approval='+raw;
  const message='講師の初回登録申請が届きました。\n氏名：'+fields.surname+' '+fields.givenName+'\nフリガナ：'+fields.surnameKana+' '+fields.givenNameKana+'\n生年月日：'+Utilities.formatDate(fields.birthDate,'Asia/Tokyo','yyyy/MM/dd')+'\nメールアドレス：'+fields.email+'\n\nリンクを開き、スタッフIDとパスワードで認証して内容を確認してください。\n承認するまで講師マスターには登録されません。\n\n'+link+'\n\nリンクの有効期限：30日。';
  let notificationWarning='';
  try{trAuditSendOne_(trAuditRecipients_(),'【個別指導STEP】講師の初回登録申請',message);}
  catch(e){notificationWarning='申請は保存しましたが、管理者へのメールを送信できませんでした。教室へ直接連絡してください。';}
  return {ok:true,pending:true,notificationWarning:notificationWarning};
}

function taRequest_(body){
  const raw=String(body.approvalToken||'');
  if(!/^[a-f0-9]{64}$/.test(raw))trError_('申請リンクを確認してください。');
  const tokenHash=trHash_(raw),request=trRead_('REQUEST_'+tokenHash);
  if(!request||request.expires<Date.now())trError_('申請が見つからないか、期限が切れています。');
  const sheet=taRequestSheet_(),values=sheet.getRange(request.row,1,1,10).getValues()[0];
  if(values[0]!==tokenHash)throw new Error('Teacher request row mismatch');
  return {tokenHash:tokenHash,request:request,sheet:sheet,values:values};
}
function taRequireAdmin_(staff){
  if(String(staff&&staff.permissionLevel)!=='2')trError_('管理者権限のスタッフIDでログインしてください。');
}

function taApprovalPreview_(body,staff){
  taRequireAdmin_(staff);
  const item=taRequest_(body),v=item.values;
  return {ok:true,status:String(v[8]),code:String(v[9]||''),applicant:{surname:String(v[2]),givenName:String(v[3]),surnameKana:String(v[4]),givenNameKana:String(v[5]),birthDate:taBirthDate_(v[6]).replace(/-/g,'/'),email:String(v[7])}};
}

function taApproveRequest_(body,staff){
  taRequireAdmin_(staff);
  const item=taRequest_(body),v=item.values,request=item.request;
  if(v[8]==='承認済み')return {ok:true,code:String(v[9]),replayed:true};
  if(v[8]!=='確認待ち')trError_('この申請は承認できません。');
  if(!request.invite){
    const master=trSheet_(),emails=master.getRange(5,16,Math.max(1,master.getLastRow()-4),1).getDisplayValues();
    if(emails.some(r=>String(r[0]).trim().toLowerCase()===String(v[7]).trim().toLowerCase()))trError_('このメールアドレスはすでに講師マスターへ登録されています。');
    request.invite=trRandom_();
    trWrite_('REQUEST_'+item.tokenHash,request);
    trWrite_('INVITE_'+trHash_(request.invite),{code:'',expires:request.expires,createdBy:'approved-request'});
  }
  const fields={surname:String(v[2]),givenName:String(v[3]),surnameKana:String(v[4]),givenNameKana:String(v[5]),birthDate:taBirthDate_(v[6]),email:String(v[7])};
  const result=trEnrollCore_({mode:'new',registrationCode:request.invite,salt:request.salt,proof:request.proof,fields:fields});
  if(result.token)trRemove_('SESSION_'+trHash_(result.token));
  const master=trSheet_(),masterRow=trFind_(master,result.code),password=master.getRange(masterRow,36);
  if(password.isBlank()){
    password.setNumberFormat('@');password.setValues([["'"+fields.birthDate.slice(5,7)+fields.birthDate.slice(8,10)]]);
  }
  SpreadsheetApp.flush();
  item.sheet.getRange(request.row,9,1,2).setValues([['承認済み',result.code]]);
  trRemove_('PENDING_EMAIL_'+trHash_(fields.email.toLowerCase()));
  const subject='【個別指導STEP】講師登録が完了しました';
  const base=fields.surname+' '+fields.givenName+' 先生\n\n講師登録を承認しました。\n\n講師番号（講師ID）：'+result.code+'\n\nこの講師番号が、今後の講師ポータルへのログインに使う講師IDになります。\n\n初期パスワードは、生年月日の「月日」を数字4桁にしたものです。\n例：5月6日生まれの場合 → 0506\n';
  let notificationWarning='';
  try{
    trAuditSendOne_([fields.email],subject,base+'\n住所・口座情報・マイナンバーの追加・変更はこちらから行えます。\nhttps://stepkobetsu-hub.github.io/teacher-portal/registration.html');
    trAuditSendOne_(trAuditRecipients_(),subject,base+'\n講師マスターD列には在籍者を示す1を自動入力しました。Q列・AJ列は後から上書きできます。');
  }catch(e){notificationWarning='登録は完了しましたが、確認メールの一部を送信できませんでした。';}
  return {ok:true,code:result.code,notificationWarning:notificationWarning};
}
