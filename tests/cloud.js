// Accounts, records that follow the player, and Daily Yamb high scores, end to end:
// real game pages in headless browsers ("devices"), the real Supabase library, and a stand-in for the Supabase
// project (cloud-server.js) that runs server/schema.sql on a local Postgres. Google is played by the stand-in.
//   node cloud.js           (about 4 minutes)
const L=require('./lib.js');
const cloudServer=require('./cloud-server.js');
const CPORT=+process.env.CLOUD_PORT||9021;
let bad=0;const ok=(c,m,seen)=>{if(c)console.log('  ok    '+m);else{bad++;console.log('  FAIL  '+m+(seen!=null?'\n        seen: '+String(seen).replace(/\s+/g,' ').slice(0,420):''));}};
const J=pg=>pg.evaluate(()=>{const j=window.__jamb;return{uid:j.cloud.uid,out:j.cloud.outbox.length,snap:!!j.cloud.snap,state:!!j.cloud.state,name:j.cloud.me&&j.cloud.me.name,modal:j.ui.modal&&j.ui.modal.kind,played:j.stats.played};});
const post=(url,body)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
(async()=>{
  const t0=Date.now();
  const srv=await L.servers(),cs=await cloudServer.start(CPORT);
  const browser=await L.chromium.launch(),T=new L.Table(browser);
  const CLOUD={url:cs.url,key:'sb_publishable_test'};
  const device=tag=>T.phone(tag,{cloud:CLOUD});
  const sql=(q,p)=>cs.S.admin(q,p).then(r=>r.rows);
  const day=today();
  const local=pg=>pg.evaluate(d=>window.__jamb.stats.daily.results[d]||null,day);
  const toastText=pg=>pg.evaluate(()=>{const e=document.getElementById('toast');return e&&!e.hidden?e.textContent:'';});
  // open a panel from a button and wait until it is really showing; close it and wait until it is gone
  async function openPanel(pg,k,sel){
    await pg.click(sel||`[data-act=open][data-k=${k}]`);
    await pg.waitForFunction(kind=>{const j=window.__jamb;return j.ui.modal&&j.ui.modal.kind===kind&&!document.getElementById('modal').classList.contains('closing')&&document.getElementById('panel').innerText.length>10;},k,{timeout:10000});
    return pg.$eval('#panel',e=>e.innerText);
  }
  async function closePanel(pg){
    await pg.click('#panel .x');
    await pg.waitForFunction(()=>!window.__jamb.ui.modal&&document.getElementById('modal').hidden,null,{timeout:10000});
  }
  async function playDaily(pg){
    await pg.click('[data-act=daily]');
    await pg.waitForFunction(()=>window.__jamb.G&&window.__jamb.G.mode==='daily'&&!window.__jamb.G.over);
    for(let t=0;t<13;t++){
      await L.roll(pg);
      if(t%3===0){await L.hold(pg,0);await L.hold(pg,3);await L.roll(pg);}
      if(t%6===0){await L.hold(pg,1);await L.roll(pg);}
      await L.write(pg);
    }
    await pg.waitForFunction(()=>window.__jamb.G.over,null,{timeout:10000});
    await pg.waitForFunction(()=>window.__jamb.ui.modal&&window.__jamb.ui.modal.kind==='result',null,{timeout:10000});
  }
  async function signIn(pg,email,name,deny){
    await post(cs.url+'/__test/next',deny?{deny:true}:{email,name});
    await Promise.all([pg.waitForNavigation({waitUntil:'load',timeout:20000}).catch(()=>{}),pg.click('.gbtn[data-act=signin]')]);
    await pg.waitForFunction(()=>!!window.__jamb,null,{timeout:20000});
    if(!deny)await pg.waitForFunction(()=>{const c=window.__jamb.cloud;return c.uid&&c.state&&!c.snap;},null,{timeout:20000});
  }
  // a game against the computer cut down to one box each, to reach the end quickly
  async function shortCpuGame(pg){
    await pg.goto(L.URL0);await pg.waitForFunction(()=>!!window.__jamb);
    await pg.click('[data-act=open][data-k=cpu]');await pg.click('[data-act=startcpu]');
    await pg.waitForFunction(()=>window.__jamb.G&&window.__jamb.G.mode==='cpu');
    await pg.evaluate(()=>{const G=window.__jamb.G;G.players.forEach(p=>{for(const c of Object.keys(p.sheet))for(const r of Object.keys(p.sheet[c]))p.sheet[c][r]=0;p.sheet.free.jamb=null;});});
    await L.turn(pg,1);
    await pg.waitForFunction(()=>window.__jamb.G.over,null,{timeout:30000});
    return pg.evaluate(()=>window.__jamb.G.id);
  }
  try{
    // ---- 1. a visitor plays the Daily, then signs in from the result
    const d1=await device('ana-phone');
    await playDaily(d1);
    const r1=await local(d1);
    ok(r1&&r1.done&&Array.isArray(r1.moves)&&r1.moves.length===13&&r1.moves.some(m=>m.length===3),'a finished Daily keeps its moves (13 turns, with the dice that were kept)');
    await d1.waitForFunction(()=>/No scores yet/.test(document.getElementById('panel').innerText),null,{timeout:10000});
    ok(await d1.$('.gbtn[data-act=signin]:not([disabled])')!==null,'a visitor sees the empty high scores and the Google button under the result');
    ok((await sql('select count(*)::int as n from public.daily_scores'))[0].n===0,'nothing is sent while nobody is signed in');
    await signIn(d1,'ana@example.com','Ana Horvat');
    await d1.waitForFunction(()=>!!document.querySelector('.board tr.me'),null,{timeout:15000});
    const row=await d1.$eval('.board tr.me',e=>e.innerText.replace(/\s+/g,' ').trim());
    const db1=await sql('select s.score, p.name from public.daily_scores s join public.profiles p on p.id = s.user_id where s.day = $1',[day]);
    ok(db1.length===1&&db1[0].score===r1.score,'after signing in, the Daily is checked and stored: the database counted '+(db1[0]&&db1[0].score)+', the game '+r1.score);
    ok(/^1\. Ana /.test(row)&&row.endsWith(String(r1.score)),'back from Google the Daily opens again with the player in first place: "'+row+'"');
    ok(db1[0].name==='Ana','the first name from Google becomes the name on the high scores');
    ok(!/[?&](code|error)=/.test(d1.url()),'the address is clean after coming back ('+d1.url()+')');
    let c=(await sql('select stats from public.carried'))[0];
    ok(c&&c.stats.played===1&&c.stats.records.length===1&&c.stats.records[0].mode==='daily'&&c.stats.records[0].best===r1.score,'the device\'s earlier records went up once, as they were');
    await closePanel(d1);
    let txt=await openPanel(d1,'records');
    ok(/Saved to your account/.test(txt)&&txt.includes(String(r1.score)),'Records says they are saved to the account and shows the Daily',txt);
    await closePanel(d1);

    // ---- 2. a second device signs into the same account
    const d2=await device('ana-laptop');
    txt=await openPanel(d2,'account');
    ok(/keep your records on every device/.test(txt),'the Account panel explains what signing in is for',txt);
    await signIn(d2,'ana@example.com','Ana Horvat');
    ok((await J(d2)).modal==='account','signing in from the Account panel comes back to it');
    const r2=await local(d2);
    ok(r2&&r2.done&&r2.score===r1.score,'today\'s Daily shows as done on the second device, with the same score');
    await closePanel(d2);
    await d2.waitForFunction(s=>document.getElementById('home').innerText.includes(String(s)),r1.score,{timeout:10000});
    txt=await d2.$eval('#home',e=>e.innerText);
    ok(/your place: 1 of 1/.test(txt),'the home screen shows the day\'s best and the player\'s place',txt);
    ok((await sql('select count(*)::int as n from public.daily_scores'))[0].n===1&&(await sql('select count(*)::int as n from public.carried'))[0].n===2,'no second score; the second device\'s (empty) records are kept beside the first');
    const gid=await shortCpuGame(d2);
    await d2.waitForFunction(()=>window.__jamb.cloud.outbox.length===0,null,{timeout:15000});
    const res=await sql('select mode, score, players, mine from public.results where game_id = $1',[gid]);
    ok(res.length===1&&res[0].mode==='cpu'&&res[0].players===2&&res[0].mine===true,'a game finished while signed in is saved to the account');
    await d1.goto(L.URL0);await d1.waitForFunction(()=>{const c=window.__jamb.cloud;return c.state&&c.state.d.totals.games===1;},null,{timeout:15000});
    txt=await openPanel(d1,'records');
    ok(/Play the computer/i.test(txt)&&/Daily Yamb/i.test(txt),'the first device now shows the game played on the second',txt);
    await closePanel(d1);

    // ---- 3. no connection: the game waits and sends later
    await post(cs.url+'/__test/down',{down:true});
    const gid2=await shortCpuGame(d2);
    await d2.waitForTimeout(1500);
    ok((await J(d2)).out===1,'with no connection the finished game waits on the device');
    await d2.goto(L.URL0);await d2.waitForFunction(()=>!!window.__jamb);
    txt=await openPanel(d2,'records');
    ok(/Saved to your account/.test(txt)&&(txt.match(/Games: 2/)||[]).length===1,'Records already counts it (2 games against the computer)',txt);
    await closePanel(d2);
    await post(cs.url+'/__test/down',{down:false});
    await d2.evaluate(()=>window.dispatchEvent(new Event('online')));
    await d2.waitForFunction(()=>window.__jamb.cloud.outbox.length===0,null,{timeout:15000});
    ok((await sql('select count(*)::int as n from public.results where game_id = $1',[gid2]))[0].n===1,'when the connection is back it goes up, once');

    // ---- 4. another player; places; a new name
    const d3=await device('ivo-phone');
    await playDaily(d3);
    const r3=await local(d3);
    await signIn(d3,'ivo@example.com','Ivo Babić');
    await d3.waitForFunction(()=>!!document.querySelector('.board tr.me'),null,{timeout:15000});
    const rows=await d3.$$eval('.board tr',els=>els.map(e=>e.innerText.replace(/\s+/g,' ').trim()));
    const mine3=await d3.$eval('.board tr.me',e=>e.innerText.replace(/\s+/g,' ').trim());
    const exp=r3.score>r1.score?1:(r3.score===r1.score?1:2);
    ok(rows.length===2&&mine3.startsWith(exp+'. Ivo')&&mine3.endsWith(String(r3.score)),'a second player is placed by score, and only their own row is marked: '+JSON.stringify(rows));
    await d3.click('[data-act=boardtab][data-v=w]');
    await d3.waitForFunction(()=>/1 day/.test(document.getElementById('panel').innerText),null,{timeout:10000});
    {const wr=await d3.$$eval('.board tr',els=>els.map(e=>e.innerText.replace(/\s+/g,' ').trim()));ok(wr.length===2,'the week\'s high scores add up each player\'s days',JSON.stringify(wr));}
    await closePanel(d3);
    await d1.goto(L.URL0);await d1.waitForFunction(()=>!!window.__jamb);
    await openPanel(d1,'account');
    await d1.fill('#acName','  Ana   B.  ');await d1.click('[data-act=acsave]');
    await d1.waitForFunction(()=>window.__jamb.cloud.me&&window.__jamb.cloud.me.name==='Ana B.',null,{timeout:10000});
    ok((await sql(`select name from public.profiles where name like 'Ana%'`))[0].name==='Ana B.','a new name is saved, tidied');
    await d3.goto(L.URL0);await d3.waitForFunction(()=>/Ana B\.|Ivo/.test(document.getElementById('home').innerText),null,{timeout:10000});
    await openPanel(d3,'daily','[data-act=daily]');
    await d3.waitForFunction(()=>/Ana B\./.test(document.getElementById('panel').innerText),null,{timeout:10000});
    ok(true,'the other player sees the new name on the high scores');
    await closePanel(d3);

    // ---- 5. sign-in tokens run out and are renewed; signing out; a refused sign-in
    await post(cs.url+'/__test/ttl',{ttl:3});
    const d4=await device('mia-tablet');
    await openPanel(d4,'account');
    await signIn(d4,'mia@example.com','Mia');
    await d4.waitForTimeout(4000);
    const before=cs.calls.filter(x=>x==='refresh').length;
    const gid4=await shortCpuGame(d4);
    await d4.waitForFunction(()=>window.__jamb.cloud.outbox.length===0,null,{timeout:20000});
    ok(cs.calls.filter(x=>x==='refresh').length>before&&(await sql('select count(*)::int as n from public.results where game_id = $1',[gid4]))[0].n===1,'an expired sign-in is renewed by itself and the game is still saved');
    await post(cs.url+'/__test/ttl',{ttl:3600});
    await d4.goto(L.URL0);await d4.waitForFunction(()=>!!window.__jamb&&!!window.__jamb.cloud.uid);
    await openPanel(d4,'account');await d4.click('[data-act=signout]');
    await d4.waitForFunction(()=>!window.__jamb.cloud.uid&&!window.__jamb.ui.modal&&document.getElementById('modal').hidden,null,{timeout:10000});
    txt=await openPanel(d4,'records');
    ok(/kept on this device/.test(txt),'after signing out, Records shows what is on the device again',txt);
    await closePanel(d4);
    await openPanel(d4,'account');
    await signIn(d4,null,null,true);
    await d4.waitForFunction(()=>!document.getElementById('toast').hidden,null,{timeout:10000});
    ok(/did not work/.test(await toastText(d4))&&!(await J(d4)).uid&&!/[?&#](code|error)/.test(d4.url()),'a refused sign-in says so, leaves the player signed out, and cleans the address');

    // ---- 6. deleting an account
    await openPanel(d3,'account');
    await d3.click('[data-act=acdel]');
    await d3.waitForSelector('[data-act=acdelyes]');
    ok(/removed for good/.test(await d3.$eval('#panel',e=>e.innerText)),'deleting asks first');
    await d3.click('[data-act=acdelyes]');
    await d3.waitForFunction(()=>!window.__jamb.cloud.uid,null,{timeout:15000});
    const leftIvo=await sql(`select (select count(*) from auth.users where email = 'ivo@example.com')::int + (select count(*) from public.daily_scores s where not exists (select 1 from auth.users u where u.id = s.user_id))::int as n`);
    ok(leftIvo[0].n===0&&(await sql('select count(*)::int as n from public.daily_scores where day = $1',[day]))[0].n===1,'the account, its scores and its sign-in are gone; the other player is untouched');
    ok((await local(d3)).score===r3.score,'the records on the device stay');

    // ---- 7. links to games still work, and the game runs with accounts switched off
    const d5=await device('guest');
    await d5.goto(L.URL0+'?game=ABCDE');
    await d5.waitForSelector('#fName',{timeout:10000});
    ok(true,'a link to a game on several devices still opens the join panel');
    const d6=await T.phone('no-accounts');
    txt=await openPanel(d6,'account');
    ok(await d6.$('.gbtn[disabled]')!==null&&/needs a connection/.test(txt),'without the sign-in service the button is off and the panel says why',txt);
    await closePanel(d6);
    await shortCpuGame(d6);
    ok(await d6.evaluate(()=>window.__jamb.G.over&&window.__jamb.cloud.outbox.length===0&&window.__jamb.stats.played===1),'and a game plays to the end as before, kept on the device');

    ok(T.errs.length===0,'no errors on any device'+(T.errs.length?': '+T.errs.slice(0,4).join(' | '):''));
  }catch(e){bad++;console.log('  FAIL  stopped: '+(e&&e.message||e).split('\n')[0]+' '+(((e&&e.stack)||'').match(/cloud\.js:\d+/)||[''])[0]);for(const x of T.errs.slice(0,6))console.log('        '+x);}
  await T.close();await browser.close();cs.close();srv.close();
  console.log(bad?`\n${bad} problem(s)`:`\nall good (${Math.round((Date.now()-t0)/1000)} s)`);process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
