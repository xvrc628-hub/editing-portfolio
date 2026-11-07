(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};
var pad=function(n){return String(n).padStart(2,'0');};
var tcode=function(f){return '0:'+pad(Math.floor(f/1800))+':'+pad(Math.floor(f/30)%60)+':'+pad(f%30);};
var rd=function(n){return Math.round(n*100)/100;};
var fmt=function(n){return String(+n.toFixed(2));};
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function selectNode(n){try{var r=document.createRange();r.selectNodeContents(n);var s=getSelection();s.removeAllRanges();s.addRange(r);}catch(e){}}
function copyText(t){
  try{return navigator.clipboard.writeText(t).then(function(){return true;},function(){return false;});}
  catch(e){return Promise.resolve(false);}
}
function flash(btn,text){var old=btn.dataset.label||btn.textContent;btn.dataset.label=old;btn.textContent=text;clearTimeout(btn._t);btn._t=setTimeout(function(){btn.textContent=old;},1600);}

/* ================= scroll timeline ================= */
var topEl=$('#top'),playhead=$('#playhead'),tcEl=$('#tc');
var heads=['styles','presets','blog','feedback'].map(function(id){return document.getElementById(id);});
var dias=$$('.track .dia'),navLinks=$$('.nav a');
var marks=[.2,.4,.6,.8],maxScroll=1,ticking=false;
function update(){
  var p=clamp(scrollY/maxScroll,0,1),a=-1;
  playhead.style.left=(p*100)+'%';
  tcEl.textContent=tcode(Math.round(p*900));
  marks.forEach(function(m,i){if(p>=m-.002)a=i;});
  dias.forEach(function(d,i){d.classList.toggle('on',i<=a);});
  navLinks.forEach(function(l,i){if(i===a)l.setAttribute('aria-current','true');else l.removeAttribute('aria-current');});
}
function measure(){
  var hh=topEl.offsetHeight;
  document.documentElement.style.setProperty('--hh',hh+'px');
  maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  marks=heads.map(function(h){return clamp((h.getBoundingClientRect().top+scrollY-hh)/maxScroll,0,1);});
  for(var i=marks.length-2;i>=0;i--)marks[i]=Math.min(marks[i],marks[i+1]-.05);
  marks=marks.map(function(m){return Math.max(0,m);});
  marks.forEach(function(m,i){
    dias[i].style.left=(m*100)+'%';
    var k=$('.kf-time',heads[i]);if(k)k.textContent=tcode(Math.round(m*900));
  });
  update();
}
addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(function(){ticking=false;update();});}},{passive:true});
addEventListener('resize',measure);
addEventListener('load',measure);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
if(window.ResizeObserver){var mt;new ResizeObserver(function(){clearTimeout(mt);mt=setTimeout(measure,80);}).observe(document.body);}
measure();

/* ================= easing + stage ================= */
function bez(x1,y1,x2,y2){
  var cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
  var sx=function(t){return((ax*t+bx)*t+cx)*t;},sy=function(t){return((ay*t+by)*t+cy)*t;},dx=function(t){return(3*ax*t+2*bx)*t+cx;};
  return function(x){
    if(x<=0)return 0;if(x>=1)return 1;
    var t=x,i;
    for(i=0;i<8;i++){var e=sx(t)-x;if(Math.abs(e)<1e-5)break;var d=dx(t);if(Math.abs(d)<1e-6)break;t-=e/d;}
    if(!(t>=0&&t<=1)||Math.abs(sx(t)-x)>1e-4){
      var lo=0,hi=1;t=x;
      for(i=0;i<30;i++){var v=sx(t);if(Math.abs(v-x)<1e-5)break;if(v<x)lo=t;else hi=t;t=(lo+hi)/2;}
    }
    return sy(t);
  };
}
var curve={x1:.65,y1:0,x2:.35,y2:1},ease=bez(.65,0,.35,1);
var eases=[['Linear',0,0,1,1],['Ease in-out',.65,0,.35,1],['Ease out',.16,1,.3,1],['Overshoot',.34,1.56,.64,1],['Anticipate',.36,0,.66,-.4]];

var stage=$('#stage'),sctx=stage.getContext('2d');
var playBtn=$('#playBtn'),scrub=$('#scrub'),stageTc=$('#stageTc');
var playing=!reduce,scrubU=.55,t0=performance.now(),dirty=true,W=0,H=0,dpr=1,lastF=-1;
var MOVE=1800,CYCLE=2700,MOVE_FRAMES=54;
var cKey='#FFC247',cClip='#6F86FF',cLine='#283040',cMuted='#8E98A8';
playBtn.textContent=playing?'Pause':'Play';
function sizeStage(){
  dpr=Math.min(2,window.devicePixelRatio||1);
  W=stage.clientWidth;H=stage.clientHeight;
  stage.width=Math.max(1,Math.round(W*dpr));stage.height=Math.max(1,Math.round(H*dpr));
  dirty=true;
}
if(window.ResizeObserver)new ResizeObserver(sizeStage).observe(stage);else addEventListener('resize',sizeStage);
sizeStage();
function diamond(c,x,y,s,fill){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=fill;c.fillRect(-s/2,-s/2,s,s);c.restore();}
function drawStage(u){
  var c=sctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  var padL=34,padR=Math.min(78,W*.2),x0=padL,x1=W-padR,mid=H*.5,r=clamp(H*.1,8,14);
  c.strokeStyle=cLine;c.lineWidth=1;
  c.beginPath();c.moveTo(x0,mid);c.lineTo(x1,mid);c.stroke();
  var n=18;
  for(var i=0;i<=n;i++){var tx=x0+(x1-x0)*i/n,h=i%3===0?7:4;c.beginPath();c.moveTo(tx,mid+r+8);c.lineTo(tx,mid+r+8+h);c.stroke();}
  diamond(c,x0,mid,8,cKey);diamond(c,x1,mid,8,cKey);
  for(var g=8;g>=1;g--){
    var ug=u-g*.04;if(ug<0)continue;
    c.globalAlpha=.07+(9-g)/9*.27;
    c.fillStyle=cClip;c.beginPath();c.arc(x0+(x1-x0)*ease(ug),mid,r,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  var e=ease(u),bx=x0+(x1-x0)*e;
  c.fillStyle=cClip;c.beginPath();c.arc(bx,mid,r,0,Math.PI*2);c.fill();
  c.font='500 11px "JetBrains Mono",ui-monospace,monospace';c.fillStyle=cMuted;c.textAlign='center';
  c.fillText(e.toFixed(2),clamp(bx,22,W-22),mid-r-10);
  c.textAlign='left';
}
function setTc(u){var f=Math.round(u*MOVE_FRAMES);if(f!==lastF){lastF=f;stageTc.textContent=tcode(f);}}
function frame(now){
  if(playing){
    var u=clamp(((now-t0)%CYCLE)/MOVE,0,1);
    scrubU=u;drawStage(u);setTc(u);scrub.value=String(Math.round(u*1000));
  }else if(dirty){drawStage(scrubU);setTc(scrubU);scrub.value=String(Math.round(scrubU*1000));}
  dirty=false;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
playBtn.addEventListener('click',function(){
  playing=!playing;playBtn.textContent=playing?'Pause':'Play';
  if(playing)t0=performance.now()-scrubU*MOVE;else dirty=true;
});
scrub.addEventListener('input',function(){playing=false;playBtn.textContent='Play';scrubU=scrub.value/1000;dirty=true;});

/* ---- curve editor ---- */
var svg=$('#curve'),X=function(x){return 30+180*x;},Y=function(y){return 190-120*y;};
var ce={p1:$('#p1'),p2:$('#p2'),h1:$('#h1'),h2:$('#h2'),path:$('#cpath')};
var bezOut=$('#bezOut'),chipsBox=$('#easeChips'),chipEls=[];
eases.forEach(function(d,i){
  var b=el('button','chip',d[0]);b.type='button';b.setAttribute('aria-pressed','false');
  b.addEventListener('click',function(){curve={x1:d[1],y1:d[2],x2:d[3],y2:d[4]};drawCurve();});
  chipsBox.appendChild(b);chipEls.push(b);
});
function drawCurve(){
  var c=curve;
  ce.path.setAttribute('d','M'+X(0)+' '+Y(0)+' C'+X(c.x1)+' '+Y(c.y1)+' '+X(c.x2)+' '+Y(c.y2)+' '+X(1)+' '+Y(1));
  ce.h1.setAttribute('x1',X(0));ce.h1.setAttribute('y1',Y(0));ce.h1.setAttribute('x2',X(c.x1));ce.h1.setAttribute('y2',Y(c.y1));
  ce.h2.setAttribute('x1',X(1));ce.h2.setAttribute('y1',Y(1));ce.h2.setAttribute('x2',X(c.x2));ce.h2.setAttribute('y2',Y(c.y2));
  ce.p1.setAttribute('cx',X(c.x1));ce.p1.setAttribute('cy',Y(c.y1));
  ce.p2.setAttribute('cx',X(c.x2));ce.p2.setAttribute('cy',Y(c.y2));
  ce.p1.setAttribute('aria-valuetext','x '+fmt(c.x1)+', y '+fmt(c.y1));
  ce.p2.setAttribute('aria-valuetext','x '+fmt(c.x2)+', y '+fmt(c.y2));
  bezOut.textContent='cubic-bezier('+fmt(c.x1)+', '+fmt(c.y1)+', '+fmt(c.x2)+', '+fmt(c.y2)+')';
  ease=bez(c.x1,c.y1,c.x2,c.y2);
  eases.forEach(function(d,i){chipEls[i].setAttribute('aria-pressed',String(d[1]===c.x1&&d[2]===c.y1&&d[3]===c.x2&&d[4]===c.y2));});
  dirty=true;
}
function setPoint(i,x,y){
  x=clamp(rd(x),0,1);y=clamp(rd(y),-.5,1.5);
  if(i===0){curve.x1=x;curve.y1=y;}else{curve.x2=x;curve.y2=y;}
  drawCurve();
}
var drag=-1;
[ce.p1,ce.p2].forEach(function(p,i){
  p.addEventListener('pointerdown',function(e){drag=i;try{p.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();p.focus();});
  p.addEventListener('pointermove',function(e){
    if(drag!==i)return;
    var r=svg.getBoundingClientRect();
    var sx=(e.clientX-r.left)/r.width*240,sy=(e.clientY-r.top)/r.height*260;
    setPoint(i,(sx-30)/180,(190-sy)/120);
  });
  var end=function(){drag=-1;};
  p.addEventListener('pointerup',end);p.addEventListener('pointercancel',end);
  p.addEventListener('keydown',function(e){
    var s=e.shiftKey?.1:.02,c=i===0?[curve.x1,curve.y1]:[curve.x2,curve.y2],hit=true;
    if(e.key==='ArrowLeft')c[0]-=s;else if(e.key==='ArrowRight')c[0]+=s;
    else if(e.key==='ArrowUp')c[1]+=s;else if(e.key==='ArrowDown')c[1]-=s;else hit=false;
    if(hit){e.preventDefault();setPoint(i,c[0],c[1]);}
  });
});
$('#copyBez').addEventListener('click',function(){
  var b=this;
  copyText(bezOut.textContent).then(function(ok){if(ok)flash(b,'Copied');else{selectNode(bezOut);flash(b,'Press Ctrl+C');}});
});
drawCurve();

/* ================= styles ================= */
var art=$('#art'),ov=$('#ov'),scan=$('#scan'),grain=$('#grain'),vig=$('#vig'),title=$('#sceneTitle');
var grainSvg="<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
grain.style.backgroundImage='url("data:image/svg+xml,'+encodeURIComponent(grainSvg)+'")';
var sgn=function(n){return(n>=0?'+':'')+Math.round(n);};
var looks=[
  {name:'Original',note:'No grade applied',sw:'linear-gradient(135deg,#1a1446,#ff9a5c)',
   fx:function(){return{};},recipe:function(){return[['Grade','Off']];}},
  {name:'Teal & Orange',note:'Cool shadows, warm highlights',sw:'linear-gradient(135deg,#0fb5b5,#ff8a2a)',
   fx:function(t){return{filter:'contrast('+(1+.15*t)+') saturate('+(1+.25*t)+')',ovBg:'linear-gradient(180deg,#0fb5b5,#ff8a2a)',blend:'soft-light',ovOp:.9*t,vig:.25*t};},
   recipe:function(t){return[['Contrast',sgn(15*t)],['Saturation',sgn(25*t)],['Split tone',Math.round(90*t)+'%'],['Vignette',Math.round(25*t)+'%']];}},
  {name:'Duotone',note:'Two colors, one mood',sw:'linear-gradient(135deg,#2b1f8f,#ff5ca8)',
   fx:function(t){return{filter:'grayscale('+t+') contrast('+(1+.2*t)+')',ovBg:'linear-gradient(135deg,#2b1f8f,#ff5ca8)',blend:'color',ovOp:.9*t};},
   recipe:function(t){return[['Desaturate',Math.round(100*t)+'%'],['Contrast',sgn(20*t)],['Map',Math.round(90*t)+'%']];}},
  {name:'VHS',note:'Scanlines and color fringing',sw:'repeating-linear-gradient(0deg,#3a3f52 0 2px,#1a1d28 2px 4px)',
   fx:function(t){return{filter:'saturate('+(1+.3*t)+') contrast('+(1+.1*t)+') blur('+(.5*t)+'px)',scan:.8*t,aberr:2.5*t};},
   recipe:function(t){return[['Saturation',sgn(30*t)],['Blur',(.5*t).toFixed(1)+' px'],['Scanlines',Math.round(80*t)+'%'],['Chroma shift',(2.5*t).toFixed(1)+' px']];}},
  {name:'Film grain',note:'Texture and soft vignette',sw:'linear-gradient(135deg,#5b4a3a,#1c1713)',
   fx:function(t){return{filter:'contrast('+(1+.1*t)+') sepia('+(.2*t)+')',grain:.55*t,vig:.5*t};},
   recipe:function(t){return[['Grain',Math.round(55*t)+'%'],['Vignette',Math.round(50*t)+'%'],['Warmth',sgn(20*t)],['Contrast',sgn(10*t)]];}},
  {name:'Bleach bypass',note:'Low color, hard contrast',sw:'linear-gradient(135deg,#8a8f99,#2a2d33)',
   fx:function(t){return{filter:'grayscale('+(.45*t)+') contrast('+(1+.45*t)+') brightness('+(1-.06*t)+')',vig:.2*t};},
   recipe:function(t){return[['Saturation','-'+Math.round(45*t)],['Contrast',sgn(45*t)],['Exposure','-'+(.06*t*100).toFixed(0)+'%']];}}
];
var lookIdx=1,inten=$('#intensity'),intenOut=$('#intensityOut'),lookBtns=[],lookBox=$('#looks'),recipeEl=$('#recipe');
looks.forEach(function(L,i){
  var b=el('button','look');b.type='button';
  var sw=el('span','sw');sw.style.background=L.sw;
  var tx=el('span');tx.appendChild(el('b',null,L.name));tx.appendChild(el('small',null,L.note));
  b.appendChild(sw);b.appendChild(tx);
  b.addEventListener('click',function(){lookIdx=i;applyLook();});
  lookBox.appendChild(b);lookBtns.push(b);
});
function applyLook(){
  var L=looks[lookIdx],t=inten.value/100,f=L.fx(t);
  art.style.filter=f.filter||'none';
  ov.style.background=f.ovBg||'none';ov.style.mixBlendMode=f.blend||'normal';ov.style.opacity=f.ovOp||0;
  scan.style.opacity=f.scan||0;grain.style.opacity=f.grain||0;vig.style.opacity=f.vig||0;
  var a=f.aberr||0;
  title.style.textShadow=a?(-a+'px 0 rgba(255,60,90,.75), '+a+'px 0 rgba(60,220,255,.75)'):'none';
  lookBtns.forEach(function(b,i){b.setAttribute('aria-pressed',String(i===lookIdx));});
  inten.disabled=lookIdx===0;intenOut.textContent=inten.value+'%';
  recipeEl.replaceChildren();
  L.recipe(t).forEach(function(r){recipeEl.appendChild(el('dt',null,r[0]));recipeEl.appendChild(el('dd',null,r[1]));});
}
inten.addEventListener('input',applyLook);
applyLook();

/* ================= presets ================= */
var presets=[
  {name:'Pop In',cat:'Entrance',dur:450,ease:'cubic-bezier(.34, 1.56, .64, 1)',kf:[{transform:'scale(0)',opacity:0},{transform:'scale(1)',opacity:1}]},
  {name:'Slide Up',cat:'Entrance',dur:600,ease:'cubic-bezier(.16, 1, .3, 1)',kf:[{transform:'translateY(46px)',opacity:0},{transform:'translateY(0)',opacity:1}]},
  {name:'Wobble',cat:'Emphasis',dur:800,ease:'ease-in-out',kf:[{transform:'rotate(0)'},{transform:'rotate(-14deg)'},{transform:'rotate(10deg)'},{transform:'rotate(-6deg)'},{transform:'rotate(3deg)'},{transform:'rotate(0)'}]},
  {name:'Heartbeat',cat:'Emphasis',dur:700,ease:'ease-in-out',kf:[{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'},{transform:'scale(1.13)'},{transform:'scale(1)'}]},
  {name:'Shake',cat:'Emphasis',dur:500,ease:'linear',kf:[{transform:'translateX(0)'},{transform:'translateX(-12px)'},{transform:'translateX(12px)'},{transform:'translateX(-9px)'},{transform:'translateX(9px)'},{transform:'translateX(-4px)'},{transform:'translateX(0)'}]},
  {name:'Fade Down',cat:'Exit',dur:500,ease:'cubic-bezier(.7, 0, .84, 0)',kf:[{transform:'translateY(0)',opacity:1},{transform:'translateY(34px)',opacity:0}]},
  {name:'Whip Pan',cat:'Transition',dur:520,ease:'cubic-bezier(.65, 0, .35, 1)',kf:[{transform:'translateX(-190px)',filter:'blur(10px)',opacity:.4},{transform:'translateX(0)',filter:'blur(0px)',opacity:1}]},
  {name:'Spin Zoom',cat:'Transition',dur:700,ease:'cubic-bezier(.22, 1, .36, 1)',kf:[{transform:'rotate(-180deg) scale(0)',opacity:0},{transform:'rotate(0) scale(1)',opacity:1}]}
];
var cats=['All','Entrance','Emphasis','Exit','Transition'],cat='All';
var filtersBox=$('#filters'),grid=$('#presetGrid'),filterBtns=[];
cats.forEach(function(c){
  var b=el('button','chip',c);b.type='button';
  b.addEventListener('click',function(){cat=c;renderPresets();});
  filtersBox.appendChild(b);filterBtns.push(b);
});
function runPreset(node,p){
  if(reduce||!node.animate)return;
  var a=node.animate(p.kf,{duration:p.dur,easing:p.ease,fill:'both'});
  a.onfinish=function(){setTimeout(function(){if(node.isConnected)a.play();},900);};
}
function renderPresets(){
  filterBtns.forEach(function(b,i){b.setAttribute('aria-pressed',String(cats[i]===cat));});
  grid.replaceChildren();
  presets.filter(function(p){return cat==='All'||p.cat===cat;}).forEach(function(p){
    var card=el('div','preset panel');
    var pv=el('div','pv');var layer=el('i');pv.appendChild(layer);
    var body=el('div','pbody');
    var row=el('div','prow');row.appendChild(el('h3',null,p.name));row.appendChild(el('span','pcat',p.cat));
    var meta=el('p','pmeta',p.dur+' ms · '+p.ease);
    var btn=el('button','btn small','Copy JSON');btn.type='button';
    var ta=el('textarea','pjson');ta.readOnly=true;ta.hidden=true;ta.setAttribute('aria-label','Preset JSON for '+p.name);
    var json=JSON.stringify({name:p.name,category:p.cat,duration:p.dur,easing:p.ease,keyframes:p.kf},null,2);
    ta.value=json;
    btn.addEventListener('click',function(){
      copyText(json).then(function(ok){
        if(ok){ta.hidden=true;flash(btn,'Copied');}
        else{ta.hidden=false;ta.focus();ta.select();flash(btn,'Press Ctrl+C');}
      });
    });
    body.appendChild(row);body.appendChild(meta);body.appendChild(btn);body.appendChild(ta);
    card.appendChild(pv);card.appendChild(body);grid.appendChild(card);
    runPreset(layer,p);
  });
}
renderPresets();

/* ================= blog ================= */
var posts=[
  {title:'Why linear motion looks wrong',date:'Oct 28, 2026',mins:2,tag:'Motion principles',body:[
    'Set two keyframes and the default interpolation draws a straight line between them. The layer moves at one constant speed, starts instantly and stops instantly. Nothing in the physical world behaves like that, so the eye reads it as a machine.',
    'The graph editor fixes this by showing speed as slope. A steep section is fast and a flat section is slow. For something arriving on screen, start steep and flatten out so it lands softly. For something leaving, do the reverse: begin flat and accelerate away.',
    'Overshoot is the same idea taken one step further. Let the curve cross 1.0 before it settles and the layer passes its target, then returns. Keep it small. On interface motion, a few percent past the target reads as energy. Twenty percent reads as a toy.',
    'A good starting point for on-screen movement is 200 to 500 milliseconds. Shorter and the eye misses the easing. Longer and the viewer waits for the layer to arrive.']},
  {title:'The 180-degree shutter, explained',date:'Oct 9, 2026',mins:2,tag:'Rendering',body:[
    'Motion blur in an editor is usually exposed as a shutter angle. The angle describes how much of each frame the virtual shutter stays open. At 360 degrees it is open for the whole frame. At 180 degrees, half of it.',
    'That gives a simple formula: exposure time equals the shutter angle divided by 360, divided by the frame rate. At 180 degrees the exposure is half a frame, which is 1/48 of a second at 24 fps and 1/60 at 30 fps. This is the long-standing film default, and most viewers read it as natural.',
    'Go lower and fast movement turns crisp and staccato. Go higher and it smears. When a preset moves a layer very quickly, such as a whip pan, raise the blur for that move only instead of changing the whole composition.']},
  {title:'Keeping a preset library from becoming a junk drawer',date:'Sep 22, 2026',mins:2,tag:'Workflow',body:[
    'A preset library starts useful and drifts into a junk drawer around the fortieth entry. Names like Bounce 2 and Slide Final stop meaning anything. Three habits slow the drift.',
    'Name by intent, not by construction. Pop In says where the motion sits in a layer\'s life. Scale Overshoot Quick says how it was built. Group by Entrance, Emphasis, Exit and Transition, because that is the question you are answering when you open the panel.',
    'Keep durations to a short list. If every preset is 200, 400 or 800 milliseconds, projects feel consistent without effort, and swapping one preset for another does not disturb the timing around it.',
    'Store the easing as data, not as a baked result. A preset that keeps its cubic-bezier values can be re-curved later. A preset that stores only the final keyframes cannot.']},
  {title:'Designing keyframes for thumbs',date:'Aug 30, 2026',mins:2,tag:'Mobile design',body:[
    'On a phone, the first thing a timeline editor loses is precision. A fingertip covers a patch roughly 8 to 10 millimetres wide, and a keyframe diamond drawn small enough to read is much smaller than that.',
    'Draw the diamond at its natural size but give it a hit area of at least 44 points, the minimum Apple\'s guidelines suggest for touch targets. Material Design suggests 48 density-independent pixels. Where two keyframes sit closer than that, the nearest one should win, and a long press can open a picker.',
    'Snap to frames by default. Add nudge buttons for one frame back and forward. Let the timeline zoom with a pinch and show the zoom level, so the person knows how far one swipe will move the playhead.']}
];
var plist=$('#plist'),reader=$('#reader'),postBtns=[],narrow=matchMedia('(max-width:899px)');
posts.forEach(function(p,i){
  var b=el('button','pitem');b.type='button';
  b.appendChild(el('span','m',p.date+' · '+p.tag));
  b.appendChild(el('b',null,p.title));
  b.addEventListener('click',function(){showPost(i,true);});
  plist.appendChild(b);postBtns.push(b);
});
function showPost(i,user){
  var p=posts[i];
  postBtns.forEach(function(b,j){if(j===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
  reader.replaceChildren();
  reader.appendChild(el('span','meta',p.date+' · '+p.mins+' min read · '+p.tag));
  reader.appendChild(el('h3',null,p.title));
  p.body.forEach(function(t){reader.appendChild(el('p',null,t));});
  if(user&&narrow.matches)reader.scrollIntoView({block:'start'});
}
showPost(0,false);

/* ================= comments ================= */
var KEY='frameloom.comments.v1';
var seeds=[
  {id:'s1',name:'Mara T.',tc:'0:04',msg:'The overshoot curve lands quickly without bouncing like a toy. I used it on a title card and changed nothing else.',base:6,ts:Date.parse('2026-10-30T09:00:00Z'),ex:true},
  {id:'s2',name:'Dev O.',tc:'0:11',msg:'Could the whip pan carry its own blur amount? At 24 fps it strobes a little.',base:3,ts:Date.parse('2026-10-31T14:00:00Z'),ex:true},
  {id:'s3',name:'Ines R.',tc:'0:27',msg:'Duotone is the look I reach for most. A saved intensity per project would be great.',base:2,ts:Date.parse('2026-11-02T18:30:00Z'),ex:true}
];
var store={mine:[],liked:[]},sortBy='new';
try{var raw=localStorage.getItem(KEY);if(raw){var o=JSON.parse(raw);if(o&&Array.isArray(o.mine))store.mine=o.mine.filter(function(c){return c&&typeof c.msg==='string';});if(o&&Array.isArray(o.liked))store.liked=o.liked;}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}}
var cList=$('#cList'),cCount=$('#cCount'),cform=$('#cform'),cerr=$('#cerr');
var avCols=['#6F86FF','#FFC247','#7BD3B0','#FF8FB1','#B79BFF'];
function secs(tc){var m=/^(\d{1,2}):([0-5]\d)$/.exec(tc);return m?(+m[1])*60+(+m[2]):0;}
function ago(ts){
  var d=(Date.now()-ts)/1000;
  if(d<60)return 'just now';if(d<3600)return Math.floor(d/60)+' min ago';if(d<86400)return Math.floor(d/3600)+' h ago';
  return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function renderComments(){
  var all=seeds.concat(store.mine);
  all.sort(function(a,b){return sortBy==='new'?b.ts-a.ts:secs(a.tc)-secs(b.tc)||a.ts-b.ts;});
  cCount.textContent=all.length+(all.length===1?' comment':' comments');
  cList.replaceChildren();
  all.forEach(function(c){
    var li=el('li','cm');
    var h=0;for(var i=0;i<c.name.length;i++)h=(h*31+c.name.charCodeAt(i))>>>0;
    var av=el('div','av',(c.name.trim().charAt(0)||'?').toUpperCase());av.style.background=avCols[h%avCols.length];av.setAttribute('aria-hidden','true');
    var main=el('div');
    var top=el('div','cm-top');top.appendChild(el('b',null,c.name));
    top.appendChild(el('span','tag t',c.tc));
    top.appendChild(el('span','tag',c.ex?'Example':ago(c.ts)));
    main.appendChild(top);main.appendChild(el('p',null,c.msg));
    var acts=el('div','acts');
    var liked=store.liked.indexOf(c.id)>-1,n=(c.base||0)+(liked?1:0);
    var lb=el('button',null,'Helpful · '+n);lb.type='button';lb.setAttribute('aria-pressed',String(liked));
    lb.addEventListener('click',function(){
      var k=store.liked.indexOf(c.id);if(k>-1)store.liked.splice(k,1);else store.liked.push(c.id);
      save();renderComments();
    });
    acts.appendChild(lb);
    if(!c.ex){
      var db=el('button',null,'Delete');db.type='button';
      db.addEventListener('click',function(){
        store.mine=store.mine.filter(function(m){return m.id!==c.id;});
        store.liked=store.liked.filter(function(x){return x!==c.id;});
        save();renderComments();
      });
      acts.appendChild(db);
    }
    main.appendChild(acts);li.appendChild(av);li.appendChild(main);cList.appendChild(li);
  });
}
var sNew=$('#sortNew'),sTc=$('#sortTc');
function setSort(s){sortBy=s;sNew.setAttribute('aria-pressed',String(s==='new'));sTc.setAttribute('aria-pressed',String(s==='tc'));renderComments();}
sNew.addEventListener('click',function(){setSort('new');});
sTc.addEventListener('click',function(){setSort('tc');});
cform.addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#cname').value.trim(),tc=$('#ctc').value.trim()||'0:00',msg=$('#cmsg').value.trim();
  if(!name){cerr.textContent='Add your name so people know who commented.';$('#cname').focus();return;}
  if(!/^\d{1,2}:[0-5]\d$/.test(tc)){cerr.textContent='Write the timecode as minutes:seconds, for example 0:12.';$('#ctc').focus();return;}
  if(msg.length<3){cerr.textContent='Write at least a few words for the comment.';$('#cmsg').focus();return;}
  cerr.textContent='';
  var ts=Date.now();
  store.mine.push({id:'u'+ts+Math.floor(Math.random()*1e4),name:name.slice(0,40),tc:tc,msg:msg.slice(0,400),base:0,ts:ts});
  save();$('#cmsg').value='';sortBy==='new'||setSort('new');renderComments();
});
renderComments();
})();