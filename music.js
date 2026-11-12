/* Jamb music.
   Recorded café and Balkan tracks from Pixabay Music (credits in audio/CREDITS.txt), played one at a time in a
   shuffled order, with a short pause between songs. The Daily Jamb opens with its own theme ("French Morning Café").
   "Table by the window", the original café waltz synthesized below, is the fallback when the tracks can't load
   (for example offline before they were ever downloaded). */
(function(root){
'use strict';
let ctx=null,out=null,on=false,wOn=false,level=0.17,timer=0,nextBar=0,barIdx=0,cache={};
const BPM=112,BEAT=60/BPM,BAR=BEAT*3;
const N={};// note name -> midi
['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].forEach((n,i)=>{for(let o=1;o<7;o++)N[n+o]=12*(o+1)+i;});
const hz=m=>440*Math.pow(2,(m-69)/12);

/* chords per bar: root, then the triad tones used by the guitar */
const CH={D:['D2',['D3','F#3','A3']],Bm:['B1',['B2','D3','F#3']],Em:['E2',['E3','G3','B3']],A:['A1',['A2','C#3','E3']],G:['G1',['G2','B2','D3']],A7:['A1',['A2','C#3','G3']]};
const PROG=['D','D','Bm','Bm','Em','A','D','A',  'D','D','Bm','Bm','G','A7','D','D',
            'G','G','D','D','Em','A','D','D',     'D','D','Bm','Bm','G','A7','D','D'];
/* melody: [note, beats] per bar; '-' is a rest; long notes get mandolin tremolo */
const A1=[[['F#4',1],['A4',1],['D5',1]],[['C#5',2],['B4',1]],[['B4',1],['D5',1],['F#5',1]],[['E5',3]],
          [['G4',1],['B4',1],['E5',1]],[['D5',1],['C#5',1],['A4',1]],[['F#4',1],['A4',1],['D5',1]],[['C#5',2],['E5',1]]];
const A2=[[['F#4',1],['A4',1],['D5',1]],[['E5',2],['D5',1]],[['B4',1],['D5',1],['F#5',1]],[['A5',2],['G5',1]],
          [['B4',1],['D5',1],['G5',1]],[['F#5',1],['E5',1],['C#5',1]],[['D5',3]],[['-',1],['A4',1],['B4',1]]];
const B1=[[['D5',1],['B4',1],['G4',1]],[['B4',2],['D5',1]],[['A4',1],['F#4',1],['D4',1]],[['F#4',2],['A4',1]],
          [['G4',1],['B4',1],['E5',1]],[['C#5',1],['E5',1],['A5',1]],[['F#5',2],['E5',1]],[['D5',3]]];
const MEL=[...A1,...A2,...B1,...A2];

/* Karplus-Strong pluck, rendered once per pitch and instrument */
function pluck(inst,m){
  const k=inst+m;if(cache[k])return cache[k];
  const sr=ctx.sampleRate,f=hz(m),len=Math.floor(sr*(inst==='bass'?1.6:inst==='gtr'?1.3:1.1));
  const b=ctx.createBuffer(1,len,sr),d=b.getChannelData(0),P=Math.max(2,Math.round(sr/f-0.5));
  const decay=inst==='bass'?0.996:inst==='gtr'?0.993:0.9955,bright=inst==='man'?0.62:inst==='gtr'?0.5:0.5;
  let last=0;
  for(let i=0;i<P;i++){const r=Math.random()*2-1;last=inst==='man'?r:last*0.55+r*0.45;d[i]=last;}
  for(let i=P;i<len;i++){const a=d[i-P],c=i-P-1>=0?d[i-P-1]:0;d[i]=decay*(bright*a+(1-bright)*c);}
  let peak=0;for(let i=0;i<len;i++)peak=Math.max(peak,Math.abs(d[i]));
  if(peak>0)for(let i=0;i<len;i++)d[i]/=peak;
  /* the two-point average adds a fraction of a sample of delay, so the loop rings at sr/(P+1-bright); playbackRate tunes it exactly */
  return cache[k]={b,rate:f/(sr/(P+(1-bright)))};
}
function play(inst,note,t,gain,dur){
  const m=N[note];if(m==null)return;
  const pk=pluck(inst,m),s=ctx.createBufferSource();s.buffer=pk.b;s.playbackRate.value=pk.rate;
  const g=ctx.createGain();g.gain.setValueAtTime(gain,t);
  if(dur){g.gain.setValueAtTime(gain,t+dur);g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);}
  const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(pan){pan.pan.value=inst==='man'?0.18:inst==='gtr'?-0.22:0;s.connect(g);g.connect(pan);pan.connect(out);}else{s.connect(g);g.connect(out);}
  s.start(t);s.stop(t+(dur?dur+0.2:2));
}
function shaker(t,gain){
  const len=Math.floor(ctx.sampleRate*0.05),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);
  const s=ctx.createBufferSource();s.buffer=b;const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=6000;
  const g=ctx.createGain();g.gain.value=gain;s.connect(f);f.connect(g);g.connect(out);s.start(t);
}
function scheduleBar(i,t0){
  const [root,tri]=CH[PROG[i%PROG.length]];
  const fifth=tri[2];
  play('bass',root,t0,0.55,BEAT*1.6);
  play('bass',fifth.replace(/\d$/,o=>String(Math.max(1,+o-1))),t0+BEAT*2,0.32,BEAT*0.9);
  [1,2].forEach(b=>{tri.forEach((n,j)=>play('gtr',n,t0+BEAT*b+j*0.012,b===1?0.2:0.16,BEAT*0.55));shaker(t0+BEAT*b,0.025);});
  shaker(t0,0.035);
  let t=t0;
  MEL[i%MEL.length].forEach(([n,beats])=>{
    if(n!=='-'){
      if(beats>=2){const step=BEAT/4;for(let k=0;k<beats*4;k++)play('man',n,t+k*step,k?0.2:0.34,step*0.9);}
      else play('man',n,t,0.32,beats*BEAT*0.95);
    }
    t+=beats*BEAT;
  });
}
function tick(){
  if(!wOn||!ctx)return;
  while(nextBar<ctx.currentTime+0.6){scheduleBar(barIdx,nextBar);nextBar+=BAR;barIdx=(barIdx+1)%PROG.length;}
}
function ramp(g,v,sec){try{g.gain.cancelScheduledValues(ctx.currentTime);g.gain.setValueAtTime(g.gain.value,ctx.currentTime);g.gain.linearRampToValueAtTime(v,ctx.currentTime+sec);}catch(e){}}
function wStart(){
  if(wOn)return;wOn=true;ramp(out,level,1.5);
  nextBar=ctx.currentTime+0.15;barIdx=0;clearInterval(timer);timer=setInterval(tick,90);tick();
}
function wStop(){if(!wOn)return;wOn=false;clearInterval(timer);ramp(out,0.0001,0.6);}

/* ---------- recorded tracks ---------- */
/* All tracks are mastered to the same loudness (-16 LUFS); TRIM puts them at the waltz's level, so the
   balance with the café sounds stays as it was. Only the playing track is decoded; the next one is
   downloaded (not decoded) while it plays, which keeps memory low on phones. */
const MAIN=['cafe-cafe','cafe-aurec','balkan-joy','cafe-lofi','battonya'],DAILY='morning-cafe',TRIM=0.86,GAP=1.6;
let tOut=null,raw={},cur=null,order=[],pos=0,last=null,mood='main',dailyDone=false,fails=0,gen=0,resumeAt=null,gapT=0,upcoming=null,useWaltz=false;
const url=t=>'audio/music/'+t+'.mp3';
function fetchRaw(t){
  if(!raw[t])raw[t]=fetch(url(t)).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.arrayBuffer();}).catch(e=>{delete raw[t];throw e;});
  return raw[t];
}
function decode(t){return fetchRaw(t).then(a=>{delete raw[t];return new Promise((res,rej)=>ctx.decodeAudioData(a,res,rej));});}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pick(){
  if(mood==='daily'&&!dailyDone){dailyDone=true;return DAILY;}
  if(pos>=order.length){order=shuffle(MAIN.slice());if(order[0]===last&&order.length>1)order.push(order.shift());pos=0;}
  return order[pos++];
}
function nextName(){if(!upcoming)upcoming=pick();return upcoming;}
/* Recordings play through an <audio> element: the browser streams and decodes them on its own, away from the game's
   sound effects, so a busy moment in the game cannot make the music crackle and a whole song never sits decoded in
   memory. Where the element's volume cannot be set (iPhone and iPad) it is routed through the game's audio instead.
   If the element cannot play, the old way (decode the whole file) takes over. */
let el=null,elGain=null,volLocked=false,useBuf=false,fadeF=0,fadeT=0;
function elSetup(){
  if(el)return true;
  if(typeof Audio!=='function')return false;
  try{
    el=new Audio();el.preload='auto';
    el.volume=0.5;volLocked=el.volume!==0.5;
    if(volLocked){const src=ctx.createMediaElementSource(el);elGain=ctx.createGain();elGain.gain.value=0.0001;src.connect(elGain);elGain.connect(tOut);}
  }catch(e){el=null;return false;}
  return true;
}
function elApply(){
  if(!el)return;
  if(volLocked){try{elGain.gain.setTargetAtTime(Math.max(0.0001,fadeF),ctx.currentTime,0.03);}catch(e){}}
  else el.volume=Math.max(0,Math.min(1,fadeF*level*TRIM*0.9));
}
function elFade(to,sec,done){
  clearInterval(fadeT);
  const from=fadeF,t0=Date.now(),ms=Math.max(1,sec*1000);
  fadeT=setInterval(()=>{
    const k=Math.min(1,(Date.now()-t0)/ms);fadeF=from+(to-from)*k;elApply();
    if(k>=1){clearInterval(fadeT);fadeT=0;if(done)done();}
  },40);
}
function playTrack(t,offset){
  const my=++gen;if(upcoming===t)upcoming=null;
  if(useBuf||!elSetup()){playBuf(t,offset,my);return;}
  clearInterval(fadeT);fadeF=0;elApply();
  const fail=()=>{
    if(my!==gen||!on)return;
    try{el.pause();}catch(e){}
    useBuf=true;playBuf(t,offset,my);
  };
  el.onended=()=>{
    if(!cur||cur.my!==my)return;
    cur=null;last=t;
    if(on&&my===gen){clearTimeout(gapT);gapT=setTimeout(()=>{if(on&&my===gen)playTrack(nextName(),0);},GAP*1000);}
  };
  el.onerror=fail;
  try{
    el.src=url(t);
    if(offset){const seek=()=>{el.removeEventListener('loadedmetadata',seek);try{el.currentTime=Math.min(offset,Math.max(0,(el.duration||offset+9)-8));}catch(e){}};el.addEventListener('loadedmetadata',seek);}
    const p=el.play();
    const ok=()=>{if(my!==gen||!on){return;}fails=0;cur={t,el:true,my};elFade(1,offset?1.5:0.3);};
    if(p&&p.then)p.then(ok).catch(fail);else ok();
  }catch(e){fail();}
}
function playBuf(t,offset,my){
  decode(t).then(b=>{
    if(my!==gen||!on)return;
    fails=0;
    const n=ctx.createBufferSource();n.buffer=b;const g=ctx.createGain();n.connect(g);g.connect(tOut);
    const at=Math.min(offset||0,Math.max(0,b.duration-8)),t0=ctx.currentTime+0.05;
    g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(1,t0+(at?1.5:0.3));
    n.start(t0,at);cur={t,n,g,t0:t0-at};
    n.onended=()=>{
      if(!cur||cur.n!==n)return;
      cur=null;last=t;
      if(on&&my===gen){clearTimeout(gapT);gapT=setTimeout(()=>{if(on&&my===gen)playTrack(nextName(),0);},GAP*1000);}
    };
    setTimeout(()=>{if(on&&my===gen)fetchRaw(nextName()).catch(()=>{});},8000);
  }).catch(()=>{
    if(my!==gen||!on)return;
    if(++fails>=2){useWaltz=true;wStart();return;}
    playTrack(nextName(),0);
  });
}
function fadeCur(sec){
  if(!cur)return null;const c=cur;cur=null;
  if(c.el){
    let at=0;try{at=el.currentTime||0;}catch(e){}
    const g=gen;elFade(0,sec,()=>{if(!cur||!cur.el){try{if(gen===g||!on)el.pause();}catch(e){}}});
    return {t:c.t,at};
  }
  const at=Math.max(0,ctx.currentTime-c.t0);
  try{c.g.gain.cancelScheduledValues(ctx.currentTime);c.g.gain.setValueAtTime(c.g.gain.value,ctx.currentTime);c.g.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+sec);c.n.stop(ctx.currentTime+sec+0.05);}catch(e){}
  return {t:c.t,at};
}

/* wet: the shared bus with the table's room sound (the waltz uses it); dry: straight to the output (recordings) */
function start(audioCtx,wet,dry){
  ctx=audioCtx;
  if(!out){out=ctx.createGain();out.gain.value=0.0001;out.connect(wet);}
  if(!tOut){tOut=ctx.createGain();tOut.gain.value=level*TRIM;tOut.connect(dry||wet);}
  if(on)return;on=true;
  useWaltz=false;fails=0;
  if(typeof fetch!=='function'||!ctx.decodeAudioData){useWaltz=true;wStart();return;}
  const r=resumeAt;resumeAt=null;let t,at=0;
  if(mood==='daily'&&!dailyDone){t=pick();if(r&&r.t===DAILY)at=r.at;}
  else if(r&&(r.t!==DAILY||mood==='daily')){t=r.t;at=r.at;}
  else t=nextName();
  playTrack(t,at);
}
function stop(){
  if(!on)return;on=false;gen++;clearTimeout(gapT);
  const hidden=typeof document!=='undefined'&&document.hidden;
  const r=fadeCur(hidden?0.01:0.6);if(r)resumeAt=r;
  if(hidden&&el){clearInterval(fadeT);fadeT=0;fadeF=0;elApply();try{el.pause();}catch(e){}}   /* timers may freeze in the background: stop at once */
  wStop();
}
/* quieter while a game is being played than on the menus */
function setLevel(v){level=v;if(!ctx)return;if(out&&wOn)ramp(out,v,0.8);if(tOut)ramp(tOut,v*TRIM,0.8);if(el&&!volLocked&&!fadeT)elApply();}
/* 'daily' while a Daily Jamb is on screen: its theme comes in (unless already playing), then the usual mix follows */
function setMood(m){
  m=m==='daily'?'daily':'main';if(m===mood)return;mood=m;
  if(m==='daily'){
    dailyDone=false;upcoming=null;
    if(!on){if(resumeAt&&resumeAt.t!==DAILY)resumeAt=null;return;}
    if(useWaltz||(cur&&cur.t===DAILY)){dailyDone=true;return;}
    const my=++gen;clearTimeout(gapT);fadeCur(1.2);
    setTimeout(()=>{if(on&&gen===my)playTrack(nextName(),0);},1300);
  }else if(upcoming===DAILY)upcoming=null;
}
/* render the whole loop into an offline context (used to preview and check the mix) */
function renderTo(off){const prev=[ctx,out];ctx=off;cache={};out=off.createGain();out.gain.value=level;out.connect(off.destination);for(let i=0;i<PROG.length;i++)scheduleBar(i,0.05+i*BAR);[ctx,out]=prev;cache={};return PROG.length*BAR+0.05;}
function _note(off,inst,name){const prev=[ctx,out];ctx=off;cache={};out=off.destination;play(inst,name,0.01,0.8,0.9);[ctx,out]=prev;cache={};}
root.JambMusic={start,stop,setLevel,setMood,renderTo,_note,loopSeconds:PROG.length*BAR,get playing(){return on;},get track(){return cur?cur.t:(wOn?'waltz':null);},tracks:[DAILY,...MAIN]};
})(typeof self!=='undefined'?self:this);
