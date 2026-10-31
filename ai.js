/* Jamb computer opponent.
   Easy: greedy for points on the table right now.
   Medium: weighs each box against what it is usually worth, looks one roll ahead.
   Hard: plans the whole turn exactly (every hold, every reroll) and uses Najava. */
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

function easy(g,rnd){
  const {turn}=g,roll=turn.roll,c=decode(keyOf(turn.dice));
  const mk=(col,r)=>({c:col,r,ri:ROWS.indexOf(r)});
  const sets=legalSets(g,mk);
  const L=roll===1?sets.l1:sets.l2;
  const val=b=>{const s=scoreC(b.ri,c,roll);return b.ri===7?(30-s)*0.6:s;};
  const ranked=L.map(b=>({b,v:val(b)})).sort((a,b)=>b.v-a.v);
  if(roll<3&&sets.cont){
    const big=ranked.find(x=>x.b.ri>=8&&x.v>0);
    if(!(big&&rnd()<0.85)){
      let face=0;for(let i=0;i<6;i++)if(c[i]>=c[face])face=i;
      return{type:'hold',held:turn.dice.map(v=>v===face+1)};
    }
    return{type:'write',c:big.b.c,r:big.b.r};
  }
  const pick=rnd()<0.25?ranked[Math.floor(rnd()*Math.min(3,ranked.length))]:ranked[0];
  return{type:'write',c:pick.b.c,r:pick.b.r};
}

function decide(g,level,rnd){
  rnd=rnd||Math.random;
  if(level==='easy')return easy(g,rnd);
  const {cols,sheet,turn}=g,roll=turn.roll,key=keyOf(turn.dice),c=decode(key);
  const models={};
  for(const col of cols)models[col]=colModel(sheet[col],col==='hand'?PAR_H:PAR_S);
  const mk=(col,r)=>makeBox(models[col],col,r);
  const sets=legalSets(g,mk);
  const ctx={legal:[null,sets.l1,sets.l2,sets.l3],cont:[null,sets.cont,sets.cont],myopic:level!=='hard'};
  gen++;
  const now=argmaxBox(ctx.legal[roll],c,roll);
  let bestHold=null,bestE=-1e9,second=null;
  if(roll<3&&ctx.cont[roll]){
    const hs=holds(key).map(([hk,n])=>({hk,e:holdValue(ctx,hk,n,roll)})).sort((a,b)=>b.e-a.e);
    bestHold=hs[0];bestE=hs[0].e;second=hs[1]||null;
  }
  if(level==='hard'&&roll===1&&!turn.announced&&cols.includes('ann')){
    const top=Math.max(now.u,bestE);
    let ann=null;
    for(const r of ROWS){
      if(sheet.ann[r]!==null)continue;
      const b=mk('ann',r);
      gen++;
      const rc={legal:[null,[b],[b],[b]],cont:[null,true,true],myopic:false};
      const wNow=b.u(c,1);
      let h=null,he=-1e9;
      for(const [hk,n] of holds(key)){const e=holdValue(rc,hk,n,1);if(e>he){he=e;h=hk;}}
      if(he>wNow&&he>top+0.75&&(!ann||he>ann.e))ann={r,e:he,hk:h};
    }
    if(ann)return{type:'announce',r:ann.r,held:holdMask(ann.hk,turn.dice)};
  }
  if(bestHold&&bestE>now.u){
    let h=bestHold;
    if(level==='medium'&&second&&rnd()<0.15)h=second;
    return{type:'hold',held:holdMask(h.hk,turn.dice)};
  }
  return{type:'write',c:now.box.c,r:now.box.r};
}

const API={decide,ROWS,_:{OUTS,decode,holds,keyOf,scoreC,V,W,holdValue,bump:()=>++gen,setPar:(s,h)=>{PAR_S=s;PAR_H=h;},getPar:()=>({PAR_S,PAR_H})}};
root.JambAI=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
