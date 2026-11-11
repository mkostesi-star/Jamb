/* Jamb computer players and coach.
   Each turn is planned exactly: every hold, every reroll and every Najava call, judging each box by what it is
   usually worth under the current house rules. Characters differ in how sharply they prefer the best option
   and in small habits (favourite column, chasing Jamb, loving Najava). The same evaluation drives hints,
   move review and the luck meter. */
(function(root){
'use strict';
const E=root.JambEngine||(typeof require!=='undefined'?require('./engine.js'):null);
const ROWS=E.ROWS;
const B=7,P=[1,7,49,343,2401,16807],N=117649,FACT=[1,1,2,6,24,120,720];

/* A multiset of dice is a key: sum(count[f] * 7^f). Adding dice adds keys. */
const OUTS=[];
for(let k=0;k<=6;k++){
  const list=[],c=[0,0,0,0,0,0];
  const rec=(i,left)=>{
    if(i===5){c[5]=left;let m=FACT[k],key=0;for(let j=0;j<6;j++){m/=FACT[c[j]];key+=c[j]*P[j];}list.push([key,m/Math.pow(6,k)]);return;}
    for(let x=0;x<=left;x++){c[i]=x;rec(i+1,left-x);}
  };
  rec(0,k);OUTS.push(list);
}
const DEC=new Array(N),HOLDS=new Array(N);
function decode(key){
  let c=DEC[key];if(c)return c;
  c=new Int8Array(6);let k=key;for(let i=0;i<6;i++){c[i]=k%B;k=(k-c[i])/B;}
  DEC[key]=c;return c;
}
function holds(key){
  let h=HOLDS[key];if(h)return h;
  const c=decode(key);h=[];
  const rec=(i,n,hk)=>{if(i===6){h.push([hk,n]);return;}for(let v=0;v<=c[i];v++)rec(i+1,n+v,hk+v*P[i]);};
  rec(0,0,0);HOLDS[key]=h;return h;
}
function keyOf(dice){let k=0;for(const v of dice)k+=P[v-1];return k;}
function heldKey(dice,held){let k=0,n=0;dice.forEach((v,i)=>{if(held[i]){k+=P[v-1];n++;}});return[k,n];}
function holdMask(hk,dice){
  const hc=Array.from(decode(hk));
  return dice.map(v=>{if(hc[v-1]>0){hc[v-1]--;return true;}return false;});
}

let gen=0;
const wS=[null,new Int32Array(N),new Int32Array(N),new Int32Array(N)],wV=[null,new Float64Array(N),new Float64Array(N),new Float64Array(N)];
const vS=[null,new Int32Array(N),new Int32Array(N)],vV=[null,new Float64Array(N),new Float64Array(N)];
function W(ctx,key,roll){
  if(wS[roll][key]===gen)return wV[roll][key];
  const c=decode(key),L=ctx.legal[roll];let best=-1e9;
  for(let i=0;i<L.length;i++){const u=L[i].u(c,roll);if(u>best)best=u;}
  wS[roll][key]=gen;wV[roll][key]=best;return best;
}
function holdValue(ctx,hk,n,roll){
  const outs=OUTS[ctx.nd-n];let e=0;
  for(let i=0;i<outs.length;i++)e+=outs[i][1]*V(ctx,hk+outs[i][0],roll+1);
  return e;
}
function V(ctx,key,roll){
  if(roll>=3)return W(ctx,key,3);
  if(vS[roll][key]===gen)return vV[roll][key];
  let best=W(ctx,key,roll);
  if(ctx.cont[roll]){
    const hs=holds(key);
    for(let i=0;i<hs.length;i++){const e=holdValue(ctx,hs[i][0],hs[i][1],roll);if(e>best)best=e;}
  }
  vS[roll][key]=gen;vV[roll][key]=best;return best;
}
function firstRollValue(ctx){let e=0;for(const [k,p] of OUTS[ctx.nd])e+=p*V(ctx,k,1);return e;}

/* What a box is usually worth, measured for these rules, then adjusted for how real games go
   (good players fill boxes when the dice offer them, so most boxes end up above the "go for it" value). */
const MULT_S=[1.19,1.19,1.19,1.19,1.19,1.19,0,0,1.6,1.34,1.57,1.37,2.5],ADD_S=[0,0,0,0,0,0,1.7,-2.2,0,0,0,0,0];
const MULT_H=[1.2,1.2,1.2,1.2,1.2,1.2,0,0,2,1.37,2.1,1.85,10],ADD_H=[0,0,0,0,0,0,1.5,-1.5,0,0,0,0,0];
const PAR_CACHE={};
function parsFor(rules){
  const key=JSON.stringify([rules.dice,rules.kenta,rules.k1,rules.k2,rules.k3,rules.ks,rules.kb,rules.tri,rules.ful,rules.poker,rules.jamb]);
  if(PAR_CACHE[key])return PAR_CACHE[key];
  const nd=rules.dice,S=[],H=[];
  for(let ri=0;ri<13;ri++){
    const sign=ri===7?-1:1,box={u:(c,roll)=>sign*E.scoreC(rules,ri,c,roll)};
    gen++;
    const ctx={nd,legal:[null,[box],[box],[box]],cont:[null,true,true]};
    const d3=sign*firstRollValue(ctx);
    gen++;
    let d1=0;for(const [k,p] of OUTS[nd])d1+=p*W(ctx,k,1);d1*=sign;
    S.push(ri===6||ri===7?d3+ADD_S[ri]:d3*MULT_S[ri]);
    H.push(ri===6||ri===7?d1+ADD_H[ri]:d1*MULT_H[ri]);
  }
  return PAR_CACHE[key]={S,H};
}

function pBonus(rules,W0,open,par){
  if(W0>=rules.bonusAt)return 1;
  if(!open.length||rules.bonus<=0)return 0;
  let mx=W0,ex=W0;for(const i of open){mx+=5*(i+1);ex+=par[i];}
  if(mx<rules.bonusAt)return 0;
  const sd=2.5+2.2*Math.sqrt(open.length);
  return 1/(1+Math.exp(-(ex-rules.bonusAt)/sd));
}
function colModel(rules,col,par){
  const open=[];let UW=0;
  for(let i=0;i<6;i++){const v=col[ROWS[i]];if(v===null)open.push(i);else UW+=v;}
  const ones=rules.mid==='plain'?1:(col['1']!==null?col['1']:par[0]);
  return{par,open,UW,pb:pBonus(rules,UW,open,par),Emax:col.max!==null?col.max:par[6],Emin:col.min!==null?col.min:par[7],E1:ones};
}
function makeBox(rules,m,c,r,prof,extra){
  const ri=ROWS.indexOf(r),par=m.par,mult=(prof&&prof.mult&&prof.mult[r])||1,bias=((prof&&prof.colBias&&prof.colBias[c])||0)+(extra||0);
  let u;
  if(ri<6){
    const rest=m.open.filter(i=>i!==ri),tbl=[];
    for(let n=0;n<=6;n++){
      const s=Math.min(n,5)*(ri+1);
      let d=s*mult-par[ri]+rules.bonus*(pBonus(rules,m.UW+s,rest,par)-m.pb);
      if(ri===0&&rules.mid!=='plain')d+=(m.Emax-m.Emin)*(s-par[0]);
      tbl.push(d+bias);
    }
    u=cc=>tbl[cc[ri]];
  }else if(ri===6)u=(cc,roll)=>(E.scoreC(rules,6,cc,roll)-par[6])*m.E1+bias;
  else if(ri===7)u=(cc,roll)=>(par[7]-E.scoreC(rules,7,cc,roll))*m.E1+bias;
  else u=(cc,roll)=>E.scoreC(rules,ri,cc,roll)*mult-par[ri]+bias;
  return{c,r,ri,u};
}
function buildCtx(g,prof){
  const {rules,sheet,turn}=g,pars=parsFor(rules),models={};
  for(const col of rules.cols)models[col]=colModel(rules,sheet[col],col==='hand'?pars.H:pars.S);
  /* In a column filled in order, writing the next box also brings the boxes waiting behind it one turn closer.
     A player who knows this (prof.chain) adds to such a write the share of the turns still left in the game that the
     rest of that column needs, so those columns keep moving and no queue of forced boxes is left for the end. */
  const chain=(prof&&prof.chain)||0;
  let left=0;
  if(chain)for(const col of rules.cols)for(const r of ROWS)if(sheet[col][r]===null)left++;
  const waiting=(col,r)=>{
    const d=E.COLS[col];let n=0;
    if(d.chains)for(const ch of d.chains){const i=ch.indexOf(r);if(i>=0)for(let k=i+1;k<ch.length;k++)if(sheet[col][ch[k]]===null)n++;}
    return n;
  };
  const mk=(col,r)=>makeBox(rules,models[col],col,r,prof,chain?chain*waiting(col,r)/left:0);
  let l1,l2;
  if(turn.announced){const b=mk('ann',turn.announced);l1=[b];l2=[b];}
  else{
    l1=[];l2=[];
    for(const col of rules.cols){
      const d=E.COLS[col],open=E.nextBoxes(col,sheet[col]);
      for(const r of open){const b=mk(col,r);l1.push(b);if(!d.first&&!d.announce)l2.push(b);}
    }
  }
  const cont=!!turn.announced||l2.length>0;
  return{nd:rules.dice,legal:[null,l1,l2,l2],cont:[null,cont,cont],mk};
}

/* All options at this decision, each with its value in points relative to "par". */
function options(g,prof){
  const {rules,sheet,turn}=g,roll=turn.roll,key=keyOf(turn.dice),c=decode(key);
  const ctx=buildCtx(g,prof);
  gen++;
  const opts=[];
  for(const b of ctx.legal[roll])opts.push({t:'w',c:b.c,r:b.r,v:b.u(c,roll)});
  if(roll<3&&ctx.cont[roll]){
    for(const [hk,n] of holds(key))opts.push({t:'h',hk,n,v:holdValue(ctx,hk,n,roll)});
  }
  if(roll===1&&!turn.announced&&rules.cols.includes('ann')){
    const annBias=(prof&&prof.annBias)||0;
    for(const r of ROWS){
      if(sheet.ann[r]!==null)continue;
      const b=ctx.mk('ann',r);
      gen++;
      const rc={nd:ctx.nd,legal:[null,[b],[b],[b]],cont:[null,true,true]};
      const wNow=b.u(c,1);
      let h=null,he=-1e9;
      for(const [hk,n] of holds(key)){const e=holdValue(rc,hk,n,1);if(e>he){he=e;h=hk;}}
      if(he>wNow+0.75)opts.push({t:'a',r,hk:h,v:he+annBias,raw:he});
    }
  }
  return opts;
}
function pick(opts,temp,rnd){
  let best=opts[0];
  for(const o of opts)if(o.v>best.v)best=o;
  if(!(temp>0))return best;
  let sum=0;const w=opts.map(o=>{const x=Math.exp((o.v-best.v)/temp);sum+=x;return x;});
  let r=rnd()*sum;
  for(let i=0;i<opts.length;i++){r-=w[i];if(r<=0)return opts[i];}
  return best;
}
function toAction(o,dice){
  if(o.t==='w')return{type:'write',c:o.c,r:o.r};
  if(o.t==='a')return{type:'announce',r:o.r,held:holdMask(o.hk,dice)};
  return{type:'hold',held:holdMask(o.hk,dice)};
}

const CHARACTERS={
  ema:{temp:4.2,level:0},
  nono:{temp:2.4,level:1,colBias:{down:2.5,up:-1},annBias:-4},
  mira:{temp:1.6,level:2,mult:{jamb:1.6,poker:1.25}},
  joza:{temp:0.5,level:3,annBias:2.5},
  profesor:{temp:0,level:4,chain:30}
};
const LEVELS={easy:{temp:3},medium:{temp:1.2},hard:{temp:0}};
function profileOf(p){if(!p)return CHARACTERS.profesor;if(typeof p==='string')return CHARACTERS[p]||LEVELS[p]||CHARACTERS.profesor;return p;}

function decide(g,prof,rnd){
  rnd=rnd||Math.random;
  const P0=profileOf(prof),opts=options(g,P0);
  if(!opts.length)return null;
  return toAction(pick(opts,P0.temp,rnd),g.turn.dice);
}

/* Coach: best option and how the chosen one compares. The coach sees the game exactly as the Professor does. */
function best(g){
  const opts=options(g,CHARACTERS.profesor);
  if(!opts.length)return null;
  let b=opts[0];for(const o of opts)if(o.v>b.v)b=o;
  let second=-1e9;for(const o of opts)if(o!==b&&o.v>second)second=o.v;
  return{opt:b,action:toAction(b,g.turn.dice),value:b.v,margin:b.v-second,opts};
}
function judge(g,action){
  const r=best(g);if(!r)return null;
  let chosen=null;
  if(action.type==='write')chosen=r.opts.find(o=>o.t==='w'&&o.c===action.c&&o.r===action.r);
  else if(action.type==='announce')chosen=r.opts.find(o=>o.t==='a'&&o.r===action.r);
  else{const [hk]=heldKey(g.turn.dice,action.held);chosen=r.opts.find(o=>o.t==='h'&&o.hk===hk);}
  if(!chosen&&action.type==='announce'){
    const ctx=buildCtx(g,CHARACTERS.profesor),b=ctx.mk('ann',action.r);gen++;
    const rc={nd:ctx.nd,legal:[null,[b],[b],[b]],cont:[null,true,true]},key=keyOf(g.turn.dice);
    let he=-1e9;for(const [hk,n] of holds(key)){const e=holdValue(rc,hk,n,1);if(e>he)he=e;}
    chosen={t:'a',r:action.r,v:he};
  }
  const cv=chosen?chosen.v:r.value;
  return{best:r.action,bestValue:r.value,chosenValue:cv,loss:Math.max(0,r.value-cv)};
}
/* Luck of one roll: value of what came up minus the value you could expect before rolling. */
function luck(g,afterDice){
  const ctx=buildCtx(g,CHARACTERS.profesor),t=g.turn;
  gen++;
  let exp;
  if(t.roll===0)exp=firstRollValue(ctx);
  else{const [hk,n]=heldKey(t.dice,t.held);exp=holdValue(ctx,hk,n,t.roll);}
  const got=V(ctx,keyOf(afterDice),t.roll+1);
  return got-exp;
}

const API={decide,best,judge,luck,CHARACTERS,LEVELS,parsFor,_:{OUTS,decode,holds,keyOf,V,W,holdValue,bump:()=>++gen}};
root.JambAI=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
