/* Jamb rules engine: house rules, scoring, legal moves and seeded dice.
   Shared by the app and the computer players. */
(function(root){
'use strict';
const ROWS=['1','2','3','4','5','6','max','min','kenta','triling','ful','poker','jamb'];
const UPPER=ROWS.slice(0,6);
const LOWER=['kenta','triling','ful','poker','jamb'];

/* Chain columns must be filled in chain order; "any" columns take any open box.
   Najava (ann) needs an announcement after the first roll; Ručna (hand) only takes the first roll. */
const COLS={
  down:{sym:'↓',chains:[ROWS.slice()]},
  up:{sym:'↑',chains:[ROWS.slice().reverse()]},
  free:{sym:'↕',any:true},
  mid:{sym:'⇅',chains:[['max','6','5','4','3','2','1'],['min','kenta','triling','ful','poker','jamb']]},
  tomid:{sym:'⇵',chains:[['1','2','3','4','5','6','max'],['jamb','poker','ful','triling','kenta','min']]},
  ann:{sym:'N',any:true,announce:true},
  hand:{sym:'R',any:true,first:true}
};
const COL_ORDER=['down','up','free','mid','tomid','ann','hand'];

const DEFAULT_RULES={cols:['down','up','free','ann'],dice:5,kenta:'roll',k1:66,k2:56,k3:46,ks:45,kb:50,tri:10,ful:30,poker:40,jamb:50,bonusAt:60,bonus:30,mid:'ones'};
const PRESETS={
  classic:{},
  quick:{cols:['free']},
  family:{cols:['down','up','free','ann','hand']},
  six:{dice:6},
  full:{cols:['down','up','free','mid','tomid','ann','hand']}
};
const DAILY_RULES={cols:['free']};

function num(v,d,lo,hi){v=Number(v);if(!isFinite(v))return d;return Math.min(hi,Math.max(lo,Math.round(v)));}
function normRules(r){
  r=r&&typeof r==='object'?r:{};
  const d=DEFAULT_RULES,o={};
  let cols=Array.isArray(r.cols)?r.cols.filter(c=>COLS[c]):d.cols.slice();
  cols=COL_ORDER.filter(c=>cols.includes(c));
  o.cols=cols.length?cols:d.cols.slice();
  o.dice=r.dice===6?6:5;
  o.kenta=r.kenta==='flat'?'flat':'roll';
  o.k1=num(r.k1,d.k1,0,200);o.k2=num(r.k2,d.k2,0,200);o.k3=num(r.k3,d.k3,0,200);
  o.ks=num(r.ks,d.ks,0,200);o.kb=num(r.kb,d.kb,0,200);
  o.tri=num(r.tri,d.tri,0,200);o.ful=num(r.ful,d.ful,0,200);o.poker=num(r.poker,d.poker,0,200);o.jamb=num(r.jamb,d.jamb,0,300);
  o.bonusAt=num(r.bonusAt,d.bonusAt,0,150);o.bonus=num(r.bonus,d.bonus,0,200);
  o.mid=r.mid==='plain'?'plain':'ones';
  return o;
}
function presetRules(name){return normRules(Object.assign({},DEFAULT_RULES,PRESETS[name]||{}));}
function sameRules(a,b){return JSON.stringify(normRules(a))===JSON.stringify(normRules(b));}

function b64e(s){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64d(s){s=String(s||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(escape(atob(s)));}
function encodeRules(r){
  r=normRules(r);const diff={};
  for(const k of Object.keys(DEFAULT_RULES)){if(JSON.stringify(r[k])!==JSON.stringify(DEFAULT_RULES[k]))diff[k]=r[k];}
  return b64e(JSON.stringify(diff));
}
function decodeRules(s){try{return normRules(Object.assign({},DEFAULT_RULES,JSON.parse(b64d(s))));}catch(e){return null;}}
function encodeObj(o){return b64e(JSON.stringify(o));}
function decodeObj(s){try{return JSON.parse(b64d(s));}catch(e){return null;}}

function counts(d){const c=[0,0,0,0,0,0];for(const v of d)c[v-1]++;return c;}
function scoreC(rules,ri,c,roll){
  if(ri<6)return Math.min(c[ri],5)*(ri+1);
  if(ri===6||ri===7){
    let need=5,s=0;
    if(ri===6){for(let f=5;f>=0&&need>0;f--){const k=Math.min(c[f],need);s+=k*(f+1);need-=k;}}
    else{for(let f=0;f<6&&need>0;f++){const k=Math.min(c[f],need);s+=k*(f+1);need-=k;}}
    return s;
  }
  if(ri===8){
    const small=c[0]&&c[1]&&c[2]&&c[3]&&c[4],big=c[1]&&c[2]&&c[3]&&c[4]&&c[5];
    if(!small&&!big)return 0;
    if(rules.kenta==='roll')return [rules.k1,rules.k2,rules.k3][Math.min(Math.max(roll,1),3)-1];
    return big?rules.kb:rules.ks;
  }
  if(ri===9){for(let f=5;f>=0;f--)if(c[f]>=3)return 3*(f+1)+rules.tri;return 0;}
  if(ri===10){
    let best=0;
    for(let a=5;a>=0;a--){
      if(c[a]>=5)best=Math.max(best,5*(a+1)+rules.ful);
      if(c[a]>=3)for(let b=5;b>=0;b--)if(b!==a&&c[b]>=2){best=Math.max(best,3*(a+1)+2*(b+1)+rules.ful);break;}
    }
    return best;
  }
  if(ri===11){for(let f=5;f>=0;f--)if(c[f]>=4)return 4*(f+1)+rules.poker;return 0;}
  for(let f=5;f>=0;f--)if(c[f]>=5)return 5*(f+1)+rules.jamb;
  return 0;
}
function score(rules,row,dice,roll){return scoreC(rules,ROWS.indexOf(row),counts(dice),roll);}

function newSheet(rules){const o={};for(const c of rules.cols){o[c]={};for(const r of ROWS)o[c][r]=null;}return o;}
function colTotals(rules,col){
  let up=0,upAny=false,low=0,lowAny=false;
  for(const r of UPPER)if(col[r]!==null){up+=col[r];upAny=true;}
  for(const r of LOWER)if(col[r]!==null){low+=col[r];lowAny=true;}
  const bonus=up>=rules.bonusAt?rules.bonus:0;
  let mid=null;
  if(col.max!==null&&col.min!==null){
    if(rules.mid==='plain')mid=col.max-col.min;
    else if(col['1']!==null)mid=(col.max-col.min)*col['1'];
  }
  const any=ROWS.some(r=>col[r]!==null);
  return{up,upAny,bonus,mid,low,lowAny,any,total:up+bonus+(mid||0)+low};
}
function total(rules,sheet){let t=0;for(const c of rules.cols)t+=colTotals(rules,sheet[c]).total;return t;}
function filled(rules,sheet){let n=0;for(const c of rules.cols)for(const r of ROWS)if(sheet[c][r]!==null)n++;return n;}
const boxes=rules=>rules.cols.length*ROWS.length;
function full(rules,sheet){return filled(rules,sheet)>=boxes(rules);}

function nextBoxes(cid,col){
  const def=COLS[cid];
  if(def.chains){
    const out=[];
    for(const ch of def.chains){for(const r of ch)if(col[r]===null){if(!out.includes(r))out.push(r);break;}}
    return out;
  }
  return ROWS.filter(r=>col[r]===null);
}
function canWrite(rules,sheet,turn,c,r){
  const col=sheet[c];
  if(!col||col[r]!==null||turn.roll<1||!rules.cols.includes(c))return false;
  if(turn.announced)return c==='ann'&&r===turn.announced;
  const def=COLS[c];
  if(def.first||def.announce)return turn.roll===1;
  return nextBoxes(c,col).includes(r);
}
function legalList(rules,sheet,turn){
  const out=[];
  for(const c of rules.cols)for(const r of ROWS)if(canWrite(rules,sheet,turn,c,r))out.push({c,r});
  return out;
}
function hasLater(rules,sheet){
  return rules.cols.some(c=>{const d=COLS[c];return !d.first&&!d.announce&&nextBoxes(c,sheet[c]).length>0;});
}
function canRollAgain(rules,sheet,turn){
  if(turn.roll>=3)return false;
  if(turn.roll===0||turn.announced)return true;
  return hasLater(rules,sheet);
}
function canAnnounce(rules,sheet,turn,r){
  return rules.cols.includes('ann')&&turn.roll===1&&!turn.announced&&sheet.ann[r]===null;
}
function freshTurn(nd){return{roll:0,dice:Array.from({length:nd||5},(_,i)=>i+1>6?6:i+1),held:Array(nd||5).fill(false),announced:null,drawn:0};}

/* Seeded dice: every turn has its own stream. The first roll takes the first values; each reroll takes the
   next values in order. Everyone playing the same seed gets the same first roll and the same reroll stream. */
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function streamAt(seed,turnNo,drawn){
  const r=mulberry(hashStr(seed+':'+turnNo));
  for(let i=0;i<(drawn||0);i++)r();
  return{next:()=>1+Math.floor(r()*6)};
}
function cryptoDie(){
  try{const a=new Uint8Array(1);do{crypto.getRandomValues(a);}while(a[0]>=252);return a[0]%6+1;}
  catch(e){return 1+Math.floor(Math.random()*6);}
}
/* Roll the dice that are not held. With a seed, values come from that turn's stream. */
function rollDice(turn,seed,turnNo){
  const t={roll:turn.roll,dice:turn.dice.slice(),held:turn.held.slice(),announced:turn.announced,drawn:turn.drawn||0};
  if(t.roll===0)t.held=t.held.map(()=>false);
  const st=seed?streamAt(seed,turnNo,t.drawn):null;
  t.dice=t.dice.map((v,i)=>{if(t.held[i])return v;t.drawn++;return st?st.next():cryptoDie();});
  t.roll++;
  return t;
}

const EPOCH=Date.UTC(2026,9,31);
function localDay(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dailyNumber(day){const [y,m,dd]=day.split('-').map(Number);return Math.round((Date.UTC(y,m-1,dd)-EPOCH)/864e5)+1;}

const API={ROWS,UPPER,LOWER,COLS,COL_ORDER,DEFAULT_RULES,PRESETS,DAILY_RULES,normRules,presetRules,sameRules,encodeRules,decodeRules,encodeObj,decodeObj,
  counts,scoreC,score,newSheet,colTotals,total,filled,boxes,full,nextBoxes,canWrite,legalList,hasLater,canRollAgain,canAnnounce,freshTurn,
  hashStr,streamAt,rollDice,cryptoDie,localDay,dailyNumber};
root.JambEngine=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
