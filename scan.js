/* Reads real dice from the camera (beta).
   Finds light, roughly square dice faces, then counts the dark round pips inside each one.
   Works best with white dice with dark pips on a darker, even surface. */
(function(root){
'use strict';
let stream=null;
async function open(video){
  close();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('nocamera');
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false});
  video.srcObject=stream;video.setAttribute('playsinline','');video.muted=true;
  await video.play();
}
function close(){if(stream){stream.getTracks().forEach(t=>{try{t.stop();}catch(e){}});stream=null;}}
function capture(video,canvas,maxW){
  maxW=maxW||640;
  const vw=video.videoWidth||640,vh=video.videoHeight||480,s=Math.min(1,maxW/vw);
  canvas.width=Math.round(vw*s);canvas.height=Math.round(vh*s);
  const c=canvas.getContext('2d');c.drawImage(video,0,0,canvas.width,canvas.height);
  return c.getImageData(0,0,canvas.width,canvas.height);
}

function gray(img){
  const {data,width,height}=img,g=new Uint8Array(width*height);
  for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(data[j]*299+data[j+1]*587+data[j+2]*114)/1000|0;
  return g;
}
function otsu(g,from,to){
  const h=new Array(256).fill(0);let n=0;
  for(let i=from||0;i<(to||g.length);i++){h[g[i]]++;n++;}
  let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];
  let sb=0,wb=0,best=0,t=128;
  for(let i=0;i<256;i++){
    wb+=h[i];if(!wb)continue;const wf=n-wb;if(!wf)break;
    sb+=i*h[i];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)*(mb-mf);
    if(v>best){best=v;t=i;}
  }
  return t;
}
/* Connected components on a mask; returns components with pixel lists' bounding boxes and areas. */
function components(mask,w,h,keep){
  const lab=new Int32Array(w*h),out=[],stack=new Int32Array(w*h);
  let id=0;
  for(let p=0;p<w*h;p++){
    if(!mask[p]||lab[p])continue;
    id++;let sp=0;stack[sp++]=p;lab[p]=id;
    let area=0,x0=w,y0=h,x1=0,y1=0,touch=false;
    while(sp){
      const q=stack[--sp],x=q%w,y=(q-x)/w;area++;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      if(x===0||y===0||x===w-1||y===h-1)touch=true;
      if(x>0){const r=q-1;if(mask[r]&&!lab[r]){lab[r]=id;stack[sp++]=r;}}
      if(x<w-1){const r=q+1;if(mask[r]&&!lab[r]){lab[r]=id;stack[sp++]=r;}}
      if(y>0){const r=q-w;if(mask[r]&&!lab[r]){lab[r]=id;stack[sp++]=r;}}
      if(y<h-1){const r=q+w;if(mask[r]&&!lab[r]){lab[r]=id;stack[sp++]=r;}}
    }
    const c={id,area,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,touch};
    if(!keep||keep(c))out.push(c);
  }
  return{lab,list:out};
}
function findDice(g,w,h,invert){
  const T=otsu(g),mask=new Uint8Array(w*h);
  for(let i=0;i<g.length;i++)mask[i]=invert?(g[i]<T?1:0):(g[i]>T?1:0);
  const total=w*h;
  const {lab,list}=components(mask,w,h,c=>{
    const ar=c.w/c.h,fill=c.area/(c.w*c.h);
    return c.area>total*0.0015&&c.area<total*0.3&&ar>0.55&&ar<1.8&&fill>0.45&&!c.touch;
  });
  const dice=[];
  for(const d of list){
    /* Pips: dark pixels inside the die's box that are not part of the die, not touching the box edge. */
    let s=0,n=0;
    for(let y=d.y;y<d.y+d.h;y++)for(let x=d.x;x<d.x+d.w;x++){const p=y*w+x;if(lab[p]===d.id){s+=g[p];n++;}}
    const faceMean=s/Math.max(1,n);
    const bw=d.w,bh=d.h,sub=new Uint8Array(bw*bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
      const p=(d.y+y)*w+(d.x+x),v=g[p];
      const dark=invert?v>faceMean+(255-faceMean)*0.45:v<faceMean*0.62;
      sub[y*bw+x]=lab[p]!==d.id&&dark?1:0;
    }
    const dieArea=bw*bh;
    const pips=components(sub,bw,bh,c=>{
      const ar=c.w/c.h;
      return !c.touch&&c.area>dieArea*0.003&&c.area<dieArea*0.08&&ar>0.45&&ar<2.2&&c.area/(c.w*c.h)>0.4;
    }).list;
    if(pips.length>=1&&pips.length<=6)dice.push({x:d.x,y:d.y,w:d.w,h:d.h,v:pips.length});
  }
  return dice;
}
function detect(img){
  const g=gray(img),w=img.width,h=img.height;
  let a=findDice(g,w,h,false),b=findDice(g,w,h,true);
  let dice=b.length>a.length?b:a;
  dice.sort((p,q)=>Math.abs(p.y-q.y)>Math.max(p.h,q.h)*0.6?p.y-q.y:p.x-q.x);
  return{dice,values:dice.map(d=>d.v),width:w,height:h};
}
root.JambScan={open,close,capture,detect,supported:()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)};
})(typeof self!=='undefined'?self:this);
