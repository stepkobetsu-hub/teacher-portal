import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../',import.meta.url);
const ctx=vm.createContext({URLSearchParams});
vm.runInContext(fs.readFileSync(new URL('registration-links.js',base),'utf8'),ctx);
const {make,read}=ctx.TeacherInviteLinks;
const code='a'.repeat(64);
for(const mode of ['new','setup']){
 const link=make(code,mode),u=new URL(link);
 assert.equal(u.origin,'https://stepkobetsu-hub.github.io');
 assert.equal(u.pathname,'/teacher-portal/registration.html');
 assert.equal(u.search,'');
 assert.equal(read(u.hash).code,code);assert.equal(read(u.hash).mode,mode);
}
for(const value of ['', '#registrationCode=bad&mode=new','#registrationCode='+code+'&mode=other','#registrationCode=%3Cscript%3E&mode=new'])assert.equal(read(value),null);
assert.throws(()=>make('bad','new'));assert.throws(()=>make(code,'other'));
const browser=vm.createContext({window:{},Uint8Array,Uint8ClampedArray,ArrayBuffer,TextEncoder,setTimeout});
vm.runInContext(fs.readFileSync(new URL('vendor/registration-qrcode.js',base),'utf8'),browser);
const qr=browser.window.TeacherRegistrationQR.create(make(code,'new'),{errorCorrectionLevel:'M'});
assert(qr.modules.size>21);assert(qr.modules.data.some(Boolean));
const expected=make(code,'new');
const encodedBytes=qr.segments.flatMap(s=>s.data instanceof Uint8Array?[...s.data]:[...new TextEncoder().encode(s.data)]);
assert.equal(new TextDecoder().decode(new Uint8Array(encodedBytes)),expected);
new vm.Script(fs.readFileSync(new URL('registration.js',base),'utf8'));
console.log('Invitation URL roundtrip, no query credentials, invalid fragments, bundled QR payload and frontend syntax passed.');
