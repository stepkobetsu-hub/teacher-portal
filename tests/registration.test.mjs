import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../gas/TeacherRegistration.gs',import.meta.url),'utf8');
const rows=Array.from({length:102},()=>Array(17).fill(''));
rows[3]=['コード','氏名','よみ','在籍','〒','住所','雇い入れ日','銀行','記号（支店）','種別','口座番号','生年月日','年齢','扶養控除申告','マイナンバー','メールアドレス',''];
rows[94]=[7092,'既存 講師','キゾン コウシ',1,'0012345','既存住所','2020/1/1','0001','002','普通','0012345',new Date('2000-01-01T00:00:00+09:00'),'=AGE','existing-N','012345678901','existing@example.invalid','existing-qr'];
const properties=new Map(),sentMail=[];let locked=false,failNextWrite=false;
const sheet={
 getSheetId:()=>2020620808,getLastRow:()=>Math.max(4,...rows.map((r,i)=>r.some(v=>v!=='')?i+1:0)),getMaxRows:()=>rows.length,
 insertRowsAfter:(n,count)=>rows.push(...Array.from({length:count},()=>Array(17).fill(''))),
 getRange(row,col,height=1,width=1){return {
  getValues:()=>Array.from({length:height},(_,i)=>rows[row-1+i].slice(col-1,col-1+width)),
  getDisplayValues:()=>Array.from({length:height},(_,i)=>rows[row-1+i].slice(col-1,col-1+width).map(String)),
  getFormulas:()=>Array.from({length:height},(_,i)=>rows[row-1+i].slice(col-1,col-1+width).map(v=>typeof v==='string'&&v.startsWith('=')?v:'')),
  setNumberFormat:()=>{},
  setValues(values){assert(locked);if(failNextWrite){failNextWrite=false;throw new Error('injected write failure');}values.forEach((r,i)=>r.forEach((v,j)=>rows[row-1+i][col-1+j]=v));}
 };}
};
const ctx=vm.createContext({
 Date,JSON,Object,Array,String,Number,Math,RegExp,Error,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k),getProperties:()=>Object.fromEntries(properties)})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
 computeDigest:(algo,s)=>[...crypto.createHash(algo).update(s).digest()],
 computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()],
 formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10)},
 SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
 MailApp:{sendEmail:message=>sentMail.push(message)},
 LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},hasLock:()=>locked,releaseLock:()=>{locked=false;}})},
 requireQrStaffSession_:body=>{if(body.sessionToken!=='staff-test')throw new Error('denied');return {loginId:'staff-test'};}
});
vm.runInContext(source,ctx);
const call=(action,data={})=>JSON.parse(JSON.stringify(ctx.handleTeacherRegistration_({action:'teacherRegistration'+action,...data})));
const salt=()=>crypto.randomBytes(16).toString('hex');
const proof=(pass,s)=>crypto.pbkdf2Sync(pass,Buffer.from(s,'hex'),600000,32,'sha256').toString('hex');
const invite=code=>call('Invite',{sessionToken:'staff-test',teacherCode:code||''}).registrationCode;
const fields={surname:'試験',givenName:'講師',surnameKana:'しけん',givenNameKana:'こうし',email:'test@example.invalid'};
let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
test('unauthenticated access and invite denied',()=>{
 assert.equal(call('Profile',{teacherCode:'7092'}).ok,false);assert.equal(call('Save',{teacherCode:'7092',fields:{address:'attack'}}).ok,false);assert.equal(call('Invite',{}).ok,false);assert.equal(call('NotificationSettingsGet',{}).ok,false);assert.equal(call('NotificationSettingsSave',{recipients:['attacker@example.invalid']}).ok,false);
});
test('staff can read and change one to three additional confirmation recipients',()=>{
 assert.deepEqual(call('NotificationSettingsGet',{sessionToken:'staff-test'}).recipients,['mintcocoajasmine@gmail.com','admin@educrest.jp']);
 assert.equal(call('NotificationSettingsSave',{sessionToken:'staff-test',recipients:[]}).ok,false);
 assert.equal(call('NotificationSettingsSave',{sessionToken:'staff-test',recipients:['bad-address']}).ok,false);
 const saved=call('NotificationSettingsSave',{sessionToken:'staff-test',recipients:['owner1@example.invalid','OWNER2@example.invalid','owner3@example.invalid']});
 assert.deepEqual(saved.recipients,['owner1@example.invalid','owner2@example.invalid','owner3@example.invalid']);
});
const registrationCode=invite(),s=salt(),p=proof('a-strong-test-password',s);
let registered;
test('next teacher gets 7093; optional financial fields empty',()=>{
 registered=call('Enroll',{mode:'new',registrationCode,salt:s,proof:p,fields});
 assert(registered.ok,registered.message);assert.equal(registered.code,'7093');assert.equal(rows[95][0],7093);
 assert.equal(rows[95][1],'試験 講師');assert.equal(rows[95][2],'シケン コウシ');assert.equal(rows[95][3],1);assert(rows[95][6] instanceof Date);assert.equal(rows[95][14],'');assert.equal(rows[95][16],'');assert.match(rows[95][12],/L96/);
 assert.deepEqual(sentMail.slice(-4).map(message=>message.to),['test@example.invalid','owner1@example.invalid','owner2@example.invalid','owner3@example.invalid']);
 assert(sentMail.slice(-4).every(message=>!message.body.includes('マイナンバー等の登録内容は、安全のためメールには記載していません。')||!message.body.includes('001234567890')));
});
test('same enrollment replay does not duplicate; changed password cannot reuse invite',()=>{
 assert.equal(call('Enroll',{mode:'new',registrationCode,salt:s,proof:p,fields}).code,'7093');
 assert.equal(rows.filter(r=>r[0]===7093).length,1);
 assert.equal(call('Enroll',{mode:'new',registrationCode,salt:s,proof:'0'.repeat(64),fields}).ok,false);
});
test('wrong password fails; code plus password logs into own row',()=>{
 assert.equal(call('Login',{teacherCode:'7093',proof:'0'.repeat(64)}).ok,false);
 registered=call('Login',{teacherCode:'7093',proof:p});assert(registered.ok);
 assert.equal(registered.profile.code,'7093');
});
test('add bank later; zeros preserved; immutable and unrelated fields preserved',()=>{
 const orig=rows[95].slice();
 const out=call('Save',{token:registered.token,teacherCode:'7092',revision:registered.profile.revision,fields:{bankCode:'9900',branchCode:'01234',accountType:'普通',accountNumber:'00123451',myNumber:'001234567890',birthDate:'2001-02-03'}});
 assert(out.ok,out.message);assert.equal(out.code,'7093');assert.equal(rows[95][7],'9900');assert.equal(rows[95][8],'01234');assert.equal(rows[95][9],'');assert.equal(rows[95][10],'00123451');assert.equal(rows[95][14],'001234567890');
 assert.equal(rows[94][7],'0001');for(const i of [0,3,6,13,16])assert.equal(rows[95][i],orig[i]);
 assert.equal(out.profile.hasMyNumber,true);assert.equal('myNumber' in out.profile,false);
 assert.equal(call('Save',{token:registered.token,revision:registered.profile.revision,fields:{address:'stale'}}).ok,false);
 registered.profile=out.profile;
});
test('partial address update retains bank and My Number; formula injection denied',()=>{
 const out=call('Save',{token:registered.token,revision:registered.profile.revision,fields:{address:'新住所'}});
 assert(out.ok);assert.equal(rows[95][10],'00123451');assert.equal(rows[95][14],'001234567890');
 registered.profile=out.profile;
 for(const fields of [{address:'=IMPORTDATA("bad")'},{teacherCode:'7092'},{myNumber:'123'},{birthDate:'2025-02-30'},{surname:'姓だけ'}]){
  assert.equal(call('Save',{token:registered.token,revision:out.profile.revision,fields}).ok,false);
 }
});
test('existing teacher password setup retains all fields; invalidates old sessions on reset',()=>{
 const original=rows[94].slice(),code=invite('7092'),ss=salt(),pp=proof('another-strong-password',ss);
 const existing=call('Enroll',{mode:'setup',registrationCode:code,salt:ss,proof:pp});
 assert(existing.ok,existing.message);assert.deepEqual(rows[94],original);
 const reset=call('Enroll',{mode:'setup',registrationCode:invite('7092'),salt:ss,proof:pp});
 assert(reset.ok);assert.equal(call('Profile',{token:existing.token}).ok,false);
});
test('write interruption recovers reserved row without duplication',()=>{
 const code=invite(),ss=salt(),pp=proof('third-strong-password',ss);
 failNextWrite=true;assert.equal(call('Enroll',{mode:'new',registrationCode:code,salt:ss,proof:pp,fields}).ok,false);
 assert.equal(call('Enroll',{mode:'new',registrationCode:code,salt:ss,proof:'0'.repeat(64),fields}).ok,false);
 const recovered=call('Enroll',{mode:'new',registrationCode:code,salt:ss,proof:pp,fields});
 assert(recovered.ok,recovered.message);assert.equal(recovered.code,'7094');assert.equal(rows.filter(r=>r[0]===7094).length,1);
});
test('logout invalidates token; no personal profile fields in properties',()=>{
 assert(call('Logout',{token:registered.token}).ok);assert.equal(call('Profile',{token:registered.token}).ok,false);
 const stored=JSON.stringify(Object.fromEntries(properties));
 for(const privateValue of ['新住所','test@example.invalid','001234567890','a-strong-test-password','試験'])assert(!stored.includes(privateValue));
});
new vm.Script(fs.readFileSync(new URL('../registration.js',import.meta.url),'utf8'));
console.log(count+' groups passed; frontend syntax valid; no production writes.');
