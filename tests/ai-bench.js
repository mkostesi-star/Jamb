// How well do the computer players play? Each one plays whole games alone with seeded dice, so runs can be compared.
//
//   node ai-bench.js                       all five characters, classic rules, 100 games each (about 8 minutes)
//   node ai-bench.js --rules quick,full    other house rules (see RULESETS in ai-sim.js)
//   node ai-bench.js --who profesor --games 400
//   node ai-bench.js --ai ../old/ai.js     measure another copy of ai.js on the same dice (before / after)
//   node ai-bench.js --check               the release check: the review agrees with the Professor's own moves,
//                                          the characters keep their order, and the Professor stays above his floor
const path=require('path');
const S=require('./ai-sim.js');const E=S.E;
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true);};
const ORDER=['ema','nono','mira','joza','profesor'];
const AI=S.loadAI(arg('ai',null)?path.resolve(arg('ai')):null);
const SEED=+arg('seed',500000);

function table(rname,who,n){
  const rules=S.RULESETS[rname];if(!rules)throw new Error('no such rules: '+rname+' (have '+Object.keys(S.RULESETS).join(', ')+')');
  const out={};
  for(const w of who){
    const t0=Date.now(),st=S.average(AI,rules,w,n,SEED);out[w]=st;
    console.log(`  ${rname.padEnd(10)} ${w.padEnd(9)} ${st.mean.toFixed(1).padStart(7)} ± ${st.se.toFixed(1).padEnd(5)} (${n} games, ${Math.round((Date.now()-t0)/n)} ms a game)`);
  }
  return out;
}

function check(){
  let bad=0;const fail=m=>{bad++;console.log('  FAIL  '+m);},ok=m=>console.log('  ok    '+m);
  // 1. The review must find nothing to improve in the Professor's own moves, and luck must add up to about zero.
  for(const rname of ['quick','classic','full']){
    const rules=S.RULESETS[rname];let worst=0,n=0,luck=0,rolls=0;
    const games=rname==='quick'?12:2;
    for(let g=0;g<games;g++)S.playGame(AI,rules,'profesor',SEED+g*7919,(st,a)=>{
      const j=AI.judge(st,a);n++;if(j&&j.loss>worst)worst=j.loss;
      const b=AI.best(st);if(!b||!b.action)worst=99;
    });
    if(worst>1e-6)fail(`${rname}: the review would change a move the Professor made (loss ${worst.toFixed(2)})`);else ok(`${rname}: review agrees with all ${n} of the Professor's moves`);
  }
  // 2. Difficulty order and the Professor's level, on the default rules.
  const n=+arg('games',50);
  const r=table('classic',ORDER,n);
  for(let i=1;i<ORDER.length;i++){
    const a=r[ORDER[i-1]],b=r[ORDER[i]];
    if(!(b.mean>a.mean))fail(`${ORDER[i]} (${b.mean.toFixed(0)}) should score above ${ORDER[i-1]} (${a.mean.toFixed(0)})`);
  }
  if(!bad)ok('order: '+ORDER.join(' < '));
  const floor=1090;
  if(r.profesor.mean-2*r.profesor.se<floor-40)fail(`the Professor averages ${r.profesor.mean.toFixed(0)} on classic rules, expected about ${floor+40} or more`);else ok(`the Professor averages ${r.profesor.mean.toFixed(0)} on classic rules`);
  // 3. Every rule set plays to the end without an illegal move.
  for(const rname of Object.keys(S.RULESETS)){
    try{for(const w of ORDER)S.playGame(AI,S.RULESETS[rname],w,SEED+17);ok(`${rname}: every character finishes a game`);}catch(e){fail(`${rname}: ${e.message}`);}
  }
  console.log(bad?`\n${bad} problem(s)`:'\nall good');process.exit(bad?1:0);
}

if(arg('check',false))check();
else{
  const rules=String(arg('rules','classic')).split(','),who=arg('who',null)?String(arg('who')).split(','):ORDER,n=+arg('games',100);
  console.log('Average final score, one player alone, seeded dice:');
  for(const r of rules)table(r,who,n);
}
