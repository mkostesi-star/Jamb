/* Jamb visual effects: confetti, little bursts, floating scores, count-ups, turn banners and button presses.
   Everything is drawn in code; nothing runs when the phone asks for reduced motion. */
(function(root){
'use strict';
const reduce=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
const PALETTE=['#C8322B','#F6EEDC','#1F3FA6','#FFD27A','#2E7D4F','#FFFFFF'];
const GOLD=['#FFD27A','#F6EEDC','#FFE9B0','#E8B84A'];
let cv=null,cx=null,parts=[],raf=0,last=0,W=0,H=0;

function resize(){
  if(!cv)return;
  const dpr=Math.min(2,root.devicePixelRatio||1);W=root.innerWidth;H=root.innerHeight;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';
  cx=cv.getContext('2d');cx.setTransform(dpr,0,0,dpr,0,0);
}
function ensure(){
  if(cv)return true;
  try{
    cv=document.createElement('canvas');cv.className='fxcanvas';cv.setAttribute('aria-hidden','true');
    document.body.appendChild(cv);resize();root.addEventListener('resize',resize);
    return !!cx;
  }catch(e){cv=null;return false;}
}
function spawn(x,y,n,o){
  for(let i=0;i<n;i++){
    const a=o.angle!=null?o.angle+(Math.random()-.5)*o.spread:Math.random()*Math.PI*2;
    const sp=o.speed*(0.45+Math.random()*0.75);
    parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:o.gravity,drag:o.drag,
      w:o.size*(0.6+Math.random()*0.8),h:o.size*(0.4+Math.random()*0.6),r:Math.random()*6.28,vr:(Math.random()-.5)*14,
      c:o.colors[Math.floor(Math.random()*o.colors.length)],life:0,max:o.life*(0.7+Math.random()*0.6),round:Math.random()<(o.round||0)});
  }
  if(!raf){last=performance.now();raf=root.requestAnimationFrame(step);}
}
function step(now){
  const dt=Math.min(0.033,(now-last)/1000);last=now;
  cx.clearRect(0,0,W,H);
  parts=parts.filter(p=>{
    p.life+=dt;if(p.life>p.max||p.y>H+60)return false;
    const k=Math.pow(p.drag,dt*60);p.vx*=k;p.vy=p.vy*k+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;
    cx.save();cx.globalAlpha=Math.max(0,Math.min(1,(p.max-p.life)/0.35));cx.translate(p.x,p.y);cx.rotate(p.r);cx.fillStyle=p.c;
    if(p.round){cx.beginPath();cx.arc(0,0,p.h*0.6,0,6.283);cx.fill();}
    else cx.fillRect(-p.w/2,-p.h/2,p.w,Math.max(1,p.h*Math.abs(Math.cos(p.r*1.3))));
    cx.restore();return true;
  });
  if(parts.length)raf=root.requestAnimationFrame(step);else{raf=0;cx.clearRect(0,0,W,H);}
}
/* Paper confetti fired from both bottom corners. */
function confetti(big){
  if(reduce||!ensure())return;
  const n=big?150:80,o={spread:0.55,speed:big?1250:1050,gravity:1500,life:2.6,drag:0.988,size:9,colors:PALETTE};
  spawn(-10,H*0.92,n/2,Object.assign({},o,{angle:-Math.PI*0.36}));
  spawn(W+10,H*0.92,n/2,Object.assign({},o,{angle:-Math.PI*0.64}));
}
/* A small burst of sparks from an element, e.g. a score chip when a bonus lands. */
function burstAt(el,colors,n){
  if(reduce||!el||!ensure())return;
  const r=el.getBoundingClientRect();
  spawn(r.left+r.width/2,r.top+r.height/2,n||28,{speed:340,gravity:420,life:0.9,drag:0.93,size:6,round:0.5,colors:colors||GOLD});
}
/* A score that floats up from where it was written. */
function floatText(el,text,cls,color){
  if(reduce||!el)return;
  const r=el.getBoundingClientRect(),s=document.createElement('div');
  s.className='fxfloat'+(cls?' '+cls:'');s.textContent=text;s.setAttribute('aria-hidden','true');
  if(color)s.style.color=color;
  s.style.left=(r.left+r.width/2)+'px';s.style.top=(r.top+r.height/2)+'px';
  document.body.appendChild(s);setTimeout(()=>s.remove(),1100);
}
/* Counts a number up instead of jumping to it. */
function countUp(el,from,to,ms,fmt){
  if(!el)return;fmt=fmt||String;
  if(reduce||from===to){el.textContent=fmt(to);return;}
  const t0=performance.now();
  const tick=now=>{const k=Math.min(1,(now-t0)/(ms||500)),e=1-Math.pow(1-k,3);el.textContent=fmt(Math.round(from+(to-from)*e));if(k<1)root.requestAnimationFrame(tick);};
  el.textContent=fmt(from);root.requestAnimationFrame(tick);
}
/* Restarts a one-shot CSS animation class. */
function pulse(el,cls,ms){
  if(!el||reduce)return;
  el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
  clearTimeout(el['_fx_'+cls]);el['_fx_'+cls]=setTimeout(()=>el.classList.remove(cls),ms||500);
}
/* A name card that drops in when the turn passes to someone on this phone. */
let bannerEl=null,bannerT=0;
function banner(title,sub,color){
  if(bannerEl){bannerEl.remove();bannerEl=null;}
  clearTimeout(bannerT);
  const b=document.createElement('div');b.className='fxbanner';b.setAttribute('role','status');
  const s=document.createElement('span'),n=document.createElement('b');
  n.textContent=title;s.textContent=sub||'';if(color)b.style.setProperty('--bc',color);
  b.appendChild(n);b.appendChild(s);document.body.appendChild(b);bannerEl=b;
  bannerT=setTimeout(()=>{b.classList.add('out');bannerT=setTimeout(()=>{b.remove();if(bannerEl===b)bannerEl=null;},380);},1250);
}
/* Screen and tray entrances. */
function enter(el,cls){if(el&&!reduce)pulse(el,cls||'enter',420);}

/* Buttons sink a little under the finger and spring back, and stay visibly pressed for at least a beat. */
let pressed=null;
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest&&e.target.closest('button');
  if(!b||b.disabled)return;
  if(pressed&&pressed!==b)pressed.classList.remove('pressing');
  pressed=b;b._pt=performance.now();b.classList.add('pressing');
},{passive:true,capture:true});
function release(){
  const b=pressed;pressed=null;if(!b)return;
  const left=Math.max(0,110-(performance.now()-(b._pt||0)));
  setTimeout(()=>b.classList.remove('pressing'),left);
}
document.addEventListener('pointerup',release,{passive:true,capture:true});
document.addEventListener('pointercancel',release,{passive:true,capture:true});

root.JambFX={confetti,burstAt,floatText,countUp,pulse,banner,enter,reduce};
})(typeof self!=='undefined'?self:this);
