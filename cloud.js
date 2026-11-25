/* Yamb Café account: Google sign-in through Supabase, and the calls to the game's database.
   The game runs without any of this: when the library has not loaded or there is no connection,
   JambCloud.available() is false or the calls fail, and the game simply stays on this device. */
(function(root){
'use strict';
/* The address and the key are public by design: the database only answers through locked functions. */
const CFG=Object.assign({url:'https://ovyoybgtoaahkrcylrkw.supabase.co',key:'sb_publishable_KGd1nYui7gP1uP4-RQPcyw_49D9no_F'},root.JAMB_CLOUD||{});

/* Coming back from Google, the address carries a one-time code (or an error). It is read here, before the game
   starts and tidies the address, and taken out so it is never shared or bookmarked. Game links are left alone. */
let back=null;
try{
  const u=new URL(root.location.href),q=u.searchParams,h=new URLSearchParams(u.hash.replace(/^#/,''));
  const err=q.get('error_description')||q.get('error')||h.get('error_description')||h.get('error');
  if(q.get('code'))back={code:q.get('code')};else if(err)back={error:String(err).replace(/\+/g,' ')};
  if(back){
    ['code','error','error_code','error_description'].forEach(k=>q.delete(k));
    const qs=q.toString(),hash=h.get('error')||h.get('error_description')?'':u.hash;
    root.history.replaceState(null,'',u.pathname+(qs?'?'+qs:'')+hash);
  }
}catch(e){}

let sb=null,session=null,ready=false,lastError=back&&back.error?back.error:null,justIn=false;
const subs=[];
const emit=why=>{subs.slice().forEach(f=>{try{f(why);}catch(e){}});};
function userOf(s){
  if(!s||!s.user)return null;
  const m=s.user.user_metadata||{};
  return{id:s.user.id,email:s.user.email||m.email||'',name:String(m.full_name||m.name||'').trim(),picture:m.avatar_url||m.picture||''};
}
function boot(){
  if(sb||!root.supabase||typeof root.supabase.createClient!=='function'||!CFG.url||!CFG.key)return;
  try{
    sb=root.supabase.createClient(CFG.url,CFG.key,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:'yamb-auth'}});
  }catch(e){sb=null;return;}
  /* never call the library from inside this callback: only note the change and tell the game a moment later */
  sb.auth.onAuthStateChange((ev,s)=>{
    const was=session&&session.user?session.user.id:null,now=s&&s.user?s.user.id:null;
    session=s||null;
    if(ready&&was!==now)setTimeout(()=>emit(now?'in':'out'),0);
  });
  (async()=>{
    if(back&&back.code){
      try{const r=await sb.auth.exchangeCodeForSession(back.code);if(r.error)lastError=r.error.message||'sign-in failed';else justIn=true;}
      catch(e){lastError=String(e&&e.message||e);}
    }
    try{const r=await sb.auth.getSession();session=r&&r.data?r.data.session:null;}catch(e){session=null;}
    ready=true;emit('ready');
  })();
}
/* Visitor numbers (see the privacy page): only on yambcafe.com, no cookies, nothing kept on the device. The database
   turns each call into a count for the day; it never learns who this is. Works without the library, and failures are ignored. */
const COUNT=CFG.count!=null?!!CFG.count:/(^|\.)yambcafe\.com$/.test(String(root.location&&root.location.hostname||''));
function post(fn,body){
  if(!COUNT||!CFG.url||!CFG.key||typeof root.fetch!=='function')return;
  try{root.fetch(CFG.url+'/rest/v1/rpc/'+fn,{method:'POST',keepalive:true,headers:{apikey:CFG.key,'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});}catch(e){}
}
/* phone, tablet or desktop: from touch and the shorter side of the screen, nothing more exact */
function device(){
  try{const sc=root.screen||{},m=Math.min(sc.width||0,sc.height||0),touch=(root.navigator.maxTouchPoints||0)>0;return !touch?'desktop':m&&m<600?'phone':'tablet';}catch(e){return 'other';}
}
let pushKey=null;
const API={
  available:()=>!!sb,
  /* a page opened: which page, where the visitor came from, the game's language, installed or not */
  count(page,src,lang,app){post('count_visit',{p_page:page,p_src:src||'direct',p_lang:lang||'',p_app:!!app,p_dev:device(),p_hour:new Date().getHours()});},
  /* choices and uses in a game, as a short list of [what, which, number] (see count_stats in server/schema.sql) */
  stats(items){if(items&&items.length)post('count_stats',{p_items:items});},
  /* something done: start or finish (with the mode), install, signin, plus_view, plus_buy, tip_buy */
  event(ev,mode){post('count_event',{p_ev:ev,p_mode:mode||'-'});},
  boot,
  /* a sign-in is stored on this device, even if it could not be checked just now (no connection) */
  remembered(){try{return !!root.localStorage.getItem('yamb-auth');}catch(e){return false;}},
  get ready(){return ready;},
  get user(){return ready?userOf(session):null;},
  /* true once, right after coming back from Google, so the game can say hello */
  takeJustIn(){const j=justIn;justIn=false;return j;},
  takeError(){const e=lastError;lastError=null;return e;},
  on(f){subs.push(f);},
  /* leaves the page for Google and comes back to the same address */
  async signIn(){
    if(!sb)throw new Error('offline');
    /* "select_account" lets a second person on a shared device choose their own Google account */
    const r=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:root.location.origin+root.location.pathname,queryParams:{prompt:'select_account'}}});
    if(r.error)throw new Error(r.error.message||'sign-in failed');
  },
  async signOut(){
    if(sb){try{await sb.auth.signOut({scope:'local'});}catch(e){}}
    /* with no connection the library keeps the sign-in; signing out must work anyway */
    try{root.localStorage.removeItem('yamb-auth');}catch(e){}
    session=null;emit('out');
  },
  /* Plus: asks the Edge Function polar-checkout for a payment page (Polar) for this player and amount (cents);
     the page's address comes back, and Polar returns the player to the game afterwards */
  async buyPlus(amount,lang){
    if(!sb)throw new Error('offline');
    let s=null;try{const r=await sb.auth.getSession();s=r&&r.data?r.data.session:null;}catch(e){}
    if(!s||!s.access_token)throw new Error('signin');
    const res=await root.fetch(CFG.url+'/functions/v1/polar-checkout',{method:'POST',
      headers:{Authorization:'Bearer '+s.access_token,apikey:CFG.key,'Content-Type':'application/json'},body:JSON.stringify({amount,lang})});
    let j={};try{j=await res.json();}catch(e){}
    if(!res.ok||!j||!j.url)throw new Error(j&&j.error||('checkout '+res.status));
    return j;
  },
  /* notifications: the public key a browser needs to switch them on (from the Edge Function push), and a nudge to send
     what is due right away (a test message) instead of at the database's next minute */
  async pushKey(){
    if(pushKey)return pushKey;
    const res=await root.fetch(CFG.url+'/functions/v1/push');
    let j={};try{j=await res.json();}catch(e){}
    if(!res.ok||!j||!j.key)throw new Error('notready');
    return pushKey=j.key;
  },
  pushKick(){try{root.fetch(CFG.url+'/functions/v1/push',{method:'POST'}).catch(()=>{});}catch(e){}},
  /* one call to a database function; throws with the database's own short message (YC_...) when it refuses */
  async rpc(fn,args){
    if(!sb)throw new Error('offline');
    let q=sb.rpc(fn,args||{});
    try{if(typeof AbortSignal!=='undefined'&&AbortSignal.timeout&&q.abortSignal)q=q.abortSignal(AbortSignal.timeout(15000));}catch(e){}
    const r=await q;
    if(r.error){const e=new Error(r.error.message||'request failed');e.code=r.error.code||'';throw e;}
    return r.data;
  }
};
root.JambCloud=API;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot);else boot();
  root.addEventListener('load',boot);
}
})(typeof self!=='undefined'?self:this);
