/* "Table by the window", an original café waltz for Jamb (3/4, D major, 32 bars, about 50 seconds, loops).
   Written for this game and synthesized in the browser: plucked strings use the Karplus-Strong method,
   so there are no recordings or samples and nothing to license. */
(function(root){
'use strict';
let ctx=null,out=null,dest=null,on=false,level=0.17,timer=0,nextBar=0,barIdx=0,cache={};
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
  if(!on||!ctx)return;
  while(nextBar<ctx.currentTime+0.6){scheduleBar(barIdx,nextBar);nextBar+=BAR;barIdx=(barIdx+1)%PROG.length;}
}
function start(audioCtx,destination){
  ctx=audioCtx;dest=destination;
  if(!out){out=ctx.createGain();out.gain.value=0.0001;out.connect(dest);}
  if(on)return;on=true;
  out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setValueAtTime(0.0001,ctx.currentTime);out.gain.linearRampToValueAtTime(level,ctx.currentTime+1.5);
  nextBar=ctx.currentTime+0.15;barIdx=0;
  clearInterval(timer);timer=setInterval(tick,90);tick();
}
function stop(){
  if(!on)return;on=false;clearInterval(timer);
  if(out&&ctx){out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setValueAtTime(out.gain.value,ctx.currentTime);out.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+0.6);}
}
/* quieter while a game is being played than on the menus */
function setLevel(v){level=v;if(on&&out&&ctx){out.gain.cancelScheduledValues(ctx.currentTime);out.gain.setValueAtTime(out.gain.value,ctx.currentTime);out.gain.linearRampToValueAtTime(v,ctx.currentTime+0.8);}}
/* render the whole loop into an offline context (used to preview and check the mix) */
function renderTo(off){const prev=[ctx,out];ctx=off;cache={};out=off.createGain();out.gain.value=level;out.connect(off.destination);for(let i=0;i<PROG.length;i++)scheduleBar(i,0.05+i*BAR);[ctx,out]=prev;cache={};return PROG.length*BAR+0.05;}
function _note(off,inst,name){const prev=[ctx,out];ctx=off;cache={};out=off.destination;play(inst,name,0.01,0.8,0.9);[ctx,out]=prev;cache={};}
root.JambMusic={start,stop,setLevel,renderTo,_note,loopSeconds:PROG.length*BAR,get playing(){return on;}};
})(typeof self!=='undefined'?self:this);
