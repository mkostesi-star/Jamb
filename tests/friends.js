// Friends' tables (Stol prijatelja), the Šef sale badge and gift links, end to end: real game pages in headless
// browsers, the real Supabase library, and the stand-in project (cloud-server.js) running server/schema.sql.
//   node friends.js                 (about a minute)
//   SHOTS=/some/folder node friends.js    also saves a picture of each page
const L=require('./lib.js');
const cloudServer=require('./cloud-server.js');
const CPORT=+process.env.CLOUD_PORT||9022,SHOTS=process.env.SHOTS||'';
let bad=0;const ok=(c,m,seen)=>{if(c)console.log('  ok    '+m);else{bad++;console.log('  FAIL  '+m+(seen!=null?'\n        seen: '+String(seen).replace(/\s+/g,' ').slice(0,420):''));}};
const post=(url,body)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
(async()=>{
  const t0=Date.now();
  const srv=await L.servers(),cs=await cloudServer.start(CPORT);
  const browser=await L.chromium.launch(),T=new L.Table(browser);
  const CLOUD={url:cs.url,key:'sb_publishable_test'};
  const device=(tag,locale)=>T.phone(tag,{cloud:CLOUD,locale:locale||'hr-HR'});
  const sql=(q,p)=>cs.S.admin(q,p).then(r=>r.rows);
  const shot=async(pg,n)=>{if(!SHOTS)return;await pg.waitForTimeout(500);await pg.screenshot({path:`${SHOTS}/${n}.png`});};
  const kind=pg=>pg.evaluate(()=>window.__jamb.ui.modal&&window.__jamb.ui.modal.kind);
  const waitKind=(pg,k)=>pg.waitForFunction(k=>{const m=window.__jamb.ui.modal;return m&&m.kind===k&&!document.getElementById('modal').classList.contains('closing');},k,{timeout:15000});
  const panel=pg=>pg.$eval('#panel',e=>e.innerText);
  async function signIn(pg,email,name){
    await post(cs.url+'/__test/next',{email,name});
    await Promise.all([pg.waitForNavigation({waitUntil:'load',timeout:20000}).catch(()=>{}),pg.click('.gbtn[data-act=signin]')]);
    await pg.waitForFunction(()=>!!window.__jamb,null,{timeout:20000});
    await pg.waitForFunction(()=>{const c=window.__jamb.cloud;return c.uid&&c.state&&!c.snap;},null,{timeout:20000});
  }
  async function home(pg,q){await pg.goto(L.URL0+(q||''));await pg.waitForFunction(()=>!!window.__jamb);}
  async function playDaily(pg){
    await pg.click('[data-act=daily]');
    await pg.waitForFunction(()=>window.__jamb.G&&window.__jamb.G.mode==='daily'&&!window.__jamb.G.over);
    for(let t=0;t<13;t++){
      await L.roll(pg);
      if(t%3===0){await L.hold(pg,0);await L.hold(pg,3);await L.roll(pg);}
      await L.write(pg);
    }
    await pg.waitForFunction(()=>window.__jamb.G.over,null,{timeout:10000});
    await pg.waitForFunction(()=>{const j=window.__jamb,r=j.stats.daily.results[j.G.daily.day];return r&&r.sent;},null,{timeout:15000});
  }
  try{
    // ---- 1. Ana signs in, opens the friends' tables from the menu and sets a table
    const a=await device('ana');
    await home(a,'?plus=test');await home(a);
    await a.click('[data-act=open][data-k=stoli]');await waitKind(a,'stoli');
    ok(/prijava/i.test(await panel(a))&&await a.$('.gbtn[data-act=signin]')!==null,'signed out, the friends\' tables ask for sign-in');
    await shot(a,'f01_signedout');
    await signIn(a,'ana@example.com','Ana');
    await waitKind(a,'stoli');await a.waitForSelector('#ftName',{timeout:15000});
    ok(true,'after sign-in Ana is back on the friends\' tables');
    await shot(a,'f02_empty');
    await a.fill('#ftName','Kava kod Ane');await a.click('[data-act=ftmake]');
    await waitKind(a,'stol');await a.waitForSelector('.ftboard tr',{timeout:15000});
    const code=await a.$eval('.ftcode b',e=>e.textContent);
    ok(/^[A-HJ-NP-Z2-9]{6}$/.test(code)&&(await a.$$('.ftboard tr')).length===1,'the new table opens with Ana alone at it and her code: '+code);
    await shot(a,'f03_table');
    await a.click('#panel .x');await waitKind(a,'stoli');
    ok((await panel(a)).includes('Kava kod Ane'),'back on the list, her table is there');

    // ---- 2. Ivo opens Ana's invite link, signs in and sits down
    const i=await device('ivo');
    await home(i,'?stol='+code);await waitKind(i,'stolIn');await i.waitForSelector('.ftname',{timeout:15000}).catch(async e=>{console.log('DEBUG',JSON.stringify(await i.evaluate(()=>window.__jamb.ui.modal)),await panel(i));throw e;});
    let txt=await panel(i);
    ok(txt.includes('Kava kod Ane')&&/Ana/.test(txt)&&await i.$('.gbtn[data-act=signin]')!==null,'the invite shows the table, who invites, and sign-in',txt);
    await shot(i,'f04_invite');
    await signIn(i,'ivo@example.com','Ivo');
    await waitKind(i,'stol');await i.waitForFunction(()=>document.querySelectorAll('.ftboard tr').length===2,null,{timeout:15000});
    ok(true,'after sign-in Ivo sits down by himself and sees both at the table');
    const inv=await sql(`select (select email from auth.users where id=i.user_id) as who, (select email from auth.users where id=i.invited_by) as by from yamb.invites i`);
    ok(inv.length===1&&inv[0].who==='ivo@example.com'&&inv[0].by==='ana@example.com','the database remembers that Ana brought Ivo');
    await shot(i,'f05_ivo_table');

    // ---- 3. Ana's progress towards Šef sale, then her Daily on the table and in the newspaper
    await a.evaluate(()=>{delete window.__jamb.boards.ft;});
    await a.click('#panel .x');await waitKind(a,'stoli').catch(()=>{});
    await home(a);await a.click('[data-act=open][data-k=stoli]');await waitKind(a,'stoli');await a.waitForSelector('.hostcard .hostfr li',{timeout:15000});
    ok(/Ivo/.test(await a.$eval('.hostcard',e=>e.innerText)),'Ana\'s card shows Ivo on her way to Šef sale');
    await shot(a,'f06_list_progress');
    await home(a);await playDaily(a);
    await a.waitForSelector('#panel .nfriends .nft[data-act=ftopen]',{timeout:15000});
    ok((await a.$eval('#panel .nfriends',e=>e.innerText)).includes('Kava kod Ane'),'the Daily\'s bill lists Ana\'s table');
    await a.click('#panel .nfriends .nft[data-act=ftopen]');await waitKind(a,'stol');
    await a.waitForFunction(()=>{const r=document.querySelector('.ftboard tr.me td.n');return r&&/\d/.test(r.textContent);},null,{timeout:15000});
    ok(true,'her table shows her Daily score');
    await shot(a,'f07_table_score');
    await i.evaluate(()=>{Object.keys(window.__jamb.boards).forEach(k=>delete window.__jamb.boards[k]);});
    await home(i);await i.click('[data-act=open][data-k=stoli]');await waitKind(i,'stoli');await i.waitForSelector('.ftlist .mline',{timeout:15000});
    await i.click('.ftlist .mline');await waitKind(i,'stol');
    await i.waitForFunction(()=>[...document.querySelectorAll('.ftboard td.n')].some(e=>/\d/.test(e.textContent)),null,{timeout:15000});
    ok(true,'Ivo sees Ana\'s score at their table');

    // ---- 4. the badges: Šef sale, Plus with the thank-you pin, shown on the profile, the records and at the table
    await sql(`insert into yamb.badges (user_id, badge) select id, 'host' from auth.users where email='ana@example.com'`);
    await sql(`insert into yamb.orders (id, user_id, env, status, net, tax, total) select 'ord_ana', id, 'sandbox', 'paid', 559, 140, 699 from auth.users where email='ana@example.com'`);
    await sql(`update public.profiles set wall = true, avatar = 'p04' where id = (select id from auth.users where email='ana@example.com')`);
    await home(a);await a.waitForFunction(()=>{const s=window.__jamb.cloud.state;return s&&s.d&&s.d.host&&s.d.plus&&s.d.plus.pin;},null,{timeout:20000}).catch(()=>{});
    await a.evaluate(()=>window.__jamb.cloud.state&&0);
    await a.click('[data-act=open][data-k=account]');await waitKind(a,'account');
    ok(await a.$('.proftop .plaque')!==null&&await a.$('.proftop .ppin.onprint')!==null&&await a.$('.proftop .pmark')!==null,'Ana\'s profile: the heart and Plus on her print, the Šef sale plaque under it');
    await shot(a,'f08_profile');
    await home(a);await a.click('[data-act=open][data-k=records]');await waitKind(a,'records');await shot(a,'f09_records');
    await home(a);await a.click('[data-act=daily]');await waitKind(a,'daily');
    await a.evaluate(()=>{Object.keys(window.__jamb.boards).forEach(k=>delete window.__jamb.boards[k]);});await a.click('[data-act=boardtab][data-v=w]').catch(()=>{});await a.click('[data-act=boardtab][data-v=d]').catch(()=>{});
    await a.waitForSelector('.nboard .pdot',{timeout:15000}).catch(()=>{});
    ok(await a.$('.nboard .pmark')===null&&await a.$('.nboard .pdot')!==null,'the Daily\'s high scores: no Plus beside Ana\'s name, only the tiny heart on her portrait');
    await shot(a,'f09b_news');
    await i.evaluate(()=>{Object.keys(window.__jamb.boards).forEach(k=>delete window.__jamb.boards[k]);window.__jamb.ui.modal&&0;});
    await i.click('[data-act=fttab][data-v=d]').catch(()=>{});
    await i.waitForSelector('.ftboard .plaque',{timeout:15000});
    ok(await i.$('.ftboard .pdot')!==null&&await i.$('.ftboard .pmark')===null,'at the table Ivo sees Ana\'s plaque and the tiny heart, but no Plus beside her name');
    await shot(i,'f10_table_badges');
    await i.click('.ftboard button.who[data-f*=s]');await waitKind(i,'who');
    ok(await i.$('.whocard .pmark.onprint')!==null&&await i.$('.whocard .ppin.onprint')!==null&&await i.$('.whocard .plaque')!==null,'tapping Ana opens her card: Plus and the heart on her portrait, Šef sale under it');
    await shot(i,'f10b_card');
    await i.click('#panel .x');await waitKind(i,'stol');
    await home(a);await a.click('[data-act=open][data-k=plus]');await waitKind(a,'plus');await a.waitForSelector('[data-act=plusShow]',{timeout:15000});
    await shot(a,'f10c_plus_switches');
    await a.click('[data-act=plusShow]');await a.waitForFunction(()=>{const s=window.__jamb.cloud.state;return s&&s.d.profile&&s.d.profile.show_plus===false;},null,{timeout:15000});
    await i.evaluate(()=>{Object.keys(window.__jamb.boards).forEach(k=>delete window.__jamb.boards[k]);});await i.click('[data-act=fttab][data-v=w]');await i.click('[data-act=fttab][data-v=d]');
    await i.waitForFunction(()=>!document.querySelector('.ftboard .pdot'),null,{timeout:15000}).then(()=>ok(true,'Ana hides her Plus: the heart is gone from her portrait at the table'),()=>ok(false,'Ana hides her Plus'));
    await a.click('[data-act=plusShow]');
    await home(a);await a.click('[data-act=open][data-k=stoli]');await waitKind(a,'stoli');await a.waitForSelector('.hostcard',{timeout:15000});
    await a.waitForFunction(()=>!document.querySelector('.hostcard .hostfr'),null,{timeout:15000}).catch(()=>{});
    await shot(a,'f11_list_badge');

    // ---- 5. a gift link: Mia signs in and gets Plus
    await sql(`insert into yamb.gift_codes (code, why, uses_left, until) values ('TEST-DAR-2026', 'tester', 3, current_date + 30)`);
    const m=await device('mia');
    await home(m,'?dar=test-dar-2026');await waitKind(m,'dar');
    ok(/Plus/.test(await panel(m))&&await m.$('.gbtn[data-act=signin]')!==null,'the gift link asks for sign-in');
    await shot(m,'f12_gift');
    await signIn(m,'mia@example.com','Mia');
    await waitKind(m,'dar');await m.waitForFunction(()=>window.__jamb.ui.modal&&window.__jamb.ui.modal.done,null,{timeout:15000});
    const mp=await sql(`select yamb.has_plus(id) as p from auth.users where email='mia@example.com'`);
    ok(mp[0].p===true,'Mia has Plus on her account');
    ok(await m.evaluate(()=>{const s=window.__jamb.cloud.state;return !!(s&&s.d&&s.d.plus&&s.d.plus.plus);}),'and the game knows it at once');
    await shot(m,'f13_gift_done');
    await home(m,'?dar=NO-SUCH-GIFT');await waitKind(m,'dar');await m.waitForFunction(()=>window.__jamb.ui.modal&&(window.__jamb.ui.modal.bad||window.__jamb.ui.modal.done),null,{timeout:15000});
    ok(await m.evaluate(()=>!!window.__jamb.ui.modal.done),'a second gift link on an account that has Plus changes nothing');

    // ---- 6. a wrong code, then Ivo gets up from the table
    await home(m,'?stol=ZZZZZZ');await waitKind(m,'stolIn');await m.waitForFunction(()=>{const p=window.__jamb.ui.modal.peek;return p&&p.none;},null,{timeout:15000});
    ok(true,'a link with a wrong code says so');
    await home(i);await i.click('[data-act=open][data-k=stoli]');await waitKind(i,'stoli');await i.waitForSelector('.ftlist .mline',{timeout:15000});
    await i.click('.ftlist .mline');await waitKind(i,'stol');await i.waitForSelector('.ftboard tr');
    await i.click('[data-act=ftleave]');await i.click('[data-act=ftleaveyes]');await waitKind(i,'stoli');
    await i.waitForSelector('.ftnone',{timeout:15000});
    const seats=await sql(`select count(*)::int as n from yamb.friend_seats`);
    ok(seats[0].n===1,'Ivo gets up and is back on his empty list; Ana keeps the table');
    await shot(i,'f14_after_leave');
    // ---- 7. feedback from the game, and the testers' guide
    await home(a);await a.click('[data-act=open][data-k=dojam]');await waitKind(a,'dojam');
    await a.click('[data-act=fbkind][data-v=bug]');await a.fill('#fbText','Kocke su zapele na drugom bacanju');await a.click('[data-act=fbstar][data-v="4"]');
    await shot(a,'f15_feedback');
    await a.click('[data-act=fbsend]');await a.waitForFunction(()=>window.__jamb.ui.modal&&window.__jamb.ui.modal.sent,null,{timeout:15000});
    const fb=await sql(`select f.kind, f.stars, f.body, f.version, f.device, (select email from auth.users where id=f.user_id) as who from yamb.feedback f`);
    ok(fb.length===1&&fb[0].kind==='bug'&&fb[0].stars===4&&fb[0].body==='Kocke su zapele na drugom bacanju'&&/^v\d/.test(fb[0].version)&&fb[0].device&&fb[0].who==='ana@example.com','Ana sends feedback: kind, stars, text, version and device reach the database');
    await shot(a,'f16_feedback_sent');
    await home(a);
    ok(await a.$('[data-act=open][data-k=testeri]')!==null,'before launch, an account with Plus sees the testers\' guide on the menu');
    await a.click('[data-act=open][data-k=testeri]');await waitKind(a,'testeri');
    ok((await a.$$('.tsweek')).length===4&&(await a.$$('.tsweek[open]')).length===1,'four weeks, one open');
    await shot(a,'f17_testers');
    await home(i);ok(await i.$('[data-act=open][data-k=testeri]')===null&&await i.$('[data-act=open][data-k=dojam]')!==null,'Ivo, without Plus, sees feedback but not the testers\' guide');
    ok(T.errs.length===0,'no errors on any device'+(T.errs.length?': '+T.errs.slice(0,4).join(' | '):''));
  }catch(e){bad++;console.log('  FAIL  stopped: '+(e&&e.message||e).split('\n')[0]+' '+(((e&&e.stack)||'').match(/friends\.js:\d+/)||[''])[0]);for(const x of T.errs.slice(0,6))console.log('        '+x);}
  await T.close();await browser.close();cs.close();srv.close();
  console.log(bad?`\n${bad} problem(s)`:`\nall good (${Math.round((Date.now()-t0)/1000)} s)`);process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
