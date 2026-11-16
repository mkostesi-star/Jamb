/* Jamb app: screens, game flow, computer players, coach, daily dice, duels, real-dice table, two phones. */
(function(){
'use strict';
const E=window.JambEngine,AI=window.JambAI,A=window.JambAudio,SC=window.JambScan,I=window.JambI18n;
const FX=window.JambFX,LAND_STEP=55;
const ROWS=E.ROWS,UPPER=E.UPPER,LOWER=E.LOWER;
const VERSION='v9.11';
const FACE={1:[4],2:[2,6],3:[2,4,6],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const PCOL=['#A8505A','#4E7A55','#A07A1E','#75466F','#3F6E72','#A5532E'];
const PCOL_LITE=['#EDA9AE','#A9D3A4','#EAC870','#D2A9CD','#98C7C9','#EDA683'];
const CHAR_ORDER=['ema','nono','mira','joza','profesor'];
const CHARS={ema:{ring:'#5E8A5A'},nono:{ring:'#4A6E86'},mira:{ring:'#A8505A'},joza:{ring:'#A5532E'},profesor:{ring:'#4A3A2E'}};
/* Character names and initials follow the interface language. */
/* A character's painted portrait inside its coloured ring; the initials show if the picture can't load. */
const avatar=k=>`<span class="mono">${esc(CHARS[k].mono)}</span><img class="face" src="art/cast/${k}.webp" alt="" decoding="async" onerror="this.remove()">`;
for(const k in CHARS)Object.defineProperties(CHARS[k],{name:{get(){return t('ch.'+k+'.name');}},mono:{get(){return t('ch.'+k+'.mono');}}});
const PKEY='jamb4-prefs',SKEY='jamb4-stats',OKEY='jamb4-online',SLOT='jamb4-slot-';
const LOG_MODES=['cpu','pp','daily','duel'];
const reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=()=>{const a=new Uint8Array(6);try{crypto.getRandomValues(a);}catch(e){for(let i=0;i<6;i++)a[i]=Math.random()*256;}return Array.from(a,x=>'abcdefghjkmnpqrstuvwxyz23456789'[x%31]).join('');};
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const jget=(k,d)=>{try{const v=JSON.parse(store.get(k)||'null');return v==null?d:v;}catch(e){return d;}};

function detectLang(){
  let list=[];try{list=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||'en'];}catch(e){}
  for(const raw of list){
    const l=String(raw||'').toLowerCase();
    const b=l.split('-')[0];
    if(b==='mk')return 'sr';
    if(['en','hr','sr','bs','sl','de'].includes(b))return b;
  }
  return 'en';
}
let prefs=Object.assign({lang:detectLang(),sound:true,music:true,emotes:true,ambience:false,haptics:true,shake:true,hints:true,name:null,rules:E.normRules({}),sets:[],char:'mira',screen:'home',mode:null},jget(PKEY,{}));
prefs.rules=E.normRules(prefs.rules);
if(prefs.lang==='sr-Cyrl'||prefs.lang==='mk')prefs.lang='sr';
if(!I.has(prefs.lang))prefs.lang='en';
/* v6.5: the sheet fits the screen by default; the bigger sizes are now Large and Huge */
if(prefs.zoomV!==2){prefs.zoom='fit';prefs.zoomV=2;store.set(PKEY,JSON.stringify(prefs));}
if(!prefs.cid){prefs.cid=uid()+uid();store.set(PKEY,JSON.stringify(prefs));}
let stats=Object.assign({daily:{results:{},streak:0,last:null},duels:{},played:0,wins:0,best:0},jget(SKEY,{}));
if(!stats.daily||!stats.daily.results)stats.daily={results:{},streak:0,last:null};
let G=null,screen='home';
const ui={sel:null,rolling:false,just:null,botPick:null,tip:null,tipText:'',bubble:null,bubbleT:0,modal:null,back:null,draft:null,setup:{},pick:-1,shaking:false,skipClick:false,msgT:0,endAsk:null,review:{},motionAsked:false,lastFocus:null};

const t=(k,v)=>I.t(prefs.lang,k,v);
/* first two finished games: show the how-to lines; afterwards the tray stays quiet. Touch screens get the shake/hold line. */
const newPlayer=()=>(stats&&stats.played||0)<2;
const COARSE=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const tl=(k)=>I.arr(prefs.lang,k);
const fmt=n=>{try{return Number(n).toLocaleString(I.locale(prefs.lang));}catch(e){return String(n);}};
const rowName=r=>t('row.'+r);
const colName=c=>t('col.'+c);
function savePrefs(){store.set(PKEY,JSON.stringify(prefs));}
function saveStats(){store.set(SKEY,JSON.stringify(stats));}
function applyAudio(){A.set({sound:prefs.sound,ambience:prefs.ambience&&screen==='game',haptics:prefs.haptics,music:prefs.music!==false,musicLevel:screen==='game'?0.085:0.17,musicMood:screen==='game'&&G&&G.mode==='daily'?'daily':'main'});}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')A.sleep();else applyAudio();});

/* ---------- games ---------- */
function validG(g){return !!(g&&g.v===4&&g.rules&&Array.isArray(g.players)&&g.players.length>0&&g.turn&&Array.isArray(g.turn.dice)&&g.players.every(p=>p&&p.sheet&&g.rules.cols.every(c=>p.sheet[c])));}
function loadSlot(m){const g=jget(SLOT+m,null);return validG(g)?g:null;}
function clearSlot(m){store.del(SLOT+m);}
function freshTurn(g){
  const t=E.freshTurn(g.rules.dice);
  if(g.mode==='table'){t.roll=1;t.dice=Array(g.rules.dice).fill(0);}
  return t;
}
function makeGame(mode,rules,plist,extra){
  rules=E.normRules(rules);
  const g={v:4,id:uid(),mode,rules,players:plist.map(p=>({name:p.name||null,kind:p.kind||'human',char:p.char||null,cid:p.cid||null,sheet:E.newSheet(rules)})),
    current:0,starter:0,view:0,turn:null,over:false,undo:null,log:[],review:{},created:Date.now(),updated:Date.now()};
  Object.assign(g,extra||{});
  g.turn=freshTurn(g);
  return g;
}
/* Games on several phones: every move gives the game a new position id that remembers the ids before it (pos.anc).
   That is how the host tells "this phone is a few moves ahead of me" from "this phone is on another track".
   Changes that are not moves (pause, ready, a name, a seat) keep the position: saveGame(true). */
function stampPos(g){const p=g.pos;g.pos={id:uid(),anc:p&&p.id?[p.id].concat(p.anc||[]).slice(0,60):[]};}
function saveGame(meta){
  if(!G)return;
  G.updated=Date.now();
  if(G.mode==='online'){if(onlineReady()){if(!meta||!G.pos)stampPos(G);G.rev=(G.rev||0)+1;saveOnline();sendState();}}
  else store.set(SLOT+G.mode,JSON.stringify(G));
}
const cur=()=>G.players[G.current];
const isBot=i=>G.players[i]&&G.players[i].kind==='cpu';
function pname(g,i){const p=g.players[i];if(!p)return '';if(p.kind==='cpu')return (CHARS[p.char]||CHARS.profesor).name;if(p.name)return p.name;return isYou(g,i)?t('youName'):t('player',{n:i+1});}
/* the only person on this phone, with no name typed in, is simply "You" */
function isYou(g,i){const p=g.players[i];return !!p&&p.kind!=='cpu'&&!p.name&&g.mode!=='online'&&g.players.filter(q=>q.kind!=='cpu').length===1;}
const name=i=>pname(G,i);
function mySeat(){if(!G)return -1;if(G.mode==='online')return G.players.findIndex(p=>p.cid&&p.cid===prefs.cid);if(G.mode==='cpu')return G.players.findIndex(p=>p.kind==='human');if(G.mode==='daily'||G.mode==='duel')return 0;return -1;}
function mayAct(){
  if(!G||G.over||G.paused)return false;
  if(G.mode==='online')return onlineReady()&&G.status==='playing'&&G.current===mySeat();
  return !isBot(G.current);
}
function othersTurn(){
  if(!G||G.over)return false;
  if(G.mode==='online')return onlineReady()&&G.status==='playing'&&G.current!==mySeat();
  return isBot(G.current);
}
const legal=(c,r)=>E.canWrite(G.rules,cur().sheet,G.turn,c,r);
const diceSet=()=>G.turn.dice.every(v=>v>0);
function canWriteUI(p,c,r){return mayAct()&&p===G.current&&!ui.rolling&&(G.mode!=='table'||diceSet())&&legal(c,r);}
function canRoll(){return mayAct()&&!ui.rolling&&G.mode!=='table'&&E.canRollAgain(G.rules,cur().sheet,G.turn);}
const turnNo=i=>E.filled(G.rules,G.players[i].sheet);
const allFull=()=>G.players.every(p=>E.full(G.rules,p.sheet));
function getView(){return G.mode==='online'?(ui.view==null?G.current:ui.view):G.view;}
function setView(p){if(G.mode==='online')ui.view=p;else G.view=p;}
const soloHuman=g=>g.players.filter(p=>p.kind!=='cpu').length===1;
/* The coach only helps when no other real person is playing. */
const coachGame=g=>!!g&&(g.mode==='cpu'||((g.mode==='pp'||g.mode==='table')&&soloHuman(g)));
function shouldLog(){return LOG_MODES.includes(G.mode)&&G.players[G.current].kind==='human'&&(G.mode!=='pp'||soloHuman(G));}
function logEvent(ev){ev.p=G.current;ev.sheet=clone(cur().sheet);G.log.push(ev);}
function untouched(){
  if(G.mode==='table')return G.turn.roll===1&&!G.turn.announced&&G.turn.dice.every(v=>v===0);
  return G.turn.roll===0;
}
function mayUndo(){
  if(!G||!G.undo||!untouched())return false;
  if(G.mode==='daily'||G.mode==='duel')return false;
  if(G.mode==='online')return onlineReady()&&G.undo.current===mySeat()&&(!isBot(G.current)||online.host);
  if(G.mode==='cpu'||G.mode==='pp')return !isBot(G.undo.current);
  return true;
}

/* ---------- game stats: kept for every player in every mode, shown when the game ends ---------- */
function pst(p,g){
  g=g||G;if(!g.stats)g.stats=[];
  let x=g.stats[p];
  if(!x||typeof x!=='object'){x=g.stats[p]={rolls:0,turns:0,faces:[0,0,0,0,0,0],first:0,jambs:0,zeros:0,calls:0,best:null,jambRoll:0,timeouts:0};}
  return x;
}
function countRoll(p,dice,idx){
  const x=pst(p);x.rolls++;
  idx.forEach(i=>{const v=dice[i];if(v>=1&&v<=6)x.faces[v-1]++;});
}
function countWrite(p,c,r,s,turn){
  const x=pst(p);x.turns++;
  if(G.mode==='table'){x.rolls+=Math.max(1,turn.roll||1);turn.dice.forEach(v=>{if(v>=1&&v<=6)x.faces[v-1]++;});}
  if(turn.roll===1)x.first++;
  if(turn.announced)x.calls++;
  if(s===0)x.zeros++;
  if(r==='jamb'&&s>0){x.jambs++;if(!x.jambRoll||turn.roll<x.jambRoll)x.jambRoll=turn.roll||1;}
  if(!x.best||s>x.best.s)x.best={s,r,c};
}

/* ---------- reactions: a fixed set of quick signals between phones in online games. No free text.
   Spam guard on every phone: one reaction per 3 seconds, at most 6 per 30 seconds per player;
   the host drops anything faster before relaying it, and anyone can mute reactions. ---------- */
/* Six character stickers, painted in the café style: Emma, Rosie, Frank, Grandpa, the Professor, Emma again. */
const EMOTES=['hi','wow','nice','gg','wait','ohno'];
const emoSrc=k=>`art/react/${k}.webp`;
let emoLoaded=false;
function emoPreload(){if(emoLoaded)return;emoLoaded=true;EMOTES.forEach(k=>{const i=new Image();i.decoding='async';i.src=emoSrc(k);});}
const EMO_GAP=3000,EMO_WIN=30000,EMO_MAX=6,emoLog={};
function emoAllowed(cid,now){
  const a=(emoLog[cid]=(emoLog[cid]||[]).filter(x=>now-x<EMO_WIN));
  if((a.length&&now-a[a.length-1]<EMO_GAP-200)||a.length>=EMO_MAX)return false;
  a.push(now);return true;
}
const emoOn=()=>!!G&&G.mode==='online'&&onlineReady()&&G.status!=='over'&&!G.over&&mySeat()>=0;
function emoHTML(){
  if(!emoOn())return '';
  emoPreload();
  const cool=Date.now()<(ui.emoCool||0);
  let h=`<button type="button" class="emobtn${cool?' cool':''}${ui.emoOpen?' open':''}" data-act="emo" aria-label="${esc(t('emoBtn'))}" aria-expanded="${!!ui.emoOpen}">${ICON.smile}</button>`;
  if(ui.emoOpen){
    const muted=ui.emoMute||prefs.emotes===false;
    h+=`<div class="emopop" role="menu">${EMOTES.map(k=>`<button type="button" role="menuitem" data-act="emosend" data-e="${k}"${cool?' disabled':''}><img class="es" src="${emoSrc(k)}" alt="" width="64" height="64" draggable="false"><span class="el">${esc(t('emo_'+k))}</span></button>`).join('')}
      <button type="button" class="emomute" data-act="emomute">${esc(muted?t('emoUnmute'):t('emoMute'))}</button></div>`;
  }
  return h;
}
function showEmote(seat,id){
  if(!EMOTES.includes(id)||!G||!G.players[seat])return;
  if(seat!==mySeat()&&(ui.emoMute||prefs.emotes===false))return;
  const chip=document.querySelector(`.chip[data-p="${seat}"]`),r=chip?chip.getBoundingClientRect():{left:innerWidth/2-40,width:80,bottom:70};
  document.querySelectorAll(`.emo[data-p="${seat}"]`).forEach(o=>o.remove());
  const b=document.createElement('div');b.className='emo';b.dataset.p=seat;b.setAttribute('role','status');
  b.innerHTML=`<img class="es" src="${emoSrc(id)}" alt="" width="88" height="88" draggable="false"><span class="el">${esc(name(seat))}: ${esc(t('emo_'+id))}</span>`;
  b.style.setProperty('--pc',PCOL_LITE[seat%6]);
  b.style.setProperty('--rot',(Math.random()*10-5).toFixed(1)+'deg');
  document.body.appendChild(b);
  const w=b.offsetWidth,x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));
  /* under the player's name when it is on screen; when the sheet is scrolled or enlarged, at the top of what is visible */
  const top=Math.max(54,Math.min(innerHeight-b.offsetHeight-140,r.bottom+8));
  b.style.left=x+'px';b.style.top=top+'px';
  setTimeout(()=>{b.classList.add('out');setTimeout(()=>b.remove(),400);},2600);
  A.pop();if(seat!==mySeat())A.haptic(10);
}
function sendEmote(id){
  if(!emoOn()||!EMOTES.includes(id))return;
  const now=Date.now();
  if(!emoAllowed(prefs.cid,now)){toast(t('emoSlow'));return;}
  ui.emoOpen=false;ui.emoCool=now+EMO_GAP;
  showEmote(mySeat(),id);
  const m={t:'emote',cid:prefs.cid,e:id};
  if(online.host)openConns().forEach(c=>sendTo(c,m));else sendTo(net.conn,m);
  renderTray();setTimeout(()=>{if(screen==='game')renderTray();},EMO_GAP+50);
}
function onEmote(d,fromConn){
  if(!G||G.mode!=='online'||typeof d.cid!=='string'||!EMOTES.includes(d.e)||d.cid===prefs.cid)return;
  const seat=G.players.findIndex(p=>p.cid===d.cid);if(seat<0)return;
  if(!emoAllowed(d.cid,Date.now()))return;
  if(online&&online.host)openConns().forEach(c=>{if(c!==fromConn)sendTo(c,{t:'emote',cid:d.cid,e:d.e});});
  showEmote(seat,d.e);
}

/* ---------- turn timer and pause, for games with other people ---------- */
const timerSec=g=>g&&g.timer&&+g.timer.sec||0;
function startClock(g){
  if(!g)return;
  if(!timerSec(g)||g.over){g.deadline=null;g.left=null;return;}
  if(g.paused){g.left=timerSec(g)*1000;g.deadline=null;return;}
  g.deadline=Date.now()+timerSec(g)*1000;g.left=null;
}
function clockLeft(){
  if(!G||!timerSec(G)||G.over)return null;
  if(G.paused)return G.left!=null?G.left:timerSec(G)*1000;
  return G.deadline?G.deadline-Date.now():null;
}
const humanSeats=g=>g.players.map((p,i)=>i).filter(i=>g.players[i].kind!=='cpu');
const clockGame=()=>!!G&&timerSec(G)>0&&!G.over&&(G.mode==='pp'||(G.mode==='online'&&G.status==='playing'));
/* state changes for pause and ready: the host decides for online games, the phone itself for pass and play */
function pauseApply(seat){
  if(!G||G.paused||G.over)return false;
  const left=G.deadline?Math.max(0,G.deadline-Date.now()):timerSec(G)*1000;
  G.paused={by:seat,ready:[]};G.left=left;G.deadline=null;cancelBot();return true;
}
function readyApply(seat,force){
  if(!G||!G.paused)return false;
  const r=G.paused.ready||(G.paused.ready=[]);
  if(seat!=null){const i=r.indexOf(seat);if(i>=0)r.splice(i,1);else r.push(seat);}
  const need=humanSeats(G);
  if(force||need.every(i=>r.includes(i))){G.deadline=Date.now()+(G.left!=null?G.left:timerSec(G)*1000);G.left=null;G.paused=null;}
  return true;
}
function doPause(){
  if(!clockGame()||G.paused)return;
  if(G.mode==='online'&&!online.host){sendTo(net.conn,{t:'pause',cid:prefs.cid});return;}
  const seat=G.mode==='online'?mySeat():G.current;
  if(pauseApply(seat)){A.tap();saveGame(true);render();}
}
function doReady(seat,force){
  if(!G||!G.paused)return;
  if(G.mode==='online'&&!online.host){sendTo(net.conn,{t:'ready',cid:prefs.cid});return;}
  if(readyApply(seat,force)){A.tap();saveGame(true);render();if(!G.paused){A.turn();maybeBot();}}
}
/* Out of time: the dice go into the first free box from the top, leftmost column first, exactly as they lie.
   If there was no roll yet, the game rolls once first. Never better than playing the turn yourself. */
function forceTimeout(away){
  if(ui.forcing||!G||G.over)return;
  ui.forcing=true;const p=G.current,g=G,id=G.id;
  const finish=()=>{
    ui.forcing=false;
    if(G!==g||G.id!==id||G.over||G.current!==p||G.turn.roll<1)return;
    const mv=E.legalList(G.rules,G.players[p].sheet,G.turn)[0];
    if(!mv)return;
    pst(p).timeouts++;
    toast(t(away?'awayDone':'tTimeout',{name:name(p),row:rowName(mv.r)+' '+E.COLS[mv.c].sym}));
    ui.sel=null;writeCore(mv.c,mv.r);
  };
  if(G.turn.roll===0)rollCore(finish);else finish();
}
/* The host can move on for a player whose phone has been gone for a while (any game, with or without a timer). */
const AWAY_MS=8000;
function awaySeat(){
  if(!G||G.mode!=='online'||!online||!online.host||!onlineReady()||G.status!=='playing'||G.over||G.paused)return -1;
  const s=G.current,p=G.players[s];
  if(!p||p.kind==='cpu'||s===mySeat()||openConns().some(c=>c._cid===p.cid))return -1;
  return s;
}
function awayNow(){const s=awaySeat();return s>=0&&net.away&&net.away.seat===s&&Date.now()-net.away.t>=AWAY_MS;}
setInterval(()=>{
  const s=awaySeat();
  if(s<0)net.away=null;else if(!net.away||net.away.seat!==s)net.away={seat:s,t:Date.now()};
  /* once the host has moved on for a phone, its later turns pass by themselves until that phone is back */
  if(s>=0&&net.skip.has(G.players[s].cid)&&Date.now()-net.away.t>=3000&&!ui.rolling&&!ui.forcing){forceTimeout(true);return;}
  const show=awayNow();
  if(show!==!!ui.awayShown){ui.awayShown=show;if(screen==='game'&&G&&G.mode==='online'&&!ui.rolling)renderTray();}
},1000);
let lastTick=-1;
setInterval(()=>{
  if(screen!=='game'||!clockGame())return;
  const left=clockLeft();if(left==null)return;
  const el=$('clock');
  if(el){const sec=Math.max(0,Math.ceil(left/1000));el.textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');el.classList.toggle('low',sec<=10&&!G.paused);}
  const bar=$('clockbar');if(bar)bar.style.transform='scaleX('+Math.max(0,Math.min(1,left/(timerSec(G)*1000))).toFixed(3)+')';
  if(G.paused||isBot(G.current))return;
  const mine=G.mode==='pp'||G.current===mySeat();
  const sec=Math.ceil(left/1000);
  if(mine&&sec<=10&&sec>0&&sec!==lastTick){lastTick=sec;A.tick();}
  if(left>0||ui.rolling)return;
  /* the player's own phone acts; the host covers for a phone that has dropped out */
  const cover=G.mode==='online'&&online&&online.host&&G.current!==mySeat()&&left<-5000&&!openConns().some(c=>c._cid===G.players[G.current].cid);
  if(mine||cover)forceTimeout();
},250);

/* ---------- turn actions ---------- */
function doRoll(){if(canRoll())rollCore();}
function rollCore(after){
  const g=G,p=G.current,before=clone(G.turn);
  const next=E.rollDice(G.turn,G.seed||null,turnNo(p));
  if(shouldLog())logEvent({k:'roll',turn:before,out:next.dice.slice()});
  G.undo=null;ui.sel=null;ui.tip=null;ui.tipText='';setView(p);
  const held=before.roll===0?before.held.map(()=>false):before.held.slice();
  const idx=held.map((h,i)=>h?-1:i).filter(i=>i>=0);
  countRoll(p,next.dice,idx);
  /* The result is saved (and sent to the other phones) straight away, so everyone watches the same roll at the same time. */
  G.turn=next;saveGame();
  rollFx(idx,()=>{
    if(G!==g)return;
    if(after)after();
  });
}
/* A roll from another phone that arrived while dice were still tumbling plays as soon as they land. */
function rollChain(){
  if(ui.rolling)return;
  if(!ui.rollNext){if(ui.holdTurn){ui.holdTurn=null;render();}if(!bot.live)maybeBot();return;}
  const idx=ui.rollNext;ui.rollNext=null;ui.holdTurn=null;rollFx(idx);
}
/* ---------- shaking the tray ----------
   The dice to be thrown rattle on the silver tray while it shakes. Holding Roll or shaking the phone keeps it
   shaking until you let go; a tap, the computer and other phones get a short shake. Then the cups spin and settle. */
const CUP_MIN=340,SPIN_TICKS=7;
/* the dice the next roll will throw: all of them on the first roll, otherwise the ones not kept */
function freeIdx(){const t=G&&G.turn;if(!t)return [];const h=t.roll===0?t.held.map(()=>false):t.held;return h.map((x,i)=>x?-1:i).filter(i=>i>=0);}
function cupStart(idx){
  if(reduce||!idx||!idx.length||screen!=='game'||ui.cup)return !!ui.cup;
  const el=$('dice');if(!el)return false;
  ui.cup={idx:idx.slice(),t0:performance.now()};
  el.classList.add('shaking');
  el.querySelectorAll('.die').forEach((d,i)=>{if(idx.includes(i)){d.classList.add('incup');if(!d.querySelector('.spin'))d.innerHTML=spinHTML(i);}});
  return true;
}
function cupStop(){
  ui.cup=null;
  const el=$('dice');if(el)el.classList.remove('shaking');
  document.querySelectorAll('#dice .die.incup').forEach(d=>d.classList.remove('incup'));
}
/* the shake is over: the cups are let go */
function cupPour(){cupStop();}
/* a hold that ended without a roll, or the game changed underneath */
function cupCancel(){if(ui.cup){cupStop();if(screen==='game'&&G&&!ui.rolling)renderTray();}}
/* Dice that were thrown rattle on the shaking tray, spin with their faces changing, then settle one by one. Phones set to reduce motion get a quick face flip instead. */
function rollFx(idx,done){
  clearInterval(ui.rollT);clearTimeout(ui.cupT);
  const g=G;
  if(reduce||!idx.length){
    cupCancel();
    ui.rolling=false;ui.rollIdx=null;A.land(idx.length||1,LAND_STEP);render();
    document.querySelectorAll('#dice .die').forEach((d,i)=>{if(!idx.includes(i))return;d.classList.remove('flip');void d.offsetWidth;d.classList.add('flip');setTimeout(()=>d.classList.remove('flip'),360);});
    if(done)done();rollChain();return;
  }
  /* already shaking from a held Roll or a shaken phone? Then it only needs to finish its minimum shake */
  const was=!!ui.cup;
  if(!was)cupStart(idx);
  const wait=ui.cup?Math.max(0,CUP_MIN-(performance.now()-ui.cup.t0)):0;
  /* the spin is timed to settle as the cups land */
  if(!was||wait>80)A.shake(wait+SPIN_TICKS*62);else A.spin(wait+SPIN_TICKS*62);
  ui.rolling=true;ui.rollIdx=idx;render();
  ui.cupT=setTimeout(()=>{
  if(G!==g){cupCancel();ui.rolling=false;ui.rollIdx=null;return;}
  cupPour();
  let n=0;
  ui.rollT=setInterval(()=>{
    if(G!==g){clearInterval(ui.rollT);ui.rolling=false;ui.rollIdx=null;return;}
    tickDice(++n);
    if(n>=SPIN_TICKS){
      clearInterval(ui.rollT);ui.rolling=false;ui.rollIdx=null;
      A.land(idx.length,LAND_STEP);render();landFx(idx);
      const st=document.querySelector('#tray .status .st');if(st)FX.pulse(st,'bump',460);
      if(done)done();
      rollChain();
    }
  },62);
  },wait);
}
function toggleHold(i){
  const t=G.turn;
  if(!mayAct()||ui.rolling||G.mode==='table'||t.roll<1||t.roll>=3||!E.canRollAgain(G.rules,cur().sheet,t))return;
  t.held[i]=!t.held[i];ui.tip=null;ui.tipText='';ui.popDie=t.held[i]?i:-1;ui.dropDie=t.held[i]?-1:i;A.hold(t.held[i]);saveGame();render();ui.popDie=-1;ui.dropDie=-1;
}
function onCell(c,r){
  if(!canWriteUI(G.current,c,r))return;
  const s=ui.sel;
  if(s&&s.c===c&&s.r===r){
    if(c==='ann'&&!G.turn.announced)return;
    writeCore(c,r);return;
  }
  ui.sel={c,r};A.tap();render();
}
function doAnnounce(r){
  if(!mayAct()||!E.canAnnounce(G.rules,cur().sheet,G.turn,r))return;
  if(shouldLog())logEvent({k:'ann',turn:clone(G.turn),r});
  G.turn.announced=r;ui.sel=null;ui.tip=null;ui.tipText='';A.write();saveGame();render();
}
/* Each moved die settles with a small squash, one after another, in time with the landing sounds. */
function landFx(idx){
  if(FX.reduce)return;
  const ds=document.querySelectorAll('#dice .die');
  idx.forEach((i,k)=>{const d=ds[i];if(!d)return;d.style.animationDelay=(k*LAND_STEP)+'ms';FX.pulse(d,'landed',380+k*LAND_STEP);});
}
/* The written score floats up from the sheet; a Jamb throws confetti and nudges the table. */
function writeFx(p,r,s){
  const w=document.querySelector('.paper .w.just');
  if(w)FX.floatText(w,s>0?'+'+fmt(s):'0',s>0?'':'zero',s>0?PCOL_LITE[p%6]:'');
  if(r==='jamb'&&s>0){FX.confetti(false);FX.pulse($('game'),'fxshake',450);}
}
function writeCore(c,r){
  if(!legal(c,r))return;
  const p=G.current,sheet=cur().sheet,before=clone(G.turn);
  const s=E.score(G.rules,r,G.turn.dice,G.turn.roll);
  const logLen=G.log.length;
  if(shouldLog())logEvent({k:'write',turn:before,c,r});
  const hadBonus=E.colTotals(G.rules,sheet[c]).bonus>0;
  const statsBefore=clone(G.stats||[]);countWrite(p,c,r,s,G.turn);
  G.undo={players:clone(G.players),current:G.current,turn:clone(G.turn),over:G.over,view:G.view,logLen,stats:statsBefore};
  sheet[c][r]=s;
  ui.sel=null;ui.botPick=null;ui.tip=null;ui.tipText='';ui.just={p,c,r};ui.pick=-1;
  if(s===0)A.zero();else if(r==='jamb')A.jamb();else A.write();
  if(!hadBonus&&E.colTotals(G.rules,sheet[c]).bonus>0)setTimeout(()=>{A.bonus();FX.burstAt(document.querySelector(`.chip[data-p="${p}"]`));},320);
  react(p,r,s);
  setView(p);
  if(allFull())G.over=true;
  else{G.current=(G.current+1)%G.players.length;G.turn=freshTurn(G);}
  startClock(G);
  if(G.mode==='online')G.status=G.over?'over':'playing';
  saveGame();render();writeFx(p,r,s);
  setTimeout(()=>{ui.just=null;},700);
  if(G.over)finishGame();else maybeBot();
}
function doUndo(){
  if(!mayUndo())return;
  cancelBot();
  const u=G.undo,now=G.players;
  u.players.forEach((p,i)=>{if(now[i]){p.cid=now[i].cid;p.name=now[i].name;}});
  G.players=u.players;G.current=u.current;G.turn=u.turn;G.over=u.over;G.view=u.view;if(u.stats)G.stats=u.stats;
  if(Array.isArray(G.log))G.log.length=Math.min(G.log.length,u.logLen||0);
  if(G.mode==='online'){G.status='playing';ui.view=G.current;}
  startClock(G);
  G.undo=null;ui.sel=null;ui.just=null;saveGame();render();
}
function hintsAllowed(){
  if(!prefs.hints||!coachGame(G)||!mayAct()||ui.rolling)return false;
  return G.mode==='table'?diceSet():G.turn.roll>=1;
}
function describe(a,dice){
  if(!a)return '';
  if(a.type==='write')return t('aWrite',{s:E.score(G?G.rules:prefs.rules,a.r,dice,a.roll||1),row:rowName(a.r),col:E.COLS[a.c].sym});
  const kept=dice.filter((v,i)=>a.held[i]).sort((x,y)=>x-y).join(' ');
  if(a.type==='announce')return t('aAnn',{row:rowName(a.r),dice:kept||'–'});
  return kept?t('aKeep',{dice:kept}):t('aRerollAll');
}
function showHint(){
  if(!hintsAllowed())return;
  let b=null;try{b=AI.best({rules:G.rules,sheet:cur().sheet,turn:G.turn});}catch(e){b=null;}
  if(!b)return;
  tally('hint');
  const a=b.action;a.roll=G.turn.roll;
  ui.tip=a;ui.tipText=describe(a,G.turn.dice);A.stir();render();
}

/* ---------- characters ---------- */
function say(i,ev,vars,fromNet){
  const p=G&&G.players[i];if(!p||p.kind!=='cpu')return;
  /* in a game on several phones the computers live on the host's phone; it tells the others what they say,
     and each phone picks the words in its own language */
  if(G.mode==='online'&&!fromNet){if(!(online&&online.host))return;const m={t:'say',i,ev,vars:vars||null};openConns().forEach(c=>sendTo(c,m));}
  const lines=tl('ch.'+p.char+'.'+ev);if(!lines.length)return;
  let s=lines[Math.floor(Math.random()*lines.length)];
  for(const k in (vars||{}))s=s.split('{'+k+'}').join(k==='row'?rowName(vars[k]):vars[k]);
  ui.bubble={i,text:s};clearTimeout(ui.bubbleT);
  ui.bubbleT=setTimeout(()=>{ui.bubble=null;if(screen==='game')renderBubble();},4200);
  if(screen==='game')renderBubble();
}
const botSeats=()=>G?G.players.map((p,i)=>i).filter(i=>G.players[i].kind==='cpu'):[];
function someBot(except){const b=botSeats().filter(i=>i!==except);return b.length?b[Math.floor(Math.random()*b.length)]:-1;}
function react(p,r,s){
  if(!G||!botSeats().length)return;
  if(isBot(p)){if(r==='jamb'&&s>0)say(p,'myJamb');else if(s===0&&LOWER.includes(r))say(p,'myZero');return;}
  const b=someBot(-1);if(b<0)return;
  if(r==='jamb'&&s>0)say(b,'yourJamb');else if(s===0&&LOWER.includes(r))say(b,'yourZero');else if(s>=50)say(b,'yourBig');
}

/* ---------- computer turns ---------- */
const bot={tk:0,timer:0,live:false};
function cancelBot(){bot.tk++;clearTimeout(bot.timer);bot.live=false;ui.botPick=null;}
function botTurn(){return screen==='game'&&G&&!G.over&&!G.paused&&(G.mode==='cpu'||G.mode==='pp'||(G.mode==='online'&&!!online&&online.host&&onlineReady()&&G.status==='playing'))&&isBot(G.current);}
function botLater(ms,fn){const tk=bot.tk;clearTimeout(bot.timer);bot.live=true;bot.timer=setTimeout(()=>{if(tk!==bot.tk)return;bot.live=false;if(botTurn())fn();},ms);}
setInterval(()=>{if(!bot.live&&!ui.rolling&&botTurn())maybeBot();},1500);
function maybeBot(){if(botTurn()&&!ui.rolling)botLater(G.turn.roll===0?1400:900,botStep);}
function botStep(){
  const tn=G.turn;
  if(tn.roll===0){botRoll();return;}
  let a=null;
  try{a=AI.decide({rules:G.rules,sheet:cur().sheet,turn:tn},cur().char);}catch(e){a=null;}
  if(a&&a.type==='write'&&legal(a.c,a.r)){ui.botPick={c:a.c,r:a.r};setView(G.current);render();botLater(950,()=>writeCore(a.c,a.r));return;}
  if(a&&a.type==='announce'&&E.canAnnounce(G.rules,cur().sheet,tn,a.r)){tn.announced=a.r;say(G.current,'calls',{row:a.r});saveGame();render();botLater(900,()=>botHold(a.held));return;}
  if(a&&a.type==='hold'&&E.canRollAgain(G.rules,cur().sheet,tn)){botHold(a.held);return;}
  const l=E.legalList(G.rules,cur().sheet,tn);if(l.length)writeCore(l[0].c,l[0].r);
}
function botHold(h){G.turn.held=(h||[]).slice(0,G.rules.dice).map(Boolean);saveGame();render();botLater(750,botRoll);}
function botRoll(){if(!ui.rolling&&E.canRollAgain(G.rules,cur().sheet,G.turn))rollCore(()=>botLater(1000,botStep));}

/* ---------- game end, review, daily, duel ---------- */
function standings(g){return g.players.map((p,i)=>({i,score:E.total(g.rules,p.sheet)})).sort((a,b)=>b.score-a.score);}
function finishGame(){
  cancelBot();
  if(G.mode==='online'&&(stats.recIds||[]).includes(G.id))return;   /* already counted on this phone */
  const st=standings(G),me=mySeat();
  if(C){C.event('finish',G.mode);finishStats(G);}
  stats.played=(stats.played||0)+1;
  if(G.mode==='cpu'&&!prefs.guideDone){prefs.guideDone=true;savePrefs();ui.guideEnd=true;}
  if(me>=0){const ms=E.total(G.rules,G.players[me].sheet);if(ms>(stats.best||0))stats.best=ms;if(st[0].i===me&&G.players.length>1&&st[0].score>st[1].score)stats.wins=(stats.wins||0)+1;}
  if(botSeats().length){const w=st[0].i,b=isBot(w)?w:someBot(-1);if(b>=0)setTimeout(()=>say(b,b===w?'win':'lose'),900);}
  const many=G.players.length>1;
  if(me>=0&&st[0].i===me)setTimeout(()=>{A.win();if(many&&screen==='game')FX.confetti(true);},700);
  if(G.mode==='daily')finishDaily();
  recordGame(G);
  if(G.mode==='duel'){stats.duels[G.duel.id]={score:E.total(G.rules,G.players[0].sheet),at:Date.now(),from:G.duel.from||null};}
  saveStats();
  const g=G,gid=G.id;
  setTimeout(()=>{if(G===g&&G.id===gid&&G.over&&screen==='game')openModal('result');},1300);
  startReview(g);
}
function grade(loss){return loss<0.5?'best':loss<3?'good':loss<8?'inacc':loss<20?'mistake':'blunder';}
const GRADE_COL={best:'#4E7A55',good:'#6E8F4A',inacc:'#A07A1E',mistake:'#A5532E',blunder:'#8E2A22'};
function startReview(g){
  const seats=g.players.map((p,i)=>i).filter(i=>g.players[i].kind==='human'&&g.log.some(ev=>ev.p===i));
  g.review=g.review||{};
  seats.forEach(p=>{if(!g.review[p])runReview(g,p);});
}
function runReview(g,p){
  const evs=g.log.filter(ev=>ev.p===p);
  const out={done:false,acc:0,lost:0,luck:0,moves:[],n:0,progress:0};
  g.review[p]=out;
  let i=0,turn=0,accSum=0;
  const step=()=>{
    if(G!==g&&screen==='game'){/* game was left: keep going quietly */}
    const t0=Date.now();
    while(i<evs.length&&Date.now()-t0<30){
      const ev=evs[i++],st={rules:g.rules,sheet:ev.sheet,turn:ev.turn};
      try{
        if(ev.k==='roll'){
          out.luck+=AI.luck(st,ev.out);
          if(ev.turn.roll>=1){const j=AI.judge(st,{type:'hold',held:ev.turn.held});rec(j,{type:'hold',held:ev.turn.held},ev);}
        }else if(ev.k==='write'){turn++;const j=AI.judge(st,{type:'write',c:ev.c,r:ev.r});rec(j,{type:'write',c:ev.c,r:ev.r,roll:ev.turn.roll},ev);}
        else if(ev.k==='ann'){const j=AI.judge(st,{type:'announce',r:ev.r});rec(j,{type:'announce',r:ev.r,held:ev.turn.dice.map(()=>false)},ev);}
      }catch(e){}
    }
    out.progress=evs.length?i/evs.length:1;
    if(i<evs.length){setTimeout(step,0);return;}
    out.acc=out.n?Math.round(accSum/out.n):100;out.done=true;
    out.moves.sort((a,b)=>b.loss-a.loss);out.moves=out.moves.filter(m=>m.loss>=3).slice(0,5);
    if(g.mode!=='online'&&G===g)saveGame();
    if(ui.modal&&ui.modal.kind==='result')renderModal();
  };
  function rec(j,act,ev){
    if(!j)return;
    out.n++;accSum+=Math.max(0,100-4*j.loss);out.lost+=j.loss;
    if(j.loss>=3){const b=j.best;b.roll=ev.turn.roll;out.moves.push({turn:turn+(ev.k==='write'?0:1),loss:j.loss,grade:grade(j.loss),did:describe(act,ev.turn.dice),better:describe(b,ev.turn.dice)});}
  }
  setTimeout(step,50);
}
function dailyToday(){const day=E.localDay();return{day,n:E.dailyNumber(day)};}
function dailyRules(){return E.normRules(E.DAILY_RULES);}
function startDaily(){
  const d=dailyToday(),res=stats.daily.results[d.day];
  if(res&&res.done){openModal('daily',{day:d.day});return;}
  const g=loadSlot('daily');
  if(g&&g.daily&&g.daily.day===d.day&&!g.over){openGame(g);return;}
  openGame(makeGame('daily',dailyRules(),[{name:myName()||null,kind:'human'}],{seed:'daily:'+d.day,daily:d}));
}
function qualityGrid(rules,sheet){
  const par=AI.parsFor(rules).S,out=[];
  for(const c of rules.cols)ROWS.forEach((r,ri)=>{
    const v=sheet[c][r];if(v===null){out.push(0);return;}
    if(ri===7){out.push(v<=par[7]?2:1);return;}
    out.push(v===0?0:(v>=par[ri]*1.25?2:1));
  });
  return out;
}
function finishDaily(){
  const d=G.daily,score=E.total(G.rules,G.players[0].sheet);
  const prev=stats.daily.last;
  const yest=E.localDay(new Date(Date.now()-864e5));
  stats.daily.streak=prev===yest?(stats.daily.streak||0)+1:(prev===d.day?stats.daily.streak||1:1);
  stats.daily.last=d.day;stats.daily.maxStreak=Math.max(stats.daily.maxStreak||0,stats.daily.streak||0);
  /* the moves are kept with the result, checked here first: played again from the list they must give the same score */
  const moves=dailyMoves(G),again=E.replayMoves(G.rules,G.seed,moves);
  stats.daily.results[d.day]={done:true,score,n:d.n,grid:qualityGrid(G.rules,G.players[0].sheet),prof:null,moves:again&&again.total===score?moves:null,at:Date.now()};
  const keys=Object.keys(stats.daily.results).sort();while(keys.length>60)delete stats.daily.results[keys.shift()];
  saveStats();clearSlot('daily');
  delete boards['d'+d.day];delete boards['w'+d.day];sendDailies().then(acctUI);
  profPlay(G.seed,G.rules,s=>{const r=stats.daily.results[d.day];if(r){r.prof=s;saveStats();}if(ui.modal&&(ui.modal.kind==='result'||ui.modal.kind==='daily'))renderModal();if(screen==='home')renderHome();});
}
function profPlay(seed,rules,cb){
  const sheet=E.newSheet(rules);let tn=0;
  const step=()=>{
    if(E.full(rules,sheet)){cb(E.total(rules,sheet));return;}
    let turn=E.rollDice(E.freshTurn(rules.dice),seed,tn);
    for(let guard=0;guard<6;guard++){
      const a=AI.decide({rules,sheet,turn},'profesor');if(!a)break;
      if(a.type==='write'){sheet[a.c][a.r]=E.score(rules,a.r,turn.dice,turn.roll);break;}
      if(a.type==='announce')turn.announced=a.r;
      turn.held=a.held;turn=E.rollDice(turn,seed,tn);
    }
    tn++;setTimeout(step,0);
  };
  setTimeout(step,30);
}
const baseUrl=()=>location.origin+location.pathname;
function dailyShareText(day){
  const r=stats.daily.results[day];if(!r)return '';
  const sq=r.grid.map(q=>q===2?'🟨':q===1?'🟦':'⬜').join('');
  return `${t('daily')} · ${dateLabel(day)} · ${r.score}\n${sq}${r.prof!=null?'\n'+t('profScore',{s:r.prof}):''}\n${baseUrl()}`;
}
/* the Daily result as a picture: the morning scene, the slip with the score, and the squares */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function dailyImage(day){
  const r=stats.daily.results[day];if(!r)return null;
  const W=1080,H=1350,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const css=getComputedStyle(document.documentElement),fam=v=>(css.getPropertyValue(v)||'').trim();
  const fUI=fam('--f-ui')||'sans-serif',fR=fam('--f-receipt')||'monospace',fS=fam('--f-sign')||'serif';
  try{await Promise.all([`700 40px ${fUI}`,`400 40px ${fR}`,`400 60px ${fS}`].map(f=>document.fonts.load(f)));}catch(e){}
  x.fillStyle='#2A1A0D';x.fillRect(0,0,W,H);
  try{const img=await loadImg('art/daily-800.webp'),hh=640,sc=Math.max(W/img.width,hh/img.height);
    x.save();x.beginPath();x.rect(0,0,W,hh);x.clip();x.drawImage(img,(W-img.width*sc)/2,(hh-img.height*sc)/2,img.width*sc,img.height*sc);x.restore();
    const gr=x.createLinearGradient(0,380,0,hh);gr.addColorStop(0,'rgba(42,26,13,0)');gr.addColorStop(1,'rgba(42,26,13,1)');x.fillStyle=gr;x.fillRect(0,380,W,hh-380);}catch(e){}
  const cx=140,cy=450,cw=800,chh=770;
  x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=40;x.shadowOffsetY=16;x.fillStyle='#FBF6EA';x.fillRect(cx,cy,cw,chh);x.restore();
  const mid=cx+cw/2,line=y=>{x.strokeStyle='#C9C2B5';x.setLineDash([10,8]);x.lineWidth=3;x.beginPath();x.moveTo(cx+50,y);x.lineTo(cx+cw-50,y);x.stroke();x.setLineDash([]);};
  x.textAlign='center';x.fillStyle='#C8322B';x.font=`700 34px ${fUI}`;x.fillText(t('daily').toUpperCase().split('').join(String.fromCharCode(8202)),mid,cy+80);
  x.fillStyle='#1F3FA6';x.font=`400 64px ${fS}`;x.fillText(t('dailyTitle'),mid,cy+160);
  x.fillStyle='#6B655C';x.font=`400 30px ${fR}`;x.fillText(dateLabel(day),mid,cy+210);
  line(cy+250);
  const q=['#C9C2B5','#1F3FA6','#E0A800'],n=r.grid.length,sz=Math.min(46,Math.floor((cw-100-(n-1)*8)/n)),gw=n*sz+(n-1)*8;
  r.grid.forEach((v,i)=>{x.fillStyle=q[v]||q[0];x.fillRect(mid-gw/2+i*(sz+8),cy+290,sz,sz);});
  line(cy+380);
  const row=(label,val,y,big)=>{x.textAlign='left';x.fillStyle='#2A2520';x.font=`${big?700:400} ${big?44:34}px ${fR}`;x.fillText(label,cx+60,y);x.textAlign='right';x.font=`700 ${big?72:38}px ${fR}`;x.fillText(String(val),cx+cw-60,y+(big?10:0));};
  row(t('total').toUpperCase(),r.score,cy+470,true);
  if(r.prof!=null)row(CHARS.profesor.name,r.prof,cy+550);
  row(t('streakShort'),stats.daily.streak||1,cy+610);
  line(cy+660);
  x.textAlign='center';x.fillStyle='#6B655C';x.font=`400 28px ${fR}`;x.fillText(t('dailySame'),mid,cy+715);
  x.fillStyle='#F6EEDC';x.font=`700 34px ${fUI}`;x.fillText('Yamb Café',mid,cy+chh+78);
  return new Promise(res=>cv.toBlob(b=>res(b),'image/png'));
}
async function shareDaily(day){
  const text=dailyShareText(day);
  try{
    const blob=await dailyImage(day);
    if(blob){
      const file=new File([blob],'jamb-daily-'+day+'.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return;}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);
      try{await navigator.clipboard.writeText(text);}catch(e){}
      toast(t('savedPic'));return;
    }
  }catch(e){if(e&&e.name==='AbortError')return;}
  shareText(text,'');
}
function startDuel(quick){
  const id=uid()+uid();
  const rules=quick?E.normRules({cols:['free']}):prefs.rules;
  openGame(makeGame('duel',rules,[{name:myName()||null,kind:'human'}],{seed:'duel:'+id,duel:{id,quick:!!quick,from:null}}));
}
function duelLink(){
  const me=E.total(G.rules,G.players[0].sheet),o={i:G.duel.id,r:E.encodeRules(G.rules),n:myName()||t('player',{n:1}),s:me};
  if(G.duel.from)o.vs={n:G.duel.from.n||G.duel.from.name,s:G.duel.from.s!=null?G.duel.from.s:G.duel.from.score};
  return baseUrl()+'?duel='+E.encodeObj(o);
}
function acceptDuel(o){
  const rules=E.decodeRules(o.r)||prefs.rules;
  openGame(makeGame('duel',rules,[{name:myName()||null,kind:'human'}],{seed:'duel:'+o.i,duel:{id:o.i,quick:rules.cols.length===1,from:{n:o.n,s:o.s}}}));
}

/* ---------- screens ---------- */
function showScreen(s){
  if(s==='home'&&ui.fresh&&screen==='game'){ui.fresh=false;prefs.screen='home';savePrefs();location.reload();return;}   /* a newer version arrived during the game */
  if(s!=='game')cupCancel();
  screen=s;prefs.screen=s;prefs.mode=G?G.mode:null;savePrefs();
  $('home').hidden=s!=='home';$('game').hidden=s!=='game';$('tray').hidden=s!=='game';
  document.documentElement.lang=I.locale(prefs.lang);
  applyAudio();
  if(s==='home'){A.motion.stop();renderHome();FX.enter($('home'));}else{render();setupMotion();FX.enter($('game'));FX.enter($('tray'),'trayin');}
  try{window.scrollTo(0,0);}catch(e){}
}
/* visitor numbers: what was chosen for this game (once per game, by the device that runs it) and what was used in it */
function rulesTag(g){if(g.mode==='daily')return 'daily';for(const p of ['classic','quick','family','six','full'])if(E.sameRules(g.rules,E.presetRules(p)))return p;return 'custom';}
function startStats(g){
  if(g.mode==='online'&&!(online&&online.host))return;
  const it=[['rules',rulesTag(g),1],['players',String(g.players.length),1]];
  g.players.forEach(p=>{if(p.kind==='cpu'&&p.char)it.push(['opp',p.char,1]);});
  C.stats(it);
}
function tally(k){if(!G)return;if(!ui.tally||ui.tally.id!==G.id)ui.tally={id:G.id,hint:0,emo:0};ui.tally[k]++;}
function finishStats(g){
  const it=[],min=Math.round((Date.now()-(g.created||Date.now()))/60000),tl=ui.tally&&ui.tally.id===g.id?ui.tally:null;
  if(min>=1&&min<=180)it.push(['len',g.mode,min]);          /* a game left open for days says nothing about its length */
  if(tl&&tl.hint)it.push(['hint',g.mode,tl.hint]);
  if(tl&&tl.emo)it.push(['emo',g.mode,tl.emo]);
  C.stats(it);
}
function openGame(g){
  cancelBot();
  if(G&&G.mode==='online'&&g.mode!=='online'){destroyPeer();online=null;}
  if(!g.over&&!(g.log&&g.log.length)&&!(ui.counted||(ui.counted=new Set())).has(g.id)){ui.counted.add(g.id);if(C){C.event('start',g.mode);startStats(g);}}
  G=g;ui.sel=null;ui.tip=null;ui.tipText='';ui.botPick=null;ui.just=null;ui.view=null;ui.pick=-1;ui.bubble=null;
  ui.rollNext=null;ui.holdTurn=null;ui.forcing=false;ui.awayShown=false;net.away=null;if(g.mode!=='online')net.skip.clear();
  if(G.mode==='pp'&&timerSec(G)&&!G.paused&&!G.over)startClock(G);
  closeModal();showScreen('game');
  if(G.mode!=='online')saveGame();
  if(progress(G)===0&&G.mode!=='online'){const b=someBot(-1);if(b>=0)setTimeout(()=>say(b,'greet'),500);}
  maybeBot();
}
function progress(g){return g.players.reduce((a,p)=>a+E.filled(g.rules,p.sheet),0);}
function goHome(){
  cancelBot();A.rattleStop();
  if(G){
    if(G.mode==='online'){if(G.over)clearOnline();else saveOnline();destroyPeer();online=null;net.state='idle';}
    else if(G.over)clearSlot(G.mode);else saveGame();
  }
  closeModal();showScreen('home');
}
function endSaved(m){
  if(m==='online'){clearOnline();if(G&&G.mode==='online'){destroyPeer();online=null;}}
  else clearSlot(m);
  ui.endAsk=null;
  if(screen==='game'&&G&&G.mode===m){G=null;closeModal();showScreen('home');}else renderHome();
}
function resumeSaved(m){
  if(m==='online'){const s=loadOnline();if(s)resumeOnline(s);return;}
  const g=loadSlot(m);if(g)openGame(g);
}
function rematch(){
  if(!G)return;
  const plist=G.players.map(p=>({name:p.name,kind:p.kind,char:p.char,cid:p.cid}));
  const st=((G.starter||0)+1)%plist.length;
  if(G.mode==='online'){
    if(!G.over)return;
    const g=makeGame('online',G.rules,plist,{code:G.code,status:'playing',rev:G.rev||0,pos:G.pos,timer:G.timer||null});g.starter=st;g.current=st;startClock(g);
    cancelBot();for(const k of Object.keys(G))delete G[k];Object.assign(G,g);   /* same game object, so the other phones' moves keep landing in it */
    ui.view=st;ui.sel=null;ui.just=null;saveGame();closeModal();render();maybeBot();return;
  }
  const g=makeGame(G.mode,G.rules,plist,{timer:G.timer||null});g.starter=st;g.current=st;g.view=st;startClock(g);
  openGame(g);
}

/* ---------- rendering helpers ---------- */
/* every die in the game is one of the six porcelain cup-dice (art/cup), loaded up front so rolls never flash.
   The score sheet's row labels keep the small painted die faces (art/dice): at that size they read better. */
const DICE=[0,1,2,3,4,5,6].map(v=>v?`art/cup/${v}.webp`:'');
const FACES=[0,1,2,3,4,5,6].map(v=>v?`art/dice/${v}.webp`:'');
DICE.forEach(s=>{if(s){const im=new Image();im.decoding='async';im.src=s;}});
['art/tray.webp','art/saucer.webp','art/cup/spin.webp'].forEach(s=>{const im=new Image();im.decoding='async';im.src=s;});
function pipsHTML(v){
  if(!v)return '';
  return `<img class="dface" src="${DICE[v]}" alt="" width="192" height="169" draggable="false">`;
}
const mdie=v=>`<span class="mdie" aria-hidden="true">${pipsHTML(v)}</span>`;
/* the sheet's upper rows are labelled with the same painted dice */
function miniFace(v){return `<img class="mini" src="${FACES[v]}" alt="" aria-hidden="true" width="48" height="48" draggable="false">`;}
const ICON={
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.6 L10.2 1.7 L13.8 1.7 L14.1 4.6 L15.8 5.3 L18.0 3.5 L20.5 6.0 L18.7 8.2 L19.4 9.9 L22.3 10.2 L22.3 13.8 L19.4 14.1 L18.7 15.8 L20.5 18.0 L18.0 20.5 L15.8 18.7 L14.1 19.4 L13.8 22.3 L10.2 22.3 L9.9 19.4 L8.2 18.7 L6.0 20.5 L3.5 18.0 L5.3 15.8 L4.6 14.1 L1.7 13.8 L1.7 10.2 L4.6 9.9 L5.3 8.2 L3.5 6.0 L6.0 3.5 L8.2 5.3Z"></path><circle cx="12" cy="12" r="3.2"></circle></svg>',
  back:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M10 3L5 8l5 5"></path></svg>',
  chev:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 3l5 5-5 5"></path></svg>',
  zoom:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 21 21M8 10.5h5M10.5 8v5"></path></svg>',
  smile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 14.5c1 1.4 2.4 2.1 4 2.1s3-.7 4-2.1"></path><circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"></circle></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
  bulb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1.3 1.7 1.5 2.5h5c.2-.8.7-1.7 1.5-2.5A6 6 0 0 0 12 3z"></path></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 20.5c1.1-3.7 4.2-5.7 8-5.7s6.9 2 8 5.7"></path></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"></path><path d="M17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3"></path></svg>',
  ask:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4"></path><path d="M12 17h.01"></path></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 19V5"></path></svg>'
};
function dots(level){let s='<span class="dots" aria-hidden="true">';for(let i=0;i<5;i++)s+=`<i class="${i<=level?'on':''}"></i>`;return s+'</span>';}
function coasterHTML(ch,extra){
  const c=CHARS[ch];
  return `<button type="button" class="coaster" data-act="pickchar" data-ch="${ch}" style="--ring:${c.ring}" ${extra||''}>
    <span class="cdisc">${avatar(ch)}</span><span class="cname">${esc(c.name)}</span><span class="chabit">${esc(t('ch.'+ch+'.habit'))}</span>${dots(AI.CHARACTERS[ch].level)}</button>`;
}
function rulesSummary(r){
  r=E.normRules(r);
  const parts=[r.cols.map(c=>E.COLS[c].sym).join(' '),t('nDice',{n:r.dice})];
  parts.push(r.kenta==='roll'?`${rowName('kenta')} ${r.k1}/${r.k2}/${r.k3}`:`${rowName('kenta')} ${r.ks}/${r.kb}`);
  if(r.bonus)parts.push(t('bonusShort',{a:r.bonusAt,b:r.bonus}));
  return parts.join(' · ');
}
/* rules by name: the preset's name, or "Your rules", with the column and dice count. The full detail lives in House rules. */
function rulesBrief(r){
  r=E.normRules(r);let name=t('rulesCustom');
  for(const k of Object.keys(E.PRESETS))if(E.sameRules(r,E.presetRules(k))){name=t('p_'+k);break;}
  return [name,t('nCols',{n:r.cols.length}),t('nDice',{n:r.dice})].join(' · ');
}
function modeLabel(g,code){
  if(!g)return t('mOnline',{code:code||''});
  if(g.mode==='cpu'){return t('mCpu',{name:g.players.filter(p=>p.kind==='cpu').map(p=>(CHARS[p.char]||CHARS.profesor).name).join(', ')});}
  if(g.mode==='online')return t('mOnline',{code:g.code||code||''});
  return t('m_'+g.mode);
}
function dateLabel(day){
  try{const [y,m,d]=day.split('-').map(Number);return new Intl.DateTimeFormat(I.locale(prefs.lang),{weekday:'short',day:'numeric',month:'short'}).format(new Date(y,m-1,d));}catch(e){return day;}
}

/* ---------- home ---------- */
/* after the second finished game, one gentle suggestion to keep Jamb on the home screen (Install also lives in Settings) */
function nudgeHTML(){
  if(isStandalone()||prefs.nudged||(stats.played||0)<2)return '';
  return `<div class="nudge" role="note"><b>${esc(t('nudgeT'))}</b><span>${esc(t('nudgeD'))}</span><div class="row2"><button type="button" class="sbtn" data-act="nudgeyes">${esc(t('installShort'))}</button><button type="button" class="sbtn ghost" data-act="nudgeno">${esc(t('notNow'))}</button></div></div>`;
}
/* one line of the menu: the name, a dotted leader, and the player's best score where the price would be */
function mline(k,name,desc,best,extra){
  return `<button type="button" class="mline" data-act="open" data-k="${k}"><span class="ml1"><span class="mt">${esc(name)}</span><span class="dots" aria-hidden="true"></span><span class="pr">${ICON.chev}</span></span><span class="md">${esc(desc)}</span>${extra||''}</button>`;
}
/* the best score in these modes (all modes when null), from the account when signed in */
function bestOf(modes){
  const av=acctView(),recs=av?av.recs:Object.values(stats.records||{});
  return recs.reduce((m,r)=>(!modes||modes.includes(r.mode))&&r.best&&r.best.s>m?r.best.s:m,0);
}
function renderHome(){
  const d=dailyToday(),res=stats.daily.results[d.day];
  const items=[];
  for(const m of ['cpu','pp','duel','table','daily']){
    const g=loadSlot(m);if(!g||g.over||progress(g)===0)continue;
    if(m==='daily'&&(!g.daily||g.daily.day!==d.day))continue;
    items.push({m,g,at:g.updated||0});
  }
  const os=loadOnline();if(os){const g=validG(os.G)?os.G:null;if(!(g&&g.over))items.push({m:'online',g,code:os.code,at:(g&&g.updated)||Date.now()});}
  items.sort((a,b)=>b.at-a.at);
  const resumes=items.map(it=>{
    const g=it.g;let score='',meta='';
    if(g){const s=g.players.map((p,i)=>E.total(g.rules,p.sheet));score=s.join(' : ');meta=t('turnOf',{a:Math.min(progress(g)+1,E.boxes(g.rules)*g.players.length),b:E.boxes(g.rules)*g.players.length});}
    else meta=t('waitingPhone');
    const btns=ui.endAsk===it.m
      ?`<button type="button" class="sbtn red" data-act="endsaved" data-m="${it.m}">${esc(t('endYes'))}</button><button type="button" class="sbtn ghost" data-act="endno">${esc(t('keep'))}</button>`
      :`<button type="button" class="sbtn" data-act="resume" data-m="${it.m}">${esc(t('continue'))}</button><button type="button" class="sbtn ghost" data-act="endask" data-m="${it.m}" aria-label="${esc(t('end'))}">×</button>`;
    return `<div class="tagcard"><span class="tt"><span class="tl">${esc(modeLabel(g,it.code))}</span><span class="tm">${esc(ui.endAsk===it.m?t('endQ'):meta)}</span></span>${score&&ui.endAsk!==it.m?`<span class="ts">${esc(score)}</span>`:''}<span class="tb">${btns}</span></div>`;
  }).join('');
  let daily;
  loadBoard('d',d.day);   /* fetched now so the newspaper opens with today's high scores */
  const dkick=`<h2 class="sec">${esc(t('menuSpecial'))}</h2>`,ddate=`<span class="date">${esc(dateLabel(d.day))}</span>`;
  if(res&&res.done){
    daily=`${dkick}<div class="drow"><h2>${esc(t('dailyDone',{s:fmt(res.score)}))}</h2>${ddate}</div>
      <button type="button" class="btnRed" data-act="daily">${esc(t('seeReceipt'))}</button>`;
  }else{
    const inprog=items.find(x=>x.m==='daily');
    /* the dice shown are today's real opening roll: the same for everyone */
    const first=E.rollDice(E.freshTurn(dailyRules().dice),'daily:'+d.day,0).dice;
    daily=`${dkick}<div class="drow"><h2>${esc(t('daily'))}</h2>${ddate}</div>
      <div class="minidice" role="img" aria-label="${esc(first.join(' '))}">${first.map(mdie).join('')}</div>
      <button type="button" class="btnRed" data-act="daily">${esc(inprog?t('dailyResume'):t('dailyPlay'))}</button>
      <p class="note">${esc(t('dailyHow'))}</p>${!acctOn()&&C&&C.available()?`<button type="button" class="lnk dsign" data-act="open" data-k="account">${esc(t('homeSignIn'))}</button>`:''}`;
  }
  const faces=CHAR_ORDER.map(k=>`<span class="cmini" style="--ring:${CHARS[k].ring}">${avatar(k)}</span>`).join('');
  $('home').innerHTML=`
    <div class="hero">
      <picture><source type="image/webp" srcset="art/cafe-800.webp 800w, art/cafe-1280.webp 1280w" sizes="100vw"><img src="art/cafe-800.jpg" alt="" width="800" height="447" decoding="async"></picture>
      <div class="wrap"><header class="top">
        <div class="mark"><span class="word">Yamb <span class="amp">Café</span></span></div>
        <div class="icons"><button type="button" class="ibtn${acctOn()?' on':''}${!acctOn()&&C&&C.available()?' signin':''}" data-act="open" data-k="account" aria-label="${esc(acctOn()?t('acSignedAs',{name:acctName()}):t('profile'))}">${myPortrait()?portraitHTML(myPortrait(),'','hdr'):ICON.user}${!acctOn()&&C&&C.available()?`<span class="si">${esc(t('acSignShort'))}</span>`:''}</button><button type="button" class="ibtn" data-act="open" data-k="lang" aria-label="${esc(t('language'))}">${esc(I.short(prefs.lang))}</button><button type="button" class="ibtn" data-act="open" data-k="settings" aria-label="${esc(t('settings'))}">${ICON.gear}</button></div>
      </header></div>
      <img class="crest" src="art/cup/1.webp" alt="" width="192" height="169" decoding="async">
    </div>
    <div class="wrap"><main class="homeIn">
      ${resumes?`<div class="modes">${resumes}</div>`:''}
      <section class="menu"><div class="menuIn">
        ${daily}
        <h2 class="sec next">${esc(t('atTable'))}</h2>
        ${mline('cpu',t('playChar'),t('cpuD'),bestOf(['cpu']),`<span class="faces" aria-hidden="true">${faces}</span>`)}
        ${mline('friends',t('friends'),t('friendsD'),bestOf(['pp','online','duel','table']))}
        <h2 class="sec next">${esc(t('menuSides'))}</h2>
        ${mline('records',t('records'),t('menuRecordsD'),bestOf(null))}
        ${mline('howto',t('howTo'),t('menuHowD'),0)}
      </div></section>${nudgeHTML()}
    </main></div>`;
}

/* ---------- game screen ---------- */
function cellHTML(p,c,r){
  const v=G.players[p].sheet[c][r],tn=G.turn;
  if(v!==null){
    const j=ui.just,just=j&&j.p===p&&j.c===c&&j.r===r;
    const rot=((c.charCodeAt(0)*7+r.charCodeAt(0)*3+r.length*11)%7)-3;
    return `<span class="w${just?' just':''}${v===0?' z':''}" style="--rot:${rot}deg">${v}</span>`;
  }
  const bp=ui.botPick;
  if(bp&&p===G.current&&bp.c===c&&bp.r===r&&!ui.rolling)return `<span class="cell sel static">${E.score(G.rules,r,tn.dice,tn.roll)}</span>`;
  if(canWriteUI(p,c,r)){
    const s=E.score(G.rules,r,tn.dice,tn.roll),sel=ui.sel&&ui.sel.c===c&&ui.sel.r===r;
    const call=c==='ann'&&!tn.announced,ann=c==='ann'&&tn.announced===r;
    const tip=ui.tip&&ui.tip.type==='write'&&ui.tip.c===c&&ui.tip.r===r;
    const cls='cell'+(sel?' sel':'')+(call?' call':'')+(ann?' ann':'')+(s===0&&!call?' zero':'')+(tip?' tip':'');
    return `<button type="button" class="${cls}" data-act="cell" data-c="${c}" data-r="${r}" aria-label="${esc(rowName(r)+', '+colName(c)+': '+s)}">${s}</button>`;
  }
  return '';
}
function sheetHTML(p){
  const g=G,pl=g.players[p],cols=g.rules.cols,calc={};
  cols.forEach(c=>{calc[c]=E.colTotals(g.rules,pl.sheet[c]);});
  const row=r=>`<tr><th scope="row" class="lab">${UPPER.includes(r)?miniFace(+r)+`<span class="sr">${esc(rowName(r))}</span>`:esc(rowName(r))}</th>${cols.map(c=>`<td>${cellHTML(p,c,r)}</td>`).join('')}</tr>`;
  const sum=(cls,label,fn)=>`<tr class="${cls}"><th scope="row" class="lab">${label}</th>${cols.map(c=>`<td>${fn(calc[c])}</td>`).join('')}</tr>`;
  const zl={fit:t('zFit'),large:t('zLarge'),huge:t('zHuge')}[zoomMode()];
  let h=`<thead><tr><th class="lab" scope="col"><span class="sr">${esc(name(p))}</span><button type="button" class="zbtn" data-act="zoom" aria-label="${esc(t('zLabel')+': '+zl)}">${ICON.zoom}<span>${esc(zl)}</span></button></th>${cols.map(c=>`<th scope="col"><button type="button" class="colh" data-act="colinfo" data-v="${c}" title="${esc(colName(c))}" aria-label="${esc(colName(c)+': '+t('colD.'+c))}"><span class="sym">${E.COLS[c].sym}</span><span class="cnm">${esc(t('cols.'+c))}</span></button></th>`).join('')}</tr></thead><tbody>`;
  UPPER.forEach(r=>{h+=row(r);});
  h+=sum('sum',`Σ<span class="sr"> ${esc(t('sumUp'))}</span>`,k=>k.upAny?`${k.up}${k.bonus?`<sup>+${k.bonus}</sup>`:''}`:'');
  h+=row('max')+row('min');
  h+=sum('sum',`<span class="midl">${esc(g.rules.mid==='plain'?'Max − Min':t('midOnes'))}</span>`,k=>k.mid===null?'':k.mid);
  LOWER.forEach(r=>{h+=row(r);});
  h+=sum('sum',`Σ<span class="sr"> ${esc(t('sumLow'))}</span>`,k=>k.lowAny?k.low:'');
  h+=sum('tot',esc(t('total')),k=>k.any?k.total:'');
  const labw=cols.length>=6?'17%':cols.length===5?'19%':'22%';
  return `<table class="c${cols.length}" style="--labw:${labw};--pc:${PCOL_LITE[p%6]}">${h}</tbody></table>`;
}
function renderGame(){
  const g=G,view=getView(),st=standings(g),winner=g.over&&st.length>1&&st[0].score>st[1].score?st[0].i:-1;
  const chips=g.players.map((p,i)=>{
    const sc=E.total(g.rules,p.sheet),me=mySeat()===i;
    const w=g.over?(i===winner?t('winner'):''):(i===g.current&&g.status!=='waiting'?t('toPlay'):'');
    return `<button type="button" class="chip${view===i?' view':''}${i===winner?' win':''}${!g.over&&i===g.current&&g.status!=='waiting'?' cur':''}" data-act="view" data-p="${i}" style="--pc:${view===i?PCOL[i%6]:PCOL_LITE[i%6]}" aria-pressed="${view===i}">
      <span>${isBot(i)&&CHARS[p.char]?`<span class="cav" aria-hidden="true">${avatar(p.char)}</span>`:''}<span class="cn">${esc(name(i))}</span><span class="cw">${esc(w)}</span></span><span class="cs">${fmt(sc)}</span></button>`;
  }).join('');
  $('game').innerHTML=`<div class="wrap">
    <header class="gtop"><button type="button" class="ibtn" data-act="exit" aria-label="${esc(t('exit'))}">${ICON.back}</button><div class="chips${g.players.length>=3?' many n'+g.players.length:''}">${chips}</div>
      <button type="button" class="ibtn" data-act="open" data-k="settings" aria-label="${esc(t('settings'))}">${ICON.gear}</button></header>
    ${onlineBanner()}
    ${sideLayout()?'':`<div class="bubbleRow${hasBots()?' fixed':''}" id="bubbleRow">${bubbleHTML()}</div>`}
    <div class="sheetWrap"><div class="paper" aria-label="${esc(t('sheetOf',{name:name(view)}))}">${sheetHTML(view)}</div></div>
  </div>`;
}
function hasBots(){return !!(G&&G.players.some((p,i)=>isBot(i)));}
function bubbleHTML(){
  if(!G||!hasBots())return '';
  /* the computer player who is talking or playing; between turns the last one stays at the table */
  let botI=ui.bubble&&isBot(ui.bubble.i)?ui.bubble.i:(isBot(G.current)&&!G.over?G.current:-1);
  if(botI<0)botI=ui.lastBot!=null&&isBot(ui.lastBot)?ui.lastBot:G.players.findIndex((p,i)=>isBot(i));
  ui.lastBot=botI;
  const ck=CHARS[G.players[botI].char]?G.players[botI].char:'profesor',c=CHARS[ck],b=ui.bubble&&ui.bubble.i===botI?ui.bubble.text:'';
  return `<span class="cmini big" style="--ring:${c.ring}" aria-hidden="true">${avatar(ck)}</span>${b?`<span class="bubble" role="status">${esc(b)}</span>`:''}`;
}
function renderBubble(){
  const el=$('bubbleRow');if(!el||!G)return;
  el.innerHTML=bubbleHTML();fitBubble();
}
/* a long line gets a smaller hand instead of being cut off */
function fitBubble(){
  const b=document.querySelector('#bubbleRow .bubble');if(!b)return;
  b.classList.remove('s1','s2');
  if(b.scrollHeight>b.clientHeight+1){b.classList.add('s1');if(b.scrollHeight>b.clientHeight+1){b.classList.remove('s1');b.classList.add('s2');}}
}
/* A spinning cup: a strip of painted frames (art/cup/spin.webp) of the cup turning on its own axis, the pips a blur.
   Each cup gets its own speed, start and direction so the five never turn in step. */
function spinHTML(i){
  const k=(i*7919+(G&&G.turn?G.turn.roll:0)*104729)%1000/1000;
  return `<span class="spin" style="--sp:${(0.24+k*0.1).toFixed(3)}s;--sdel:-${(k*0.3).toFixed(3)}s;--sdir:${(i+(G&&G.turn?G.turn.roll:0))%2?'reverse':'normal'}"></span>`;
}
function dieHTML(v,i,o){
  const r=((i*37+v*11)%9)-4;
  if(o.unset)return `<button type="button" class="die unset${o.picked?' ghost':''}" data-act="tdie" data-i="${i}" aria-label="${esc(t('setDie',{n:i+1}))}">?</button>`;
  const cupping=!!(ui.cup&&ui.cup.idx.includes(i)),spinning=!o.idle&&(o.tumble||cupping);
  return `<span class="dslot${o.held?' kept':''}${!o.held&&ui.dropDie===i?' unkept':''}"><button type="button" class="die${o.held?' held':''}${o.held&&ui.popDie===i?' popin':''}${!o.held&&ui.dropDie===i?' popout':''}${o.idle?' idle':''}${o.tumble?' tumble':''}${o.ghost?' ghost':''}${cupping?' incup':''}" style="--r:${r}deg" data-act="${o.table?'tdie':'hold'}" data-i="${i}" aria-pressed="${!!o.held}" aria-label="${esc(o.idle?t('dieIdle'):t('die',{v})+(o.held?', '+t('kept'):''))}"${o.can?'':' disabled'}>${spinning?spinHTML(i):pipsHTML(o.idle?0:v)}</button></span>`;
}
/* first-game guide: short tips in the first game against the computer, each shown once */
function guideTip(){
  const g=G;if(!g||g.mode!=='cpu'||g.over||prefs.guideDone||ui.rolling||ui.modal||ui.sel||!mayAct())return null;
  const me=mySeat();if(me<0||g.current!==me)return null;
  const seen=prefs.guideSeen||{},tn=g.turn,sh=g.players[me].sheet;
  let filled=0;for(const c in sh)for(const r in sh[c])if(sh[c][r]!=null)filled++;
  if(tn.roll>=1&&!seen.g1keep)return 'g1keep';
  if(tn.roll>=1&&!seen.g2yellow)return 'g2yellow';
  if(filled>=1&&!seen.g3cols)return 'g3cols';
  if(filled>=1&&g.rules.cols.includes('ann')&&tn.roll===1&&!tn.announced&&!seen.g4call)return 'g4call';
  if(filled>=2&&tn.roll>=1&&!seen.g5maxmin)return 'g5maxmin';
  return null;
}
function guideText(k){
  return t(k,{down:colName('down'),up:colName('up'),free:colName('free'),ann:colName('ann'),max:rowName('max'),min:rowName('min')});
}
function tipHTML(){
  const k=guideTip();if(!k)return '';
  return `<div class="tipcard" role="note"><p>${esc(guideText(k))}</p><button type="button" class="sbtn" data-act="tipok" data-k="${k}">${esc(t('gotIt'))}</button></div>`;
}
function renderTray(){
  const g=G,tn=g.turn,c=g.current,me=mayAct();
  document.documentElement.style.setProperty('--pcl',PCOL_LITE[c%6]);
  let st='',hint='',acts='',dice='';
  const undo=mayUndo()?`<button type="button" class="lnk" data-act="undo">${esc(t('undo'))}</button>`:'';
  const annPill=tn.announced?`<span class="pill">N · ${esc(rowName(tn.announced))}</span>`:'';
  const clockOn=clockGame();
  const clockHTML=clockOn?`<span class="clockgrp"><span class="clock" id="clock" aria-label="${esc(t('tTimer'))}">–</span>${G.paused?'':`<button type="button" class="pzbtn" data-act="pause" aria-label="${esc(t('tPause'))}">${ICON.pause}</button>`}</span>`:'';
  const who=`<span class="st"><b class="who">${esc(name(c))}</b><span class="rpill">${esc(g.mode==='table'?t('tableTurn'):tn.roll?t('rollOf',{n:tn.roll}):t('toPlay'))}</span></span>`;
  const idle=label=>`<button type="button" class="glass" disabled><b>${esc(label)}</b></button>`;
  const tipOn=ui.tip&&(ui.tip.type==='hold'||ui.tip.type==='announce');
  if(g.mode==='table'&&!g.over){
    const can=me&&!ui.rolling;
    dice=tn.dice.map((v,i)=>v?dieHTML(v,i,{table:true,can,ghost:ui.pick===i||(tipOn&&ui.tip.held[i])}):dieHTML(0,i,{unset:true,picked:ui.pick===i})).join('');
  }else{
    const dt=ui.holdTurn&&ui.holdTurn.dice.length===tn.dice.length?ui.holdTurn:tn;   /* a newer roll is waiting its turn to be shown */
    const showIdle=dt.roll===0&&!ui.rolling;
    const can=me&&!g.over&&!ui.rolling&&tn.roll>=1&&tn.roll<3&&E.canRollAgain(g.rules,cur().sheet,tn);
    const rolling=i=>ui.rolling&&ui.rollIdx&&ui.rollIdx.includes(i);
    dice=dt.dice.map((v,i)=>dieHTML(v,i,{held:dt.held[i]&&!showIdle&&!rolling(i),idle:showIdle,can,tumble:rolling(i),ghost:tipOn&&ui.tip.held&&ui.tip.held[i]&&!ui.rolling})).join('');
  }
  if(g.mode==='online'&&!onlineReady()){st=`<span class="st">${esc(statusText())}</span>`;hint='&nbsp;';acts=idle(t('roll'));}
  else if(g.over){
    const s=standings(g),win=s.length>1&&s[0].score>s[1].score?s[0].i:-1;
    st=`<span class="st">${esc(t('over'))}</span>${undo}`;
    hint=esc(g.players.length===1?t('finalScore',{s:fmt(s[0].score)}):win<0?t('draw'):(win===mySeat()?t('youWin'):t('wins',{name:name(win)})));
    acts=`<button type="button" class="bigbtn go" data-act="results">${esc(t('results'))}</button><button type="button" class="bigbtn ghost" data-act="exit">${esc(t('menu'))}</button>`;
  }else if(g.mode==='online'&&g.status==='waiting'){
    st=`<span class="st">${esc(t('playersN',{n:g.players.length}))}</span>`;
    if(online.host)st+=(g.players.length<MAX_PLAYERS?`<button type="button" class="lnk" data-act="onaddbot">+ ${esc(t('addComputer'))}</button>`:'')+(botSeats().length?`<button type="button" class="lnk minus" data-act="onrmbot" aria-label="${esc(t('rmComputer'))}" title="${esc(t('rmComputer'))}">−</button>`:'');
    if(online.host){hint=esc(t('lobbyHost'));acts=`<button type="button" class="bigbtn cream" data-act="share">${esc(t('shareLink'))}</button><button type="button" class="bigbtn go" data-act="startonline"${g.players.length<2?' disabled':''}>${esc(t('startNow'))}</button>`;}
    else{hint=esc(t('lobbyGuest',{name:name(0)}));acts=idle(t('waitStart'));}
  }else if(othersTurn()){
    st=who+(annPill||undo);
    hint=ui.rolling?'&nbsp;':esc(isBot(c)?(tn.announced&&tn.roll===1?t('calls',{name:name(c),row:rowName(tn.announced)}):t('thinking',{name:name(c)})):t('hWaitTurn',{name:name(c)}));
    acts=idle(t('waitTurn',{name:name(c)}));
    if(awayNow()&&!ui.rolling){hint=esc(t('awayHint',{name:name(c)}));acts=`<button type="button" class="bigbtn cream" data-act="skipaway">${esc(t('awaySkip'))}</button>`;}
  }else{
    st=who+(annPill||undo);
    const sel=ui.sel,selCall=sel&&sel.c==='ann'&&!tn.announced;
    if(ui.tipText&&!sel)hint=`<span class="tipT">${esc(ui.tipText)}</span>`;
    else if(g.mode==='table')hint=esc(!diceSet()?t('tEnter'):sel?(selCall?t('hCall'):t('hSel')):t('tPick'));
    else if(ui.rolling)hint='&nbsp;';
    else if(tn.roll===0)hint=esc(g.mode==='pp'||g.mode==='table'?t('hStartPass'):t('hStart'));
    else if(selCall)hint=esc(t('hCall'));
    else if(sel)hint=esc(t('hSel'));
    else if(tn.announced)hint=esc(t('hAnn',{row:rowName(tn.announced)}));
    else if(tn.roll>=3)hint=esc(t('hLast'));
    else if(!E.hasLater(g.rules,cur().sheet))hint=esc(t('hMust'));
    else hint=newPlayer()?esc(tn.held.some(Boolean)?t('hKept'):t('hHold')):'&nbsp;';/* instructions only in the first two games */
    const hintBtn=hintsAllowed()&&!sel?`<button type="button" class="hintbtn" data-act="hint" aria-label="${esc(t('hint'))}" title="${esc(t('hint'))}"><img class="bell" src="art/page/bell.webp" alt="" draggable="false"></button>`:'';
    if(sel&&!ui.rolling){
      const s=E.score(g.rules,sel.r,tn.dice,tn.roll),lab=rowName(sel.r),sym=E.COLS[sel.c].sym;
      if(selCall)acts=`<button type="button" class="bigbtn go" data-act="announce">${esc(t('announce',{row:lab}))}</button><button type="button" class="bigbtn cream" data-act="write">${esc(t('writeNow',{s}))}</button>`;
      else acts=`<button type="button" class="bigbtn ${s?'go':'red'}" data-act="write">${esc(s?t('write',{s,row:lab,col:sym}):t('scratch',{row:lab,col:sym}))}</button>`;
      acts+=`<button type="button" class="bigbtn ghost x" data-act="cancel" aria-label="${esc(t('cancel'))}">×</button>`;
    }else if(g.mode==='table'){
      const segs=[1,2,3].map(n=>`<button type="button" data-act="troll" data-n="${n}" aria-pressed="${tn.roll===n}">${esc(t('tRoll'+n))}</button>`).join('');
      const picker=ui.pick>=0?`<div class="picker">${[1,2,3,4,5,6].map(v=>`<button type="button" data-act="tval" data-v="${v}" aria-label="${v}">${v}</button>`).join('')}</div>`:'';
      acts=`<div style="flex:1;display:grid;gap:8px">${picker}<div class="acts"><div class="rollseg" style="flex:1">${segs}</div>${SC.supported()?`<button type="button" class="hintbtn" data-act="open" data-k="scan" aria-label="${esc(t('tScan'))}" title="${esc(t('tScan'))}" style="color:var(--cream)">${ICON.cam}</button>`:''}${hintBtn}</div></div>`;
    }else{
      const pips=[0,1,2].map(k=>`<i style="display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 2px;${k<tn.roll?'border:1.5px solid var(--cream);box-sizing:border-box':'background:var(--cream)'}"></i>`).join('');
      const dis=!canRoll()&&!ui.rolling;
      acts=`<button type="button" class="glass" data-act="roll"${dis?' disabled':''}><b>${esc(tn.roll?t('rollAgain'):t('roll'))} <span aria-hidden="true">${pips}</span></b>${newPlayer()&&COARSE?`<small>${esc(prefs.shake&&A.motion.supported()?t('shakeHint'):t('holdHint'))}</small>`:''}</button>${hintBtn}`;
    }
  }
  if(guideTip())hint='&nbsp;';/* the tip card says it; the tray line stays quiet */
  if(ui.msg)hint=`<span class="err">${esc(ui.msg)}</span>`;
  if(clockOn&&g.paused){
    const r=g.paused.ready||[],seats=humanSeats(g),me2=mySeat();
    const by=g.paused.by!=null&&g.players[g.paused.by]?name(g.paused.by):'';
    const btns=seats.map(i=>{const on=r.includes(i),can=g.mode==='pp'||i===me2;
      return `<button type="button" class="rdy${on?' on':''}" style="--pc:${PCOL[i%6]}" data-act="ready" data-i="${i}"${can?'':' disabled'}>${on?'✓ ':''}${esc(name(i))}</button>`;}).join('');
    $('tray').innerHTML=`<div class="trayIn"><div class="clockline"><i id="clockbar"></i></div><div class="status"><span class="st"><b class="who">${esc(t('tPaused',{name:by}))}</b></span><span class="sright">${clockHTML}${emoHTML()}</span></div>
      <div class="pzboard"><img src="art/page/board.webp" alt="" draggable="false"><span>${esc(t('backSoon'))}</span></div>
      <p class="hint">${esc(t(g.mode==='pp'?'tTapReady':'tWaitReady'))}</p><div class="rdyrow">${btns}</div>
      ${g.mode==='online'&&online&&online.host?`<button type="button" class="lnk" style="justify-self:center" data-act="resumenow">${esc(t('tResumeNow'))}</button>`:''}</div>`;
    stabTray();return;
  }
  /* The name and the roll number are already in the name chip on top and on the Roll button, so when the status line
     has nothing else to show (no clock, reactions, undo or call) it is left out and the chalkboard gets the room. */
  const emo=emoHTML(),bare=!clockOn&&!emo&&st===who&&g.mode!=='table';
  /* desktop: the computer player sits across the table, at the top of the tray panel */
  const side=sideLayout()&&hasBots()?`<div class="bubbleRow fixed side" id="bubbleRow">${bubbleHTML()}</div>`:'';
  $('tray').innerHTML=side+`<div class="trayIn${bare?' bare':''}">${clockOn?'<div class="clockline"><i id="clockbar"></i></div>':''}${bare?'':`<div class="status">${st}<span class="sright">${clockHTML}${emo}</span></div>`}${g.mode==='online'&&g.status==='waiting'?seatsHTML(g):`<div class="dice${g.rules.dice===6?' six':''}${ui.cup?' shaking':''}" id="dice">${dice}</div>`}<p class="hint" aria-live="polite">${hint}</p><div class="acts">${acts}</div>${keysHTML(g)}</div>${tipHTML()}`;
  stabTray();
}
/* the lobby: who has sat down, and empty chairs for the seats still free (up to four shown) */
function seatsHTML(g){
  const free=Math.max(0,Math.min(MAX_PLAYERS,Math.max(4,g.players.length+1))-g.players.length);
  const taken=g.players.map((p,i)=>{
    const ck=isBot(i)&&CHARS[p.char]?p.char:null;
    return `<span class="seat"><span class="cmini" style="--ring:${ck?CHARS[ck].ring:PCOL[i%6]}">${ck?avatar(ck):`<b>${esc(String(name(i)).slice(0,1).toUpperCase())}</b>`}</span><span class="sn">${esc(name(i))}</span></span>`;
  }).join('');
  const chairs=Array.from({length:free},()=>`<span class="seat free"><img src="art/page/chair.webp" alt="" draggable="false"><span class="sn">${esc(t('freeSeat'))}</span></span>`).join('');
  return `<div class="seats" id="dice">${taken}${chairs}</div>`;
}
/* keyboard keys, shown in the desktop layout during the first games */
function keysHTML(g){
  if(!newPlayer()||g.mode==='table')return '';
  return `<p class="keys" aria-hidden="true"${mayAct()?'':' style="visibility:hidden"'}><kbd>${esc(t('kSpace'))}</kbd> ${esc(t('kRoll'))} · <kbd>1</kbd>–<kbd>${g.rules.dice}</kbd> ${esc(t('kKeep'))} · <kbd>Enter</kbd> ${esc(t('kWrite'))}</p>`;
}
/* the spin slows down for its last few frames, then the cups stop and show their faces */
function tickDice(n){
  const el=$('dice');if(!el||!ui.rollIdx)return;
  if(n===SPIN_TICKS-3)el.querySelectorAll('.die.tumble').forEach(d=>d.classList.add('slow'));
}
function render(){
  if(screen!=='game'||!G)return;
  const a=document.activeElement,key=a&&a.dataset&&a.dataset.act?[a.dataset.act,a.dataset.i||'',a.dataset.c||'',a.dataset.r||'',a.dataset.p||''].join('|'):null;
  renderGame();renderTray();
  if(key){const el=[...document.querySelectorAll('[data-act]')].find(e=>[e.dataset.act,e.dataset.i||'',e.dataset.c||'',e.dataset.r||'',e.dataset.p||''].join('|')===key);if(el&&!el.disabled){try{el.focus({preventScroll:true});}catch(e){}}}
  const tr=$('tray');if(tr)document.documentElement.style.setProperty('--tray-h',tr.offsetHeight+'px');
  applyZoom();sidePanel();fitBubble();chipFx();turnFx();
}
/* Sheet size: Fit (the default) shrinks every row so the whole board shows above the tray.
   Large and Huge are steps up from Fit and scroll. */
const ZOOMS=['fit','large','huge'];
/* The tray never shrinks during a game: lines that come and go (the status line, a two-line hint, the shake hint)
   would otherwise move the dice and resize the score sheet on every turn. Its tallest height is kept, and the room
   for the status line is kept even while it is left out. Desktop: the panel sits beside the sheet, top to bottom. */
function stabTray(){
  const tr=$('tray'),ti=tr&&tr.querySelector('.trayIn');if(!ti)return;
  const key=(G&&G.id)+'|'+window.innerWidth+'x'+window.innerHeight;
  if(ui.trayKey!==key){ui.trayKey=key;ui.trayMax=0;}
  let h=ti.offsetHeight;
  if(ti.classList.contains('bare'))h+=30+(parseFloat(getComputedStyle(ti).rowGap)||8);
  if(h>ui.trayMax)ui.trayMax=h;
  ti.style.minHeight=ui.trayMax+'px';
}
function sidePanel(){
  const root=document.documentElement;
  if(!sideLayout()){['--side-top','--side-h','--colL'].forEach(k=>root.style.removeProperty(k));return;}
  const pp=document.querySelector('#game .paper');if(!pp)return;
  /* the sheet's column grows with its rows, so a big screen gets a bigger board rather than empty wood */
  const z=parseFloat(pp.style.getPropertyValue('--z'))||1,stage=Math.min(1700,window.innerWidth-64);
  const col=Math.round(Math.max(560,Math.min(450*z,stage*0.6)));
  if(root.style.getPropertyValue('--colL')!==col+'px')root.style.setProperty('--colL',col+'px');
  const r=pp.getBoundingClientRect(),top=Math.round(r.top+window.scrollY);
  root.style.setProperty('--side-top',top+'px');
  /* a board taller than the screen scrolls; the tray panel stays put and on screen */
  root.style.setProperty('--side-h',Math.round(Math.min(r.height,window.innerHeight-top-16))+'px');
}
const sideLayout=()=>!!(window.matchMedia&&matchMedia('(min-width:1000px) and (min-aspect-ratio:4/3)').matches);
function zoomMode(){return ZOOMS.includes(prefs.zoom)?prefs.zoom:'fit';}
function applyZoom(){
  const paper=document.querySelector('#game .paper');if(!paper)return;
  paper.style.setProperty('--z','1');
  const tb=paper.querySelector('table'),tr=$('tray');if(!tb)return;
  const top=paper.getBoundingClientRect().top+window.scrollY,trayH=tr&&!tr.hidden&&!sideLayout()?tr.offsetHeight:0;
  const avail=window.innerHeight-top-trayH-22,h=tb.offsetHeight||1;
  const side=sideLayout(),fit=Math.max(.6,Math.min(side?1.9:1.25,avail/h)),z=zoomMode();/* below 0.6 the text gets too small to read; the sheet scrolls instead */
  /* phone: Fit shows the whole board, the other two make it bigger and it scrolls. Desktop: Fit already fills the
     screen's height, so Larger and Largest grow from there and the page scrolls, with the tray staying in view. */
  const v=side?(z==='huge'?Math.min(3,fit*1.5):z==='large'?Math.min(2.5,fit*1.22):fit)
    :z==='huge'?Math.min(2,Math.max(1.3,fit*1.6)):z==='large'?Math.min(1.6,Math.max(1,fit*1.25)):fit;
  paper.style.setProperty('--z',v.toFixed(3));
}
window.addEventListener('resize',()=>{if(screen!=='game')return;if(ui.side!==sideLayout()){ui.side=sideLayout();render();return;}applyZoom();sidePanel();});
/* Totals count up and the chip bumps when a player scores. */
function chipFx(){
  if(!G)return;
  const tot=G.players.map(p=>E.total(G.rules,p.sheet));
  if(ui.totKey!==G.id||!ui.tot||ui.tot.length!==tot.length){ui.totKey=G.id;ui.tot=tot;return;}
  tot.forEach((v,i)=>{
    const o=ui.tot[i];
    if(v>o){const chip=document.querySelector(`.chip[data-p="${i}"]`),cs=chip&&chip.querySelector('.cs');if(cs){FX.countUp(cs,o,v,550,fmt);FX.pulse(chip,'bump',460);}}
  });
  ui.tot=tot;
}
/* When the turn passes to someone playing on this phone, their name drops in with a soft chime. */
function turnFx(){
  if(!G||G.over||G.players.length<2)return;
  const k=G.id+':'+G.current+':'+progress(G);
  if(ui.turnKey===k)return;
  const fresh=!ui.turnKey||ui.turnKey.split(':')[0]!==G.id;
  ui.turnKey=k;
  if(fresh||G.turn.roll!==0)return;
  const c=G.current;
  if(isBot(c)||(G.mode==='online'&&c!==mySeat())||(G.mode==='online'&&G.status!=='playing'))return;
  setTimeout(()=>{if(G&&!G.over&&ui.turnKey===k&&screen==='game'&&!ui.modal){FX.banner(name(c),t('toPlay'),PCOL[c%6]);A.turn();}},480);
}

/* ---------- pages and sheets ----------
   Everything but a few small sheets opens as a full page with a back arrow; the phone's own back gesture closes it. */
const SHEETS=['install','scan','rulesIn'];
const MENUCARD=['friends','settings','howto','lang','rules','cpu','pp','table','duel','duelIn','online','account'];
const isPage=k=>!!k&&!SHEETS.includes(k);
window.addEventListener('popstate',()=>{if(ui.modal&&isPage(ui.modal.kind)){if(ui.backs.length)back();else closeModal();}});
ui.backs=[];
/* opening a page from another page remembers the one underneath, so back returns there, one step at a time */
function pushBack(){const m=ui.modal;if(!m||!isPage(m.kind))return;if(m.kind==='pp'||m.kind==='table')syncPlayers(m);ui.backs.push(Object.assign({},m));}
function openModal(kind,o){
  const M=$('modal'),wasOpen=!M.hidden&&!M.classList.contains('closing');
  clearTimeout(ui.closeT);M.classList.remove('closing');
  if(!wasOpen)A.swish();
  if(!ui.modal)ui.lastFocus=document.activeElement;
  ui.modal=Object.assign({kind},o||{});
  if(kind==='rules')ui.draft=clone(o&&o.rules?o.rules:prefs.rules);
  const fresh=!$('panel').classList.contains('k-'+kind)||!wasOpen;
  {const pg=isPage(kind),P=$('panel');M.classList.toggle('page',pg);P.className='panel k-'+kind;
   if(pg&&!(history.state&&history.state.yc)){try{history.pushState({yc:1},'');}catch(e){}}}
  $('modal').hidden=false;renderModal();
  if(fresh)$('panel').scrollTop=0;
  const f=$('panel').querySelector('[data-autofocus]')||$('panel').querySelector('.x');if(f){try{f.focus();}catch(e){}}
}
function closeModal(){
  if(ui.modal&&ui.modal.kind==='scan')SC.close();
  ui.backs=[];
  const M=$('modal'),was=!!ui.modal&&!M.hidden;
  ui.modal=null;
  clearTimeout(ui.closeT);
  if(!was||FX.reduce){M.hidden=true;M.classList.remove('closing');$('panel').innerHTML='';}
  else{
    A.swish(true);M.classList.add('closing');
    ui.closeT=setTimeout(()=>{M.classList.remove('closing');if(!ui.modal){M.hidden=true;$('panel').innerHTML='';}},200);
  }
  if(ui.lastFocus&&ui.lastFocus.isConnected){try{ui.lastFocus.focus();}catch(e){}}
}
function back(){const b=ui.backs.pop();if(b){if(ui.modal&&ui.modal.kind==='scan')SC.close();ui.modal=null;openModal(b.kind,b);}else closeModal();}
const head=title=>ui.modal&&isPage(ui.modal.kind)
  ?`<div class="phead pg"><button type="button" class="x back" data-act="close" aria-label="${esc(t('close'))}">${ICON.back}</button><h2>${esc(title)}</h2></div>`
  :`<div class="phead"><h2>${esc(title)}</h2><button type="button" class="x" data-act="close" aria-label="${esc(t('close'))}">×</button></div>`;
const seg=(act,items,cur,n)=>`<div class="seg" style="--n:${n||items.length}">${items.map(([v,l])=>`<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(v)===String(cur)}">${esc(l)}</button>`).join('')}</div>`;
const sw=(k,label,sub)=>`<div class="toggle"><span>${esc(label)}${sub?`<small>${esc(sub)}</small>`:''}</span><button type="button" class="sw" role="switch" data-act="pref" data-k="${k}" aria-checked="${!!prefs[k]}" aria-label="${esc(label)}"></button></div>`;
function rulesRow(){return `<h3>${esc(t('rulesLabel'))}</h3><div class="toggle"><span>${esc(rulesBrief(prefs.rules))}</span><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="editrules">${esc(t('change'))}</button></div>`;}
function renderModal(){
  const m=ui.modal;if(!m)return;
  const P=$('panel');let h='';
  /* keep whatever was typed when the sheet redraws (picking a character, a timer, a preset) */
  {const a=$('acName');if(a&&P.contains(a))m.acName=a.value;}
  {const f=$('fName');if(f&&P.contains(f))m.fName=f.value;if((m.kind==='pp'||m.kind==='table')&&m.players&&P.querySelector('#pl0'))syncPlayers(m);}
  const nameVal=esc(m.fName!=null?m.fName:(prefs.name||''));
  switch(m.kind){
    case 'cpu':{
      m.chars=m.chars||(Array.isArray(prefs.chars)&&prefs.chars.length?prefs.chars.filter(k=>CHARS[k]).slice(0,5):[m.ch||prefs.char]);
      const ch=m.focus||m.chars[m.chars.length-1],c=CHARS[ch];
      h=head(t('playChar'))+`<p class="fine">${esc(t('pickOpp'))}</p><div class="charpick">${CHAR_ORDER.map(k=>`<button type="button" data-act="setchar" data-ch="${k}" style="--ring:${CHARS[k].ring}" aria-pressed="${m.chars.includes(k)}" aria-label="${esc(CHARS[k].name)}">${avatar(k)}</button>`).join('')}</div>
        <p class="fine" style="margin:2px 0 8px">${esc(t('oppCount',{n:m.chars.length,names:m.chars.map(k=>CHARS[k].name).join(', ')}))}</p>
        <div class="charcard" style="--ring:${c.ring}"><span class="cdisc">${avatar(ch)}</span><span><b>${esc(c.name)}</b><q>${esc(t('ch.'+ch+'.quote'))}</q><span style="display:block;margin-top:4px">${dots(AI.CHARACTERS[ch].level).replace(/rgba\(246,238,220,.25\)/g,'')}</span></span></div>
        ${nameField(nameVal)}
        ${rulesRow()}
        ${loadSlot('cpu')&&!loadSlot('cpu').over?`<p class="fine" style="margin-top:12px">${esc(t('replaces'))}</p>`:''}
        <button type="button" class="btnRed" data-act="startcpu" data-autofocus>${esc(t('startGame'))}</button>`;
      break;}
    case 'pp':case 'table':{
      const list=m.players;
      const max=6,min=m.kind==='table'?1:2,humans=list.filter(p=>p.kind!=='cpu').length;
      h=head(m.kind==='pp'?t('modePP'):t('modeTable'))+(m.kind==='table'?`<p>${esc(t('tableIntro'))}</p>`:'')+
        `<h3>${esc(t('players'))} · ${list.length}</h3>`+list.map((p,i)=>{
          const rm=list.length>min&&!(p.kind!=='cpu'&&humans<=1)?`<button type="button" data-act="plrm" data-i="${i}" aria-label="${esc(t('remove'))}">−</button>`:'';
          if(p.kind==='cpu'){const c=CHARS[p.char];return `<div class="pl" style="--pc:${PCOL[i]}"><span class="dot"></span><span class="cmini" style="--ring:${c.ring};width:40px;height:40px;font-size:12px" aria-hidden="true">${avatar(p.char)}</span><span style="flex:1;font:600 17px var(--f-ui)">${esc(c.name)} <span class="fine">· ${esc(t('ch.'+p.char+'.habit'))}</span></span><button type="button" data-act="plchar" data-i="${i}" aria-label="${esc(t('change'))}">↻</button>${rm}</div>`;}
          return `<div class="pl" style="--pc:${PCOL[i]}"><span class="dot"></span><input id="pl${i}" maxlength="16" autocomplete="off" placeholder="${esc(t('player',{n:i+1}))}" value="${esc(p.name||'')}" aria-label="${esc(t('player',{n:i+1}))}">${rm}</div>`;
        }).join('')+
        (list.length<max?`<div class="btnRow" style="margin-top:10px"><button type="button" class="btnInk" style="margin-top:0" data-act="pladd">+ ${esc(t('addPlayer'))}</button>${m.kind==='pp'?`<button type="button" class="btnInk" style="margin-top:0" data-act="pladdbot">+ ${esc(t('addComputer'))}</button>`:''}</div>`:'')+
        (m.kind==='pp'?`<h3>${esc(t('tTimer'))}</h3>`+seg('tsecpp',[[0,t('tOff')],[30,'30 s'],[60,'60 s'],[90,'90 s']],prefs.ppTimer||0):'')+
        rulesRow()+`<button type="button" class="btnRed" data-act="start${m.kind}">${esc(t('startGame'))}</button>`;
      break;}
    case 'duel':
      h=head(t('modeDuel'))+`<p>${esc(t('duelIntro'))}</p>`+seg('duelfmt',[['quick',t('quick')],['full',t('full')]],m.fmt||'quick')+
        `<p class="fine" style="margin-top:8px">${esc((m.fmt||'quick')==='quick'?t('quickD'):t('fullD',{rules:rulesBrief(prefs.rules)}))}</p>
        ${nameField(nameVal)}
        <button type="button" class="btnRed" data-act="startduel">${esc(t('startDuel'))}</button>
        <h3>${esc(t('duelPaste'))}</h3><div class="pl"><input id="duelCode" class="linkbox" placeholder="${esc(t('duelPasteHint'))}" autocomplete="off"><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="pasteduel">${esc(t('open'))}</button></div>`;
      break;
    case 'duelIn':{
      const o=m.o,rules=E.decodeRules(o.r)||prefs.rules;
      if(o.vs){
        const mine=stats.duels[o.i];
        h=head(t('modeDuel'))+`<div class="result"><span class="big">${esc(t('duelBack',{name:o.n}))}</span><p>${esc(o.n)}: <b>${fmt(o.s)}</b> · ${esc(o.vs.n)}: <b>${fmt(o.vs.s)}</b></p><p class="fine">${esc(rulesBrief(rules))}</p></div>
          <button type="button" class="btnInk" data-act="close">${esc(t('close'))}</button>`;
      }else{
        const played=stats.duels[o.i];
        h=head(t('duelFrom',{name:o.n}))+`<p>${esc(t('duelSame'))}</p><p class="fine">${esc(rulesBrief(rules))} · ${esc(t('duelHidden'))}</p>`+
          (played?`<p><b>${esc(t('duelAlready',{s:fmt(played.score)}))}</b></p><button type="button" class="btnInk" data-act="close">${esc(t('close'))}</button>`:
          `${nameField(nameVal)}<button type="button" class="btnRed" data-act="acceptduel" data-autofocus>${esc(t('startDuel'))}</button>`);
      }
      break;}
    case 'online':h=onlineModalHTML(m);break;
    case 'friends':
      h=head(t('friends'))+`<nav class="mlines" aria-label="${esc(t('friends'))}">${[['pp','modePP','modePPD'],['online','modeOnline','modeOnlineD'],['duel','modeDuel','modeDuelD'],['table','modeTable','modeTableD']]
        .map(([k,a,b])=>mline(k,t(a),t(b),0)).join('')}</nav>`;
      break;
    case 'rules':h=rulesModalHTML();break;
    case 'rulesIn':
      h=head(t('rulesFromLink'))+`<p>${esc(rulesBrief(m.rules))}</p><p class="fine">${esc(rulesSummary(m.rules))}</p><button type="button" class="btnRed" data-act="userules">${esc(t('useRules'))}</button><button type="button" class="btnInk" data-act="close">${esc(t('close'))}</button>`;
      break;
    case 'settings':
      {const av=acctView()||stats;m.line=t('statsLine',{p:av.played||0,w:av.wins||0,b:fmt(av.best||0)});}
      h=head(t('settings'))+`<div class="toggle"><span>${esc(t('account'))}<small>${esc(acctOn()?t('acSignedAs',{name:acctName()||(cloud.me&&cloud.me.email)||''}):t('acSignedOut'))}</small></span><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="open" data-k="account">${esc(acctOn()?t('change'):t('signIn'))}</button></div>`+
        `<div class="toggle"><span>${esc(t('language'))}</span><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="open" data-k="lang">${esc(I.name(prefs.lang))}</button></div>`+
        `<h3>${esc(t('sSoundG'))}</h3>`+sw('sound',t('sSound'))+sw('music',t('sMusic'),t('sMusicD'))+sw('ambience',t('sAmb'),t('sAmbD'))+
        `<h3>${esc(t('sPlayG'))}</h3>`+sw('haptics',t('sHap'))+sw('shake',t('sShake'),t('sShakeD'))+sw('hints',t('sHints'),t('sHintsD'))+sw('emotes',t('sEmotes'),t('sEmotesD'))+
        (isStandalone()?'':`<button type="button" class="btnInk" data-act="install">${esc(t('installT'))}</button>`)+
        `<button type="button" class="btnInk" data-act="open" data-k="howto">${esc(t('howTo'))}</button><p class="fine" style="margin-top:14px">Yamb Café ${VERSION}<br>${siteLinks()}</p>`;
      break;
    case 'lang':
      h=head(t('language'))+`<div class="langlist">${I.list().map(l=>`<button type="button" data-act="setlang" data-v="${l.code}" aria-pressed="${l.code===prefs.lang}"><span>${esc(l.name)}</span><span>${esc(l.short)}</span></button>`).join('')}</div>`;
      break;
    case 'howto':h=head(t('howTo'))+howtoHTML(G&&screen==='game'?G.rules:prefs.rules)+`<button type="button" class="btnInk" data-act="guideagain">${esc(t('guideAgain'))}</button>`;break;
    case 'install':
      h=head(t('installT'))+(isIOS()?t('instIOS'):/Android/i.test(navigator.userAgent)?t('instAndroid'):t('instDesktop'));
      break;
    case 'result':h=resultHTML();break;
    case 'records':h=recordsHTML();break;
    case 'account':h=accountHTML(m);break;
    case 'daily':h=dailyModalHTML(m.day);break;
    case 'scan':
      h=head(t('scanTitle')+' ('+t('beta')+')')+`<p class="fine">${esc(t('scanHint'))}</p><div class="scanbox"><video id="scanV" playsinline muted></video><canvas id="scanC" hidden></canvas></div>
        <div class="found" id="scanFound">${(m.found||[]).map(mdie).join('')}</div><p class="fine" id="scanMsg" style="text-align:center">${esc(m.msg||'')}</p>
        <div class="btnRow"><button type="button" class="btnRed" data-act="scannow">${esc(t('scanBtn'))}</button>${m.found&&m.found.length?`<button type="button" class="btnRed" style="background:var(--ink);box-shadow:none" data-act="scanuse">${esc(t('scanUse'))}</button>`:''}</div>`;
      break;
  }
  /* most pages are a menu card on the café table: the back arrow stays on the wood, the rest is on the card */
  if(MENUCARD.includes(m.kind)&&h.startsWith('<div class="phead pg">')){const k=h.indexOf('</div>')+6;h=h.slice(0,k)+`<div class="menu mcard"><div class="menuIn">`+h.slice(k)+`</div></div>`;}
  P.innerHTML=h;
  if(m.kind==='scan'&&!m.started){m.started=true;const v=$('scanV');SC.open(v).catch(()=>{m.msg=t('scanNoCam');const el=$('scanMsg');if(el)el.textContent=m.msg;});}
  else if(m.kind==='scan'&&SC){const v=$('scanV');if(v&&m.started){SC.open(v).catch(()=>{});}}
}
function rulesModalHTML(){
  const d=ui.draft=E.normRules(ui.draft);
  const presets=['classic','quick','family','six','full'].map(p=>`<button type="button" data-act="preset" data-v="${p}" aria-pressed="${E.sameRules(d,E.presetRules(p))}">${esc(t('p_'+p))}</button>`).join('');
  const cols=E.COL_ORDER.map(c=>`<button type="button" class="colbtn" data-act="togcol" data-v="${c}" aria-pressed="${d.cols.includes(c)}"><b>${E.COLS[c].sym}</b><span>${esc(colName(c))}</span></button>`).join('');
  const step=(k,label,dl)=>`<div class="stepper"><span>${esc(label)}</span><span class="sv"><button type="button" data-act="step" data-k="${k}" data-d="${-dl}" aria-label="−">−</button><output>${d[k]}</output><button type="button" data-act="step" data-k="${k}" data-d="${dl}" aria-label="+">+</button></span></div>`;
  const sets=(prefs.sets||[]).map((s,i)=>`<div class="toggle"><span>${esc(s.name)}<small>${esc(rulesBrief(s.rules))}</small></span><span style="display:flex;gap:6px"><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="loadset" data-i="${i}">${esc(t('load'))}</button><button type="button" class="sbtn ghost" style="color:var(--text);box-shadow:inset 0 0 0 1.5px var(--line-strong)" data-act="delset" data-i="${i}" aria-label="${esc(t('remove'))}">×</button></span></div>`).join('');
  return head(t('modeRules'))+`<p class="fine">${esc(rulesSummary(d))}</p>
    <h3>${esc(t('presets'))}</h3><div class="chiprow">${presets}</div>
    <h3>${esc(t('columns'))}</h3><div class="colgrid">${cols}</div>
    <h3>${esc(t('dice'))}</h3>${seg('rdice',[[5,t('nDice',{n:5})],[6,t('nDice',{n:6})]],d.dice)}
    <h3>${esc(rowName('kenta'))}</h3>${seg('rkenta',[['roll',t('kRoll')],['flat',t('kFlat')]],d.kenta)}
    <div class="steps" style="margin-top:6px">${d.kenta==='roll'?step('k1',t('tRoll1'),2)+step('k2',t('tRoll2'),2)+step('k3',t('tRoll3'),2):step('ks','1–5',5)+step('kb','2–6',5)}</div>
    <h3>${esc(t('combos'))}</h3><div class="steps">${step('tri',rowName('triling')+' +',5)+step('ful',rowName('ful')+' +',5)+step('poker',rowName('poker')+' +',5)+step('jamb',rowName('jamb')+' +',5)}</div>
    <h3>${esc(t('bonusTitle'))}</h3><div class="steps">${step('bonusAt',t('bonusAt'),5)+step('bonus',t('bonusAmt'),5)}</div>
    <h3>${esc(t('midTitle'))}</h3>${seg('rmid',[['ones',t('midOnes')],['plain','Max − Min']],d.mid)}
    <button type="button" class="btnRed" data-act="saverules">${esc(t('useRules'))}</button>
    <button type="button" class="btnInk" data-act="sharerules">${esc(t('shareRules'))}</button>
    <h3>${esc(t('savedSets'))}</h3>${sets||`<p class="fine">${esc(t('noSets'))}</p>`}
    <div class="pl"><input id="setName" class="linkbox" maxlength="24" placeholder="${esc(t('setName'))}" autocomplete="off"><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="saveset">${esc(t('save'))}</button></div>`;
}
/* the site's own pages, in the game's language where they exist */
function siteLinks(){
  const l=prefs.lang,a=(href,txt)=>`<a href="${href}" target="_blank" rel="noopener" style="color:inherit">${esc(txt)}</a>`;
  const ln=l==='hr'?'hr/':'',rl=l==='en'||!['hr','sr','bs','sl','de'].includes(l)?'':l+'/';
  return a('privacy/'+ln,t('privacy'))+' · '+a('terms/'+ln,t('termsLink'))+' · '+a('rules/'+rl,t('rulesLink'));
}
function howtoHTML(r){
  r=E.normRules(r);
  const cols=r.cols.map(c=>`<dt>${E.COLS[c].sym}</dt><dd><b>${esc(colName(c))}.</b> ${esc(t('colD.'+c))}</dd>`).join('');
  const kenta=r.kenta==='roll'?t('kentaRoll',{a:r.k1,b:r.k2,c:r.k3}):t('kentaFlat',{a:r.ks,b:r.kb});
  const rows=[['1 – 6',t('sc.upper')],[t('bonusTitle'),r.bonus?t('sc.bonus',{a:r.bonusAt,b:r.bonus}):'–'],['Max, Min',t('sc.maxmin',{n:r.dice===6?t('sc.best5'):''})],[r.mid==='plain'?'Max − Min':t('midOnes'),r.mid==='plain'?t('sc.midPlain'):t('sc.midOnes')],
    [rowName('kenta'),kenta],[rowName('triling'),t('sc.tri',{b:r.tri})],[rowName('ful'),t('sc.ful',{b:r.ful})],[rowName('poker'),t('sc.poker',{b:r.poker})],[rowName('jamb'),t('sc.jamb',{b:r.jamb})]];
  return `<div class="howto"><p>${esc(t('howIntro',{n:r.dice}))}</p><h3>${esc(t('columns'))}</h3><dl>${cols}</dl><h3>${esc(t('scoring'))}</h3><table>${rows.map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</table><p class="fine" style="margin-top:12px">${esc(t('howNote'))}</p></div>`;
}
function reviewHTML(p){
  const rv=G.review&&G.review[p];
  if(!rv||!rv.done)return `<h3>${esc(t('review'))}${G.players.length>1?' · '+esc(name(p)):''}</h3><p class="fine">${esc(t('analyzing'))} ${rv?Math.round(rv.progress*100)+'%':''}</p>`;
  const lk=Math.round(rv.luck),lkl=lk>15?t('lucky'):lk<-15?t('unlucky'):t('avgLuck');
  const ms=rv.moves.length?rv.moves.map(mv=>`<div class="mrow"><span class="g" style="--gc:${GRADE_COL[mv.grade]}">${esc(t('g_'+mv.grade))}</span><span>${esc(t('turnN',{n:mv.turn}))}: ${esc(mv.did)}</span><span class="lossv">−${mv.loss.toFixed(1)}</span><span class="sub">${esc(t('better',{b:mv.better}))}</span></div>`).join(''):`<p class="fine">${esc(t('noMistakes'))}</p>`;
  return `<h3>${esc(t('review'))}${G.players.length>1?' · '+esc(name(p)):''}</h3><div class="stat3"><div class="stat"><b>${rv.acc}%</b><span>${esc(t('accuracy'))}</span></div><div class="stat"><b>${Math.round(rv.lost)}</b><span>${esc(t('lost'))}</span></div><div class="stat"><b>${lk>0?'+':''}${lk}</b><span>${esc(t('luck'))} · ${esc(lkl)}</span></div></div>
    <h3>${esc(t('mistakes'))}</h3><div class="mist">${ms}</div>`;
}
function receiptHTML(day){
  const r=stats.daily.results[day];if(!r)return '';
  const rules=dailyRules(),q=['#C9C2B5','#1F3FA6','#E0A800'];
  return `<div class="receipt"><div class="c b">${esc(t('daily').toUpperCase())}</div><div class="c" style="font-size:12px;color:#6B655C">${esc(dateLabel(day))} · ${esc(t('dailySame'))}</div><div class="hr"></div>
    <div class="grid">${r.grid.map(x=>`<i style="--q:${q[x]}"></i>`).join('')}</div><div class="hr"></div>
    <div class="ln tot"><span>${esc(t('total').toUpperCase())}</span><span>${r.score}</span></div>
    <div class="ln"><span>${esc(CHARS.profesor.name)}</span><span>${r.prof!=null?r.prof:'…'}</span></div>
    <div class="ln"><span>${esc(t('streakShort'))}</span><span>${stats.daily.streak||1}</span></div><div class="hr"></div><div class="c" style="font-size:12px">${esc(t('dailyNext'))}</div></div>`;
}
/* Daily Yamb is the café's newspaper on its wooden holder: the date, today's dice or your score, the high scores
   as the headline table, and the streak as a stamp card. */
const STAMP_AT=[[30.7,19.5],[60,18.1],[32.6,35.2],[62.1,33.8],[34.9,50.6],[64.3,49.1],[36.9,66.3],[66.4,64.8],[39.2,81.7],[68.5,80.2]];
function stampCardHTML(n){
  const k=n>0?((n-1)%10)+1:0;
  return `<span class="stampcard" role="img" aria-label="${esc(t('streak',{n}))}">${STAMP_AT.slice(0,k).map(([x,y],i)=>`<i style="left:${x}%;top:${y}%;--sr:${((i*53)%21)-10}deg"></i>`).join('')}</span>`;
}
function newsHTML(day){
  const r=stats.daily.results[day],done=!!(r&&r.done),streak=stats.daily.streak||0;
  const first=E.rollDice(E.freshTurn(dailyRules().dice),'daily:'+day,0).dice;
  const q=['#C9C2B5','#2A1A12','#B5851D'];
  let h=`<div class="newsWrap"><article class="news">
    <header class="nmast"><span class="nbrand">Yamb Café</span><h1>${esc(t('daily'))}</h1><p class="ndate"><span>${esc(dateLabel(day))}</span><span>${esc(t('dailySame'))}</span></p></header>`;
  if(done){
    h+=`<section class="nlead"><div class="nscore"><span class="nk">${esc(t('total'))}</span><b>${fmt(r.score)}</b>${r.prof!=null?`<span class="nsub">${esc(t('profScore',{s:fmt(r.prof)}))}</span>`:''}</div>
      <div class="ngrid">${(r.grid||[]).map(x=>`<i style="--q:${q[x]}"></i>`).join('')}</div></section>`;
  }else{
    const inprog=loadSlot('daily');
    h+=`<section class="nlead play"><div class="minidice" role="img" aria-label="${esc(first.join(' '))}">${first.map(mdie).join('')}</div>
      <button type="button" class="btnRed" data-act="daily">${esc(inprog&&!inprog.over&&inprog.daily&&inprog.daily.day===day?t('dailyResume'):t('dailyPlay'))}</button><p class="nsub">${esc(t('dailyHow'))}</p></section>`;
  }
  h+=`<section class="nboard">${boardHTML(day)}</section>`;
  h+=`<section class="nstreak">${stampCardHTML(streak)}<div><b>${esc(streak>=1?t('streak',{n:streak}):t('streakShort'))}</b><p>${esc(t('dailyNext'))}</p></div></section>`;
  h+=`</article></div>`;
  if(done)h+=`<button type="button" class="btnRed onwood" data-act="sharedaily" data-day="${day}">${esc(t('shareResult'))}</button>`;
  return h;
}
function dailyModalHTML(day){return head(t('daily'))+newsHTML(day);}
function resultHTML(){
  if(!G)return head(t('results'));
  const st=standings(G),me=mySeat(),win=st.length>1&&st[0].score>st[1].score?st[0].i:-1;
  const title=G.players.length===1?t('finalScore',{s:fmt(st[0].score)}):win<0?t('draw'):win===me?t('youWin'):t('wins',{name:name(win)});
  const endTip=ui.guideEnd?`<div class="tipcard inline" role="note"><p>${esc(t('g6end'))}</p></div>`:'';ui.guideEnd=false;
  let a=`<div class="billTitle"><span class="big">${esc(title)}</span></div>`+billHTML(G,st,win),h='';
  if(G.mode==='daily'){a+=`<button type="button" class="btnRed onwood" data-act="sharedaily" data-day="${G.daily.day}">${esc(t('shareResult'))}</button>`;h+=`<div class="slip">${boardHTML(G.daily.day)}</div>`;}
  if(G.mode==='duel'){
    const mine=st[0].score;
    if(G.duel.from){const th=G.duel.from.s;h+=`<div class="result slip"><p style="font-size:20px">${esc(t('duelResult',{a:fmt(mine),b:fmt(th),name:G.duel.from.n}))}</p><p>${esc(mine>th?t('duelWon'):mine<th?t('duelLost',{name:G.duel.from.n}):t('draw'))}</p></div><button type="button" class="btnRed" data-act="shareduel">${esc(t('duelSendBack'))}</button>`;}
    else a+=`<p class="onwoodp">${esc(t('duelSendD'))}</p><button type="button" class="btnRed onwood" data-act="shareduel">${esc(t('duelSend'))}</button>`;
  }
  let more=gameStatsHTML(G);
  G.players.forEach((p,i)=>{if(p.kind==='human'&&G.log.some(ev=>ev.p===i))more+=reviewHTML(i);});
  h+=`<div class="slip">${more}</div>`;
  const canRematch=!['daily','duel'].includes(G.mode);
  a+=`<div class="btnRow" style="margin-top:16px">${canRematch?`<button type="button" class="btnRed" data-act="rematch">${esc(t('rematch'))}</button>`:''}<button type="button" class="btnInk" style="margin-top:0" data-act="exit">${esc(t('menu'))}</button></div>`;
  return head(t('results'))+endTip+`<div class="resgrid"><div class="resA">${a}</div><div class="resB">${h}</div></div>`;
}

/* The result is the café bill on a small silver tray, written by hand: everyone's score, or for one player the
   parts of the sheet, and the total. */
function billHTML(g,st,win){
  let items=[],total=null;
  if(g.players.length>1)items=st.map(s=>({l:name(s.i),v:s.score,star:s.i===win}));
  else{
    const sh=g.players[0].sheet;
    if(g.rules.cols.length===1){
      const k=E.colTotals(g.rules,sh[g.rules.cols[0]]);
      items=[{l:'1 \u2013 6'+(k.bonus?` (+${k.bonus})`:''),v:k.up+k.bonus},{l:'Max \u2212 Min',v:k.mid||0},{l:rowName('kenta')+' \u2013 '+rowName('jamb'),v:k.low}];
    }else items=g.rules.cols.map(c=>({l:colName(c),v:E.colTotals(g.rules,sh[c]).total}));
    total=st[0].score;
  }
  const now=new Date(),tm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  return `<div class="billWrap"><div class="bill" role="img" aria-label="${esc(items.map(x=>x.l+' '+x.v).join(', ')+(total!=null?', '+t('total')+' '+total:''))}">
    <div class="bpaper" aria-hidden="true"><p class="bhead">Yamb Café</p><p class="bsub">${esc(dateLabel(E.localDay()))} · ${tm}</p>
      ${items.map(x=>`<p class="bline${x.star?' win':''}"><span>${esc(x.l)}</span><i></i><b>${fmt(x.v)}</b></p>`).join('')}
      ${total!=null?`<p class="bline tot"><span>${esc(t('total'))}</span><i></i><b>${fmt(total)}</b></p>`:''}
      <p class="bthanks">${esc(t('billThanks'))}</p></div></div></div>`;
}
/* ---------- end-of-game stats and one fun fact ---------- */
function statLine(g,i){
  const x=pst(i,g),pl=g.players[i];
  const bonus=g.rules.cols.filter(c=>E.colTotals(g.rules,pl.sheet[c]).bonus>0).length;
  const rpt=x.turns?(x.rolls/x.turns):0;
  return {i,x,bonus,rpt,total:E.total(g.rules,pl.sheet)};
}
function funFact(g,lines){
  const nm=i=>pname(g,i),c=[],LD=I._D[prefs.lang]||{};
  const ft=(k,i,v)=>{v=Object.assign({name:nm(i)},v||{});return isYou(g,i)&&LD[k+'You']!=null?t(k+'You',v):t(k,v);};
  const rows=lines.filter(l=>l.x.turns>0);if(!rows.length)return '';
  rows.forEach(l=>{
    if(l.x.jambRoll===1)c.push([90,ft('f_firstJamb',l.i)]);
    if(l.x.jambs>=2)c.push([70+l.x.jambs,ft('f_jambs',l.i,{n:l.x.jambs})]);
    const mx=Math.max(...l.x.faces),face=l.x.faces.indexOf(mx)+1,avg=l.x.faces.reduce((a,b)=>a+b,0)/6;
    if(mx>=8&&mx>=avg*1.35){const fw=String(I.arr(prefs.lang,'faceN')[face-1]||face);c.push([60+mx-avg,ft('f_face',l.i,{face,faceW:fw,faceWc:fw.charAt(0).toUpperCase()+fw.slice(1),n:mx})]);}
    if(l.x.zeros>=3)c.push([50+l.x.zeros,ft('f_zeros',l.i,{n:l.x.zeros})]);
    if(l.x.zeros===0&&l.x.turns>=8)c.push([58,ft('f_noZero',l.i)]);
    if(l.x.first>=Math.max(5,l.x.turns*0.35))c.push([45+l.x.first,ft('f_first',l.i,{n:l.x.first})]);
    if(l.x.best&&l.x.best.s>=45)c.push([40+l.x.best.s/10,ft('f_best',l.i,{s:l.x.best.s,row:rowName(l.x.best.r)})]);
  });
  if(rows.length>1){const lo=rows.slice().sort((a,b)=>a.rpt-b.rpt)[0];if(lo.rpt>0)c.push([44,ft('f_rolls',lo.i,{x:lo.rpt.toLocaleString(I.locale(prefs.lang),{minimumFractionDigits:1,maximumFractionDigits:1})})]);}
  const throws=rows.reduce((a,l)=>a+l.x.faces.reduce((p,q)=>p+q,0),0);
  if(throws)c.push([30,t('f_throws',{n:fmt(throws)})]);
  if(!c.length)return '';
  c.sort((a,b)=>b[0]-a[0]);
  /* pick among the three most interesting, the same one every time this game's results are opened */
  let hsh=0;for(const ch of String(g.id||''))hsh=(hsh*31+ch.charCodeAt(0))>>>0;
  return c[hsh%Math.min(3,c.length)][1];
}
function gameStatsHTML(g){
  const order=standings(g).map(s=>s.i),lines=order.map(i=>statLine(g,i));
  if(!lines.some(l=>l.x.turns>0))return '';
  let h=`<h3>${esc(t('stTitle'))}</h3>`;
  const best=l=>l.x.best?`${l.x.best.s} <small>${esc(rowName(l.x.best.r))}</small>`:'–';
  if(lines.length===1){
    const l=lines[0];
    h+=`<div class="stat3 stat4">${[[l.x.jambs,t('stJambs')],[l.bonus,t('stBonus')],[l.x.zeros,t('stZeros')],[l.rpt.toFixed(1),t('stRolls')]].map(([v,k])=>`<div class="stat"><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
  }else{
    h+=`<table class="gstats"><thead><tr><th></th><th>${esc(t('stJambs'))}</th><th>${esc(t('stBonus'))}</th><th>${esc(t('stZeros'))}</th><th>${esc(t('stRolls'))}</th><th>${esc(t('stBest'))}</th></tr></thead><tbody>${lines.map(l=>`<tr style="--pc:${PCOL[l.i%6]}"><td class="nm">${esc(pname(g,l.i))}</td><td>${l.x.jambs}</td><td>${l.bonus}</td><td>${l.x.zeros}</td><td>${l.rpt.toFixed(1)}</td><td>${best(l)}</td></tr>`).join('')}</tbody></table>`;
  }
  const f=funFact(g,lines);
  if(f)h+=`<div class="fact"><span class="fk">${esc(t('factTitle'))}</span><p>${esc(f)}</p></div>`;
  return h;
}

/* ---------- records: best scores per mode and rule set, kept on this phone ---------- */
function rulesKey(r){return E.encodeRules(r)||'classic';}
function rulesLabel(r){
  for(const k of Object.keys(E.PRESETS))if(E.sameRules(r,E.presetRules(k)))return t('p_'+k);
  return rulesBrief(r);
}
function recordGame(g){
  stats.recIds=stats.recIds||[];
  if(!g.id||stats.recIds.includes(g.id))return;
  stats.recIds.push(g.id);while(stats.recIds.length>60)stats.recIds.shift();
  const me=mySeat(),humans=g.players.map((p,i)=>i).filter(i=>g.players[i].kind!=='cpu');
  let seat=me>=0?me:-1;
  if(g.mode==='pp'||g.mode==='table'){seat=humans.slice().sort((a,b)=>E.total(g.rules,g.players[b].sheet)-E.total(g.rules,g.players[a].sheet))[0];}
  if(seat==null||seat<0)return;
  const score=E.total(g.rules,g.players[seat].sheet),st=standings(g);
  const won=g.players.length>1&&st[0].i===seat&&st[0].score>(st[1]?st[1].score:-1);
  stats.records=stats.records||{};
  const key=g.mode+'|'+rulesKey(g.rules);
  const r=stats.records[key]||(stats.records[key]={mode:g.mode,rules:g.rules,games:0,wins:0,sum:0,best:null});
  r.games++;r.sum+=score;if(won)r.wins++;
  if(!r.best||score>r.best.s)r.best={s:score,name:pname(g,seat),day:E.localDay(new Date())};
  saveStats();
  queueResult(g,seat,score,won,humans);
}
function recordsHTML(){
  const av=acctView(),recs=av?av.recs:Object.values(stats.records||{});
  const where=(av?'':`<p class="fine" style="margin-top:14px">${esc(t('recPhone'))}</p>`)+(acctOn()||!C||!C.available()?'':`<button type="button" class="btnInk" data-act="open" data-k="account">${esc(t('recSignIn'))}</button>`);
  /* the wall of regulars: your portrait in the gilded oval, every best game on a brass plaque */
  const me=acctName()||myName()||t('youName'),games=recs.reduce((a,r)=>a+(r.games||0),0),best=recs.reduce((m,r)=>r.best&&r.best.s>m?r.best.s:m,0);
  let h=head(t('records'))+`<div class="wall"><div class="wallme"><button type="button" class="oval" data-act="open" data-k="account" aria-label="${esc(t('profile'))}">${portraitHTML(myPortrait(),me,'full')}</button>
    <div><b>${esc(me)}</b><span>${esc(t('recGames'))}: ${games}${best?` · ${esc(t('menuBest',{s:fmt(best)}))}`:''}</span></div></div>`;
  const modes=['cpu','pp','online','duel','table','daily'],mt={cpu:t('playChar'),pp:t('modePP'),online:t('modeOnline'),duel:t('modeDuel'),table:t('modeTable'),daily:t('daily')};
  if(!recs.length)return h+`<p class="wallnone">${esc(t('recNone'))}</p></div>`+`<div class="slip">${where}</div>`;
  modes.forEach(m=>{
    const list=recs.filter(r=>r.mode===m).sort((a,b)=>(b.best?b.best.s:0)-(a.best?a.best.s:0));if(!list.length)return;
    h+=`<h3 class="wallh">${esc(mt[m])}</h3><div class="plaques">`;
    list.forEach(r=>{
      const many=m!=='daily'&&m!=='duel'&&m!=='table';
      h+=`<div class="plq"><div class="plate"><span class="pr">${esc(rulesLabel(r.rules))}</span><b>${r.best?fmt(r.best.s):'\u2013'}</b><span class="pb">${r.best?esc(t('recBy',{name:r.best.name||'',date:dateLabel(r.best.day)})):''}</span></div>
        <p class="pf">${esc(t('recGames'))}: ${r.games} · ${esc(t('recAvg'))}: ${fmt(Math.round(r.sum/Math.max(1,r.games)))}${many&&m!=='pp'?` · ${esc(t('recWins'))}: ${r.wins}`:''}</p></div>`;
    });
    h+=`</div>`;
    if(m==='daily')h+=`<p class="pf wallstreak">${esc(t('recStreak'))}: ${Math.max(stats.daily.maxStreak||0,stats.daily.streak||0,av?av.maxStreak:0)}</p>`;
  });
  return h+`</div><div class="slip">${where}</div>`;
}

/* ---------- table mode ---------- */
function tableDie(i){if(!mayAct())return;ui.pick=ui.pick===i?-1:i;ui.sel=null;ui.tip=null;ui.tipText='';A.tap();renderTray();}
function tableVal(v){
  if(ui.pick<0)return;
  G.turn.dice[ui.pick]=v;
  const nxt=G.turn.dice.findIndex((x,i)=>x===0&&i>ui.pick);
  ui.pick=nxt>=0?nxt:G.turn.dice.findIndex(x=>x===0);
  ui.sel=null;ui.tip=null;ui.tipText='';A.hold();saveGame();render();
}
function tableRoll(n){
  if(!mayAct())return;
  if(G.turn.announced&&n<1)return;
  G.turn.roll=n;ui.sel=null;ui.tip=null;ui.tipText='';
  if(n>1&&!G.turn.announced&&!E.hasLater(G.rules,cur().sheet))G.turn.roll=1;
  saveGame();render();
}

/* ---------- online: two to six phones (PeerJS). The host's phone relays every move to the others. ---------- */
let online=null;
const MAX_PLAYERS=6;
const net={peer:null,conn:null,conns:[],state:'idle',retryT:0,away:null,skip:new Set()};
const PV=2;   /* how the phones talk to each other; phones on another version are asked to reopen the game */
const PEER_PREFIX='jamb4two-game-',CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const hasPeer=()=>typeof window.Peer==='function';
const onlineReady=()=>G&&G.mode==='online'&&!!online&&typeof G.code==='string'&&G.code===online.code&&validG(G);
function loadOnline(){
  const o=jget(OKEY,null);
  if(!o||typeof o.code!=='string'||!/^[A-Z0-9]{5}$/.test(o.code))return null;
  if(typeof o.host!=='boolean')o.host=o.seat===0;
  return o;
}
function saveOnline(){if(online)store.set(OKEY,JSON.stringify({code:online.code,host:online.host,G:onlineReady()?G:null}));}
function clearOnline(){store.del(OKEY);}
function makeCode(){let s='';const b=new Uint8Array(5);try{crypto.getRandomValues(b);}catch(e){for(let i=0;i<5;i++)b[i]=Math.random()*256;}b.forEach(x=>{s+=CODE_CHARS[x%CODE_CHARS.length];});return s;}
const cleanCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
const hostId=code=>PEER_PREFIX+code.toLowerCase();
const shareUrl=()=>online?baseUrl()+'?game='+online.code:baseUrl();
const openConns=()=>net.conns.filter(c=>c.open);
function setNet(s){net.state=s;if(screen==='game'&&G&&G.mode==='online')render();if(ui.modal&&ui.modal.kind==='online')renderModal();}
function retryLater(fn,ms){clearTimeout(net.retryT);net.retryT=setTimeout(fn,ms||3000);}
function destroyPeer(){
  clearTimeout(net.retryT);
  const all=net.conns.concat(net.conn?[net.conn]:[]);net.conns=[];net.conn=null;
  all.forEach(c=>{try{c.close();}catch(e){}});
  if(net.peer){const p=net.peer;net.peer=null;try{p.destroy();}catch(e){}}
}
function sendTo(c,m){if(c&&c.open){try{c.send(m);}catch(e){}}}
/* A game on its way to another phone. "now" lets the receiver turn the turn clock into its own time,
   so phones with wrong clocks still count down together. */
const wire=x=>Object.assign({t:'state',pv:PV,now:Date.now(),G},x||{});
function fixClock(g,sent){if(g&&g.deadline&&typeof sent==='number')g.deadline+=Date.now()-sent;return g;}
function sendState(){
  if(!onlineReady())return;
  const m=wire();
  if(online.host)openConns().forEach(c=>sendTo(c,m));
  else sendTo(net.conn,m);
}
function peerOpts(){return Object.assign({debug:0},window.JAMB_PEER_OPTS||{});}
function ensurePeer(id,onOpen){
  if(net.peer&&!net.peer.destroyed&&net.peer.open&&(!id||net.peer.id===id)){onOpen();return;}
  destroyPeer();
  let peer;try{peer=id?new window.Peer(id,peerOpts()):new window.Peer(peerOpts());}catch(e){setNet('unsupported');return;}
  net.peer=peer;
  peer.on('open',()=>{if(net.peer===peer)onOpen();});
  peer.on('connection',conn=>{if(net.peer===peer&&online&&online.host)adoptGuest(conn);else{try{conn.close();}catch(e){}}});
  peer.on('disconnected',()=>{if(net.peer!==peer||peer.destroyed)return;setTimeout(()=>{if(net.peer===peer&&!peer.destroyed&&peer.disconnected){try{peer.reconnect();}catch(e){}}},1500);});
  peer.on('error',err=>{
    if(net.peer!==peer||!online)return;
    const ty=err&&err.type;
    if(ty==='browser-incompatible'){setNet('unsupported');return;}
    if(ty==='peer-unavailable'){if(!online.host){setNet('hostAway');retryLater(connectGuest,4000);}return;}
    if(ty==='unavailable-id'||peer.destroyed){setNet('opening');retryLater(online.host?startHost:connectGuest,3000);return;}
    retryLater(()=>{if(net.peer===peer&&!peer.destroyed&&peer.disconnected){try{peer.reconnect();}catch(e){}}if(online&&!online.host&&!(net.conn&&net.conn.open))connectGuest();},3000);
  });
}
const hostState=()=>openConns().length?'connected':'waiting';
function startHost(){if(!online||!online.host)return;if(!hasPeer()){setNet('off');return;}setNet('opening');ensurePeer(hostId(online.code),()=>setNet(hostState()));}
function connectGuest(){
  if(!online||online.host)return;if(!hasPeer()){setNet('off');return;}
  clearTimeout(net.retryT);if(net.conn&&net.conn.open)return;
  if(net.state!=='hostAway'&&net.state!=='full')setNet('opening');
  ensurePeer(null,()=>{
    if(!online||online.host||(net.conn&&net.conn.open))return;
    if(net.conn){const c=net.conn;net.conn=null;try{c.close();}catch(e){}}
    let conn;try{conn=net.peer.connect(hostId(online.code),{reliable:true});}catch(e){retryLater(connectGuest,3000);return;}
    if(!conn){retryLater(connectGuest,3000);return;}
    adoptHost(conn);
    setTimeout(()=>{if(net.conn===conn&&!conn.open){net.conn=null;try{conn.close();}catch(e){}retryLater(connectGuest,2000);}},12000);
  });
}
function adoptGuest(conn){
  net.conns.push(conn);conn._seen=Date.now();
  conn.on('open',()=>{conn._seen=Date.now();setNet(hostState());});
  conn.on('data',d=>{conn._seen=Date.now();onHostData(conn,d);});
  conn.on('close',()=>{net.conns=net.conns.filter(c=>c!==conn);if(online&&online.host)setNet(hostState());});
  conn.on('iceStateChanged',s=>{if(s==='failed'||s==='closed'){try{conn.close();}catch(e){}}});
  conn.on('error',()=>{});
}
function adoptHost(conn){
  if(net.conn&&net.conn!==conn){const o=net.conn;net.conn=null;try{o.close();}catch(e){}}
  net.conn=conn;
  const opened=()=>{if(net.conn!==conn)return;clearTimeout(net.retryT);conn._seen=Date.now();setNet('connected');sendTo(conn,{t:'hello',pv:PV,now:Date.now(),cid:prefs.cid,name:myName()||null,G:onlineReady()?G:null});};
  conn.on('open',opened);
  conn.on('data',d=>{if(net.conn===conn){conn._seen=Date.now();onGuestData(d);}});
  conn.on('close',()=>{if(net.conn!==conn)return;net.conn=null;if(online&&!online.host&&net.state!=='full'){setNet('opening');retryLater(connectGuest,1500);}});
  conn.on('iceStateChanged',s=>{if(net.conn===conn&&(s==='failed'||s==='closed')){try{conn.close();}catch(e){}}});
  conn.on('error',()=>{});
  if(conn.open)opened();
}
const sameGame=x=>validG(x)&&x.code===online.code;
/* The host's phone is the referee. Phones play their own moves at once and send the result; the host takes it only
   if it was built on the game the host has now (hostSubmit), then tells everyone. Anything else is answered with the
   host's game, and the phone falls back to it. That keeps every phone on the same game when two things happen
   at the same moment, a phone was away, or a phone sends something it may not. */
function hostSubmit(conn,d){
  const x=d.G;
  if(!x||!sameGame(x)||!x.pos||typeof x.pos.id!=='string'||!G.pos)return;
  if(x.pos.id===G.pos.id)return;                                   /* nothing new */
  const seat=G.players.findIndex(p=>p.cid&&p.cid===conn._cid);
  const ahead=Array.isArray(x.pos.anc)&&x.pos.anc.includes(G.pos.id);
  const fresh=x.id!==G.id;                                         /* a rematch */
  const may=seat>=0&&G.status!=='waiting'&&(fresh?(G.over&&!x.over&&progress(x)===0&&x.status==='playing'):(!G.over&&(G.current===seat||(!!G.undo&&G.undo.current===seat&&untouched()))));
  const table=Array.isArray(x.players)&&x.players.length===G.players.length&&x.players.every((p,i)=>p&&p.kind===G.players[i].kind&&(fresh||i===seat||JSON.stringify(p.sheet)===JSON.stringify(G.players[i].sheet)));
  if(!(ahead&&may&&table)){sendTo(conn,wire({reject:x.pos.id}));return;}
  fixClock(x,d.now);
  x.players.forEach((p,i)=>{const h=G.players[i];p.cid=h.cid;p.name=h.name;p.char=h.char;});   /* who sits where is the host's call */
  if(G.paused&&!x.over){const moved=fresh||x.current!==G.current;x.paused=G.paused;x.left=moved?timerSec(x)*1000:G.left;x.deadline=null;}
  else{x.paused=null;x.left=null;}
  x.rev=(G.rev||0)+1;
  applyRemote(x);sendState();
}
function onHostData(conn,d){
  if(!d||typeof d!=='object'||!online||!onlineReady())return;
  if(d.t==='ping'){
    /* a phone that shows another game than the host's gets the host's game again */
    if(conn._cid&&typeof d.pos==='string'&&G.pos&&(d.pos!==G.pos.id||d.rev!==G.rev))sendTo(conn,wire({sync:true}));
    return;
  }
  if(d.t==='emote'){if(conn._cid)onEmote({t:'emote',cid:conn._cid,e:d.e},conn);return;}
  if(d.t==='pause'||d.t==='ready'){
    const seat=G.players.findIndex(p=>p.cid&&p.cid===conn._cid);if(seat<0)return;
    const ok=d.t==='pause'?(clockGame()&&pauseApply(seat)):readyApply(seat);
    if(ok){saveGame(true);render();if(d.t==='ready'&&!G.paused){A.turn();maybeBot();}}
    return;
  }
  if(d.t==='hello'){
    const cid=typeof d.cid==='string'?d.cid.slice(0,40):'',nm=typeof d.name==='string'?d.name.trim().slice(0,16):'';
    if(!cid)return;
    if(d.pv!==PV){sendTo(conn,{t:'ver',pv:PV});sendTo(conn,{t:'full'});toast(t('verMismatch'),true);return;}
    conn._cid=cid;net.skip.delete(cid);
    const seat=G.players.findIndex(p=>p.cid===cid);
    const free=G.players.findIndex((p,i)=>i>0&&p.kind==='human'&&!p.cid);
    if(seat<0&&free>=0&&G.status!=='waiting'){G.players[free].cid=cid;saveGame(true);render();}
    else if(seat<0){
      if(G.status!=='waiting'||G.players.length>=MAX_PLAYERS){sendTo(conn,{t:'full'});return;}
      G.players.push({name:nm||null,kind:'human',char:null,cid,sheet:E.newSheet(G.rules)});
      saveGame(true);render();
    }else if(nm&&!G.players[seat].name){G.players[seat].name=nm;saveGame(true);render();}
    if(d.G)hostSubmit(conn,d);                                      /* moves the phone made while it was away */
    sendTo(conn,wire());
    return;
  }
  if(d.t==='state')hostSubmit(conn,d);
}
function onGuestData(d){
  if(!d||typeof d!=='object'||!online)return;
  if(d.t==='full'){if(net.state!=='version')setNet('full');return;}
  if(d.t==='ver'){if(net.state!=='version')toast(t('verMismatch'),true);setNet('version');return;}
  if(d.t==='emote'){onEmote(d,null);return;}
  if(d.t==='say'){
    if(!onlineReady()||!Number.isInteger(d.i)||!isBot(d.i)||typeof d.ev!=='string'||!/^[A-Za-z]{2,12}$/.test(d.ev))return;
    const v=d.vars&&typeof d.vars==='object'&&ROWS.includes(d.vars.row)?{row:d.vars.row}:null;
    say(d.i,d.ev,v,true);return;
  }
  if(d.t==='state'&&d.G&&sameGame(d.G)){
    const x=d.G;
    if(d.pv!==PV||!x.pos||typeof x.pos.id!=='string'){if(net.state!=='version')toast(t('verMismatch'),true);setNet('version');return;}
    if(net.state==='version')setNet('connected');
    fixClock(x,d.now);
    const mine=onlineReady()&&G.pos?G.pos:null;
    if(!mine){applyRemote(x);return;}
    const anc=mine.anc||[];
    if(d.reject){if(d.reject===mine.id||anc.includes(d.reject))applyRemote(x);return;}   /* the host did not take my move: back to the host's game */
    if(x.pos.id===mine.id){if((x.rev||0)!==(G.rev||0))applyRemote(x);return;}           /* same game; pause, names and the like may differ */
    if(anc.includes(x.pos.id)){if(d.sync)sendState();return;}                            /* I am a move or two ahead; mine are on their way */
    applyRemote(x);
  }
}
/* Take over the game as another phone sent it. The game object stays the same one, so a roll that is still
   landing on screen finishes normally and then shows the new state. */
function applyRemote(x){
  if(!G||G.mode!=='online')return;
  const old=onlineReady()?Object.assign({},G):null;
  for(const k of Object.keys(G))delete G[k];
  Object.assign(G,x);
  if(old){
    const fresh=G.id!==old.id;
    if(fresh){cancelBot();ui.sel=null;ui.just=null;if(ui.modal&&ui.modal.kind==='result')closeModal();}
    if(fresh||(old.turn.roll===0&&G.turn.roll>0)||(old.status==='waiting'&&G.status==='playing'))ui.view=G.current;
    if(G.turn.roll>0&&(fresh||G.current!==old.current||G.turn.roll>old.turn.roll)){
      const all=fresh||G.current!==old.current||old.turn.roll===0;
      ui.rollNext=G.turn.dice.map((v,i)=>i).filter(i=>all||!old.turn.held[i]);
      if(ui.rolling){if(!ui.holdTurn)ui.holdTurn=old.turn;}else setTimeout(rollChain,0);
    }else if(fresh||G.current!==old.current||G.turn.roll===0){ui.rollNext=null;ui.holdTurn=null;}   /* that turn is over: nothing left to show of it */
    if(!fresh)for(let p=0;p<G.players.length;p++)for(const c of G.rules.cols)for(const r of ROWS){
      if(old.players[p]&&old.players[p].sheet[c]&&old.players[p].sheet[c][r]===null&&G.players[p].sheet[c][r]!==null){ui.just={p,c,r};A.write();setTimeout(()=>{ui.just=null;},700);if(online.host)react(p,r,G.players[p].sheet[c][r]);}
    }
    if(G.over&&!old.over)finishGame();
  }
  if(ui.view==null||!G.players[ui.view])ui.view=G.current;
  if(ui.sel&&!canWriteUI(G.current,ui.sel.c,ui.sel.r))ui.sel=null;
  saveOnline();render();
  if(!ui.rolling&&!bot.live)maybeBot();
}
setInterval(()=>{
  const now=Date.now(),all=online&&online.host?openConns():(net.conn&&net.conn.open?[net.conn]:[]);
  const ping=online&&!online.host&&onlineReady()&&G.pos?{t:'ping',pos:G.pos.id,rev:G.rev||0}:{t:'ping'};   /* a guest says what it is showing */
  all.forEach(c=>{sendTo(c,ping);if(c._seen&&now-c._seen>16000){try{c.close();}catch(e){}}});
},5000);
function hostGame(){
  if(!hasPeer()){toast(t('onNoLib'),true);return;}
  takeName();
  if(G&&G.mode==='online')destroyPeer();
  const code=makeCode();
  online={code,host:true};net.state='idle';
  const sec=prefs.onlineTimer==null?60:prefs.onlineTimer;
  const g=makeGame('online',prefs.rules,[{name:myName()||null,cid:prefs.cid}],{code,status:'waiting',rev:1,timer:sec?{sec}:null});
  openGame(g);saveOnline();startHost();
}
function joinGame(raw){
  const code=cleanCode(raw);
  if(code.length!==5){toast(t('errCode'),true);return;}
  if(!hasPeer()){toast(t('onNoLib'),true);return;}
  takeName();
  if(G&&G.mode==='online')destroyPeer();
  online={code,host:false};net.state='idle';
  openGame(makeGame('online',prefs.rules,[{name:myName()||null,cid:prefs.cid}],{code:'',status:'waiting'}));saveOnline();connectGuest();
}
function resumeOnline(s){
  online={code:s.code,host:!!s.host};net.state='idle';
  const g=validG(s.G)&&s.G.code===s.code?s.G:makeGame('online',prefs.rules,[{name:myName()||null,cid:prefs.cid}],{code:'',status:'waiting'});
  if(typeof s.seat==='number'&&g.players[s.seat]&&!g.players.some(p=>p.cid===prefs.cid))g.players[s.seat].cid=prefs.cid;
  if(g.code&&!g.pos)stampPos(g);
  openGame(g);
  const go=()=>{if(!hasPeer())setNet('off');else if(online.host)startHost();else connectGuest();};
  if(hasPeer())go();else window.addEventListener('load',go,{once:true});
}
function startOnlineGame(){
  if(!onlineReady()||!online.host||G.status!=='waiting'||G.players.length<2)return;
  G.status='playing';G.current=0;G.starter=0;G.turn=freshTurn(G);ui.view=0;startClock(G);
  saveGame();render();
  const b=someBot(-1);if(b>=0)setTimeout(()=>say(b,'greet'),600);
  maybeBot();
}
function statusText(){
  switch(net.state){
    case 'connected':return online.host?t('connectedN',{n:openConns().length}):t('connected',{name:onlineReady()?name(0):t('player',{n:1})});
    case 'waiting':return online.host?t('waitingPhones'):t('waitingPhone');
    case 'hostAway':return t('hostAway',{name:onlineReady()?name(0):t('player',{n:1})});
    case 'full':return t('tableFull');
    case 'version':return t('verMismatch');
    case 'unsupported':case 'off':return t('notConnected');
    default:return t('opening');
  }
}
function onlineBanner(){
  if(!G||G.mode!=='online'||!online)return '';
  const dot=net.state==='connected'?'var(--ok)':(net.state==='waiting'||net.state==='hostAway'||net.state==='version')?'var(--warn)':'var(--cream-dim)';
  return `<div class="tagcard" style="margin-bottom:8px"><span style="width:10px;height:10px;border-radius:50%;background:${dot};flex:none"></span><span class="tt"><span class="tm"${net.state==='version'?' style="white-space:normal"':''}>${esc(statusText())}${net.state==='version'?'':' · '+esc(online.code)}</span></span><button type="button" class="sbtn" data-act="open" data-k="online">${esc(online.host&&G.status==='waiting'?t('shareShort'):t('gameBtn'))}</button></div>`;
}
function onlineModalHTML(m){
  let h=head(t('modeOnline'));const nameVal=esc(m.fName!=null?m.fName:(prefs.name||''));
  if(G&&G.mode==='online'&&online&&screen==='game'){
    h+=`<p class="fine">${esc(t('sessCode'))}</p><div style="font:700 44px/1.1 var(--f-hand);letter-spacing:.14em;color:var(--ink)">${esc(online.code)}</div><p><b>${esc(statusText())}</b> · ${esc(t('playersN',{n:G.players.length}))}</p>`;
    if(online.host&&G.status==='waiting')h+=`<p>${esc(t('sendLink'))}</p><input class="linkbox" id="linkBox" readonly value="${esc(shareUrl())}" aria-label="${esc(t('shareLink'))}"><button type="button" class="btnRed" data-act="share">${esc(t('shareLink'))}</button>`+(G.players.length>=2?`<button type="button" class="btnRed" style="background:var(--ink);box-shadow:none" data-act="startonline">${esc(t('startNow'))}</button>`:'');
    h+=`<button type="button" class="btnInk" data-act="endsaved" data-m="online">${esc(t('endOnline'))}</button>`;
    return h;
  }
  if(!hasPeer())h+=`<p class="err">${esc(t('onNoLib'))}</p>`;
  h+=`<p>${esc(t('onlineIntro'))}</p>${nameField(nameVal)}`;
  if(!m.joinOnly)h+=`<h3>${esc(t('tTimer'))}</h3>`+seg('tsecon',[[0,t('tOff')],[30,'30 s'],[60,'60 s'],[90,'90 s']],prefs.onlineTimer==null?60:prefs.onlineTimer)+rulesRow()+`<button type="button" class="btnRed" data-act="host">${esc(t('startOnline'))}</button><h3>${esc(t('orJoin'))}</h3>`;
  h+=`<div class="pl"><input id="joinCode" class="linkbox" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t('codeLabel'))}" value="${esc(m.code||'')}" style="font:700 22px var(--f-ui);letter-spacing:.2em;text-transform:uppercase"><button type="button" class="sbtn" style="background:var(--text);color:var(--slip)" data-act="join">${esc(t('joinBtn'))}</button></div>`;
  return h;
}

/* ---------- misc ---------- */
function toast(msg,bad){
  const el=$('toast');el.textContent=msg;el.className='toast'+(bad?' bad':'');el.hidden=false;
  clearTimeout(ui.msgT);ui.msgT=setTimeout(()=>{el.hidden=true;},Math.max(3200,1600+String(msg).length*45));
}
async function shareText(text,url){
  try{if(navigator.share){await navigator.share({title:'Yamb Café',text,url});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  const all=url&&!text.includes(url)?text+'\n'+url:text;
  try{await navigator.clipboard.writeText(all);toast(t('copied'));}catch(e){toast(all);}
}
let installEvt=null;
const isStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}catch(e){return false;}};
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function doInstall(){
  if(installEvt){const e=installEvt;installEvt=null;try{e.prompt();}catch(err){openModal('install');}return;}
  openModal('install');
}
function setupMotion(){
  A.motion.stop();
  if(!prefs.shake||!A.motion.supported()||screen!=='game')return;
  A.motion.start(()=>{if(canRoll()){ui.shaking=true;A.rattleStart();cupStart(freeIdx());const g=document.querySelector('.glass');if(g)g.classList.add('shaking');}},()=>{if(ui.shaking){ui.shaking=false;A.rattleStop();doRoll();if(!ui.rolling)cupCancel();}});
}
async function askMotion(){
  if(ui.motionAsked||!prefs.shake)return;ui.motionAsked=true;
  const ok=await A.motion.request();if(ok)setupMotion();
}
function syncPlayers(m){(m.players||[]).forEach((p,i)=>{if(p.kind!=='cpu'){const el=$('pl'+i);if(el)p.name=el.value.trim().slice(0,16);}});return m.players;}
function nextChar(list,from){const used=list.filter(p=>p.kind==='cpu').map(p=>p.char);let i=from?CHAR_ORDER.indexOf(from):-1;for(let k=0;k<CHAR_ORDER.length;k++){i=(i+1)%CHAR_ORDER.length;if(!used.includes(CHAR_ORDER[i])||CHAR_ORDER[i]===from)return CHAR_ORDER[i];}return CHAR_ORDER[(i+1)%CHAR_ORDER.length];}

/* ---------- events ---------- */
document.addEventListener('pointerdown',e=>{
  A.unlock();
  const btn=e.target.closest('button');
  if(btn&&!btn.disabled&&!btn.matches('.die,.cell,.glass,.picker button'))A.press();
  const gl=e.target.closest('.glass[data-act="roll"]');
  if(gl&&canRoll()){
    askMotion();
    ui.shaking=true;ui.pressAt=Date.now();A.rattleStart();gl.classList.add('shaking');cupStart(freeIdx());
    try{gl.setPointerCapture(e.pointerId);}catch(err){}
  }
},{passive:true});
document.addEventListener('pointerup',e=>{
  if(!ui.shaking||!ui.pressAt)return;
  const gl=e.target.closest('.glass');ui.pressAt=0;
  ui.shaking=false;A.rattleStop();if(gl)gl.classList.remove('shaking');
  ui.skipClick=true;setTimeout(()=>{ui.skipClick=false;},400);
  doRoll();if(!ui.rolling)cupCancel();
});
document.addEventListener('pointercancel',()=>{if(ui.shaking){ui.shaking=false;ui.pressAt=0;A.rattleStop();cupCancel();}});
const SOFT=new Set(['exit','results','daily','resume','endask','endno','endsaved','pickchar','open','close','editrules','pladd','pladdbot','plrm','plchar',
  'startcpu','startpp','starttable','startonline','startduel','acceptduel','rematch','host','join','setlang','saverules','userules','loadset','preset']);
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');
  if(ui.emoOpen&&(!el||!['emo','emosend','emomute'].includes(el.dataset.act))){ui.emoOpen=false;if(screen==='game')renderTray();}
  if(!el)return;
  const d=el.dataset;
  if(SOFT.has(d.act)&&!(d.act==='open'&&(d.k==='scan'||d.k==='install'))&&!FX.reduce){
    if(el._soft)return;el._soft=true;
    setTimeout(()=>{el._soft=false;act(el,d);},90);
    return;
  }
  act(el,d);
});
function act(el,d){
  switch(d.act){
    case 'roll':if(ui.skipClick){ui.skipClick=false;break;}doRoll();break;
    case 'hold':toggleHold(+d.i);break;
    case 'pause':doPause();break;
    case 'emo':ui.emoOpen=!ui.emoOpen;renderTray();break;
    case 'emosend':sendEmote(d.e);tally('emo');break;
    case 'emomute':ui.emoMute=!(ui.emoMute||prefs.emotes===false);if(!ui.emoMute&&prefs.emotes===false){prefs.emotes=true;savePrefs();}renderTray();break;
    case 'ready':doReady(G&&G.mode==='online'?mySeat():+d.i);break;
    case 'resumenow':doReady(null,true);break;
    case 'tsecpp':prefs.ppTimer=+d.v;savePrefs();renderModal();break;
    case 'tsecon':prefs.onlineTimer=+d.v;savePrefs();renderModal();break;
    case 'zoom':{prefs.zoom=ZOOMS[(ZOOMS.indexOf(zoomMode())+1)%ZOOMS.length];savePrefs();render();if(prefs.zoom==='fit')try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}break;}
    case 'cell':onCell(d.c,d.r);break;
    case 'write':if(ui.sel)writeCore(ui.sel.c,ui.sel.r);break;
    case 'announce':if(ui.sel)doAnnounce(ui.sel.r);break;
    case 'cancel':ui.sel=null;render();break;
    case 'undo':doUndo();break;
    case 'skipaway':if(awayNow()&&!ui.rolling){net.skip.add(G.players[G.current].cid);forceTimeout(true);}break;
    case 'hint':showHint();break;
    case 'view':{
      const p=+d.p;
      /* in the lobby the host taps a computer to swap it for another character */
      if(G.mode==='online'&&online&&online.host&&G.status==='waiting'&&isBot(p)){G.players[p].char=nextChar(G.players,G.players[p].char);A.tap();saveGame();render();break;}
      setView(p);if(G.mode!=='online')saveGame();render();break;
    }
    case 'onaddbot':{
      if(!onlineReady()||!online.host||G.status!=='waiting'||G.players.length>=MAX_PLAYERS)break;
      const first=!botSeats().length;
      G.players.push({name:null,kind:'cpu',char:nextChar(G.players),cid:null,sheet:E.newSheet(G.rules)});
      saveGame();render();if(first)toast(t('botSwap'));break;
    }
    case 'onrmbot':{
      if(!onlineReady()||!online.host||G.status!=='waiting')break;
      const b=botSeats().pop();if(b==null)break;
      G.players.splice(b,1);if(Array.isArray(G.stats))G.stats.splice(b,1);
      saveGame();render();break;
    }
    case 'exit':goHome();break;
    case 'results':openModal('result');break;
    case 'tdie':tableDie(+d.i);break;
    case 'tval':tableVal(+d.v);break;
    case 'troll':tableRoll(+d.n);break;
    case 'daily':startDaily();break;
    case 'resume':resumeSaved(d.m);break;
    case 'endask':ui.endAsk=d.m;renderHome();break;
    case 'endno':ui.endAsk=null;renderHome();break;
    case 'endsaved':endSaved(d.m);break;
    case 'pickchar':openModal('cpu',{chars:[d.ch],focus:d.ch});break;
    case 'setchar':{const m=ui.modal,ch=d.ch;m.chars=m.chars||[];const i=m.chars.indexOf(ch);
      if(i>=0){if(m.chars.length>1)m.chars.splice(i,1);}else if(m.chars.length<5)m.chars.push(ch);
      m.focus=m.chars.includes(ch)?ch:m.chars[m.chars.length-1];prefs.char=m.chars[0];prefs.chars=m.chars.slice();savePrefs();renderModal();break;}
    case 'open':{
      const k=d.k;
      if(ui.modal&&ui.modal.kind!==k)pushBack();
      if(k==='pp')openModal('pp',{players:[{kind:'human',name:myName()},{kind:'human',name:''}]});
      else if(k==='table')openModal('table',{players:[{kind:'human',name:myName()}]});
      else if(k==='rules')openModal('rules');
      else{
        openModal(k);
        if((k==='records'||k==='account')&&cloud.uid&&(!cloud.state||Date.now()-cloud.state.at>60000))syncCloud();
      }
      break;}
    case 'close':if(ui.backs.length)back();else closeModal();break;
    case 'editrules':{if(ui.modal&&ui.modal.kind!=='rules')pushBack();openModal('rules');break;}
    case 'pladd':{const m=ui.modal;syncPlayers(m);if(m.players.length<6)m.players.push({kind:'human',name:''});renderModal();break;}
    case 'pladdbot':{const m=ui.modal;syncPlayers(m);if(m.players.length<6)m.players.push({kind:'cpu',char:nextChar(m.players)});renderModal();break;}
    case 'plchar':{const m=ui.modal;syncPlayers(m);const p=m.players[+d.i];if(p&&p.kind==='cpu')p.char=nextChar(m.players,p.char);renderModal();break;}
    case 'plrm':{const m=ui.modal;syncPlayers(m);m.players.splice(+d.i,1);renderModal();break;}
    case 'startcpu':{
      takeName();
      const chars=(ui.modal.chars&&ui.modal.chars.length?ui.modal.chars:[prefs.char]).slice(0,5);prefs.char=chars[0];savePrefs();
      openGame(makeGame('cpu',prefs.rules,[{name:myName()||null,kind:'human'}].concat(chars.map(ch=>({kind:'cpu',char:ch}))),{}));break;}
    case 'startpp':case 'starttable':{const list=syncPlayers(ui.modal),first=list.find(p=>p.kind!=='cpu');if(first&&first.name)prefs.name=first.name;savePrefs();
      {const g=makeGame(d.act==='startpp'?'pp':'table',prefs.rules,list.map(p=>p.kind==='cpu'?{kind:'cpu',char:p.char}:{name:p.name||null}),d.act==='startpp'&&prefs.ppTimer?{timer:{sec:prefs.ppTimer}}:{});startClock(g);openGame(g);}break;}
    case 'startonline':closeModal();startOnlineGame();break;
    case 'duelfmt':ui.modal.fmt=d.v;renderModal();break;
    case 'startduel':{takeName();startDuel((ui.modal.fmt||'quick')==='quick');break;}
    case 'pasteduel':{const v=$('duelCode').value;const mm=v.match(/duel=([A-Za-z0-9_-]+)/)||[null,v.trim()];const o=E.decodeObj(mm[1]);if(o&&o.i&&o.r!=null)openModal('duelIn',{o});else toast(t('badLink'),true);break;}
    case 'acceptduel':{takeName();acceptDuel(ui.modal.o);break;}
    case 'shareduel':if(C)C.stats([['share','duel',1]]);shareText(G.duel.from?t('duelShareBack',{a:E.total(G.rules,G.players[0].sheet),b:G.duel.from.s}):t('duelShareText',{s:E.total(G.rules,G.players[0].sheet)}),duelLink());break;
    case 'sharedaily':if(C)C.stats([['share','daily',1]]);shareDaily(d.day);break;
    case 'boardtab':ui.boardTab=d.v==='w'?'w':'d';renderModal();break;
    case 'signin':case 'signout':case 'acsave':case 'acdel':case 'acdelno':case 'acdelyes':accountAct(d.act);break;
    case 'pickava':{
      const v=d.v;if(!PORTRAITS.includes(v))break;
      prefs.avatar=v;prefs.painted=v;savePrefs();A.hold(true);
      const st=acctOn()&&acctState();if(st&&st.profile)st.profile.avatar=v;
      if(st&&cloudLive())C.rpc('save_profile',{p_name:acctName()||myName()||'',p_avatar:v}).then(p=>{const s2=acctState();if(s2&&p)s2.profile=p;saveCloud();acctUI();}).catch(()=>{});
      renderModal();if(screen==='home')renderHome();break;}
    case 'photo':
      if(myPhoto()&&prefs.avatar!=='photo'){prefs.avatar='photo';savePrefs();A.hold(true);renderModal();if(screen==='home')renderHome();}
      else{const fi=$('photoIn');if(fi)fi.click();}
      break;
    case 'rmphoto':
      try{localStorage.removeItem(PHOTO_KEY);}catch(e){}
      if(prefs.avatar==='photo'){prefs.avatar=PORTRAITS.includes(prefs.painted)?prefs.painted:'';savePrefs();}
      renderModal();if(screen==='home')renderHome();break;
    case 'rematch':rematch();break;
    case 'host':hostGame();break;
    case 'join':joinGame($('joinCode').value);break;
    case 'share':if(C)C.stats([['share','table',1]]);shareText(t('shareText'),shareUrl());break;
    case 'install':doInstall();break;
    case 'colinfo':toast(colName(d.v)+': '+t('colD.'+d.v));break;
    case 'tipok':prefs.guideSeen=Object.assign({},prefs.guideSeen,{[d.k]:true});savePrefs();renderTray();break;
    case 'guideagain':prefs.guideSeen={};prefs.guideDone=false;savePrefs();closeModal();toast(t('guideOn'));break;
    case 'nudgeyes':prefs.nudged=true;savePrefs();renderHome();doInstall();break;
    case 'nudgeno':prefs.nudged=true;savePrefs();renderHome();break;
    case 'pref':{const k=d.k;prefs[k]=!prefs[k];savePrefs();applyAudio();if(k==='shake'){ui.motionAsked=false;if(prefs.shake)askMotion();else A.motion.stop();}if(k==='sound'&&prefs.sound)A.tap();renderModal();break;}
    case 'setlang':prefs.lang=d.v;savePrefs();document.documentElement.lang=I.locale(prefs.lang);closeModal();if(screen==='home')renderHome();else render();break;
    case 'preset':ui.draft=E.presetRules(d.v);renderModal();break;
    case 'togcol':{const c=d.v,cols=ui.draft.cols.slice();const i=cols.indexOf(c);if(i>=0){if(cols.length>1)cols.splice(i,1);}else cols.push(c);ui.draft.cols=cols;renderModal();break;}
    case 'rdice':ui.draft.dice=+d.v;renderModal();break;
    case 'rkenta':ui.draft.kenta=d.v;renderModal();break;
    case 'rmid':ui.draft.mid=d.v;renderModal();break;
    case 'step':{const k=d.k;ui.draft[k]=Math.max(0,(ui.draft[k]||0)+(+d.d));renderModal();break;}
    case 'saverules':prefs.rules=E.normRules(ui.draft);savePrefs();toast(t('rulesSaved'));if(ui.backs.length)back();else{closeModal();if(screen==='home')renderHome();}break;
    case 'sharerules':if(C)C.stats([['share','rules',1]]);shareText(t('rulesShareText',{r:rulesBrief(ui.draft)}),baseUrl()+'?rules='+E.encodeRules(ui.draft));break;
    case 'saveset':{const nm=($('setName').value||'').trim().slice(0,24);if(!nm){toast(t('setName'),true);break;}prefs.sets=(prefs.sets||[]).filter(s=>s.name!==nm);prefs.sets.unshift({name:myName()||null,rules:E.normRules(ui.draft)});prefs.sets=prefs.sets.slice(0,10);savePrefs();renderModal();break;}
    case 'loadset':{const s=prefs.sets[+d.i];if(s){ui.draft=E.normRules(s.rules);renderModal();}break;}
    case 'delset':prefs.sets.splice(+d.i,1);savePrefs();renderModal();break;
    case 'userules':prefs.rules=E.normRules(ui.modal.rules);savePrefs();toast(t('rulesSaved'));closeModal();renderHome();break;
    case 'scannow':{
      const v=$('scanV'),c=$('scanC');if(!v||!v.videoWidth){toast(t('scanNoCam'),true);break;}
      const img=SC.capture(v,c),res=SC.detect(img);
      const nd=G?G.rules.dice:5;
      ui.modal.found=res.values.slice(0,nd);ui.modal.msg=res.values.length?(res.values.length===nd?'':t('scanCount',{n:res.values.length,m:nd})):t('scanNone');
      const f=$('scanFound');if(f)f.innerHTML=ui.modal.found.map(mdie).join('');const mg=$('scanMsg');if(mg)mg.textContent=ui.modal.msg;
      const P=$('panel'),row=P.querySelector('.btnRow');if(row&&ui.modal.found.length&&!row.querySelector('[data-act=scanuse]'))row.insertAdjacentHTML('beforeend',`<button type="button" class="btnRed" style="background:var(--ink);box-shadow:none" data-act="scanuse">${esc(t('scanUse'))}</button>`);
      break;}
    case 'scanuse':{
      if(G&&G.mode==='table'&&ui.modal.found){const f=ui.modal.found;G.turn.dice=G.turn.dice.map((v,i)=>f[i]||v);ui.pick=G.turn.dice.findIndex(x=>x===0);saveGame();}
      closeModal();render();break;}
  }
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ui.modal){if(ui.backs.length)back();else closeModal();return;}
  if(screen!=='game'||ui.modal||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))return;
  const press=sel=>{const b=document.querySelector(sel);if(b&&!b.disabled){e.preventDefault();b.click();return true;}return false;};
  if(e.key===' '||e.key==='r'||e.key==='R')press('#tray [data-act=roll]');
  else if(/^[1-6]$/.test(e.key))press(`#tray [data-act=hold][data-i="${+e.key-1}"]`);
  else if(e.key==='Enter')press('#tray [data-act=write]')||press('#tray [data-act=announce]');
  else if(e.key==='Escape')press('#tray [data-act=cancel]');
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;});
window.addEventListener('appinstalled',()=>{if(window.JambCloud)window.JambCloud.event('install');});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!G||G.mode!=='online'||!online||!hasPeer())return;
  if(!online.host){if(!(net.conn&&net.conn.open))connectGuest();}
  else if(!net.peer||net.peer.destroyed)startHost();
  else if(net.peer.disconnected){try{net.peer.reconnect();}catch(e){}}
});
window.addEventListener('resize',()=>{const tr=$('tray');if(tr&&!tr.hidden)document.documentElement.style.setProperty('--tray-h',tr.offsetHeight+'px');});

/* ---------- account: Google sign-in, records that follow the player, Daily Yamb high scores ----------
   None of this is needed to play. Signed out, or with no connection, everything stays on this device as before.
   Signed in: each finished game goes into an outbox and up to the account; what this device had before its first
   sign-in goes up once, as it was; and a finished Daily Yamb is sent as a list of moves, which the database plays
   again with that day's dice. The score on the high scores is the one the database counted. */
const C=window.JambCloud||null;
const CKEY='jamb4-cloud';
let cloud=Object.assign({uid:null,me:null,outbox:[],snap:null,carriedBy:null,state:null},jget(CKEY,{}));
if(!Array.isArray(cloud.outbox))cloud.outbox=[];
const boards={};
let syncing=false,syncAgain=false,sendingDaily=false;
function saveCloud(){store.set(CKEY,JSON.stringify(cloud));}
const acctOn=()=>!!cloud.uid;
const cloudLive=()=>!!(C&&C.user&&C.user.id===cloud.uid);
const acctState=()=>cloud.uid&&cloud.state&&cloud.state.u===cloud.uid&&cloud.state.d?cloud.state.d:null;
/* Signed in, the account's name is the player's name everywhere, so the setup sheets don't ask for it.
   Pass and play still asks for every name, with the first one filled in. */
function myName(){return (acctOn()&&acctName())||prefs.name||'';}
function nameField(v){
  if(acctOn()&&acctName())return `<p class="fine asname">${esc(t('playingAs',{name:acctName()}))}</p>`;
  return `<label class="field"><span>${esc(t('yourName'))}</span><input id="fName" maxlength="16" autocomplete="off" value="${v}"></label>`;
}
function takeName(){const f=$('fName');if(f){prefs.name=f.value.trim().slice(0,16)||null;savePrefs();}}
/* Your portrait: one of the twelve painted regulars (art/regulars), kept on the device and, signed in, on the account. */
const PORTRAITS=['r01','r02','r03','r04','r05','r06','r07','r08','r09','r10','r11','r12'];
/* Your own photo stays on this device (a 256px square in localStorage): you see it wherever you appear, while other
   players see the painted portrait you picked, so nobody's picture reaches the public high scores unchecked. */
const PHOTO_KEY='jamb4-photo';
function myPhoto(){try{return localStorage.getItem(PHOTO_KEY)||'';}catch(e){return '';}}
const portraitSrc=id=>id==='photo'?myPhoto():PORTRAITS.includes(id)?`art/regulars/${id.slice(1)}.webp`:'';
function publicPortrait(){const d=acctOn()&&acctState(),a=d&&d.profile&&d.profile.avatar;return PORTRAITS.includes(a)?a:(PORTRAITS.includes(prefs.painted)?prefs.painted:(PORTRAITS.includes(prefs.avatar)?prefs.avatar:''));}
function myPortrait(){return prefs.avatar==='photo'&&myPhoto()?'photo':publicPortrait();}
function loadImg(f){return new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im);};im.onerror=e=>{URL.revokeObjectURL(u);rej(e);};im.src=u;});}
async function takePhoto(f){
  if(!f)return;
  try{
    const im=await loadImg(f),w=im.naturalWidth,h=im.naturalHeight,s=Math.min(w,h);
    const c=document.createElement('canvas');c.width=c.height=256;
    /* the middle square, a little above centre on a tall picture, where faces usually are */
    c.getContext('2d').drawImage(im,(w-s)/2,Math.max(0,(h-s)*0.35),s,s,0,0,256,256);
    localStorage.setItem(PHOTO_KEY,c.toDataURL('image/jpeg',0.86));
    prefs.avatar='photo';savePrefs();A.hold(true);
    renderModal();if(screen==='home')renderHome();
  }catch(e){toast(t('photoFail'),true);}
}
document.addEventListener('change',e=>{const el=e.target;if(el&&el.id==='photoIn'){takePhoto(el.files&&el.files[0]);el.value='';}});
function portraitHTML(id,name,cls){
  /* in the oval frame a painted regular is shown whole, head to shoulders (art/regulars/full) */
  const src=cls&&/\bfull\b/.test(cls)&&PORTRAITS.includes(id)?`art/regulars/full/${id.slice(1)}.webp`:portraitSrc(id);
  return `<span class="ptr${cls?' '+cls:''}" aria-hidden="true">${src?`<img src="${src}" alt="" decoding="async">`:`<b>${esc(String(name||'?').slice(0,1).toUpperCase())}</b>`}</span>`;
}
function acctName(){const d=acctState();return (d&&d.profile&&d.profile.name)||(cloud.me&&cloud.me.name)||'';}
const rulesOfKey=k=>k==='classic'?E.normRules({}):(E.decodeRules(k)||E.normRules({}));
function statsSnapshot(){
  return{played:stats.played||0,wins:stats.wins||0,best:stats.best||0,maxStreak:Math.max(stats.daily.maxStreak||0,stats.daily.streak||0),
    records:Object.values(stats.records||{}).map(r=>({mode:r.mode,rk:rulesKey(r.rules),games:r.games||0,wins:r.wins||0,sum:r.sum||0,best:r.best?r.best.s:null,name:r.best?r.best.name:null,day:r.best?r.best.day:null}))};
}
/* the signed-in player's records: what each device carried over, the games saved since, and the ones still waiting to go up */
function acctView(){
  const d=acctState();if(!d)return null;
  const recs={};let played=0,wins=0,best=0,maxStreak=0;
  const add=(mode,rk,games,w,sum,b,nm,day)=>{
    if(!mode||!rk)return;
    const k=mode+'|'+rk,r=recs[k]||(recs[k]={mode,rk,games:0,wins:0,sum:0,best:null});
    r.games+=+games||0;r.wins+=+w||0;r.sum+=+sum||0;
    if(b!=null&&(!r.best||+b>r.best.s))r.best={s:+b,name:nm||acctName()||t('youName'),day:day||null};
  };
  (Array.isArray(d.carried)?d.carried:[]).forEach(c=>{
    if(!c)return;
    played+=+c.played||0;wins+=+c.wins||0;best=Math.max(best,+c.best||0);maxStreak=Math.max(maxStreak,+c.maxStreak||0);
    (Array.isArray(c.records)?c.records:[]).forEach(r=>add(r.mode,r.rk,r.games,r.wins,r.sum,r.best,r.name,r.day));
  });
  (Array.isArray(d.records)?d.records:[]).forEach(r=>add(r.mode,r.rules,r.games,r.wins,r.sum,r.best,r.best_name,r.best_day));
  const tt=d.totals||{};played+=+tt.games||0;wins+=+tt.wins||0;best=Math.max(best,+tt.best||0);
  cloud.outbox.forEach(x=>{
    if(x.u!==cloud.uid)return;
    played++;if(x.won&&x.mine&&x.players>1)wins++;if(x.mine)best=Math.max(best,x.score);
    add(x.mode,x.rules,1,x.won?1:0,x.score,x.score,x.name,x.day);
  });
  return{played,wins,best,maxStreak,recs:Object.values(recs).map(r=>({mode:r.mode,rules:rulesOfKey(r.rk),games:r.games,wins:r.wins,sum:r.sum,best:r.best}))};
}
function acctUI(){
  if(ui.modal&&['account','settings','records','daily','result'].includes(ui.modal.kind)){
    const f=document.activeElement;if(!(ui.modal.kind==='account'&&f&&f.id==='acName'))renderModal();
  }
  if(screen==='home')renderHome();
}
function queueResult(g,seat,score,won,humans){
  if(!cloud.uid||!g.id)return;
  const shared=(g.mode==='pp'||g.mode==='table')&&humans.length>1;      /* several people on one device: a record, but not "mine" */
  cloud.outbox.push({u:cloud.uid,id:g.id,mode:g.mode,rules:rulesKey(g.rules),score,won:!!won,mine:!shared,players:g.players.length,
    name:isYou(g,seat)?null:String(pname(g,seat)||'').slice(0,16),at:Date.now(),day:E.localDay(new Date())});
  while(cloud.outbox.length>400)cloud.outbox.shift();
  saveCloud();syncCloud();
}
async function syncCloud(fresh){
  if(!cloudLive())return;
  if(syncing){syncAgain=true;return;}
  syncing=true;
  const me=cloud.uid,hello=()=>{if(fresh)toast(t('acHello',{name:acctName()||String(C.user&&C.user.name||'').split(/\s+/)[0]||t('playerAnon')}));};
  try{
    const mine=cloud.outbox.filter(x=>x.u===me).slice(0,300);
    const snap=cloud.snap&&cloud.snap.u===me?cloud.snap.stats:null;
    const d=await C.rpc('sync_up',{p_device:prefs.cid,p_carried:snap,p_results:mine.map(x=>({id:x.id,mode:x.mode,rules:x.rules,score:x.score,won:x.won,mine:x.mine,players:x.players,name:x.name,at:x.at,day:x.day}))});
    if(cloud.uid!==me)return;
    const ids=new Set(mine.map(x=>x.id));
    cloud.outbox=cloud.outbox.filter(x=>!(x.u===me&&ids.has(x.id)));
    if(snap)cloud.snap=null;
    cloud.state={u:me,at:Date.now(),d};
    if(d&&d.profile&&!d.profile.name){
      /* first sign-in: the name already used in games, or the first name from Google; it can be changed in Account */
      const nm=String(prefs.name||String(C.user&&C.user.name||'').split(/\s+/)[0]||'').trim().slice(0,16);
      if(nm){try{d.profile=await C.rpc('save_profile',{p_name:nm,p_avatar:publicPortrait()||null});}catch(e){}}
    }
    if(cloud.uid!==me)return;
    if(cloud.me)cloud.me.name=(d&&d.profile&&d.profile.name)||'';
    saveCloud();
    importDailies(d&&d.dailies);
    hello();
    await sendDailies();
    acctUI();
  }catch(e){hello();}
  finally{syncing=false;if(syncAgain){syncAgain=false;syncCloud();}}
}
/* a Daily finished on another device shows as done here too, rebuilt from its moves */
function importDailies(list){
  if(!Array.isArray(list))return;
  const rules=dailyRules(),today=E.localDay(),oldest=E.localDay(new Date(Date.now()-55*864e5));let changed=false;
  list.forEach(x=>{
    if(!x||typeof x.day!=='string'||x.day<oldest)return;
    const have=stats.daily.results[x.day];
    if(have&&have.done)return;
    const rp=E.replayMoves(rules,'daily:'+x.day,x.moves);if(!rp)return;
    stats.daily.results[x.day]={done:true,score:rp.total,n:E.dailyNumber(x.day),grid:qualityGrid(rules,rp.sheet),prof:null,moves:x.moves,sent:cloud.uid};
    changed=true;
    if(x.day===today){
      const g=loadSlot('daily');
      if(g&&g.daily&&g.daily.day===today&&!(G&&G.mode==='daily'&&screen==='game'))clearSlot('daily');
      profPlay('daily:'+today,rules,sc=>{const r=stats.daily.results[today];if(r){r.prof=sc;saveStats();}acctUI();});
    }
  });
  if(!changed)return;
  const days=Object.keys(stats.daily.results).filter(k=>stats.daily.results[k].done).sort(),last=days[days.length-1];
  let n=1;
  for(let i=days.length-1;i>0;i--){if(Math.round((new Date(days[i]+'T12:00:00')-new Date(days[i-1]+'T12:00:00'))/864e5)===1)n++;else break;}
  stats.daily.streak=Math.max(n,last===stats.daily.last?(stats.daily.streak||0):0);stats.daily.last=last;
  stats.daily.maxStreak=Math.max(stats.daily.maxStreak||0,stats.daily.streak);
  const all=Object.keys(stats.daily.results).sort();while(all.length>60)delete stats.daily.results[all.shift()];
  saveStats();
}
/* the player's turns in a finished Daily, read from the game's log: [row, kept before the 2nd roll, kept before the 3rd] */
function dailyMoves(g){
  const out=[];let kept=[];
  for(const ev of g.log||[]){
    if(ev.p!==0)continue;
    if(ev.k==='roll'){if(ev.turn.roll>=1)kept.push(ev.turn.held.reduce((a,h,i)=>a|(h?1<<i:0),0));else kept=[];}
    else if(ev.k==='write'){out.push([ROWS.indexOf(ev.r)].concat(kept));kept=[];}
  }
  return out;
}
async function sendDailies(){
  if(!cloudLive()||sendingDaily)return;
  sendingDaily=true;
  try{
    const me=cloud.uid;
    for(const day of [E.localDay(new Date(Date.now()-864e5)),E.localDay()]){
      const r=stats.daily.results[day];
      if(!r||!r.done||!Array.isArray(r.moves)||r.sent||r.bad)continue;
      try{
        const b=await C.rpc('submit_daily',{p_day:day,p_moves:r.moves});
        if(cloud.uid!==me)return;
        r.sent=me;saveStats();boards['d'+day]={at:Date.now(),data:b,err:false};delete boards['w'+day];
        /* a game just finished that takes the day's top place from someone else: the till rings */
        const top=b&&b.top||[];
        if(day===E.localDay()&&Date.now()-(r.at||0)<120000&&b.me&&b.me.rank===1&&top.length>1&&r.score>top[1].score)A.cash();
      }catch(e){if(/YC_(MOVES|DAY)/.test(String(e&&e.message))){r.bad=true;saveStats();}}
    }
  }finally{sendingDaily=false;}
}
async function loadBoard(kind,day,force){
  if(!C||!C.available())return;
  const k=kind+day,b=boards[k];
  if(b&&b.loading)return;
  if(b&&!force&&Date.now()-b.at<(b.err?20000:90000))return;
  boards[k]={at:b?b.at:0,data:b?b.data:null,err:false,loading:true};
  try{const data=await C.rpc(kind==='w'?'week_board':'daily_board',{p_day:day});boards[k]={at:Date.now(),data,err:false};}
  catch(e){boards[k]={at:Date.now(),data:b?b.data:null,err:true};}
  if(ui.modal&&(ui.modal.kind==='daily'||ui.modal.kind==='result'))renderModal();
  else if(screen==='home'&&!ui.modal)renderHome();
}
const GLOGO='<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
const gbtn=()=>`<button type="button" class="gbtn" data-act="signin"${C&&C.available()?'':' disabled'}>${GLOGO}<span>${esc(t('acGoogle'))}</span></button>`;
/* the day's and the week's high scores, shown with the Daily's receipt */
function boardHTML(day){
  const tab=ui.boardTab==='w'?'w':'d',r=stats.daily.results[day];
  let h=`<h3>${esc(t('board'))}</h3>`+seg('boardtab',[['d',t('boardToday')],['w',t('boardWeek')]],tab);
  if(!C||!C.available())return h+`<p class="fine bnote">${esc(t('boardOff'))}</p>`;
  loadBoard(tab,day);
  const b=boards[tab+day],d=b&&b.data;
  if(!d)h+=`<p class="fine bnote">${esc(b&&b.err?t('boardOff'):t('boardWait'))}</p>`;
  else if(!d.top||!d.top.length)h+=`<p class="fine bnote">${esc(t('boardNone'))}</p>`;
  else{
    const rows=d.top.slice(0,10),mine=d.top.find(x=>x.me);if(mine&&!rows.includes(mine))rows.push(mine);
    h+=`<table class="scores board">${rows.map(x=>`<tr${x.me?' class="me"':''}><td class="rk">${x.rank}.</td><td>${(av=>portraitSrc(av)?portraitHTML(av,x.name,'sm'):'')(x.me&&myPortrait()==='photo'?'photo':x.avatar)}${esc(x.name||t('playerAnon'))}${tab==='w'?` <small>${esc(t('boardDays',{n:x.days}))}</small>`:''}</td><td class="n">${fmt(x.score)}</td></tr>`).join('')}</table>
      <p class="fine bnote">${esc(t('boardCount',{n:d.count}))}${d.me&&!rows.some(x=>x.me)?' · '+esc(t('boardPlace',{r:d.me.rank,n:d.count})):''}</p>`;
  }
  if(!acctOn())h+=`<p class="fine bnote">${esc(t('boardSignIn'))}</p>`+gbtn();
  else if(r&&r.done&&!r.sent&&!r.bad&&Array.isArray(r.moves))h+=`<p class="fine bnote">${esc(t('boardPending'))}</p>`;
  else if(tab==='d'&&d&&d.me&&r&&r.done&&d.me.score!==r.score)h+=`<p class="fine bnote">${esc(t('boardFirst',{s:fmt(d.me.score)}))}</p>`;
  return h;
}
function portraitPicker(){
  const cur=myPortrait(),ph=myPhoto();
  return `<h3>${esc(t('pickPortrait'))}</h3><div class="ppick">${PORTRAITS.map(id=>`<button type="button" data-act="pickava" data-v="${id}" aria-pressed="${cur===id}" aria-label="${esc(t('pickPortrait'))} ${+id.slice(1)}"><img src="${portraitSrc(id)}" alt="" decoding="async"></button>`).join('')}
    <button type="button" class="phototile" data-act="photo" aria-pressed="${cur==='photo'}" aria-label="${esc(t('usePhoto'))}">${ph?`<img src="${ph}" alt="">`:CAMERA}</button></div>
    <input type="file" id="photoIn" accept="image/*" hidden>
    ${ph?`<p class="fine rmphoto"><button type="button" class="lnk" data-act="rmphoto">${esc(t('removePhoto'))}</button></p>`:''}`;
}
const CAMERA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>';
function profileTop(name){return `<div class="proftop"><span class="oval big">${portraitHTML(myPortrait(),name,'full')}</span><b>${esc(name)}</b></div>`;}
function accountHTML(m){
  let h=head(t('profile'));
  if(!acctOn()){
    h+=profileTop(myName()||t('youName'))+portraitPicker()+`<h3>${esc(t('account'))}</h3><p>${esc(t('acIntro'))}</p>`+gbtn();
    if(!C||!C.available())h+=`<p class="fine" style="margin-top:10px">${esc(t('acNoNet'))}</p>`;
    return h+`<button type="button" class="btnInk" data-act="close">${esc(t('close'))}</button><p class="fine" style="margin-top:14px;text-align:center">${siteLinks()}</p>`;
  }
  if(m.del)return h+`<p><b>${esc(t('acDelQ'))}</b></p><p>${esc(t('acDelD'))}</p><button type="button" class="btnRed" data-act="acdelyes"${m.busy?' disabled':''}>${esc(t('acDelYes'))}</button><button type="button" class="btnInk" data-act="acdelno">${esc(t('keep'))}</button>`;
  const nm=m.acName!=null?m.acName:acctName(),shown=acctName()||t('playerAnon');
  const waiting=!acctState()||cloud.outbox.some(x=>x.u===cloud.uid)||!!(cloud.snap&&cloud.snap.u===cloud.uid);
  return h+profileTop(shown)+`<p class="fine profmail">${esc(cloud.me&&cloud.me.email||'')}</p>`+portraitPicker()+`
    <label class="field"><span>${esc(t('acName'))}</span><input id="acName" maxlength="16" autocomplete="nickname" autocapitalize="words" value="${esc(nm)}"></label>
    <button type="button" class="btnRed" data-act="acsave"${m.busy?' disabled':''}>${esc(t('acSave'))}</button>
    <p class="fine" style="margin-top:12px">${esc(waiting?t('acSyncWait'):t('acSyncOk'))}</p>
    <button type="button" class="btnInk" data-act="signout">${esc(t('acSignOut'))}</button>
    <button type="button" class="linkbtn" data-act="acdel">${esc(t('acDelete'))}</button>`;
}
function cloudIn(u,fresh){
  if(cloud.uid!==u.id){
    cloud.uid=u.id;if(!(cloud.state&&cloud.state.u===u.id))cloud.state=null;
    /* what this device had before anyone signed in goes to the first account, once */
    if(!cloud.carriedBy){cloud.carriedBy=u.id;cloud.snap={u:u.id,stats:statsSnapshot()};}
    cloud.me=null;
  }
  cloud.me={id:u.id,email:u.email,name:(cloud.me&&cloud.me.name)||''};
  saveCloud();
  if(fresh){
    const after=store.get('jamb4-after');store.del('jamb4-after');
    const d=dailyToday(),res=stats.daily.results[d.day];
    if((after==='daily'||after==='result')&&res&&res.done)openModal('daily',{day:d.day});
    else if(after==='records')openModal('records');
    else if(after)openModal('account');
  }
  acctUI();syncCloud(fresh);
}
function cloudOut(){
  if(!cloud.uid)return;
  cloud.uid=null;cloud.me=null;cloud.state=null;saveCloud();
  Object.keys(boards).forEach(k=>delete boards[k]);
  acctUI();
}
function cloudEvent(why){
  const u=C.user;
  if(why==='ready'){
    if(C.takeError())toast(t('acErr'),true);
    const fresh=!!u&&C.takeJustIn();
    if(fresh)C.event('signin');
    if(!fresh)store.del('jamb4-after');
    if(u)cloudIn(u,fresh);
    else if(cloud.uid&&!C.remembered())cloudOut();
    else acctUI();
  }else if(why==='in'){if(u)cloudIn(u,false);}
  else if(why==='out')cloudOut();
}
async function accountAct(act){
  const m=ui.modal;
  if(act==='signin'){
    if(!C||!C.available()){toast(t('acNoNet'),true);return;}
    store.set('jamb4-after',m?m.kind:'account');
    try{await C.signIn();}catch(e){store.del('jamb4-after');toast(t('acNoNet'),true);}
    return;
  }
  if(act==='signout'){if(C)await C.signOut();cloudOut();closeModal();toast(t('acBye'));return;}
  if(!m||m.kind!=='account')return;
  if(act==='acdel'){m.del=true;renderModal();return;}
  if(act==='acdelno'){m.del=false;renderModal();return;}
  if(m.busy)return;
  if(act==='acsave'){
    const nm=String(($('acName')||{}).value||'').trim().slice(0,16);
    if(!nm){toast(t('acFail'),true);return;}
    m.busy=true;renderModal();
    try{
      const d=acctState(),p=await C.rpc('save_profile',{p_name:nm,p_avatar:publicPortrait()||null});
      if(d)d.profile=p;if(cloud.me)cloud.me.name=p&&p.name||nm;saveCloud();
      Object.keys(boards).forEach(k=>delete boards[k]);
      m.acName=null;toast(t('acSaved'));
    }catch(e){toast(t('acFail'),true);}
    m.busy=false;acctUI();return;
  }
  if(act==='acdelyes'){
    m.busy=true;renderModal();
    try{
      const me=cloud.uid;await C.rpc('delete_my_account',{});
      cloud.outbox=cloud.outbox.filter(x=>x.u!==me);if(cloud.snap&&cloud.snap.u===me)cloud.snap=null;if(cloud.carriedBy===me)cloud.carriedBy=null;
      Object.values(stats.daily.results).forEach(r=>{if(r&&r.sent===me)delete r.sent;});saveStats();
      await C.signOut();cloudOut();closeModal();toast(t('acDeleted'));
    }catch(e){m.busy=false;renderModal();toast(t('acFail'),true);}
  }
}
if(C){
  C.on(cloudEvent);
  if(C.ready)cloudEvent('ready');
  window.addEventListener('online',()=>{syncCloud();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cloud.uid&&(!cloud.state||Date.now()-cloud.state.at>10*60000))syncCloud();});
}

/* ---------- start ---------- */
/* where this visit came from, for the visitor numbers: a game link, a ref= tag on a shared link, another site, or none */
function visitSource(q,gameCode,duel,rules){
  if(gameCode)return 'link:table';if(duel)return 'link:duel';if(rules)return 'link:rules';
  const ref=String(q.get&&q.get('ref')||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40);if(ref)return 'ref:'+ref;
  try{const r=document.referrer&&new URL(document.referrer);if(r&&r.hostname&&r.hostname!==location.hostname)return r.hostname.replace(/^www\./,'').slice(0,60);}catch(e){}
  return 'direct';
}
function start(){
  document.documentElement.lang=I.locale(prefs.lang);
  let q;try{q=new URLSearchParams(location.search);}catch(e){q=new Map();}
  const gameCode=cleanCode(q.get&&q.get('game')),duel=q.get&&q.get('duel'),rules=q.get&&q.get('rules');
  if(C)C.count('game',visitSource(q,gameCode,duel,rules),prefs.lang,isStandalone());
  if(location.search){try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}}
  const sess=loadOnline();
  if(gameCode&&gameCode.length===5&&!(sess&&sess.code===gameCode)){showScreen('home');openModal('online',{joinOnly:true,code:gameCode});return;}
  if(gameCode&&sess&&sess.code===gameCode){resumeOnline(sess);return;}
  if(duel){const o=E.decodeObj(duel);showScreen('home');if(o&&o.i&&o.r!=null)openModal('duelIn',{o});else toast(t('badLink'),true);return;}
  if(rules){const r=E.decodeRules(rules);showScreen('home');if(r)openModal('rulesIn',{rules:r});return;}
  if(prefs.screen==='game'&&prefs.mode){
    if(prefs.mode==='online'&&sess){resumeOnline(sess);return;}
    const g=loadSlot(prefs.mode);if(g&&!g.over){openGame(g);return;}
  }
  showScreen('home');
}
start();
/* The newest version is fetched whenever the game is opened with a connection. A phone that keeps the game open for days
   asks again when it comes back to the front, and reloads on the home screen (never in the middle of a game). */
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{
  const had=!!navigator.serviceWorker.controller;let asked=Date.now();
  navigator.serviceWorker.register('sw.js').then(reg=>{
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-asked>20*60000){asked=Date.now();try{reg.update().catch(()=>{});}catch(e){}}});
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||ui.fresh)return;ui.fresh=true;if(screen==='home'&&!ui.modal)location.reload();});
});
window.__jamb={get G(){return G;},get online(){return online;},net,ui,prefs,stats,get cloud(){return cloud;},boards};
})();
