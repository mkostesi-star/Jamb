// Shared helpers for the several-phones tests: a local web server, a local PeerJS server,
// and "phones" (browser pages with a phone-sized screen) that host, join and play.
const http=require('http'),fs=require('fs'),path=require('path');
let playwright;try{playwright=require('playwright');}catch(e){playwright=require('/opt/npm-tools/node_modules/playwright');}
const {chromium,devices}=playwright;
const ROOT=path.join(__dirname,'..');
const WEB=+process.env.WEB_PORT||8771,PEERPORT=+process.env.PEER_PORT||9011;
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
// Wraps PeerJS so every message takes window.JAMB_NET_DELAY ms to leave the phone (in order), like a real network.
const LAG=`;(function(){var P=window.Peer;if(!P)return;function patch(c){if(!c||c.__lag)return c;c.__lag=1;var s=c.send;c.send=function(d){var ms=window.JAMB_NET_DELAY||0;if(window.JAMB_NET_DROP)return;if(!ms)return s.call(c,d);var snap=JSON.parse(JSON.stringify(d));setTimeout(function(){try{s.call(c,snap);}catch(e){}},ms);};return c;}
var oc=P.prototype.connect;P.prototype.connect=function(){return patch(oc.apply(this,arguments));};
var oe=P.prototype.emit;P.prototype.emit=function(ev,a){if(ev==='connection')patch(a);return oe.apply(this,arguments);};})();`;

async function servers(){
  const web=http.createServer((req,res)=>{
    let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
    const f=path.join(ROOT,p);
    if(!f.startsWith(ROOT)||f.includes('node_modules')||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>web.listen(WEB,'127.0.0.1',r));
  const express=require('express'),{ExpressPeerServer}=require('peer');
  const app=express(),ps=http.createServer(app);
  app.use('/myapp',ExpressPeerServer(ps,{path:'/'}));
  await new Promise(r=>ps.listen(PEERPORT,'127.0.0.1',r));
  return {close(){web.close();ps.close();}};
}
const URL0=`http://localhost:${WEB}/`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

class Table{
  constructor(browser){this.b=browser;this.errs=[];this.ctxs=[];}
  async phone(tag,o){
    o=o||{};
    const ctx=await this.b.newContext({...devices['Pixel 7'],...(o.viewport?{viewport:o.viewport}:{}),locale:o.locale||'en-US',serviceWorkers:'block'});this.ctxs.push(ctx);
    await ctx.route(/fonts\.g/,r=>r.abort());
    await ctx.route(/audio\/(music|.*\.mp3)/,r=>r.abort());
    const lib=fs.readFileSync(path.join(__dirname,'node_modules/peerjs/dist/peerjs.min.js'),'utf8')+LAG;
    await ctx.route(/jsdelivr.*peerjs/,r=>r.fulfill({body:lib,contentType:'application/javascript'}));
    await ctx.addInitScript(a=>{window.JAMB_PEER_OPTS={host:'127.0.0.1',port:a.port,path:'/myapp',secure:false,config:{iceServers:[]}};window.JAMB_NET_DELAY=a.lag;
      if(a.skew){const D=Date.now.bind(Date);Date.now=()=>D()+a.skew;}},{port:PEERPORT,lag:o.lag||0,skew:o.skew||0});
    const pg=await ctx.newPage();pg.tag=tag;
    pg.on('pageerror',e=>this.errs.push(tag+' PAGEERR '+e.message));
    pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket|ERR_|net::/.test(m.text()))this.errs.push(tag+' '+m.text().slice(0,200));});
    await pg.goto(URL0);await pg.waitForFunction(()=>!!window.__jamb&&typeof window.Peer==='function');
    return pg;
  }
  async close(){for(const c of this.ctxs){try{await c.close();}catch(e){}}}
}
// ----- actions on one phone -----
async function host(pg,name,o){
  o=o||{};
  await pg.click('[data-act=open][data-k=friends]');await pg.click('.panel [data-act=open][data-k=online]');await pg.waitForSelector('#fName');
  await pg.fill('#fName',name);
  await pg.click(`[data-act=tsecon][data-v="${o.timer==null?0:o.timer}"]`);
  if(o.sec)await pg.evaluate(s=>{window.__jamb.prefs.onlineTimer=s;},o.sec);   // a short timer, only for tests
  await pg.click('[data-act=host]');
  await pg.waitForFunction(()=>window.__jamb.net.state==='waiting',null,{timeout:20000});
  return pg.evaluate(()=>window.__jamb.online.code);
}
async function join(pg,code,name){
  await pg.goto(URL0+'?game='+code);await pg.waitForSelector('#fName');
  await pg.fill('#fName',name);await pg.click('[data-act=join]');
  await pg.waitForFunction(()=>{const j=window.__jamb;return j.G&&j.G.code&&j.G.players.some(p=>p.cid===j.prefs.cid);},null,{timeout:25000});
}
async function table(T,names,o){
  o=o||{};
  const pages=[];
  const h=await T.phone(names[0],o.phone&&o.phone[0]);pages.push(h);
  const code=await host(h,names[0],o);
  for(let i=0;i<(o.bots||0);i++){await h.click('[data-act=onaddbot]');await sleep(60);}
  for(let i=1;i<names.length;i++){const g=await T.phone(names[i],o.phone&&o.phone[i]);await join(g,code,names[i]);pages.push(g);}
  const n=names.length+(o.bots||0);
  await h.waitForFunction(k=>window.__jamb.G.players.length===k,n,{timeout:20000});
  if(o.fill!=null){ // leave only a few free boxes on every sheet, to reach the end of a game quickly
    await h.evaluate(keep=>{const G=window.__jamb.G;G.players.forEach(p=>{let left=keep;const cols=Object.keys(p.sheet);for(const c of cols)for(const r of Object.keys(p.sheet[c]))p.sheet[c][r]=0;
      for(const r of ['jamb','poker','ful','triling','kenta','min','max']){if(left>0&&p.sheet.free&&r in p.sheet.free){p.sheet.free[r]=null;left--;}}});},o.fill);
  }
  if(o.start!==false){
    await h.click('.bigbtn[data-act=startonline]');
    for(const p of pages)await p.waitForFunction(()=>window.__jamb.G.status==='playing',null,{timeout:15000});
  }
  return {pages,code,host:h};
}
const S=pg=>pg.evaluate(()=>{const j=window.__jamb,G=j.G;if(!G)return null;
  return {pos:G.pos?G.pos.id:null,rev:G.rev,id:G.id,cur:G.current,roll:G.turn.roll,dice:G.turn.dice.join(''),held:G.turn.held.map(x=>x?1:0).join(''),ann:G.turn.announced||'',status:G.status,over:!!G.over,paused:G.paused?{by:G.paused.by,ready:(G.paused.ready||[]).slice().sort()}:null,
    left:G.left==null?null:Math.round(G.left/1000),dl:G.deadline?Math.round((G.deadline-Date.now())/1000):null,
    who:G.players.map(p=>p.kind==='cpu'?'cpu:'+p.char:(p.name||'?')).join(','),
    filled:G.players.map(p=>Object.values(p.sheet).reduce((a,c)=>a+Object.values(c).filter(v=>v!==null).length,0)).join('/'),
    sheets:JSON.stringify(G.players.map(p=>p.sheet)),net:j.net.state,seat:G.players.findIndex(p=>p.cid===j.prefs.cid),rolling:!!j.ui.rolling};});
const key=s=>s?[s.id,s.cur,s.roll,s.dice,s.held,s.ann,s.status,s.over,JSON.stringify(s.paused),s.sheets].join('|'):'null';
// every phone shows the same game (same position, same sheets, same pause state)
async function agree(pages,ms){
  const t0=Date.now();let ss;
  for(;;){
    ss=await Promise.all(pages.map(S));
    if(ss.every(s=>s&&!s.rolling&&key(s)===key(ss[0])))return ss[0];
    if(Date.now()-t0>(ms||8000))break;
    await sleep(120);
  }
  const brief=ss.map((s,i)=>pages[i].tag+': '+(s?`cur ${s.cur} roll ${s.roll} dice ${s.dice} held ${s.held} filled ${s.filled} rev ${s.rev} paused ${JSON.stringify(s.paused)} over ${s.over} net ${s.net}`:'none')).join('\n    ');
  throw new Error('phones disagree:\n    '+brief);
}
const myTurn=pg=>pg.evaluate(()=>{const j=window.__jamb,G=j.G;return !!G&&G.status==='playing'&&!G.over&&!G.paused&&G.current===G.players.findIndex(p=>p.cid===j.prefs.cid);});
async function settle(pg){await pg.waitForFunction(()=>!window.__jamb.ui.rolling,null,{timeout:8000});}
async function roll(pg){await settle(pg);await pg.click('.glass[data-act=roll]:not([disabled])',{timeout:8000});await pg.waitForFunction(()=>window.__jamb.ui.rolling||window.__jamb.G.turn.roll>0);await settle(pg);}
async function hold(pg,i){await settle(pg);await pg.click(`.die[data-i="${i}"]`);}
// writes the first box the game offers (select, then confirm)
async function write(pg){
  await settle(pg);
  const c=await pg.$('.cell[data-act=cell]:not(.call)');if(!c)throw new Error(pg.tag+': no box to write');
  await c.click();await sleep(60);
  const s=await pg.$('.cell.sel');if(s)await s.click();else{const w=await pg.$('[data-act=write]');if(w)await w.click();}
  await sleep(80);
}
async function turn(pg,rolls){for(let k=0;k<(rolls||1);k++){const can=await pg.$('.glass[data-act=roll]:not([disabled])');if(!can)break;await roll(pg);}await write(pg);}
// plays turns on whichever phone is up until the predicate says stop
async function playUntil(pages,stop,max){
  for(let k=0;k<(max||60);k++){
    const s=await S(pages[0]);if(await stop(s))return s;
    let moved=false;
    for(const p of pages){if(await myTurn(p)){await turn(p,1);moved=true;break;}}
    if(!moved)await sleep(250);
  }
  throw new Error('playUntil ran out of turns');
}
async function freeze(pg,on){const s=await pg.context().newCDPSession(pg);await s.send('Page.setWebLifecycleState',{state:on?'frozen':'active'});await s.detach();}
module.exports={servers,Table,chromium,host,join,table,S,agree,myTurn,roll,hold,write,turn,playUntil,sleep,settle,freeze,URL0,key};
