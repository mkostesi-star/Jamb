// Checks the notifications Edge Function (server/functions/push) with a fake database and fake push services, no network.
// The locked message is opened again with Node's own crypto, the way the receiving browser does it (RFC 8291), and,
// when it is installed, with the reference library http_ece (npm i http_ece in /home/claude/work/pushtest).
//   node --experimental-strip-types --no-warnings push.mjs
import crypto from 'node:crypto';
let ENV={};let calls=[];let fakeFetch=null;
globalThis.Deno={env:{get:k=>ENV[k]},serve:()=>{}};
globalThis.fetch=async(u,o)=>{calls.push({u:String(u),o});return fakeFetch(String(u),o);};
const P=await import('../server/functions/push/index.ts');
let ece=null;try{ece=(await import('/home/claude/work/pushtest/node_modules/http_ece/ece.js')).default;}catch(e){}
let bad=0;const ok=(c,m)=>{console.log((c?'  ok    ':'  FAIL  ')+m);if(!c)bad++;};
const b64u=b=>Buffer.from(b).toString('base64url');

// a browser's subscription: its key pair and its auth secret
const ua=crypto.createECDH('prime256v1');ua.generateKeys();
const sub={p256dh:b64u(ua.getPublicKey()),auth:b64u(crypto.randomBytes(16))};
function open(buf){   // the receiving side of RFC 8291, written separately from the function's own code
  const salt=buf.subarray(0,16),rs=buf.readUInt32BE(16),idlen=buf[20],asPub=buf.subarray(21,21+idlen),ct=buf.subarray(21+idlen);
  const shared=ua.computeSecret(asPub),auth=Buffer.from(sub.auth,'base64url');
  const ikm=Buffer.from(crypto.hkdfSync('sha256',shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),ua.getPublicKey(),asPub]),32));
  const cek=Buffer.from(crypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(crypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const d=crypto.createDecipheriv('aes-128-gcm',cek,nonce);d.setAuthTag(ct.subarray(ct.length-16));
  const plain=Buffer.concat([d.update(ct.subarray(0,ct.length-16)),d.final()]);
  if(plain[plain.length-1]!==2)throw new Error('no last-record mark');
  return {rs,text:plain.subarray(0,plain.length-1).toString('utf8')};
}
// 1. locking a message
const msg=JSON.stringify({title:'Dnevni Jamb te čeka',body:'Današnje kocke su na stolu ☕'});
const box=Buffer.from(await P.encrypt(sub.p256dh,sub.auth,msg));
const o1=open(box);ok(o1.text===msg&&o1.rs===4096,'the browser opens the message (Node crypto, RFC 8291)');
if(ece){const t=ece.decrypt(box,{version:'aes128gcm',privateKey:ua,authSecret:sub.auth}).toString('utf8');ok(t===msg,'the reference library http_ece opens it too');}
else console.log('  (http_ece not installed: skipped)');
const tampered=Buffer.from(box);tampered[tampered.length-3]^=1;let threw=false;try{open(tampered);}catch(e){threw=true;}ok(threw,'a changed message does not open');
let refused=false;try{await P.encrypt('AAAA',sub.auth,'x');}catch(e){refused=true;}ok(refused,'bad subscription keys are refused');
// 2. the VAPID keys and the signed note
const K=await P.newKeys();
ok(Buffer.from(K.VAPID_PUBLIC,'base64url').length===65&&Buffer.from(K.VAPID_PRIVATE,'base64url').length===32,'a new key pair: 65-byte public, 32-byte private');
const sk=await P.signingKey(K.VAPID_PUBLIC,K.VAPID_PRIVATE);
const hdr=await P.vapidHeader('https://fcm.googleapis.com/fcm/send/abc',K.VAPID_PUBLIC,sk,Date.parse('2026-12-01T12:00:00Z'));
const m=hdr.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);ok(!!m&&m[4]===K.VAPID_PUBLIC,'the header carries the note and the public key');
const claims=JSON.parse(Buffer.from(m[2],'base64url'));ok(claims.aud==='https://fcm.googleapis.com'&&claims.sub==='https://yambcafe.com'&&claims.exp===Date.parse('2026-12-01T12:00:00Z')/1000+43200,'addressed to that push service, from yambcafe.com, for 12 hours');
const pubBytes=Buffer.from(K.VAPID_PUBLIC,'base64url');
const pk=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:b64u(pubBytes.subarray(1,33)),y:b64u(pubBytes.subarray(33))},format:'jwk'});
ok(crypto.verify('sha256',Buffer.from(m[1]+'.'+m[2]),{key:pk,dsaEncoding:'ieee-p1363'},Buffer.from(m[3],'base64url')),'the signature checks out (ES256)');
let wp=null;try{wp=(await import('node:module')).createRequire(import.meta.url)('/home/claude/work/pushtest/node_modules/web-push');}catch(e){}
if(wp){const g=wp.generateVAPIDKeys();let fit=true;try{await P.signingKey(g.publicKey,g.privateKey);}catch(e){fit=e.message;}ok(fit===true,'keys made by the web-push library fit too ('+fit+')');}
// 3. the words
ok(P.days('hr',21)==='21 dan'&&P.days('hr',3)==='3 dana'&&P.days('hr',11)==='11 dana'&&P.days('sl',2)==='2 dneva'&&P.days('sl',4)==='4 dnevi'&&P.days('sl',5)==='5 dni'&&P.days('en',1)==='1 day','"days in a row" in each language\'s own plural');
let w=P.message({kind:'daily',lang:'hr',streak:5});ok(w.title==='Dnevni Jamb te čeka'&&w.body.startsWith('5 dana zaredom')&&w.url==='/?d=daily','the Daily reminder ('+w.body+')');
w=P.message({kind:'daily',lang:'en',streak:0});ok(/same for everyone/.test(w.body),'without a streak');
w=P.message({kind:'duel',lang:'hr',name:'Ana',score:245,mine:230,n:1});ok(w.body==='Ana 245 · ti 230. Ovaj put pobjeđuje Ana.'&&w.tag==='duel'&&w.url==='/?d=duels','a duel result ('+w.body+')');
w=P.message({kind:'duel',lang:'de',name:'',score:100,mine:230,n:3});ok(w.title==='Duell-Ergebnisse (3)'&&w.body==='Jemand 100 · du 230. Du gewinnst das Duell.','several at once, a friend without a name');
// 4. the function: GET for the key, POST to send what is due
ENV={SUPABASE_URL:'https://x.supabase.co',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_abc'})};
let r=await P.handle(new Request('https://x/functions/v1/push'));let j=await r.json();
ok(r.status===200&&j.setup&&Buffer.from(j.VAPID_PUBLIC,'base64url').length===65&&r.headers.get('cache-control')==='no-store','before the keys are set: a fresh pair to copy, never cached');
r=await P.handle(new Request('https://x/functions/v1/push',{method:'POST'}));ok(r.status===503,'without keys nothing is sent');
ENV.VAPID_PUBLIC=K.VAPID_PUBLIC;ENV.VAPID_PRIVATE=K.VAPID_PRIVATE;
r=await P.handle(new Request('https://x/functions/v1/push'));j=await r.json();ok(j.key===K.VAPID_PUBLIC&&!('VAPID_PRIVATE' in j)&&r.headers.get('access-control-allow-origin')==='*','with the keys set: only the public key, for the game');
const due=[{endpoint:'https://fcm.googleapis.com/fcm/send/ok1',...sub,lang:'hr',kind:'daily',streak:2},
  {endpoint:'https://web.push.apple.com/gone1',...sub,lang:'en',kind:'duel',name:'Ana',score:200,mine:250,n:1},
  {endpoint:'https://updates.push.services.mozilla.com/wpush/v2/err1',...sub,lang:'de',kind:'test'}];
let result=null;calls=[];
fakeFetch=async(u,o)=>{
  if(u.endsWith('/rest/v1/rpc/push_due'))return new Response(JSON.stringify(due),{status:200});
  if(u.endsWith('/rest/v1/rpc/push_result')){result=JSON.parse(o.body).p;return new Response('{"dropped":1}',{status:200});}
  if(u.includes('/gone1'))return new Response('',{status:410});
  if(u.includes('/err1'))return new Response('',{status:500});
  return new Response('',{status:201});
};
r=await P.handle(new Request('https://x/functions/v1/push',{method:'POST',body:'{}'}));j=await r.json();
ok(j.due===3&&j.sent===1&&j.gone===1&&j.failed===1,'three due: one sent, one gone, one failed');
ok(result&&result.ok[0].endsWith('ok1')&&result.gone[0].endsWith('gone1')&&result.failed[0].endsWith('err1'),'and the database is told which');
const dbCall=calls.find(c=>c.u.endsWith('push_due'));ok(dbCall.o.headers.apikey==='sb_secret_abc'&&!dbCall.o.headers.Authorization,'the database is asked with the project\'s secret key');
const sent=calls.find(c=>c.u.endsWith('ok1')),H=sent.o.headers;
ok(H['Content-Encoding']==='aes128gcm'&&H.TTL==='14400'&&H.Topic==='daily'&&/^vapid t=/.test(H.Authorization),'sent locked, with a 4-hour life and the daily topic');
const got=JSON.parse(open(Buffer.from(sent.o.body)).text);ok(got.title==='Dnevni Jamb te čeka'&&got.body.startsWith('2 dana zaredom')&&got.url==='/?d=daily','what the phone shows: '+got.body);
const aud=JSON.parse(Buffer.from(H.Authorization.split(' ')[1].slice(2).split('.')[1],'base64url')).aud;ok(aud==='https://fcm.googleapis.com','the note is addressed to that push service');
const ap=calls.find(c=>c.u.includes('gone1'));ok(ap.o.headers.TTL==='172800','a duel result waits up to two days for a phone that is off');
// the old style service_role key is sent as a Bearer token too
ENV.SUPABASE_SECRET_KEYS='';ENV.SUPABASE_SERVICE_ROLE_KEY='eyJold.key.here';calls=[];fakeFetch=async u=>new Response('[]',{status:200});
await P.handle(new Request('https://x/functions/v1/push',{method:'POST'}));
ok(calls.length===1&&calls[0].o.headers.Authorization==='Bearer eyJold.key.here','an older project\'s service key works too; nothing due, nothing else asked');
ENV.VAPID_PRIVATE='nonsense';r=await P.handle(new Request('https://x/functions/v1/push',{method:'POST'}));ok(r.status===500,'keys that do not fit are reported, not used');

console.log(bad?`\n${bad} problem(s)`:'\nall good');process.exit(bad?1:0);
