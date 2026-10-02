(function(){
  'use strict';
  var section=document.getElementById('brands');
  if(!section)return;
  var pin=section.querySelector('.brand-pin');
  var stage=section.querySelector('.brand-stage');
  var track=section.querySelector('.brand-track');
  var cards=Array.from(track.querySelectorAll('.card'));
  var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  var hoverCapable=window.matchMedia('(hover: hover) and (pointer: fine)');
  var start=0,travel=0,rendered=0,speed=0,carry=0,expectedY=window.scrollY;
  var raf=0,lastFrame=0,lastManual=-Infinity,wakeTimer=0,settledAt=0;
  var hovered=false,touching=false,resizeFrame=0;
  var clamp=function(v,min,max){return Math.max(min,Math.min(max,v));};
  section.classList.add('is-enhanced');

  function isPinned(){return window.scrollY>=start-1&&window.scrollY<=start+travel+1;}
  function wake(){if(!raf&&!document.hidden){lastFrame=performance.now();raf=requestAnimationFrame(tick);}}
  function manual(){
    lastManual=performance.now();speed=0;carry=0;
    clearTimeout(wakeTimer);
    wakeTimer=setTimeout(wake,2100);
    wake();
  }
  function position(y){
    expectedY=y;
    window.scrollTo({left:0,top:y,behavior:'instant'});
  }
  function draw(){track.style.transform='translate3d('+(-rendered).toFixed(3)+'px,0,0)';}
  function measure(){
    var pinned=isPinned(),ratio=travel?clamp((window.scrollY-start)/travel,0,1):0;
    start=section.getBoundingClientRect().top+window.scrollY;
    travel=Math.max(0,Math.ceil(track.getBoundingClientRect().width-stage.clientWidth));
    section.style.setProperty('--rail-height',(pin.offsetHeight+travel)+'px');
    if(pinned)position(start+ratio*travel);
    rendered=clamp(window.scrollY-start,0,travel);draw();wake();
  }
  function tick(now){
    raf=0;
    if(document.hidden)return;
    var dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    var target=clamp(window.scrollY-start,0,travel);
    var pinned=isPinned();
    var focused=section.contains(document.activeElement);
    var running=pinned&&!motion.matches&&!hovered&&!touching&&!focused&&
      !document.body.classList.contains('menu-open')&&now-lastManual>2000&&target<travel;
    var remaining=travel-target;
    var wanted=running?Math.max(18,window.innerWidth*.028)*clamp(remaining/140,.18,1):0;
    speed+=(wanted-speed)*(1-Math.exp(-dt/.24));
    if(speed<.04)speed=0;
    if(pinned&&speed>0){
      carry+=speed*dt;
      var step=Math.floor(carry);
      if(step){carry-=step;position(start+Math.min(travel,target+step));target=clamp(window.scrollY-start,0,travel);}
    }
    if(!pinned||motion.matches)rendered=target;
    else rendered+=(target-rendered)*(1-Math.exp(-dt/(touching?.065:.1)));
    if(Math.abs(target-rendered)<.05)rendered=target;
    draw();
    if(target>=travel-1&&Math.abs(rendered-travel)<2){if(!settledAt)settledAt=now;}
    else settledAt=0;
    if(running||speed>0||Math.abs(target-rendered)>.05)raf=requestAnimationFrame(tick);
  }
  function steer(delta){
    if(!isPinned()||!delta)return false;
    var at=clamp(window.scrollY-start,0,travel);
    if(delta>0&&at>=travel-1&&settledAt&&performance.now()-settledAt>220)return false;
    if(delta<0&&at<=0&&rendered<2)return false;
    position(start+clamp(at+delta,0,travel));wake();return true;
  }
  function goToCard(card,instant){
    if(cards.indexOf(card)<0)return;
    manual();pin.scrollLeft=0;stage.scrollLeft=0;
    var at=clamp(card.offsetLeft-(stage.clientWidth-card.offsetWidth)/2,0,travel);
    if(instant){position(start+at);rendered=at;draw();}
    else window.scrollTo({left:0,top:start+at,behavior:motion.matches?'instant':'smooth'});
    wake();
  }
  window.lgBrandRail={goToCard:goToCard,isPinned:isPinned};
  window.addEventListener('scroll',function(){
    if(Math.abs(window.scrollY-expectedY)>2){manual();expectedY=window.scrollY;}
    wake();
  },{passive:true});
  window.addEventListener('wheel',function(event){
    if(event.ctrlKey||event.metaKey||document.body.classList.contains('menu-open'))return;
    if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    var delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(event.deltaMode===1)delta*=16;
    if(event.deltaMode===2)delta*=pin.offsetHeight;
    manual();
    if(steer(delta))event.preventDefault();
  },{passive:false});
  window.addEventListener('keydown',function(event){
    if(event.altKey||event.ctrlKey||event.metaKey||document.body.classList.contains('menu-open'))return;
    if(event.target.closest('input,textarea,select,button,[contenteditable="true"]'))return;
    var distances={ArrowDown:100,ArrowUp:-100,ArrowRight:160,ArrowLeft:-160,PageDown:pin.offsetHeight*.85,PageUp:-pin.offsetHeight*.85};
    var delta=event.key===' '?(event.shiftKey?-1:1)*pin.offsetHeight*.85:distances[event.key];
    if(delta!==undefined){manual();if(steer(delta))event.preventDefault();}
  });
  cards.forEach(function(card){
    card.addEventListener('pointerenter',function(event){if(hoverCapable.matches&&event.pointerType!=='touch'){hovered=true;wake();}});
    card.addEventListener('pointerleave',function(event){if(event.pointerType!=='touch'){hovered=false;wake();}});
  });
  section.addEventListener('focusin',function(event){var card=event.target.closest('.card');if(card)goToCard(card);});
  section.addEventListener('focusout',function(){setTimeout(wake,0);});
  window.addEventListener('pointerdown',function(){manual();},{passive:true});

  var gesture=null,suppressClickUntil=0;
  pin.addEventListener('touchstart',function(event){
    if(event.touches.length!==1){gesture=null;return;}
    var t=event.touches[0];
    gesture={x:t.clientX,y:t.clientY,startX:t.clientX,startY:t.clientY,time:performance.now(),axis:null,captured:false,velocity:0};
    touching=true;manual();
  },{passive:true});
  pin.addEventListener('touchmove',function(event){
    if(!gesture||event.touches.length!==1||document.body.classList.contains('menu-open'))return;
    var t=event.touches[0],dx=gesture.startX-t.clientX,dy=gesture.startY-t.clientY;
    if(!gesture.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;gesture.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';}
    var delta=gesture.axis==='x'?gesture.x-t.clientX:gesture.y-t.clientY;
    var now=performance.now();gesture.velocity=delta/Math.max(8,now-gesture.time);
    gesture.x=t.clientX;gesture.y=t.clientY;gesture.time=now;
    if(gesture.captured||steer(delta)){
      if(gesture.captured)steer(delta);
      gesture.captured=true;suppressClickUntil=now+500;event.preventDefault();
    }
  },{passive:false});
  function endTouch(){
    if(gesture&&gesture.captured&&!motion.matches&&performance.now()-gesture.time<100){
      var impulse=clamp(gesture.velocity*120,-stage.clientWidth*.45,stage.clientWidth*.45);
      if(Math.abs(impulse)>12)window.scrollTo({top:start+clamp(window.scrollY-start+impulse,0,travel),behavior:'smooth'});
    }
    gesture=null;touching=false;manual();
  }
  pin.addEventListener('touchend',endTouch,{passive:true});
  pin.addEventListener('touchcancel',function(){gesture=null;touching=false;manual();},{passive:true});
  pin.addEventListener('click',function(event){if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
  window.addEventListener('resize',function(){
    cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(measure);
  },{passive:true});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){cancelAnimationFrame(raf);raf=0;speed=0;carry=0;}
    else wake();
  });
  new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class']});
  motion.addEventListener('change',function(){speed=0;carry=0;wake();});
  measure();
  if(location.hash){
    try{var initial=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(initial&&cards.indexOf(initial)>=0)goToCard(initial,true);}catch(ignore){}
  }
  window.addEventListener('pageshow',function(event){
    measure();
    // Native fragment positioning runs again after media and fonts finish loading.
    if(!event.persisted&&initial&&cards.indexOf(initial)>=0)goToCard(initial,true);
  });
})();
