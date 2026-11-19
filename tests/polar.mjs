// Checks the two Polar Edge Functions (server/functions) with fake Polar and Supabase answers, no network.
//   node --experimental-strip-types --no-warnings polar.mjs
import { webcrypto } from 'node:crypto';
let ENV={};let calls=[];let fakeFetch=null;
globalThis.Deno={env:{get:k=>ENV[k]},serve:()=>{}};
globalThis.fetch=async(u,o)=>{calls.push({u,o});return fakeFetch(u,o);};
const W=await import('../server/functions/polar-webhook/index.ts');const CK=await import('../server/functions/polar-checkout/index.ts');
// optional: Polar's own SDK checks the same signature (npm i @polar-sh/sdk in /home/claude/work/polartest)
let polarValidate=null;try{const fs=await import('node:fs');const d='/home/claude/work/polartest/node_modules/@polar-sh/sdk/dist/';const f=fs.readdirSync(d).find(x=>/^webhooks-.*\.mjs$/.test(x));polarValidate=(await import(d+f)).i;}catch(e){}
let bad=0;const ok=(c,m)=>{console.log((c?'  ok    ':'  FAIL  ')+m);if(!c)bad++;};
const enc=new TextEncoder();
async function sign(keyBytes,id,ts,body){const k=await webcrypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await webcrypto.subtle.sign('HMAC',k,enc.encode(`${id}.${ts}.${body}`))).toString('base64');}
const secretA='polar_whs_'+Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64').replace(/[+/=]/g,'x');
const raw=webcrypto.getRandomValues(new Uint8Array(24)),secretB='whsec_'+Buffer.from(raw).toString('base64');
const now=Math.floor(Date.now()/1000),body=JSON.stringify({type:'order.paid',timestamp:new Date().toISOString(),data:{id:'ord_1',status:'paid',product_id:'a3309610-f502-4d25-94b7-65041f5bc4c6',net_amount:399,tax_amount:100,total_amount:499,customer:{external_id:'11111111-1111-4111-8111-111111111111'},metadata:{user_id:'11111111-1111-4111-8111-111111111111'}}});
// 1. signatures, keyed both ways, checked against Polar's own SDK too
const sA=await sign(enc.encode(secretA),'msg_1',now,body),sB=await sign(raw,'msg_1',now,body);
ok(await W.verify(secretA,'msg_1',String(now),'v1,'+sA,body),'secret used as its own bytes (Polar style)');
ok(await W.verify(secretB,'msg_1',String(now),'v1,'+sB,body),'secret read as base64 after whsec_ (the standard)');
ok(await W.verify(secretA,'msg_1',String(now),'v1,zzz v1,'+sA,body),'several signatures in the header');
ok(!(await W.verify(secretA,'msg_1',String(now),'v1,'+sA,body.replace('399','1'))),'a changed body is refused');
ok(!(await W.verify(secretA,'msg_1',String(now-600),'v1,'+(await sign(enc.encode(secretA),'msg_1',now-600,body)),body)),'an old message is refused');
ok(!(await W.verify('','msg_1',String(now),'v1,'+sA,body)),'no secret set: refused');
let sdkOk=true;if(polarValidate)try{await polarValidate(body,{'webhook-id':'msg_1','webhook-timestamp':String(now),'webhook-signature':'v1,'+sA},secretA,new Set(['order.paid']));}catch(e){sdkOk=e.message;}
ok(sdkOk===true,'Polar\'s SDK accepts the same signature, so the keying matches ('+sdkOk+')');
// 2. the webhook handler
ENV={POLAR_WEBHOOK_SECRET:secretA,SUPABASE_URL:'https://x.supabase.co',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_abc'})};
const req=(b,sig,ts=now)=>new Request('https://x/functions/v1/polar-webhook',{method:'POST',body:b,headers:{'webhook-id':'msg_1','webhook-timestamp':String(ts),'webhook-signature':sig}});
calls=[];fakeFetch=async()=>new Response(JSON.stringify({ok:true,plus:true}),{status:200});
let r=await W.handle(req(body,'v1,'+sA));
ok(r.status===200&&calls.length===1&&calls[0].u==='https://x.supabase.co/rest/v1/rpc/yamb_order','a paid order goes to the database');
const sent=JSON.parse(calls[0].o.body);ok(sent.p_env==='sandbox'&&sent.p_order.id==='ord_1'&&calls[0].o.headers.apikey==='sb_secret_abc'&&!calls[0].o.headers.Authorization,'with the order, the test-shop mark and the new secret key');
calls=[];r=await W.handle(req(body,'v1,AAAA'));ok(r.status===403&&calls.length===0,'a forged message is refused and the database is not called');
const other=body.replace('a3309610-f502-4d25-94b7-65041f5bc4c6','00000000-0000-4000-8000-000000000000');
calls=[];r=await W.handle(req(other,'v1,'+(await sign(enc.encode(secretA),'msg_1',now,other))));ok(r.status===202&&calls.length===0,'another product is ignored');
const sub=JSON.stringify({type:'subscription.created',data:{}});calls=[];r=await W.handle(req(sub,'v1,'+(await sign(enc.encode(secretA),'msg_1',now,sub))));ok(r.status===202&&calls.length===0,'other events are ignored');
fakeFetch=async()=>new Response('boom',{status:500});calls=[];r=await W.handle(req(body,'v1,'+sA));ok(r.status===500,'a database failure answers 500, so Polar tries again');
ENV.SUPABASE_SECRET_KEYS='';ENV.SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOi.legacy.jwt';fakeFetch=async()=>new Response('{}',{status:200});calls=[];
r=await W.handle(req(body,'v1,'+sA));ok(calls[0].o.headers.Authorization==='Bearer eyJhbGciOi.legacy.jwt','an older project\'s service key is sent as a bearer token');
// 3. the checkout opener
ENV={SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'anon',POLAR_ACCESS_TOKEN:'polar_oat_test'};
const ck=(b,h)=>new Request('https://x/functions/v1/polar-checkout',{method:'POST',body:JSON.stringify(b),headers:Object.assign({'content-type':'application/json',origin:'https://yambcafe.com'},h||{})});
fakeFetch=async(u,o)=>{if(u.endsWith('/auth/v1/user'))return o.headers.Authorization==='Bearer good'?new Response(JSON.stringify({id:'u-1',email:'p@example.com'}),{status:200}):new Response('{}',{status:401});
  return new Response(JSON.stringify({id:'co_1',url:'https://sandbox.polar.sh/checkout/abc'}),{status:201});};
calls=[];r=await CK.handle(ck({amount:699,lang:'hr'},{authorization:'Bearer good'}));const j=await r.json();
ok(r.status===200&&j.url==='https://sandbox.polar.sh/checkout/abc'&&j.test===true,'a signed-in player gets a test-shop checkout link');
const pc=calls.find(c=>c.u.includes('/v1/checkouts/')),pb=JSON.parse(pc.o.body);
ok(pc.u==='https://sandbox-api.polar.sh/v1/checkouts/'&&pb.amount===699&&pb.external_customer_id==='u-1'&&pb.metadata.user_id==='u-1'&&pb.products[0]==='a3309610-f502-4d25-94b7-65041f5bc4c6'&&pb.locale==='hr'&&pb.success_url.startsWith('https://yambcafe.com/?plus=done'),'with the amount, the player, the product, the language and the way back');
ok(r.headers.get('access-control-allow-origin')==='https://yambcafe.com','the browser may read the answer on yambcafe.com');
r=await CK.handle(ck({amount:699},{authorization:'Bearer bad'}));ok(r.status===401,'not signed in: refused');
r=await CK.handle(ck({amount:100},{authorization:'Bearer good'}));ok(r.status===400,'less than €4.99: refused');
r=await CK.handle(ck({amount:699},{authorization:'Bearer good',origin:'https://evil.example'}));ok(r.status===403,'another website: refused');
r=await CK.handle(new Request('https://x/functions/v1/polar-checkout',{method:'OPTIONS',headers:{origin:'http://127.0.0.1:8765'}}));ok(r.status===204&&r.headers.get('access-control-allow-origin')==='http://127.0.0.1:8765','the browser\'s pre-check is answered, also for local testing');
ENV.POLAR_SERVER='production';ENV.POLAR_PRODUCT_ID='live-prod';
const CK2=await import('../server/functions/polar-checkout/index.ts?live');calls=[];await CK2.handle(ck({amount:499},{authorization:'Bearer good'}));
const lc=calls.find(c=>c.u.includes('/v1/checkouts/'));ok(lc.u==='https://api.polar.sh/v1/checkouts/'&&JSON.parse(lc.o.body).products[0]==='live-prod','with POLAR_SERVER=production it uses the real shop and its product');
console.log(bad?`\n${bad} problem(s)`:'\nall good');process.exit(bad?1:0);
