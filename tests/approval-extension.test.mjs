import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../gas/TeacherApprovalExtension.gs',import.meta.url),'utf8');
const properties=new Map(),sent=[];
const masterRows=Array.from({length:9},()=>Array(36).fill(''));
masterRows[4][0]=7092;masterRows[4][15]='existing@example.invalid';
let requests;
function range(rows,row,col,height=1,width=1){return {
 getDisplayValue:()=>String(rows[row-1]?.[col-1]||''),
 getDisplayValues:()=>Array.from({length:height},(_,i)=>rows[row-1+i].slice(col-1,col-1+width).map(String)),
 getValues:()=>Array.from({length:height},(_,i)=>rows[row-1+i].slice(col-1,col-1+width)),
 isBlank:()=>!rows[row-1]?.[col-1],setNumberFormat(){return this;},
 setValues(values){values.forEach((values,i)=>{rows[row-1+i]??=Array(36).fill('');values.forEach((value,j)=>rows[row-1+i][col-1+j]=String(value).replace(/^'(\d+)$/,'$1'));});return this;}
};}
const master={getLastRow:()=>5,getRange:(...args)=>range(masterRows,...args)};
const book={getSheetByName:name=>name==='講師マスター'?master:requests,insertSheet:()=>{
 requests={hideSheet(){},getLastRow:()=>requests.rows.length,getRange:(...args)=>range(requests.rows,...args),rows:[]};return requests;
}};
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const ctx=vm.createContext({Date,Math,Object,Array,String,RegExp,Error,
 TR_SHEET_ID_:'master',SpreadsheetApp:{openById:()=>book,flush(){}},
 Utilities:{formatDate:date=>date.toISOString().slice(0,10)},
 trFields_:raw=>({...raw,birthDate:new Date(raw.birthDate+'T00:00:00Z')}),
 trError_:message=>{throw new Error(message)},trRate_:()=>{},trHash_:hash,
 trRead_:key=>properties.get(key),trWrite_:(key,value)=>properties.set(key,value),trRemove_:key=>properties.delete(key),
 trSheet_:()=>master,trRandom_:()=>crypto.randomBytes(32).toString('hex'),
 trAuditRecipients_:()=>['owner@example.invalid'],trAuditSendOne_:(to,subject,body)=>sent.push({to,subject,body}),
 trEnrollCore_:body=>{
  assert.equal(body.mode,'new');assert.equal(body.fields.email,'teacher@example.invalid');
  masterRows[5][0]=7093;masterRows[5][1]=body.fields.surname+' '+body.fields.givenName;
  masterRows[5][3]=1;masterRows[5][15]=body.fields.email;masterRows[5][16]='STEP-7093';
  return {code:'7093',token:'abc'};
 },trFind_:()=>6
});
vm.runInContext(source,ctx);
const fields={surname:'試験',givenName:'講師',surnameKana:'シケン',givenNameKana:'コウシ',birthDate:'2001-02-03',email:'teacher@example.invalid'};
const request=ctx.taSubmitRequest_({fields,salt:'a'.repeat(32),proof:'b'.repeat(64)});
assert(request.pending);assert.equal(masterRows[5][0],'');
const token=sent[0].body.match(/#approval=([a-f0-9]{64})/)[1];
assert.throws(()=>ctx.taApprovalPreview_({approvalToken:token},{permissionLevel:'3'}));
assert.throws(()=>ctx.taApproveRequest_({approvalToken:token},{permissionLevel:'3'}));
assert.equal(masterRows[5][0],'');
const preview=ctx.taApprovalPreview_({approvalToken:token},{permissionLevel:'2'});
assert.equal(preview.status,'確認待ち');assert.equal(preview.applicant.birthDate,'2001-02-03');
const approved=ctx.taApproveRequest_({approvalToken:token},{permissionLevel:'2'});
assert.equal(approved.code,'7093');assert.equal(masterRows[5][3],1);
assert.equal(masterRows[5][16],'STEP-7093');assert.equal(masterRows[5][35],'0203');
assert.equal(ctx.taApproveRequest_({approvalToken:token},{permissionLevel:'2'}).replayed,true);
assert.equal(sent.length,3);assert(!sent[0].body.includes('2001-02-03'));
console.log('Approval staging, authorization, D/Q/AJ population and replay passed.');
