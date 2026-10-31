/* Jamb computer opponent: plans each turn exactly (every hold, every reroll, Najava),
   judging each box by what it is usually worth. Weaker levels pick worse options more often. */
(function(root){
'use strict';
const ROWS=['1','2','3','4','5','6','max','min','kenta','triling','ful','poker','jamb'];
const P6=[1,6,36,216,1296,7776],N=46656,FACT=[1,1,2,6,24,120];

/* Dice are held as counts per face; a multiset key is sum(count[i]*6^i), so adding dice adds keys. */
const OUTS=[];
for(let k=0;k<=5;k++){
  const list=[],c=[0,0,0,0,0,0];
  const rec=(i,left)=>{
    if(i===5){c[5]=left;let m=FACT[k],key=0;for(let j=0;j<6;j++){m/=FACT[c[j]];key+=c[j]*P6[j];}list.push([key,m/Math.pow(6,k)]);return;}
    for(let x=0;x<=left;x++){c[i]=x;rec(i+1,left-x);}
  };
  rec(0,k);OUTS.push(list);
}
const DEC=new Array(N),HOLDS=new Array(N);
function decode(key){
  let c=DEC[key];if(c)return c;
  c=new Int8Array(6);let k=key;for(let i=0;i<6;i++){c[i]=k%6;k=(k-c[i])/6;}
  DEC[key]=c;return c;
}
function holds(key){
  let h=HOLDS[key];if(h)return h;
  const c=decode(key);h=[];
  const rec=(i,n,hk)=>{if(i===6){h.push([hk,n]);return;}for(let v=0;v<=c[i];v++)rec(i+1,n+v,hk+v*P6[i]);};
  rec(0,0,0);HOLDS[key]=h;return h;
}
function keyOf(dice){let k=0;for(const v of dice)k+=P6[v-1];return k;}

function scoreC(ri,c,roll){
  if(ri<6)return c[ri]*(ri+1);
  let sum=0;for(let i=0;i<6;i++)sum+=c[i]*(i+1);
  if(ri<8)return sum;
  if(ri===8){
    for(let i=1;i<5;i++)if(c[i]!==1)return 0;
    return (c[0]===1||c[5]===1)?[66,56,46][Math.min(Math.max(roll,1),3)-1]:0;
  }
  if(ri===9){for(let i=5;i>=0;i--)if(c[i]>=3)return 3*(i+1)+10;return 0;}
  if(ri===10){let t3=false,t2=false;for(let i=0;i<6;i++){if(c[i]===3)t3=true;else if(c[i]===2)t2=true;else if(c[i]===5)return sum+30;}return t3&&t2?sum+30:0;}
  if(ri===11){for(let i=5;i>=0;i--)if(c[i]>=4)return 4*(i+1)+40;return 0;}
  for(let i=5;i>=0;i--)if(c[i]===5)return 5*(i+1)+50;
  return 0;
}

/* What a box is usually worth when you go for it (3 rolls), and from a single roll (column R).
   Measured with this engine; upper rows nudged up because good players fill them opportunistically. */
let PAR_S=[2.5,5,7.5,10,12.5,15,25,9.5,22,22,28,22,8];
let PAR_H=[1,2,3,4,5,6,19,16,4,6,4,2,0.5];

/* Memo tables reused across solves; a generation stamp marks which entries are current. */
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
  const outs=OUTS[5-n];let e=0;
  if(ctx.myopic){for(let i=0;i<outs.length;i++)e+=outs[i][1]*W(ctx,hk+outs[i][0],roll+1);}
  else{for(let i=0;i<outs.length;i++)e+=outs[i][1]*V(ctx,hk+outs[i][0],roll+1);}
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

/* Expected final value of a column if open boxes end up at par; writing a box changes it by u(). */
function pBonus(W0,open,par){
  if(W0>=60)return 1;
  if(!open.length)return 0;
  let mx=W0,ex=W0;for(const i of open){mx+=5*(i+1);ex+=par[i];}
  if(mx<60)return 0;
  const sd=2.5+2.2*Math.sqrt(open.length);
  return 1/(1+Math.exp(-(ex-60)/sd));
}
function colModel(col,par){
  const open=[];let UW=0;
  for(let i=0;i<6;i++){const v=col[ROWS[i]];if(v===null)open.push(i);else UW+=v;}
  return{par,open,UW,pb:pBonus(UW,open,par),
    Emax:col.max!==null?col.max:par[6],Emin:col.min!==null?col.min:par[7],E1:col['1']!==null?col['1']:par[0]};
}
function makeBox(m,c,r){
  const ri=ROWS.indexOf(r),par=m.par;
  let u;
  if(ri<6){
    const rest=m.open.filter(i=>i!==ri),tbl=[];
    for(let n=0;n<=5;n++){
      const s=n*(ri+1);
      let d=s-par[ri]+30*(pBonus(m.UW+s,rest,par)-m.pb);
      if(ri===0)d+=(m.Emax-m.Emin)*(s-par[0]);
      tbl.push(d);
    }
    u=cc=>tbl[cc[ri]];
  }else if(ri===6)u=(cc,roll)=>(scoreC(6,cc,roll)-par[6])*m.E1;
  else if(ri===7)u=(cc,roll)=>(par[7]-scoreC(7,cc,roll))*m.E1;
  else u=(cc,roll)=>scoreC(ri,cc,roll)-par[ri];
  return{c,r,ri,u};
}

function nextDown(col){return ROWS.find(r=>col[r]===null);}
function nextUp(col){for(let i=ROWS.length-1;i>=0;i--)if(col[ROWS[i]]===null)return ROWS[i];return undefined;}
function legalSets(g,mk){
  const {cols,sheet,turn}=g,later=[],first=[];
  if(turn.announced){const b=mk('ann',turn.announced);return{l1:[b],l2:[b],l3:[b],cont:true};}
  for(const c of cols){
    const col=sheet[c];
    if(c==='down'){const r=nextDown(col);if(r)later.push(mk(c,r));}
    else if(c==='up'){const r=nextUp(col);if(r)later.push(mk(c,r));}
    else if(c==='free'){for(const r of ROWS)if(col[r]===null)later.push(mk(c,r));}
    else{for(const r of ROWS)if(col[r]===null)first.push(mk(c,r));}
  }
  return{l1:later.concat(first),l2:later,l3:later,cont:later.length>0};
}
function holdMask(hk,dice){
  const hc=Array.from(decode(hk));
  return dice.map(v=>{if(hc[v-1]>0){hc[v-1]--;return true;}return false;});
}
function argmaxBox(L,c,roll){
  let best=null,bu=-1e9;
  for(const b of L){const u=b.u(c,roll);if(u>bu){bu=u;best=b;}}
  return{box:best,u:bu};
}

/* Every level plays the full game (all columns, Najava, Ručna). Skill comes from how sharply it
   prefers the best option: temp 0 always takes the best; higher temps pick weaker options more often.
   bias nudges what a box is worth, which gives characters their habits. */
const PROFILES={
  easy:{temp:3,bias:null},
  medium:{temp:1.2,bias:null},
  hard:{temp:0,bias:null}
};
function biased(par,bias){
  if(!bias)return par;
  return par.map((v,i)=>v+(bias[ROWS[i]]||0));
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
function decide(g,level,rnd,profile){
  rnd=rnd||Math.random;
  const P=profile||PROFILES[level]||PROFILES.medium;
  const {cols,sheet,turn}=g,roll=turn.roll,key=keyOf(turn.dice),c=decode(key);
  const parS=biased(PAR_S,P.bias),parH=biased(PAR_H,P.bias);
  const models={};
  for(const col of cols)models[col]=colModel(sheet[col],col==='hand'?parH:parS);
  const mk=(col,r)=>makeBox(models[col],col,r);
  const sets=legalSets(g,mk);
  const ctx={legal:[null,sets.l1,sets.l2,sets.l3],cont:[null,sets.cont,sets.cont],myopic:false};
  gen++;
  const opts=[];
  for(const b of ctx.legal[roll])opts.push({t:'w',b,v:b.u(c,roll)});
  if(roll<3&&ctx.cont[roll]){
    for(const [hk,n] of holds(key))opts.push({t:'h',hk,v:holdValue(ctx,hk,n,roll)});
  }
  if(roll===1&&!turn.announced&&cols.includes('ann')){
    for(const r of ROWS){
      if(sheet.ann[r]!==null)continue;
      const b=mk('ann',r);
      gen++;
      const rc={legal:[null,[b],[b],[b]],cont:[null,true,true],myopic:false};
      const wNow=b.u(c,1);
      let h=null,he=-1e9;
      for(const [hk,n] of holds(key)){const e=holdValue(rc,hk,n,1);if(e>he){he=e;h=hk;}}
      if(he>wNow+0.75)opts.push({t:'a',r,hk:h,v:he});
    }
  }
  const o=pick(opts,P.temp,rnd);
  if(o.t==='w')return{type:'write',c:o.b.c,r:o.b.r};
  if(o.t==='a')return{type:'announce',r:o.r,held:holdMask(o.hk,turn.dice)};
  return{type:'hold',held:holdMask(o.hk,turn.dice)};
}

const API={decide,ROWS,PROFILES,_:{OUTS,decode,holds,keyOf,scoreC,V,W,holdValue,bump:()=>++gen,setPar:(s,h)=>{PAR_S=s;PAR_H=h;},getPar:()=>({PAR_S,PAR_H})}};
root.JambAI=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
