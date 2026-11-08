/* Jamb sounds, café ambience, vibration and shake-to-roll.
   The game sounds are synthesized; the café ambience and the music are recordings (see audio/CREDITS.txt). */
(function(root){
'use strict';
let ctx=null,master=null,dry=null,NB=null,BB=null;
const opt={sound:true,ambience:false,haptics:true,music:false,musicLevel:0.17,musicMood:'main'};
function ac(){
  if(!ctx){
    const C=root.AudioContext||root.webkitAudioContext;if(!C)return null;
    try{ctx=new C();}catch(e){return null;}
    /* A gentle limiter and a little room reverb, so the synthesized sounds feel like they happen at a real table. */
    const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.attack.value=0.003;comp.release.value=0.2;
    comp.connect(ctx.destination);
    master=ctx.createGain();master.gain.value=0.9;master.connect(comp);
    /* recorded music skips the room reverb: it already has its own room */
    dry=ctx.createGain();dry.gain.value=0.9;dry.connect(comp);
    try{const rev=ctx.createConvolver();rev.buffer=room(1.2,3.4);const wet=ctx.createGain();wet.gain.value=0.14;master.connect(wet);wet.connect(rev);rev.connect(comp);}catch(e){}
  }
  if(ctx.state==='suspended'){try{ctx.resume();}catch(e){}}
  return ctx;
}
function room(sec,decay){
  const r=ctx.sampleRate,len=Math.floor(r*sec),b=ctx.createBuffer(2,len,r);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}
  return b;
}
function white(){
  if(NB)return NB;
  const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return NB=b;
}
function brown(){
  if(BB)return BB;
  const b=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),d=b.getChannelData(0);
  let last=0;for(let i=0;i<d.length;i++){last=(last+0.02*(Math.random()*2-1))/1.02;d[i]=last*3.2;}
  return BB=b;
}
const rnd=(a,b)=>a+Math.random()*(b-a);
function burst(t,o){
  const s=ctx.createBufferSource();s.buffer=white();
  const f=ctx.createBiquadFilter();f.type=o.type||'bandpass';f.frequency.value=o.freq;f.Q.value=o.q||1;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(o.gain,t+(o.att||0.002));g.gain.exponentialRampToValueAtTime(0.0001,t+o.dur);
  s.connect(f);f.connect(g);g.connect(o.out||master);
  s.start(t,Math.random()*1.5,o.dur+0.05);
}
function ping(t,freq,dur,gain,type,out){
  const o=ctx.createOscillator();o.type=type||'sine';o.frequency.value=freq;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gain,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(out||master);o.start(t);o.stop(t+dur+0.05);
}
/* A short pitched knock: wood, a die hitting the table, a button. */
function knock(t,f0,f1,dur,gain,out){
  const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(gain,t+0.003);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(out||master);o.start(t);o.stop(t+dur+0.05);
}
function ready(){return opt.sound&&ac();}

/* Dice rattling in a drinking glass: bright clicks with a little glass ring. */
let shakeTimer=0;
function rattleBurst(len){
  const t0=ctx.currentTime;let t=0;
  while(t<len){
    burst(t0+t,{freq:rnd(2400,4600),q:5,dur:0.022,gain:rnd(0.12,0.3)});
    if(Math.random()<0.45)ping(t0+t,rnd(2900,5200),0.06,0.025);
    t+=rnd(0.025,0.07);
  }
}
function rattleStart(){
  if(!ready())return;
  rattleStop();rattleBurst(0.25);
  shakeTimer=setInterval(()=>{if(ready())rattleBurst(0.25);},230);
  haptic([12,40,12,40,12]);
}
function rattleStop(){if(shakeTimer){clearInterval(shakeTimer);shakeTimer=0;}}
function shake(ms){if(!ready())return;rattleBurst((ms||450)/1000);}
/* Dice landing on a wooden table: a body thud, a hard click, then a smaller bounce. One die every `step` ms, matching the screen. */
function land(n,step){
  haptic(18);
  if(!ready())return;
  const t0=ctx.currentTime+0.015,st=(step||55)/1000;
  for(let i=0;i<(n||5);i++){
    const t=t0+i*st+rnd(-0.006,0.006);
    knock(t,rnd(190,240),rnd(85,110),0.09,rnd(0.28,0.4));
    burst(t,{freq:rnd(900,1600),q:2.5,dur:0.05,gain:rnd(0.3,0.5)});
    const b=t+rnd(0.07,0.1);
    knock(b,rnd(220,260),120,0.05,0.1);
    burst(b,{freq:rnd(1300,2000),q:3,dur:0.03,gain:0.12});
    if(Math.random()<0.35)burst(b+rnd(0.04,0.07),{freq:rnd(2200,3200),q:4,dur:0.02,gain:0.07});
  }
}
/* A soft wooden tock for buttons. */
function press(){
  haptic(6);
  if(!ready())return;
  const t=ctx.currentTime;
  knock(t,rnd(620,700),380,0.06,0.11);
  burst(t,{freq:1800,q:1.4,dur:0.012,gain:0.05});
}
/* Paper sliding across the table when a sheet opens or closes. */
function swish(out){
  if(!ready())return;
  const t=ctx.currentTime,s=ctx.createBufferSource();s.buffer=white();
  const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=0.8;
  f.frequency.setValueAtTime(out?2600:900,t);f.frequency.exponentialRampToValueAtTime(out?900:2600,t+0.2);
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(out?0.035:0.05,t+0.06);g.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
  s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random(),0.3);
}
/* Two soft marimba notes when the turn comes to you. */
function turn(){
  if(!ready())return;
  const t=ctx.currentTime;
  [[659.25,0],[987.77,0.11]].forEach(([fq,d])=>{ping(t+d,fq,0.45,0.07);ping(t+d,fq*4,0.08,0.012);});
}
/* a soft clock tick for the last seconds of a turn */
function tick(){if(!ready())return;const t=ctx.currentTime;knock(t,1500,1100,0.03,0.05);}
function hold(){haptic(8);if(!ready())return;burst(ctx.currentTime,{freq:1900,q:2,dur:0.02,gain:0.22});}
function tap(){if(!ready())return;burst(ctx.currentTime,{freq:2600,q:1.5,dur:0.015,gain:0.12});}
/* A ballpoint pen writing a number. */
function write(){
  haptic(10);
  if(!ready())return;
  const t0=ctx.currentTime;
  let t=t0;
  for(let i=0;i<6;i++){
    const d=rnd(0.05,0.09);
    burst(t,{freq:rnd(2600,4400),q:0.9,dur:d,gain:rnd(0.05,0.09),att:0.015});
    t+=d+rnd(0.01,0.03);
  }
}
/* Crumpling paper for a zero. */
function zero(){
  haptic([20,30,20]);
  if(!ready())return;
  const t0=ctx.currentTime;
  for(let i=0;i<26;i++)burst(t0+rnd(0,0.5),{freq:rnd(1200,6500),q:0.8,dur:0.025,gain:rnd(0.08,0.25)});
}
function bonus(){if(!ready())return;const t=ctx.currentTime;[880,1108.73,1318.5,1760].forEach((f,i)=>ping(t+i*0.07,f,0.55,0.09,'triangle'));}
/* A small fanfare and a café cheer for a Jamb. */
function jamb(){
  haptic([30,40,30,40,60]);
  if(!ready())return;
  const t=ctx.currentTime;
  [523.25,659.25,783.99,1046.5].forEach((f,i)=>ping(t+i*0.09,f,0.6,0.11,'triangle'));
  const s=ctx.createBufferSource();s.buffer=white();
  const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.6;
  const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.12,t+0.35);g.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
  s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+1.7);
}
function win(){
  if(!ready())return;const t=ctx.currentTime;
  [392,523.25,659.25,783.99].forEach((f,i)=>ping(t+i*0.12,f,0.8,0.1,'triangle'));
  [523.25,659.25,783.99,1046.5].forEach(f=>ping(t+0.55,f,1.4,0.05,'triangle'));
  for(let i=0;i<40;i++)burst(t+0.5+rnd(0,1.1),{freq:rnd(1500,4000),q:1.2,dur:0.02,gain:rnd(0.02,0.06)});
}

/* Café sounds: a real recording (audio/cafe.mp3, looped) plus the odd cup on a saucer, so the loop never sounds the same twice.
   The file is a 27.4 s crossfaded loop with 0.1 s of extra audio at each end, so any encoder padding sits outside the loop
   points. Each session starts at a random point in it. Recording: "Bustling cafe ambience" (freesound_community, Pixabay
   Content License: free to use in the app, no credit required). */
const AMB_PAD=0.1,AMB_LOOP=27.436,AMB_GAIN=0.16;
let amb=null,clinkT=0,ambBuf=null,ambTried=false;
function loadAmb(cb){
  if(ambBuf||ambTried){cb();return;}
  ambTried=true;
  try{fetch('audio/cafe.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(a=>new Promise((res,rej)=>ctx.decodeAudioData(a,res,rej))).then(bf=>{ambBuf=bf;cb();}).catch(()=>cb());}catch(e){cb();}
}
function startAmbience(){
  if(amb||!opt.sound||!opt.ambience||!ac())return;
  amb={};
  loadAmb(()=>{
    if(!amb)return;
    if(ambBuf){
      const s=ctx.createBufferSource();s.buffer=ambBuf;s.loop=true;
      const len=Math.min(AMB_LOOP,ambBuf.duration-2*AMB_PAD);
      if(len>5){s.loopStart=AMB_PAD;s.loopEnd=AMB_PAD+len;}
      const g=ctx.createGain(),now=ctx.currentTime;g.gain.setValueAtTime(0.0001,now);g.gain.linearRampToValueAtTime(AMB_GAIN,now+2.5);
      s.connect(g);g.connect(master);s.start(now,len>5?AMB_PAD+Math.random()*len:0);amb.s=s;amb.g=g;
    }
    const clink=()=>{
      if(!amb)return;
      const t=ctx.currentTime,base=rnd(2400,3800);
      ping(t,base,0.35,0.018);ping(t,base*2.76,0.2,0.008);
      if(Math.random()<0.4)ping(t+0.12,base*1.03,0.25,0.012);
      clinkT=setTimeout(clink,rnd(6000,15000));
    };
    clinkT=setTimeout(clink,rnd(2000,6000));
  });
}
function stopAmbience(){
  if(!amb)return;clearTimeout(clinkT);
  const a=amb;amb=null;
  if(a.g){try{a.g.gain.cancelScheduledValues(ctx.currentTime);a.g.gain.setValueAtTime(a.g.gain.value,ctx.currentTime);a.g.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+0.6);setTimeout(()=>{try{a.s.stop();}catch(e){}},700);}catch(e){}}
}
/* The music in music.js, quieter during play than on the menus. */
function syncMusic(){
  const M=root.JambMusic;if(!M)return;
  if(M.setMood)M.setMood(opt.musicMood);
  if(opt.sound&&opt.music&&ctx&&ctx.state==='running'){M.start(ctx,master,dry);M.setLevel(opt.musicLevel);}
  else M.stop();
}

function haptic(p){if(!opt.haptics)return;try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
function set(o){
  Object.assign(opt,o||{});
  if(opt.sound&&opt.ambience)startAmbience();else stopAmbience();
  syncMusic();
}
function unlock(){
  if(!opt.sound)return;
  const c=ac();if(!c)return;
  if(c.state!=='running'){try{c.resume().then(()=>{if(opt.ambience)startAmbience();syncMusic();});}catch(e){}}
  else{if(opt.ambience)startAmbience();syncMusic();}
}
/* when the app goes to the background: silence, and pick up again on return */
function sleep(){stopAmbience();const M=root.JambMusic;if(M)M.stop();}

/* Shake to roll: a burst of strong movement starts the rattle, a pause throws the dice. */
const motion={on:false,shaking:false,last:0,prev:null,onStart:null,onEnd:null,timer:0,handler:null};
function motionSupported(){return typeof root.DeviceMotionEvent!=='undefined';}
async function motionRequest(){
  if(!motionSupported())return false;
  if(typeof DeviceMotionEvent.requestPermission==='function'){
    try{return (await DeviceMotionEvent.requestPermission())==='granted';}catch(e){return false;}
  }
  return true;
}
function motionStart(onStart,onEnd){
  motionStop();
  if(!motionSupported())return;
  motion.onStart=onStart;motion.onEnd=onEnd;motion.on=true;
  motion.handler=e=>{
    const a=e.accelerationIncludingGravity||e.acceleration;if(!a||a.x===null)return;
    const p=motion.prev;motion.prev={x:a.x,y:a.y,z:a.z};
    if(!p)return;
    const d=Math.abs(a.x-p.x)+Math.abs(a.y-p.y)+Math.abs(a.z-p.z);
    const now=Date.now();
    if(d>16){
      motion.last=now;
      if(!motion.shaking){motion.shaking=true;if(motion.onStart)motion.onStart();}
      clearTimeout(motion.timer);
      motion.timer=setTimeout(()=>{if(motion.shaking&&Date.now()-motion.last>=400){motion.shaking=false;if(motion.onEnd)motion.onEnd();}},450);
    }
  };
  root.addEventListener('devicemotion',motion.handler);
}
function motionStop(){
  if(motion.handler)root.removeEventListener('devicemotion',motion.handler);
  clearTimeout(motion.timer);motion.handler=null;motion.on=false;motion.shaking=false;motion.prev=null;
}

root.JambAudio={set,unlock,sleep,tick,rattleStart,rattleStop,shake,land,hold,tap,press,swish,turn,write,zero,bonus,jamb,win,haptic,
  motion:{supported:motionSupported,request:motionRequest,start:motionStart,stop:motionStop}};
})(typeof self!=='undefined'?self:this);
