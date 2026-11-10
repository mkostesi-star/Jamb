// Games on several phones: two and three "phones" play through the cases that go wrong in real life.
// Run:  cd tests && npm install && node online.js          (all cases)
//       node online.js pause rematch                       (only cases whose name contains one of the words)
const L=require('./lib.js');
const {S,agree,roll,hold,write,turn,playUntil,sleep,myTurn,settle}=L;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const tests=[];
const test=(name,fn)=>tests.push({name,fn});
const filled=s=>s.filled.split('/').map(Number);
const sum=a=>a.reduce((x,y)=>x+y,0);
const who=async(pages)=>{for(const p of pages)if(await myTurn(p))return p;return null;};
const cut=async(pg)=>{await pg.context().setOffline(true);await pg.evaluate(()=>{const n=window.__jamb.net;window.JAMB_NET_DROP=true;[n.conn].concat(n.conns).forEach(c=>{try{c&&c.close();}catch(e){}});if(n.peer){try{n.peer.disconnect();}catch(e){}}});};
const mend=async(pg)=>{await pg.context().setOffline(false);await pg.evaluate(()=>{window.JAMB_NET_DROP=false;document.dispatchEvent(new Event('visibilitychange'));});};
const linked=(pg)=>pg.waitForFunction(()=>window.__jamb.net.state==='connected',null,{timeout:30000});

test('two phones play three rounds',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana']);
  for(let r=1;r<=3;r++){await playUntil(pages,s=>sum(filled(s))>=2*r);const s=await agree(pages);assert(s.filled===`${r}/${r}`,'filled '+s.filled);}
});
test('three phones play two rounds, with holds and a second roll',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  for(let k=0;k<6;k++){
    const p=await who(pages);assert(p,'nobody to play');
    await roll(p);await hold(p,0);await hold(p,3);await agree(pages);
    await roll(p);const s=await agree(pages);assert(s.roll===2&&s.held==='10010','kept dice differ: '+s.held);
    await write(p);await agree(pages);
  }
  const s=await agree(pages);assert(s.filled==='2/2/2','filled '+s.filled);
});
test('same moment: host pauses while a guest rolls',async T=>{
  const {pages,host}=await L.table(T,['Ivan','Ana'],{timer:60,phone:[{lag:250},{lag:250}]});
  const g=pages[1];
  await turn(host,1);await agree(pages);
  await Promise.all([g.click('.glass[data-act=roll]'),host.click('[data-act=pause]')]);
  const s=await agree(pages,10000);
  assert(s.paused,'the pause was lost');assert(s.roll===1,'the roll was lost (roll '+s.roll+')');
  await host.click('.rdy:not([disabled])');await g.click('.rdy:not([disabled])');
  await host.waitForFunction(()=>!window.__jamb.G.paused,null,{timeout:8000});
  const s2=await agree(pages);assert(!s2.paused&&s2.roll===1&&s2.cur===1,'after ready: '+JSON.stringify(s2.paused)+' roll '+s2.roll);
  await write(g);const s3=await agree(pages);assert(s3.filled==='1/1','filled '+s3.filled);
});
test('same moment: one guest takes a move back while the next one rolls',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko'],{phone:[{lag:200},{lag:200},{lag:200}]});
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await turn(a,1);await agree(pages);
  await Promise.all([a.click('[data-act=undo]'),m.click('.glass[data-act=roll]')]);
  const s=await agree(pages,10000);
  assert((s.cur===2&&s.roll===1&&s.filled==='1/1/0')||(s.cur===1&&s.filled==='1/0/0'),'neither outcome: cur '+s.cur+' roll '+s.roll+' filled '+s.filled);
  // whoever is up can finish the turn and everyone follows
  const p=await who(pages);if((await S(p)).roll===0)await roll(p);await write(p);
  await agree(pages);
});
test('same moment: host and guest both tap rematch',async T=>{
  const {pages,host}=await L.table(T,['Ivan','Ana'],{fill:1,phone:[{lag:250},{lag:250}]});
  await playUntil(pages,s=>s.over);await agree(pages);
  for(const p of pages)await p.waitForSelector('[data-act=rematch]',{timeout:8000});
  await Promise.all(pages.map(p=>p.click('[data-act=rematch]')));
  for(const p of pages)await p.waitForFunction(()=>!window.__jamb.G.over,null,{timeout:8000});
  const s=await agree(pages,10000);assert(!s.over&&s.filled==='0/0'&&s.cur===1,'rematch state: over '+s.over+' filled '+s.filled+' cur '+s.cur);
  await playUntil(pages,x=>sum(filled(x))>=2);await agree(pages);
});
test('quick taps: a kept die right after a roll reaches the third phone',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  // Ana's taps arrive while the host is still showing her roll
  await a.evaluate(()=>{document.querySelector('.glass[data-act=roll]').click();});
  await a.waitForFunction(()=>!window.__jamb.ui.rolling&&window.__jamb.G.turn.roll===1);
  await a.evaluate(()=>{document.querySelector('.die[data-i="1"]').click();document.querySelector('.die[data-i="2"]').click();});
  await a.evaluate(()=>{document.querySelector('.glass[data-act=roll]').click();});
  await a.waitForFunction(()=>!window.__jamb.ui.rolling&&window.__jamb.G.turn.roll===2);
  await a.evaluate(()=>{document.querySelector('.die[data-i="4"]').click();});
  const s=await agree(pages,10000);assert(s.roll===2&&s.held==='01101','kept dice: '+s.held+' roll '+s.roll);
});
test('a phone drops out during other turns and rejoins',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await cut(m);
  await turn(a,2);await agree([h,a]);
  await mend(m);await linked(m);
  const s=await agree(pages,15000);assert(s.filled==='1/1/0'&&s.cur===2,'after rejoin: '+s.filled+' cur '+s.cur);
  await turn(m,1);await agree(pages);
});
test('a guest plays a whole turn without a connection, then it arrives',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await cut(a);
  await roll(a);await hold(a,0);await hold(a,1);await roll(a);await write(a);
  const before=await S(h);assert(before.filled==='1/0/0','host moved early: '+before.filled);
  await mend(a);await linked(a);
  const s=await agree(pages,15000);assert(s.filled==='1/1/0'&&s.cur===2,'offline turn not accepted: '+s.filled+' cur '+s.cur);
});
test('host skips a missing player; their offline moves give way',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await cut(a);await roll(a);
  await h.waitForSelector('[data-act=skipaway]',{timeout:20000});
  await h.click('[data-act=skipaway]');
  const s1=await agree([h,m],8000);assert(s1.cur===2&&s1.filled==='1/1/0','skip did not pass the turn: cur '+s1.cur+' '+s1.filled);
  // her next turn passes by itself while she is still away
  await turn(m,1);await turn(h,1);
  await h.waitForFunction(()=>window.__jamb.G.current===2,null,{timeout:15000});
  const s2=await agree([h,m]);assert(s2.filled==='2/2/1','second turn not passed: '+s2.filled);
  await mend(a);await linked(a);
  const s=await agree(pages,15000);assert(s.cur===2&&s.filled==='2/2/1','after return: cur '+s.cur+' '+s.filled);
  await turn(m,1);await turn(h,1);
  await sleep(4500);assert(await myTurn(a),'Ana is back but her turn was taken');
  await turn(a,1);const s3=await agree(pages);assert(s3.filled==='3/3/2','after she plays: '+s3.filled);
});
test('turn timer: a connected player who waits too long is moved on',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana'],{sec:5});
  const [h,a]=pages;
  await turn(h,1);await agree(pages);
  const s=await agree(pages);assert(s.dl>=3&&s.dl<=5,'clock shows '+s.dl);
  await h.waitForFunction(()=>window.__jamb.G.current===0,null,{timeout:12000});
  const s2=await agree(pages);assert(s2.filled==='1/1','timeout move missing: '+s2.filled);
});
test('turn timer: the host covers for a phone that is gone',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko'],{sec:5});
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await cut(a);
  await h.waitForFunction(()=>window.__jamb.G.current===2,null,{timeout:25000});
  const s=await agree([h,m]);assert(s.filled==='1/1/0','cover move missing: '+s.filled);
  await mend(a);await linked(a);await agree(pages,15000);
});
test('turn timer: phones with wrong clocks still show the same time',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko'],{sec:30,phone:[{},{skew:90000},{skew:-90000}]});
  const [h,a,m]=pages;
  await turn(h,1);
  const ss=await Promise.all(pages.map(S));
  ss.forEach((s,i)=>assert(s.dl>=26&&s.dl<=31,pages[i].tag+' shows '+s.dl+' s'));
  await sleep(1500);const s=await agree(pages);assert(s.cur===1&&s.filled==='1/0/0','a wrong clock forced a move: cur '+s.cur+' '+s.filled);
  await turn(a,1);await sleep(300);
  const s2=await Promise.all(pages.map(S));s2.forEach((x,i)=>assert(x.dl>=26&&x.dl<=31,pages[i].tag+' shows '+x.dl+' s after Ana'));
});
test('pause and ready on three phones, with a computer at the table',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana'],{timer:60,bots:1});
  const [h,a]=pages;
  await turn(h,1);
  await h.waitForFunction(()=>window.__jamb.G.current===1&&window.__jamb.G.turn.roll>=1,null,{timeout:10000});   // the computer is playing
  await a.click('[data-act=pause]');
  const s=await agree(pages);assert(s.paused,'not paused');
  const r1=(await S(h)).rev;await sleep(2500);const r2=(await S(h)).rev;assert(r1===r2,'computer played during the pause');
  assert((await h.$$('.rdy')).length===2,'ready buttons');
  await a.click('.rdy:not([disabled])');const s1=await agree(pages);assert(s1.paused&&s1.paused.ready.length===1,'one ready');
  await h.click('.rdy:not([disabled])');await h.waitForFunction(()=>!window.__jamb.G.paused);
  await h.waitForFunction(()=>window.__jamb.G.current===2,null,{timeout:20000});
  const s2=await agree(pages);assert(s2.filled==='1/1/0','computer did not finish: '+s2.filled);
});
test('computers: two rounds on two phones, host reloads during a computer turn',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana'],{bots:2});
  const [h,a]=pages;
  await turn(h,1);
  await h.waitForFunction(()=>window.__jamb.G.current===1&&window.__jamb.G.turn.roll>=1,null,{timeout:10000});
  await h.reload();await h.waitForFunction(()=>!!window.__jamb&&!!window.__jamb.G&&window.__jamb.G.mode==='online');
  await a.waitForFunction(()=>window.__jamb.G.current===3,null,{timeout:60000});
  let s=await agree(pages,15000);assert(s.filled==='1/1/1/0','after reload: '+s.filled);
  await playUntil(pages,x=>sum(filled(x))>=8,300);
  s=await agree(pages,15000);assert(s.filled==='2/2/2/2','two rounds: '+s.filled);
});
test('host goes to the menu and comes back',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await h.click('[data-act=exit]');
  await a.waitForFunction(()=>window.__jamb.net.state!=='connected',null,{timeout:25000});
  await roll(a);                                              // Ana keeps playing while the host is away
  await h.click('[data-act=resume][data-m=online]');
  await linked(a);await linked(m);
  let s=await agree(pages,15000);assert(s.cur===1&&s.roll===1,'Ana\'s roll lost: cur '+s.cur+' roll '+s.roll);
  await write(a);s=await agree(pages);assert(s.filled==='1/1/0','after return: '+s.filled);
});
test('host locks the phone for a while',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await L.freeze(h,true);
  await roll(a);await hold(a,2);
  await sleep(22000);                                         // long enough for the guests to notice
  await L.freeze(h,false);
  await h.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await linked(a);await linked(m);
  let s=await agree(pages,20000);assert(s.cur===1&&s.roll===1&&s.held==='00100','after unlock: cur '+s.cur+' roll '+s.roll+' held '+s.held);
  await write(a);await turn(m,1);s=await agree(pages);assert(s.filled==='1/1/1','after unlock round: '+s.filled);
});
test('guest reloads in the middle of a turn',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await roll(a);await hold(a,1);await agree(pages);
  await a.reload();await a.waitForFunction(()=>!!window.__jamb&&!!window.__jamb.G&&window.__jamb.G.mode==='online');await linked(a);
  let s=await agree(pages,15000);assert(s.cur===1&&s.roll===1&&s.held==='01000','after reload: roll '+s.roll+' held '+s.held);
  await roll(a);await write(a);s=await agree(pages);assert(s.filled==='1/1/0','filled '+s.filled);
});
test('end of a game: everyone sees the result and it counts for everyone; rematch by a guest',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko'],{fill:1});
  const played=await Promise.all(pages.map(p=>p.evaluate(()=>window.__jamb.stats.played||0)));
  await playUntil(pages,s=>s.over);
  const s=await agree(pages);assert(s.over&&s.status==='over','not over');
  for(const p of pages)await p.waitForSelector('.panel [data-act=rematch]',{timeout:8000});
  const after=await Promise.all(pages.map(p=>p.evaluate(()=>({n:window.__jamb.stats.played||0,rec:Object.values(window.__jamb.stats.records||{}).reduce((a,r)=>a+r.games,0)}))));
  after.forEach((x,i)=>{assert(x.n===played[i]+1,pages[i].tag+': games played '+x.n);assert(x.rec===1,pages[i].tag+': records '+x.rec);});
  await pages[2].click('[data-act=rematch]');
  await pages[2].waitForFunction(()=>!window.__jamb.G.over,null,{timeout:8000});
  const s2=await agree(pages,10000);assert(!s2.over&&s2.cur===1&&s2.filled==='0/0/0','rematch: cur '+s2.cur+' '+s2.filled);
  for(const p of pages)await p.waitForFunction(()=>!window.__jamb.ui.modal,null,{timeout:4000}).catch(()=>{throw new Error(p.tag+' still shows the old result');});
  await playUntil(pages,x=>sum(filled(x))>=3);await agree(pages);
});
test('a late phone cannot join a running game',async T=>{
  const {pages,code}=await L.table(T,['Ivan','Ana']);
  const x=await T.phone('Late');
  await x.goto(L.URL0+'?game='+code);await x.waitForSelector('#fName');await x.fill('#fName','Late');await x.click('[data-act=join]');
  await x.waitForFunction(()=>window.__jamb.net.state==='full',null,{timeout:20000});
  await turn(pages[0],1);const s=await agree(pages);assert(s.who==='Ivan,Ana','roster changed: '+s.who);
});
test('a phone cannot move for someone else or rewrite the sheets',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);                          // Ana is up; Marko tries to cheat
  await m.evaluate(()=>{const j=window.__jamb,G=JSON.parse(JSON.stringify(j.G));G.rev=(G.rev||0)+5;G.players[2].sheet.free.jamb=80;G.current=2;
    if(G.pos)G.pos={id:'forged',anc:[G.pos.id].concat(G.pos.anc||[])};j.net.conn.send({t:'state',pv:2,now:Date.now(),G});});
  await sleep(800);
  const s=await agree(pages,8000);assert(s.cur===1&&!/80/.test(s.sheets),'forged state accepted: cur '+s.cur);
  await turn(a,1);await agree(pages);
});
test('taking a move back on three phones',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await turn(a,1);let s=await agree(pages);assert(s.filled==='1/1/0'&&s.cur===2,'before: '+s.filled);
  assert(!(await h.$('[data-act=undo]'))&&!(await m.$('[data-act=undo]')),'someone else can take Ana\'s move back');
  await a.click('[data-act=undo]');await a.waitForFunction(()=>window.__jamb.G.current===1);
  s=await agree(pages);assert(s.filled==='1/0/0'&&s.cur===1&&s.roll===1,'after undo: '+s.filled+' cur '+s.cur+' roll '+s.roll);
  await write(a);await roll(m);s=await agree(pages);
  assert(!(await a.$('[data-act=undo]')),'undo still offered after the next player rolled');
});
test('guest goes to the menu and comes back; host reloads on its own turn',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko']);
  const [h,a,m]=pages;
  await turn(h,1);await agree(pages);
  await m.click('[data-act=exit]');await m.waitForSelector('[data-act=resume][data-m=online]');
  await turn(a,1);await agree([h,a]);
  await m.click('[data-act=resume][data-m=online]');await linked(m);
  let s=await agree(pages,15000);assert(s.filled==='1/1/0'&&s.cur===2,'after menu: '+s.filled);
  await turn(m,1);await roll(h);await hold(h,0);await agree(pages);
  await h.reload();await h.waitForFunction(()=>!!window.__jamb&&!!window.__jamb.G&&window.__jamb.G.mode==='online');
  await linked(a);await linked(m);
  s=await agree(pages,15000);assert(s.cur===0&&s.roll===1&&s.held==='10000','after host reload: cur '+s.cur+' roll '+s.roll+' held '+s.held);
  await write(h);await turn(a,1);s=await agree(pages);assert(s.filled==='2/2/1','filled '+s.filled);
});
test('a phone on an older version is turned away and told why',async T=>{
  const {pages,code}=await L.table(T,['Ivan','Ana']);
  const [h,a]=pages;
  // Ana's phone pretends to be an older version: reconnects with an old-style greeting
  await a.evaluate(()=>{const j=window.__jamb;j.net.conn.send({t:'hello',cid:j.prefs.cid,name:'Ana',G:j.G});});
  await a.waitForFunction(()=>window.__jamb.net.state==='version',null,{timeout:8000});
  const txt=await a.evaluate(()=>document.querySelector('.tagcard .tm').textContent);assert(/version/i.test(txt),'banner says: '+txt);
  await turn(h,1);const s=await S(h);assert(s.filled==='1/0','host game broke: '+s.filled);
});
test('soak: three phones and a computer, slow network, random taps, drops and pauses',async T=>{
  const {pages}=await L.table(T,['Ivan','Ana','Marko'],{bots:1,timer:60,phone:[{lag:120},{lag:220},{lag:60}]});
  let seed=+process.env.SEED||20261110;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const t0=Date.now();let cutPg=null,cutAt=0,acts=0;
  const tap=(pg,sel)=>pg.evaluate(q=>{const e=document.querySelector(q);if(e&&!e.disabled){e.click();return true;}return false;},sel).catch(()=>false);
  while(Date.now()-t0<70000){
    let pg=pages[Math.floor(rnd()*3)];const r=rnd();
    if(rnd()<0.7){const up=await who(pages.filter(p=>p!==cutPg));if(up)pg=up;}   // mostly the phone whose turn it is
    if(cutPg&&Date.now()-cutAt>5000){await mend(cutPg);cutPg=null;}
    if(r<0.34)await tap(pg,'.glass[data-act=roll]');
    else if(r<0.50)await tap(pg,`.die[data-i="${Math.floor(rnd()*5)}"]`);
    else if(r<0.74){if(await tap(pg,'.cell[data-act=cell]:not(.call)')){await sleep(40);await tap(pg,'.cell.sel');}}
    else if(r<0.80)await tap(pg,'[data-act=undo]');
    else if(r<0.815)await tap(pages[Math.floor(rnd()*3)],'[data-act=pause]');
    else if(r<0.93){for(const p of pages)if(rnd()<0.6)await tap(p,'.rdy:not(.on):not([disabled])');}
    else if(r<0.95&&!cutPg&&pg!==pages[0]){cutPg=pg;cutAt=Date.now();await cut(pg);}
    else if(r<0.97)await tap(pages[0],'[data-act=resumenow]');
    acts++;await sleep(60+Math.floor(rnd()*240));
  }
  if(cutPg)await mend(cutPg);
  for(const p of pages.slice(1))await linked(p);
  // let everything settle: unpause, and wait for a moment when a person is to play
  for(let k=0;k<40;k++){
    for(const p of pages)await tap(p,'.rdy:not(.on):not([disabled])');
    const s=await S(pages[0]);if(!s.paused&&s.cur!==1&&!s.rolling)break;await sleep(500);
  }
  await sleep(1500);
  const s=await agree(pages,20000);
  const f=filled(s);console.log('      soak: '+acts+' taps, boxes filled '+s.filled+', seed '+(+process.env.SEED||20261110));assert(sum(f)>=10,'hardly anything was played: '+s.filled+' after '+acts+' taps');
  assert(Math.max(...f)-Math.min(...f)<=1,'turn order broke: '+s.filled);
});
test('lobby: add, swap and remove computers; a guest sees them',async T=>{
  const {pages,host}=await L.table(T,['Ivan','Ana'],{bots:2,start:false});
  let s=await agree(pages);assert(/^Ivan,cpu:\w+,cpu:\w+,Ana$/.test(s.who),'lobby: '+s.who);
  await host.click('.chip[data-p="2"]');await host.click('[data-act=onrmbot]');
  s=await agree(pages);assert(/^Ivan,cpu:\w+,Ana$/.test(s.who),'after remove: '+s.who);
  assert((await pages[1].$$('[data-act=onaddbot]')).length===0,'guest can add computers');
});

(async()=>{
  const only=process.argv.slice(2);
  const srv=await L.servers();
  const browser=await L.chromium.launch({args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
  let fail=0;const t00=Date.now();
  for(const tc of tests){
    if(only.length&&!only.some(w=>tc.name.toLowerCase().includes(w.toLowerCase())))continue;
    const T=new L.Table(browser),t0=Date.now();let err=null;
    try{await Promise.race([tc.fn(T),new Promise((_,rej)=>setTimeout(()=>rej(new Error('took longer than 150 s')),150000))]);if(T.errs.length)err=new Error('page errors: '+T.errs.join(' | '));}
    catch(e){err=e;}
    await T.close();
    console.log((err?'FAIL':'ok  ')+'  '+tc.name+'  ('+((Date.now()-t0)/1000).toFixed(1)+' s)'+(err?'\n    '+String(err.message).split('\n').slice(0,8).join('\n    '):''));
    if(err)fail++;
  }
  console.log(`\n${fail?fail+' FAILED':'all passed'} in ${Math.round((Date.now()-t00)/1000)} s`);
  await browser.close();srv.close();process.exit(fail?1:0);
})();
