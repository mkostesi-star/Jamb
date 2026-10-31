/* Jamb sounds, café ambience, vibration and shake-to-roll.
   Every sound is synthesized, so there are no audio files to license or download. */
(function(root){
'use strict';
let ctx=null,master=null,NB=null,BB=null;
const opt={sound:true,ambience:false,haptics:true};
function ac(){
  if(!ctx){
    const C=root.AudioContext||root.webkitAudioContext;if(!C)return null;
    try{ctx=new C();}catch(e){return null;}
    master=ctx.createGain();master.gain.value=0.9;master.connect(ctx.destination);
  }
  if(ctx.state==='suspended'){try{ctx.resume();}catch(e){}}
  return ctx;
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
/* Dice landing on a wooden table. */
function land(n){
  haptic(18);
  if(!ready())return;
  const t0=ctx.currentTime+0.02;
  for(let i=0;i<(n||5);i++){
    const t=t0+i*rnd(0.035,0.085);
    burst(t,{freq:rnd(850,1500),q:2.5,dur:0.06,gain:rnd(0.35,0.6)});
    ping(t,rnd(140,210),0.08,0.22);
    burst(t+rnd(0.06,0.11),{freq:rnd(1100,1800),q:3,dur:0.035,gain:0.15});
  }
}
function hold(){haptic(8);if(!ready())return;burst(ctx.currentTime,{freq:1900,q:2,dur:0.02,gain:0.22});}
function tap(){if(!ready())return;burst(ctx.currentTime,{freq:2600,q:1.5,dur:0.015,gain:0.12});}
/* A ballpoint pen writing a number. */
function write(){
  haptic(10);
  if(!ready())return;
  const t0=ctx.currentTime;
  for(let i=0;i<4;i++){
    const t=t0+i*rnd(0.07,0.11);
    burst(t,{freq:rnd(2800,4200),q:0.9,dur:rnd(0.06,0.1),gain:rnd(0.05,0.09),att:0.02});
  }
}
/* Crumpling paper for a zero. */
function zero(){
  haptic([20,30,20]);
  if(!ready())return;
  const t0=ctx.currentTime;
  for(let i=0;i<26;i++)burst(t0+rnd(0,0.5),{freq:rnd(1200,6500),q:0.8,dur:0.025,gain:rnd(0.08,0.25)});
}
function bonus(){if(!ready())return;const t=ctx.currentTime;ping(t,880,0.5,0.12,'triangle');ping(t+0.09,1318.5,0.6,0.1,'triangle');}
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
function win(){if(!ready())return;const t=ctx.currentTime;[392,523.25,659.25,783.99].forEach((f,i)=>ping(t+i*0.12,f,0.8,0.1,'triangle'));}

/* Café ambience: a low murmur and the odd cup on a saucer. */
let amb=null,clinkT=0;
function startAmbience(){
  if(amb||!opt.sound||!opt.ambience||!ac())return;
  const s=ctx.createBufferSource();s.buffer=brown();s.loop=true;
  const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=520;
  const g=ctx.createGain();g.gain.value=0.0001;g.gain.linearRampToValueAtTime(0.09,ctx.currentTime+2);
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=0.13;lg.gain.value=0.025;lfo.connect(lg);lg.connect(g.gain);
  s.connect(f);f.connect(g);g.connect(master);s.start();lfo.start();
  amb={s,g,lfo};
  const clink=()=>{
    if(!amb)return;
    const t=ctx.currentTime,base=rnd(2400,3800);
    ping(t,base,0.35,0.018);ping(t,base*2.76,0.2,0.008);
    if(Math.random()<0.4)ping(t+0.12,base*1.03,0.25,0.012);
    clinkT=setTimeout(clink,rnd(5000,14000));
  };
  clinkT=setTimeout(clink,rnd(2000,6000));
}
function stopAmbience(){
  if(!amb)return;clearTimeout(clinkT);
  const a=amb;amb=null;
  try{a.g.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+0.6);setTimeout(()=>{try{a.s.stop();a.lfo.stop();}catch(e){}},700);}catch(e){}
}

function haptic(p){if(!opt.haptics)return;try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
function set(o){
  Object.assign(opt,o||{});
  if(opt.sound&&opt.ambience)startAmbience();else stopAmbience();
}
function unlock(){if(opt.sound)ac();if(opt.sound&&opt.ambience)startAmbience();}

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

root.JambAudio={set,unlock,rattleStart,rattleStop,shake,land,hold,tap,write,zero,bonus,jamb,win,haptic,
  motion:{supported:motionSupported,request:motionRequest,start:motionStart,stop:motionStop}};
})(typeof self!=='undefined'?self:this);
