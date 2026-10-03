const AUTH='https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec';
const ORIGIN='https://step-permissions.mintcocoajasmine.chatgpt.site';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
export async function handle(req:Request){
 if(req.method!=='POST')return Response.json({allowed:false,error:'POST required'},{status:405,headers});
 try{
 const p=await req.json();if(!['view','settings'].includes(p.action)||!/^\d{4,8}$/.test(String(p.staffLoginId||''))||typeof p.sessionToken!=='string'||p.sessionToken.length<16||p.sessionToken.length>512)return Response.json({allowed:false,error:'Invalid request'},{status:400,headers});
 const auth=await fetch(AUTH,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:p.staffSessionKind==='systemPortal'?'verifySystemPortal':'studentQrVerify',sessionToken:p.sessionToken}),signal:AbortSignal.timeout(45000)});
 const staff=await auth.json();const code=String(staff.loginId||staff.code||'');const level=Number(staff.permissionLevel);
 if(!auth.ok||!staff.success||code!==p.staffLoginId||!Number.isInteger(level)||level<1||level>4)return Response.json({allowed:false,error:'Staff session invalid'},{status:401,headers});
 const db=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!db||!key)throw Error('Configuration missing');
 const configResponse=await fetch(db+'/rest/v1/step_permission_bridge_config?select=site_origin,site_service_token,bridge_key,enabled&id=eq.sites&limit=1',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});const rows=await configResponse.json();const cfg=rows[0];if(!configResponse.ok||!cfg?.enabled||cfg.site_origin!==ORIGIN)throw Error('Permission service unavailable');
 const result=await fetch(ORIGIN+'/api/check-context',{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+cfg.site_service_token,Authorization:'Bearer '+cfg.bridge_key},body:JSON.stringify({staffCode:code,level,appId:'teacher-registration-notification-settings',action:p.action}),signal:AbortSignal.timeout(12000)});
 const verdict=await result.json();if(!result.ok)throw Error('Permission service unavailable');if(verdict.allowed&&verdict.scope!=='all')return Response.json({allowed:false,reason:'全校舎のメール送信先設定には全校舎の権限が必要です。'},{headers});
 return Response.json({allowed:!!verdict.allowed,reason:verdict.reason,level:verdict.level},{headers});
 }catch{return Response.json({allowed:false,error:'権限を確認できません。時間をおいて再度お試しください。'},{status:503,headers});}
}
Deno.serve(handle);
