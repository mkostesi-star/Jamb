// Checks server/schema.sql: the Daily replay in the database gives the same score as the game's own rules engine,
// the tables are locked, and the functions the game calls behave. Runs on a local Postgres (PGlite), no network.
//   node sql.js            (about half a minute)
//   node sql.js --games 5000
const path=require('path');
const E=require(path.join(__dirname,'..','engine.js'));
const AI=require(path.join(__dirname,'..','ai.js'));
const {open}=require('./pgdb.js');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:+process.argv[i+1];};
let bad=0;const ok=(c,m)=>{if(c)console.log('  ok    '+m);else{bad++;console.log('  FAIL  '+m);}};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const RULES=E.normRules(E.DAILY_RULES);
const dayStr=d=>d.toISOString().slice(0,10);
function randomMoves(rnd){
  const rows=[...Array(13).keys()];for(let i=12;i>0;i--){const j=Math.floor(rnd()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
  return rows.map(r=>{const m=[r],n=Math.floor(rnd()*3);for(let k=0;k<n;k++)m.push(Math.floor(rnd()*32));return m;});
}
// the Professor plays the day; his choices become a move list, the way the game records a player's
function professorMoves(seed){
  const sheet=E.newSheet(RULES),moves=[];
  for(let tn=0;tn<13;tn++){
    let turn=E.rollDice(E.freshTurn(5),seed,tn);const m=[];
    for(;;){
      const a=AI.decide({rules:RULES,sheet,turn},'profesor',Math.random);
      if(a.type==='write'){sheet[a.c][a.r]=E.score(RULES,a.r,turn.dice,turn.roll);m.unshift(E.ROWS.indexOf(a.r));break;}
      m.push(a.held.reduce((s,h,i)=>s|(h?1<<i:0),0));turn.held=a.held.slice();turn=E.rollDice(turn,seed,tn);
    }
    moves.push(m);
  }
  return{moves,total:E.total(RULES,sheet)};
}
(async()=>{
  const t0=Date.now();
  const S=await open();
  console.log('Database script applied twice without errors');

  // ---- 1. the same score as the game, for random play and for good play
  const N=arg('games',1500),rnd=mulberry(20261114);let diff=0,first=null;
  for(let g=0;g<N;g++){
    const day=dayStr(new Date(Date.UTC(2026,10,1)+Math.floor(rnd()*900)*864e5)),moves=randomMoves(rnd);
    const js=E.replayMoves(RULES,'daily:'+day,moves).total;
    const r=await S.admin('select yamb.daily_replay($1::date, $2::jsonb) as s',[day,JSON.stringify(moves)]);
    if(r.rows[0].s!==js){diff++;first=first||{day,moves,js,sql:r.rows[0].s};}
  }
  ok(diff===0,`${N} random games: the database counts the same score as the game`+(first?' — first difference '+JSON.stringify(first):''));
  let pd=0,psum=0;const PN=60;
  for(let g=0;g<PN;g++){
    const day=dayStr(new Date(Date.UTC(2026,10,14)+g*864e5)),p=professorMoves('daily:'+day);
    const viaList=E.replayMoves(RULES,'daily:'+day,p.moves).total;
    const r=await S.admin('select yamb.daily_replay($1::date, $2::jsonb) as s',[day,JSON.stringify(p.moves)]);
    if(r.rows[0].s!==p.total||viaList!==p.total)pd++;psum+=p.total;
  }
  ok(pd===0,`${PN} days played by the Professor (average ${Math.round(psum/PN)}): same score in the game, from the move list, and in the database`);

  // ---- 2. made-up or broken move lists are refused
  const good=professorMoves('daily:2026-11-14').moves;
  const refuse=async(label,moves)=>{let err=null;try{await S.admin('select yamb.daily_replay($1::date, $2::jsonb)',['2026-11-14',JSON.stringify(moves)]);}catch(e){err=e.message;}ok(err&&/YC_MOVES/.test(err),'refused: '+label);};
  await refuse('twelve turns',good.slice(0,12));
  await refuse('the same box twice',good.map((m,i)=>i===5?[good[4][0]]:m));
  await refuse('a row that does not exist',good.map((m,i)=>i===0?[13]:m));
  await refuse('four rolls in a turn',good.map((m,i)=>i===0?[m[0],0,0,0]:m));
  await refuse('a kept-dice number that is too big',good.map((m,i)=>i===0?[m[0],32]:m));
  await refuse('a fraction',good.map((m,i)=>i===0?[m[0],1.5]:m));
  await refuse('text in place of a number',good.map((m,i)=>i===0?['1']:m));
  await refuse('not a list',{a:1});

  // ---- 3. the tables are closed; the functions need a signed-in player
  const ana=await S.addUser('ana@example.com','Ana'),ivo=await S.addUser('ivo@example.com','Ivo'),mia=await S.addUser('mia@example.com','Mia');
  const denied=async(label,uid,sql)=>{let err=null;try{await S.as(uid,sql);}catch(e){err=e.message;}ok(err&&/permission denied/.test(err),'closed: '+label);};
  for(const tb of ['profiles','carried','results','daily_scores']){
    await denied(`a signed-in player cannot read ${tb} directly`,ana,`select * from public.${tb}`);
    await denied(`a visitor cannot read ${tb} directly`,null,`select * from public.${tb}`);
  }
  await denied('a signed-in player cannot write a score directly',ana,`insert into public.daily_scores (day, user_id, score, moves) values (current_date, '${ana}', 999, '[]')`);
  await denied('a visitor cannot call sync_up',null,`select public.sync_up('d', '{}'::jsonb, '[]'::jsonb)`);
  await denied('a visitor cannot call submit_daily',null,`select public.submit_daily(current_date, '[]'::jsonb)`);
  await denied('a visitor cannot call my_state',null,`select public.my_state()`);
  await denied('a visitor cannot call delete_my_account',null,`select public.delete_my_account()`);
  await denied('nobody outside can call the replay itself',ana,`select yamb.daily_replay(current_date, '[]'::jsonb)`);

  // ---- 4. Daily: the first result stands, ranks, ties, the day window
  const today=dayStr(new Date()),seed='daily:'+today;
  const pA=professorMoves(seed);
  const weak=[...Array(13).keys()].map(r=>[r]);                       // writes the first roll every turn
  const weakTotal=E.replayMoves(RULES,seed,weak).total;
  let r=await S.as(ana,'select public.submit_daily($1::date, $2::jsonb) as b',[today,JSON.stringify(pA.moves)]);
  ok(r.rows[0].b.count===1&&r.rows[0].b.me.score===pA.total&&r.rows[0].b.me.rank===1&&r.rows[0].b.had===false,'Ana\'s Daily goes on the table with the score the database counted ('+pA.total+')');
  r=await S.as(ana,'select public.submit_daily($1::date, $2::jsonb) as b',[today,JSON.stringify(weak)]);
  ok(r.rows[0].b.me.score===pA.total&&r.rows[0].b.had===true&&r.rows[0].b.count===1,'a second result on the same day changes nothing');
  r=await S.as(ivo,'select public.submit_daily($1::date, $2::jsonb) as b',[today,JSON.stringify(weak)]);
  ok(r.rows[0].b.me.rank===(weakTotal<pA.total?2:1)&&r.rows[0].b.count===2,'Ivo is placed by score ('+weakTotal+')');
  r=await S.as(mia,'select public.submit_daily($1::date, $2::jsonb) as b',[today,JSON.stringify(weak)]);
  ok(r.rows[0].b.me.rank===r.rows[0].b.top.find(x=>x.score===weakTotal).rank&&r.rows[0].b.top.filter(x=>x.me).length===1,'equal scores share a place, and only your own row is marked as yours');
  r=await S.as(null,'select public.daily_board($1::date) as b',[today]);
  ok(r.rows[0].b.count===3&&r.rows[0].b.me===null&&r.rows[0].b.top.length===3&&!r.rows[0].b.top.some(x=>x.me)&&!('user_id' in r.rows[0].b.top[0]),'a visitor sees the table, with names and scores only');
  const old=dayStr(new Date(Date.now()-3*864e5)),ahead=dayStr(new Date(Date.now()+3*864e5));
  for(const [lab,d] of [['three days ago',old],['three days ahead',ahead]]){let err=null;try{await S.as(ana,'select public.submit_daily($1::date, $2::jsonb)',[d,JSON.stringify(professorMoves('daily:'+d).moves)]);}catch(e){err=e.message;}ok(err&&/YC_DAY/.test(err),'refused: a Daily from '+lab);}
  const yest=dayStr(new Date(Date.now()-864e5));
  r=await S.as(ana,'select public.submit_daily($1::date, $2::jsonb) as b',[yest,JSON.stringify(professorMoves('daily:'+yest).moves)]);
  ok(r.rows[0].b.me.rank===1,'yesterday\'s Daily is still accepted (time zones)');
  let err=null;try{await S.as(ana,'select public.submit_daily($1::date, $2::jsonb)',[dayStr(new Date(Date.now()+864e5)),JSON.stringify(weak.slice(1))]);}catch(e){err=e.message;}
  ok(err&&/YC_MOVES/.test(err),'refused through the front door too: a broken move list');
  r=await S.as(ana,'select public.week_board($1::date) as b',[today]);
  const wk=r.rows[0].b;ok(wk.count===3&&wk.me&&wk.me.rank===1&&wk.me.days>=1&&wk.top[0].me===true,'the week\'s table adds up each player\'s days');

  // ---- 5. records: old device totals once, finished games once, bad rows left out
  const carried={played:7,wins:3,best:812,records:{'cpu|e30':{mode:'cpu',games:7,wins:3,sum:4900,best:{s:812,name:'Ana',day:'2026-11-01'}}}};
  const games=[{id:'g-aaaa-1',mode:'cpu',rules:'e30',score:900,won:true,mine:true,players:2,name:'Ana',at:Date.now(),day:today},
               {id:'g-aaaa-2',mode:'cpu',rules:'e30',score:700,won:false,mine:true,players:2,name:'Ana',at:Date.now(),day:today},
               {id:'g-aaaa-3',mode:'hack',rules:'e30',score:1,at:Date.now(),day:today},
               {id:'g-aaaa-4',mode:'cpu',rules:'e30',score:99999999,at:Date.now(),day:today},
               {id:'g-aaaa-5',mode:'pp',rules:'e30',score:650,won:false,mine:false,players:3,name:'  Tata\n<b>  ',at:Date.now(),day:today}];
  r=await S.as(ana,'select public.sync_up($1, $2::jsonb, $3::jsonb) as s',['device-1',JSON.stringify(carried),JSON.stringify(games)]);
  let st=r.rows[0].s;
  ok(st.carried.length===1&&st.carried[0].played===7,'the device\'s old records are kept as they were');
  ok(st.totals.games===3&&st.totals.wins===1&&st.totals.best===900,'three good games counted, two bad rows left out');
  const cpu=st.records.find(x=>x.mode==='cpu'),pp=st.records.find(x=>x.mode==='pp');
  ok(cpu&&cpu.games===2&&cpu.wins===1&&Number(cpu.sum)===1600&&cpu.best===900&&cpu.best_name==='Ana'&&cpu.best_day===today&&pp&&pp.best_name==='Tata b','records per mode and rules, with the cleaned name of who scored best'+(cpu&&pp?'':' '+JSON.stringify(st.records)));
  r=await S.as(ana,'select public.sync_up($1, $2::jsonb, $3::jsonb) as s',['device-1',JSON.stringify({played:999}),JSON.stringify(games)]);
  st=r.rows[0].s;ok(st.totals.games===3&&st.carried.length===1&&st.carried[0].played===7,'sending the same things again changes nothing');
  r=await S.as(ana,'select public.sync_up($1, $2::jsonb, $3::jsonb) as s',['device-2',JSON.stringify({played:2,wins:0,best:300}),'[]']);
  ok(r.rows[0].s.carried.length===2,'a second device adds its own old records');
  ok(r.rows[0].s.dailies.length===2&&r.rows[0].s.dailies.some(d=>d.day===today&&d.score===pA.total&&Array.isArray(d.moves)),'the player\'s own Daily results come back with their moves');
  r=await S.as(ivo,'select public.my_state() as s');
  ok(r.rows[0].s.totals.games===0&&r.rows[0].s.carried.length===0&&r.rows[0].s.dailies.length===1,'another player sees only their own records');

  // ---- 6. profile and deleting
  r=await S.as(ana,'select public.save_profile($1, $2) as p',['  Ana   <script>\n Banana of the long name  ','p3']);
  ok(r.rows[0].p.name==='Ana script Banan'&&r.rows[0].p.avatar==='p3','a name is trimmed, cleaned and cut to 16 letters: "'+r.rows[0].p.name+'"');
  r=await S.as(ana,'select public.save_profile($1, $2) as p',['Ana','../../etc']);ok(r.rows[0].p.avatar===null,'a strange picture name is dropped');
  r=await S.as(null,'select public.daily_board($1::date) as b',[today]);ok(r.rows[0].b.top[0].name==='Ana','the table shows the chosen name');
  r=await S.as(ana,'select public.delete_my_account() as d');
  const left=await S.admin(`select (select count(*) from public.results where user_id=$1)+(select count(*) from public.carried where user_id=$1)+(select count(*) from public.daily_scores where user_id=$1)+(select count(*) from public.profiles where id=$1)+(select count(*) from auth.users where id=$1) as n`,[ana]);
  ok(r.rows[0].d.data===true&&r.rows[0].d.login===true&&Number(left.rows[0].n)===0,'deleting an account removes the profile, games, scores and the sign-in');
  r=await S.as(null,'select public.daily_board($1::date) as b',[today]);ok(r.rows[0].b.count===2,'and the table no longer shows that player');

  // ---- 7. visitor numbers: no device storage, one-way daily codes, totals only for the admin
  const hdr=async(ip,ua)=>S.admin(`select set_config('request.headers', $1, false)`,[JSON.stringify({'x-forwarded-for':ip+', 10.0.0.1','user-agent':ua})]);
  await hdr('1.1.1.1','Phone A');
  await S.as(null,'select public.count_visit($1, $2, $3, $4)',['game','google.com','hr',false]);
  await S.as(null,'select public.count_visit($1, $2, $3, $4)',['game','google.com','hr',false]);
  await hdr('2.2.2.2','Phone B');
  await S.as(null,'select public.count_visit($1, $2, $3, $4)',['game','link:duel','en',true]);
  await S.as(null,'select public.count_visit($1, $2, $3, $4)',['rules/de','<script>','german',null]);
  let v=await S.admin(`select page, src, lang, app, views, people from yamb.visits order by page, src`);
  const row=(pg,sr)=>v.rows.find(x=>x.page===pg&&x.src===sr);
  ok(row('game','google.com')&&row('game','google.com').views===2&&row('game','google.com').people===1,'the same visitor twice in a day: two views, one person');
  ok(row('game','link:duel')&&row('game','link:duel').people===1&&row('game','link:duel').app===true,'another visitor is another person, and the installed app is told apart');
  ok(row('rules/de','other')&&row('rules/de','other').lang==='xx'&&row('rules/de','other').people===0,'strange values are stored as "other", and a person counts once a day across pages');
  const seen=await S.admin(`select count(*)::int as n, bool_and(h ~ '^[0-9a-f]{64}$') as hex, bool_and(position('2.2.2.2' in h) = 0) as noip from yamb.seen`);
  ok(seen.rows[0].n===2&&seen.rows[0].hex&&seen.rows[0].noip,'only one-way codes are kept, never the address');
  await S.as(null,'select public.count_event($1, $2)',['start','cpu']);await S.as(null,'select public.count_event($1, $2)',['start','cpu']);
  await S.as(null,'select public.count_event($1, $2)',['finish','nonsense']);await S.as(null,'select public.count_event($1, $2)',['drop table','cpu']);
  let e=await S.admin(`select ev, mode, n, people from yamb.events order by ev, mode`);
  await S.as(null,'select public.count_event($1, $2)',['start','pp']);
  e=await S.admin(`select ev, mode, n, people from yamb.events order by ev, mode`);
  const evr=(ev,m)=>e.rows.find(x=>x.ev===ev&&x.mode===m);
  ok(e.rows.length===5&&evr('start','cpu').n===2&&evr('start','cpu').people===1&&evr('finish','-')&&evr('start','pp').people===1,'events are counted per mode, unknown events are ignored');
  ok(evr('start','all').n===3&&evr('start','all').people===1,'and once more as "all", one player across modes');
  await S.admin(`select set_config('request.headers', $1, false)`,[JSON.stringify({'x-forwarded-for':'3.3.3.3','user-agent':'Tab C','cf-ipcountry':'HR'})]);
  await S.as(null,'select public.count_visit($1, $2, $3, $4, $5, $6)',['game','direct','hr',false,'tablet',21]);
  await S.as(null,'select public.count_visit($1, $2, $3, $4, $5, $6)',['game','direct','hr',false,'tablet',22]);
  await S.as(null,'select public.count_stats($1::jsonb)',[JSON.stringify([['opp','mira',1],['opp','mira',1],['rules','classic',1],['players','3',1],['len','cpu',25],['len','cpu',99999],['hack','x',1],['opp','<b>',1],'junk'])]);
  const stt=await S.admin(`select k, v, n, sum::int as sum from yamb.stats`);const sv=(k,v)=>stt.rows.find(x=>x.k===k&&x.v===v);
  ok(sv('country','hr').n===1&&sv('device','tablet').n===1&&sv('hour','21').n===1&&!sv('hour','22')&&sv('country','xx').n===2,'country, device and hour are counted once a day for each visitor');
  ok(sv('opp','mira').n===2&&sv('players','3').n===1&&sv('len','cpu').n===2&&sv('len','cpu').sum===625&&!sv('hack','x')&&stt.rows.every(x=>!/[<>]/.test(x.v)),'game choices are counted, unknown or strange ones are dropped, lengths are capped');
  await denied('visitors cannot read these either',null,'select * from yamb.stats');
  await denied('visitors cannot read the counts',null,'select * from yamb.visits');
  await denied('players cannot read the counts',ivo,'select * from yamb.events');
  await denied('visitors cannot open the Numbers page',null,`select public.numbers(current_date - 7, current_date)`);
  let err7=null;try{await S.as(ivo,`select public.numbers(current_date - 7, current_date)`);}catch(x){err7=x.message;}
  ok(err7&&/YC_ADMIN/.test(err7),'a player who is not the admin cannot open the Numbers page');
  await S.admin(`insert into yamb.admins (user_id) values ($1)`,[ivo]);
  const wkAgo=(n)=>new Date(Date.now()-n*7*864e5).toISOString();
  await S.admin(`insert into public.results (user_id, game_id, mode, rules, score, finished_at) values
    ($1,'wk-001','cpu','e30',500,$3),($1,'wk-002','cpu','e30',500,$4),($2,'wk-003','cpu','e30',500,$3)`,[ivo,mia,wkAgo(2),wkAgo(1)]);
  r=await S.as(ivo,`select public.numbers(current_date - 30, current_date) as n`);
  const NB=r.rows[0].n,d0=NB.days[NB.days.length-1];
  ok(d0&&d0.people===3&&d0.views===6&&d0.app===1,'the Numbers page shows a day: '+JSON.stringify(d0));
  ok(NB.sources.length===4&&NB.events.length===5&&NB.langs.hr===2&&NB.stats.some(x=>x.k==='opp'&&x.v==='mira'&&x.n===2),'and its sources, events and languages');
  const back=NB.weeks.find(w=>w.players===2);
  ok(back&&back.back===1,'signed-in players who came back the next week: '+JSON.stringify(NB.weeks));
  await S.admin(`update yamb.day_key set day = day - 1`);await S.admin(`update yamb.seen set day = day - 1`);
  await hdr('1.1.1.1','Phone A');await S.as(null,'select public.count_visit($1, $2, $3, $4)',['game','google.com','hr',false]);
  const after=await S.admin(`select (select count(*) from yamb.day_key)::int as keys, (select count(*) from yamb.seen where day < current_date)::int as old,
                                    (select people from yamb.visits where day = (now() at time zone 'utc')::date and page='game' and src='google.com')::int as p`);
  ok(after.rows[0].keys===1&&after.rows[0].old===0&&after.rows[0].p===2,'a new day: yesterday\'s key and codes are gone, and the same visitor counts again');
  await S.admin(`select set_config('request.headers', '', false)`);

  console.log(bad?`\n${bad} problem(s)`:`\nall good (${Math.round((Date.now()-t0)/1000)} s)`);process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
