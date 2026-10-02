(function(){
  'use strict';
  var section=document.getElementById('brands');
  if(!section)return;
  var stage=section.querySelector('.brand-stage');
  var track=section.querySelector('.brand-track');
  var cards=Array.from(track.querySelectorAll('.card'));
  var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  var hoverCapable=window.matchMedia('(hover: hover) and (pointer: fine)');
  var travel=0,speed=0,carry=0,expectedX=stage.scrollLeft;
  var raf=0,lastFrame=0,lastManual=-Infinity,wakeTimer=0,resizeFrame=0;
  var hovered=false,touching=false,visible=false;
  var clamp=function(v,min,max){return Math.max(min,Math.min(max,v));};
  section.classList.add('is-enhanced');

  function wake(){if(!raf&&!document.hidden){lastFrame=performance.now();raf=requestAnimationFrame(tick);}}
  function manual(){
    lastManual=performance.now();speed=0;carry=0;
    clearTimeout(wakeTimer);
    wakeTimer=setTimeout(wake,2100);
    wake();
  }
  function position(x){
    stage.scrollLeft=x;
    expectedX=stage.scrollLeft;
  }
  function measure(){
    var ratio=travel?clamp(stage.scrollLeft/travel,0,1):0;
    travel=Math.max(0,stage.scrollWidth-stage.clientWidth);
    position(ratio*travel);
    var bounds=section.getBoundingClientRect();
    visible=bounds.bottom>0&&bounds.top<window.innerHeight;
    wake();
  }
  function tick(now){
    raf=0;
    if(document.hidden)return;
    var dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    var at=stage.scrollLeft;
    var focused=section.contains(document.activeElement);
    var running=visible&&!motion.matches&&!hovered&&!touching&&!focused&&
      !document.body.classList.contains('menu-open')&&now-lastManual>2000&&at<travel-1;
    var wanted=running?Math.max(18,window.innerWidth*.028)*clamp((travel-at)/140,.18,1):0;
    speed+=(wanted-speed)*(1-Math.exp(-dt/.24));
    if(speed<.04)speed=0;
    if(visible&&speed>0){
      carry+=speed*dt;
      var step=Math.floor(carry);
      if(step){carry-=step;position(Math.min(travel,at+step));}
    }
    if(running||speed>0)raf=requestAnimationFrame(tick);
  }
  function centerCard(card,instant){
    if(cards.indexOf(card)<0)return;
    manual();
    var at=clamp(card.offsetLeft-(stage.clientWidth-card.offsetWidth)/2,0,travel);
    if(instant||motion.matches)position(at);
    else stage.scrollTo({left:at,behavior:'smooth'});
  }
  function goToCard(card,instant){
    if(cards.indexOf(card)<0)return;
    centerCard(card,instant);
    var top=section.getBoundingClientRect().top+window.scrollY;
    window.scrollTo({left:0,top:top,behavior:instant||motion.matches?'instant':'smooth'});
  }
  window.lgBrandRail={goToCard:goToCard};

  // Native wheel, touch and keyboard scrolling never capture the vertical page.
  stage.addEventListener('scroll',function(){
    if(Math.abs(stage.scrollLeft-expectedX)>2){manual();expectedX=stage.scrollLeft;}
  },{passive:true});
  stage.addEventListener('wheel',manual,{passive:true});
  stage.addEventListener('keydown',manual);
  stage.addEventListener('pointerdown',manual,{passive:true});
  stage.addEventListener('touchstart',function(){touching=true;manual();},{passive:true});
  function endTouch(){touching=false;manual();}
  stage.addEventListener('touchend',endTouch,{passive:true});
  stage.addEventListener('touchcancel',endTouch,{passive:true});
  cards.forEach(function(card){
    card.addEventListener('pointerenter',function(event){if(hoverCapable.matches&&event.pointerType!=='touch'){hovered=true;wake();}});
    card.addEventListener('pointerleave',function(event){if(event.pointerType!=='touch'){hovered=false;wake();}});
  });
  section.addEventListener('focusin',function(event){
    var card=event.target.closest('.card');
    if(card)centerCard(card);
    wake();
  });
  section.addEventListener('focusout',function(){setTimeout(wake,0);});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      visible=entries[0].isIntersecting;
      if(!visible){speed=0;carry=0;}
      wake();
    }).observe(section);
  }else{
    window.addEventListener('scroll',function(){
      var bounds=section.getBoundingClientRect();
      visible=bounds.bottom>0&&bounds.top<window.innerHeight;
      wake();
    },{passive:true});
  }
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
  var initial=null;
  if(location.hash){
    try{initial=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(initial&&cards.indexOf(initial)>=0)goToCard(initial,true);}catch(ignore){}
  }
  window.addEventListener('pageshow',function(event){
    measure();
    if(!event.persisted&&initial&&cards.indexOf(initial)>=0)goToCard(initial,true);
  });
})();
