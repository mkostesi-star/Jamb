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
    await home(a);await a.waitForSelector('.mline.plusline',{timeout:15000}).catch(()=>{});
    ok(await a.$('.icons .ptr.hdr')!==null&&await a.$('.mline.plusline')!==null&&await a.$('.mline.temp')!==null,'Ana\'s home: her portrait in the circle, Plus set apart, the testers\' line at the bottom');
    await a.evaluate(()=>window.scrollTo(0,0));await shot(a,'f08c_top');
    await a.evaluate(()=>document.querySelector('.sides').scrollIntoView({block:'center'}));await shot(a,'f08b_menu');
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
    // ---- 8. Plus shown to everyone before the sale; a tester whose Plus starts in week 3
    await home(i);
    ok(await i.$('.mline.plusline[data-k=plus]')!==null,'a free player sees Yamb Café Plus on the menu before the sale');
    await i.click('[data-act=open][data-k=plus]');await waitKind(i,'plus');
    ok(await i.$('.btnRed.soon[disabled]')!==null&&await i.$('[data-act=plusbuy]')===null&&/Uskoro/i.test(await panel(i)),'but the button says Uskoro and nothing can be bought');
    await shot(i,'f18_plus_soon');
    ok(await i.evaluate(()=>window.__jamb.ui&&document.querySelector('#panel .pamts')!==null),'the prices are there to see');
    await sql(`insert into yamb.gift_codes (code, why, uses_left, until, starts) values ('LATER-TEST', 'tester', 5, current_date + 60, current_date + 14)`);
    const z=await device('zoe');
    await home(z,'?dar=LATER-TEST');await waitKind(z,'dar');await signIn(z,'zoe@example.com','Zoe');
    await waitKind(z,'dar');await z.waitForFunction(()=>window.__jamb.ui.modal&&window.__jamb.ui.modal.done,null,{timeout:15000});
    ok(/uključuje sam/.test(await panel(z)),'a tester whose Plus starts later is told when',await panel(z));
    await shot(z,'f19_gift_later');
    const zp=await sql(`select yamb.has_plus(id) as p from auth.users where email='zoe@example.com'`);ok(zp[0].p===false,'no Plus yet in the database');
    await home(z);
    ok(await z.$('[data-act=open][data-k=testeri]')!==null,'but she has the testers\' guide from day one');
    ok(await z.evaluate(()=>!!document.querySelector('.mline.plusline'))&&await z.evaluate(()=>!window.__jamb.cloud.state.d.plus.plus),'and plays the free game');
    await z.click('[data-act=open][data-k=plus]');await waitKind(z,'plus');ok(/stiže/.test(await panel(z))&&await z.$('.btnRed.soon')===null,'her Plus page says when it arrives, with nothing to buy');
    await shot(z,'f20_plus_coming');

    // ---- 9. a duel kept for the challenger: Ana sends it, a signed-out friend plays it, Ana sees the result
    const playDuel=async pg=>{for(let k=0;k<40;k++){if(await pg.evaluate(()=>window.__jamb.G.over))break;await L.roll(pg);await L.write(pg);}await pg.waitForFunction(()=>window.__jamb.G.over,null,{timeout:10000});};
    await home(a);await a.click('[data-act=open][data-k=friends]');await waitKind(a,'friends');
    await a.click('[data-act=open][data-k=duel]');await waitKind(a,'duel');
    ok(await a.$('[data-act=open][data-k=dvoboji]')!==null,'a signed-in player has "Tvoji dvoboji" on the duel page');
    await a.click('[data-act=startduel]');await a.waitForFunction(()=>window.__jamb.G&&window.__jamb.G.mode==='duel');
    await playDuel(a);
    await a.waitForFunction(()=>{const j=window.__jamb;return j.stats.duels[j.G.duel.id]&&j.stats.duels[j.G.duel.id].kept;},null,{timeout:15000});
    const dk=await sql('select id, score from yamb.duels');ok(dk.length===1,'Ana\'s finished duel is kept in the database');
    await waitKind(a,'result');await a.waitForSelector('[data-act=ntduelask]',{timeout:8000});
    ok(/rezultat stiže ovamo/.test(await panel(a)),'her bill says the result will come back by itself');
    await shot(a,'f21_duel_sent');
    const link=await a.evaluate(()=>window.__jamb.duelLinkForTest());
    ok(/[?&]duel=/.test(link),'the duel link');
    const fz=await device('fran');
    await home(fz,link.replace(/^.*\?/,'?'));await waitKind(fz,'duelIn');
    ok(/vidi tvoj rezultat čim završiš/.test(await panel(fz)),'the friend is told Ana will see the score',await panel(fz));
    await fz.fill('#fName','Fran');
    await shot(fz,'f22_duel_in');
    await fz.click('[data-act=acceptduel]');await fz.waitForFunction(()=>window.__jamb.G&&window.__jamb.G.mode==='duel');
    await playDuel(fz);
    await fz.waitForFunction(()=>{const j=window.__jamb;return j.stats.duels[j.G.duel.id]&&j.stats.duels[j.G.duel.id].told;},null,{timeout:15000});
    const ans=await sql('select name, score, user_id from yamb.duel_answers');
    ok(ans.length===1&&ans[0].user_id===null&&ans[0].name==='Fran','the signed-out friend\'s name and score reach the database ('+(ans[0]&&ans[0].name)+' '+(ans[0]&&ans[0].score)+')');
    await waitKind(fz,'result');ok(/vidi tvoj rezultat u igri/.test(await panel(fz)),'and the friend\'s bill says so');
    await home(a);await a.waitForSelector('.tagcard.duelnews',{timeout:15000});
    ok(/Rezultat dvoboja/i.test(await a.$eval('.tagcard.duelnews',e=>e.innerText)),'Ana\'s home screen shows the result');
    await shot(a,'f23_home_duel');
    await a.click('.tagcard.duelnews [data-act=open]');await waitKind(a,'dvoboji');await a.waitForSelector('.dcans li.new',{timeout:15000});
    ok((await a.$$('.dcans li')).length===1,'"Tvoji dvoboji" lists the answer, marked new');
    await shot(a,'f24_my_duels');
    await a.waitForTimeout(1200);
    const seen=await sql('select seen from yamb.duel_answers');ok(seen[0].seen===true,'once looked at, it is marked seen');
    await home(a);await a.waitForTimeout(600);ok(await a.$('.tagcard.duelnews')===null,'and leaves the home screen');
    await home(a,'?d=duels');await waitKind(a,'dvoboji');ok(true,'a notification\'s link opens "Tvoji dvoboji"');

    // ---- 10. notifications: switched on, changed, tested, off (the browser's push part is a stand-in)
    const ua=require('crypto').createECDH('prime256v1');ua.generateKeys();
    const pk=ua.getPublicKey().toString('base64url'),au=require('crypto').randomBytes(16).toString('base64url');
    await a.addInitScript(({pk,au})=>{
      const st={sub:localStorage.getItem('__sub')?1:0};
      const sub={endpoint:'https://push.example.test/send/ana',options:{applicationServerKey:null},toJSON(){return{endpoint:this.endpoint,keys:{p256dh:pk,auth:au}};},
        unsubscribe:async()=>{localStorage.removeItem('__sub');st.sub=0;window.__unsub=(window.__unsub||0)+1;return true;}};
      const pm={getSubscription:async()=>st.sub?sub:null,subscribe:async o=>{window.__subKey=Array.from(o.applicationServerKey);sub.options={applicationServerKey:o.applicationServerKey.buffer};st.sub=1;localStorage.setItem('__sub','1');return sub;}};
      const reg={active:{},pushManager:pm};
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg),addEventListener:(t,f)=>{if(t==='message')window.__swmsg=f;}}});
      window.PushManager=window.PushManager||function(){};
      window.Notification=function(){};window.Notification.requestPermission=async()=>{localStorage.setItem('__perm','granted');return 'granted';};
      Object.defineProperty(window.Notification,'permission',{get:()=>localStorage.getItem('__perm')||'default'});
    },{pk,au});
    await home(a);await a.click('[data-act=open][data-k=settings]');await waitKind(a,'settings');
    ok(/Obavijesti/.test(await panel(a))&&/Isključene/.test(await panel(a)),'settings show notifications, off');
    await a.click('[data-act=open][data-k=obavijesti]');await waitKind(a,'obavijesti');
    await shot(a,'f25_notif_off');
    await a.click('[data-act=ntdaily]');await a.waitForFunction(()=>window.__jamb.prefs.notif&&window.__jamb.prefs.notif.daily_at===20,null,{timeout:15000});
    let ps=await sql(`select daily_at, duels, lang, tz, p256dh, auth from yamb.push_subs where endpoint = 'https://push.example.test/send/ana'`);
    ok(ps.length===1&&ps[0].daily_at===20&&ps[0].duels===false&&ps[0].lang==='hr'&&ps[0].p256dh===pk&&ps[0].auth===au&&ps[0].tz,'the Daily reminder: switched on at 20:00, with the browser\'s keys, language and time zone ('+(ps[0]&&ps[0].tz)+')');
    ok(await a.evaluate(()=>Array.isArray(window.__subKey)&&window.__subKey.length===65),'the browser got the game\'s public key from the push function');
    await a.click('[data-act=nthour][data-v="8"]');await a.waitForFunction(()=>window.__jamb.prefs.notif.daily_at===8,null,{timeout:15000});
    await a.click('[data-act=ntduels]');await a.waitForFunction(()=>window.__jamb.prefs.notif.duels===true,null,{timeout:15000});
    ps=await sql(`select daily_at, duels from yamb.push_subs where endpoint = 'https://push.example.test/send/ana'`);
    ok(ps[0].daily_at===8&&ps[0].duels===true,'another hour, and duel results too');
    await shot(a,'f26_notif_on');
    const before=(await fetch(cs.url+'/__test/calls').then(r=>r.json())).filter(x=>x==='push-kick').length;
    await a.click('[data-act=nttest]');await a.waitForTimeout(1200);
    ps=await sql(`select test from yamb.push_subs where endpoint = 'https://push.example.test/send/ana'`);
    const after=(await fetch(cs.url+'/__test/calls').then(r=>r.json())).filter(x=>x==='push-kick').length;
    ok(ps[0].test===true&&after===before+1,'a test message is asked for, and the push function nudged to send it now');
    await a.evaluate(()=>{window.__jamb.ui.modal&&0;window.__swmsg&&window.__swmsg({data:{yamb:'open',d:'duels'}});});
    await waitKind(a,'dvoboji');ok(true,'a tap on a notification with the game open goes to "Tvoji dvoboji"');
    await a.click('#panel .x');await waitKind(a,'obavijesti');
    await a.click('[data-act=ntdaily]');await a.waitForFunction(()=>window.__jamb.prefs.notif&&window.__jamb.prefs.notif.daily_at==null,null,{timeout:15000});
    await a.click('[data-act=ntduels]');await a.waitForFunction(()=>!window.__jamb.prefs.notif,null,{timeout:15000});
    ps=await sql(`select count(*)::int as n from yamb.push_subs where user_id = (select id from auth.users where email='ana@example.com')`);
    ok(ps[0].n===0&&await a.evaluate(()=>window.__unsub===1),'both off: the browser unsubscribed and the database forgot the device');
    ok(T.errs.length===0,'no errors on any device'+(T.errs.length?': '+T.errs.slice(0,4).join(' | '):''));
  }catch(e){bad++;console.log('  FAIL  stopped: '+(e&&e.message||e).split('\n')[0]+' '+(((e&&e.stack)||'').match(/friends\.js:\d+/)||[''])[0]);for(const x of T.errs.slice(0,6))console.log('        '+x);}
  await T.close();await browser.close();cs.close();srv.close();
  console.log(bad?`\n${bad} problem(s)`:`\nall good (${Math.round((Date.now()-t0)/1000)} s)`);process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
