// Plays whole games with the game's own rules engine and computer players, with seeded dice.
// Used by ai-bench.js (how well does each character play) and by the tuning scripts.
const path=require('path');
const E=require(path.join(__dirname,'..','engine.js'));
function loadAI(file){
  const f=require.resolve(file||path.join(__dirname,'..','ai.js'));
  delete require.cache[f];
  return require(f);
}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function roll(turn,rnd){
  const t={roll:turn.roll,dice:turn.dice.slice(),held:turn.held.slice(),announced:turn.announced,drawn:0};
  if(t.roll===0)t.held=t.held.map(()=>false);
  t.dice=t.dice.map((v,i)=>t.held[i]?v:1+Math.floor(rnd()*6));
  t.roll++;return t;
}
// One player's game from start to finish. Returns the total and the sheet. onDecision sees every choice.
function playGame(AI,rules,prof,seed,onDecision,start){
  const dice=mulberry(seed>>>0),pick=mulberry((seed^0x9E3779B9)>>>0);
  const sheet=start?JSON.parse(JSON.stringify(start.sheet)):E.newSheet(rules);
  let turn=start&&start.turn?JSON.parse(JSON.stringify(start.turn)):null,first=start&&start.first;
  let guard=0;
  while(!E.full(rules,sheet)||first){
    if(!turn){turn=roll(E.freshTurn(rules.dice),dice);}
    for(;;){
      if(++guard>5000)throw new Error('game does not end');
      let a;
      if(first){a=first;first=null;}
      else{a=AI.decide({rules,sheet,turn},prof,pick);if(onDecision)onDecision({rules,sheet,turn},a);}
      if(!a){const l=E.legalList(rules,sheet,turn)[0];a={type:'write',c:l.c,r:l.r};}
      if(a.type==='write'){
        if(!E.canWrite(rules,sheet,turn,a.c,a.r))throw new Error('illegal write '+a.c+' '+a.r);
        sheet[a.c][a.r]=E.score(rules,a.r,turn.dice,turn.roll);break;
      }
      if(a.type==='announce'){if(!E.canAnnounce(rules,sheet,turn,a.r))throw new Error('illegal call');turn.announced=a.r;}
      if(!E.canRollAgain(rules,sheet,turn))throw new Error('illegal roll');
      turn.held=a.held.slice();turn=roll(turn,dice);
    }
    turn=null;
  }
  return {total:E.total(rules,sheet),sheet};
}
function stats(xs){const n=xs.length,m=xs.reduce((a,b)=>a+b,0)/n;const v=xs.reduce((a,b)=>a+(b-m)*(b-m),0)/Math.max(1,n-1);return {n,mean:m,sd:Math.sqrt(v),se:Math.sqrt(v/n)};}
function average(AI,rules,prof,n,seed0){const xs=[];for(let i=0;i<n;i++)xs.push(playGame(AI,rules,prof,(seed0||1000)+i*7919).total);return stats(xs);}
const RULESETS={
  classic:E.presetRules('classic'),
  quick:E.presetRules('quick'),
  family:E.presetRules('family'),
  six:E.presetRules('six'),
  full:E.presetRules('full'),
  flatKenta:E.normRules(Object.assign({},E.DEFAULT_RULES,{kenta:'flat'})),
  plainMid:E.normRules(Object.assign({},E.DEFAULT_RULES,{mid:'plain'}))
};
module.exports={E,loadAI,playGame,average,stats,mulberry,roll,RULESETS};
