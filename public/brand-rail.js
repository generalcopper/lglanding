(function(){
  'use strict';
  var section=document.getElementById('brands');
  if(!section)return;
  var pin=section.querySelector('.brand-pin');
  var stage=section.querySelector('.brand-stage');
  var track=section.querySelector('.brand-track');
  var cards=Array.from(track.querySelectorAll('.card'));
  var items=cards.slice(),ordered=items.slice();
  var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  var hoverCapable=window.matchMedia('(hover: hover) and (pointer: fine)');
  var desktop=window.matchMedia('(min-width: 721px) and (hover: hover) and (pointer: fine)');
  var previous=section.querySelector('.brand-nav-prev');
  var next=section.querySelector('.brand-nav-next');
  var travel=0,speed=0,carry=0;
  var raf=0,lastFrame=0,resizeFrame=0,lastManual=-Infinity,wakeTimer=0,autoDeadline=0;
  var hovered=false,hoverStarted=0,touching=false,visible=false,initialized=false;
  var navigation=null,normalizing=false;
  var clamp=function(v,min,max){return Math.max(min,Math.min(max,v));};
  cards.forEach(function(card,index){card.dataset.brandIndex=index;});
  section.classList.add('is-enhanced');

  function wake(){if(!raf&&!document.hidden){lastFrame=performance.now();raf=requestAnimationFrame(tick);}}
  function manual(){
    navigation=null;lastManual=performance.now();speed=0;carry=0;
    clearTimeout(wakeTimer);wakeTimer=setTimeout(wake,2100);wake();
  }
  function position(x){stage.scrollLeft=x;}
  function applyOrder(){ordered.forEach(function(card,index){card.style.order=index;});}
  function nearestCard(){
    var center=stage.getBoundingClientRect().left+stage.clientWidth/2;
    var nearest=ordered[0],distance=Infinity;
    ordered.forEach(function(card){
      var rect=card.getBoundingClientRect(),delta=Math.abs(rect.left+rect.width/2-center);
      if(delta<distance){distance=delta;nearest=card;}
    });
    return nearest;
  }
  // Reorder only a fully offscreen card. Keep the visible cards and their videos in place.
  function rotate(direction){
    var anchor=ordered[direction>0?1:0];
    var left=anchor.getBoundingClientRect().left,at=stage.scrollLeft;
    if(direction>0)ordered.push(ordered.shift());
    else ordered.unshift(ordered.pop());
    applyOrder();
    position(at+anchor.getBoundingClientRect().left-left);
  }
  function normalize(){
    if(normalizing||travel<1)return;
    var at=stage.scrollLeft;
    if(at>32&&at<travel-32)return;
    normalizing=true;
    var bounds=stage.getBoundingClientRect();
    if(at<=32&&ordered[ordered.length-1].getBoundingClientRect().left>bounds.right){rotate(-1);}
    else if(at>=travel-32&&ordered[0].getBoundingClientRect().right<bounds.left){rotate(1);}
    normalizing=false;
  }
  function makeCopy(card){
    var copy=card.cloneNode(true);
    copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(function(el){el.removeAttribute('id');});
    copy.dataset.loopCopy='true';copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;
    copy.querySelectorAll('video').forEach(function(video){video.removeAttribute('autoplay');video.preload='none';});
    track.appendChild(copy);
    if(window.lgObserveBrandCard)window.lgObserveBrandCard(copy,true);
    return copy;
  }
  function measure(){
    var anchor=initialized?nearestCard():cards[0];
    var bounds=anchor.getBoundingClientRect();
    var offset=bounds.left+bounds.width/2-stage.getBoundingClientRect().left-stage.clientWidth/2;
    var style=getComputedStyle(track),gap=parseFloat(style.gap)||0,gutter=parseFloat(style.paddingLeft)||0;
    var stride=cards[0].getBoundingClientRect().width+gap;
    var cycles=Math.max(1,Math.ceil((stage.clientWidth+stride+2*gutter)/(stride*cards.length)));
    if(items.length!==cycles*cards.length){
      items.slice(cards.length).forEach(function(copy){
        if(window.lgObserveBrandCard)window.lgObserveBrandCard(copy,false);
        copy.remove();
      });
      items=cards.slice();
      for(var cycle=1;cycle<cycles;cycle++)cards.forEach(function(card){items.push(makeCopy(card));});
      ordered=items.slice();
      if(items.indexOf(anchor)<0)anchor=cards[Number(anchor.dataset.brandIndex)];
    }
    applyOrder();travel=Math.max(0,stage.scrollWidth-stage.clientWidth);navigation=null;
    if(initialized)position(anchor.offsetLeft+anchor.offsetWidth/2-stage.clientWidth/2-offset);
    else position(0);
    initialized=true;normalize();
    previous.disabled=next.disabled=cards.length<2||travel<1;
    var rect=section.getBoundingClientRect();visible=rect.bottom>0&&rect.top<window.innerHeight;wake();
  }
  function targetPosition(card){return card.offsetLeft+(card.offsetWidth-stage.clientWidth)/2;}
  function tick(now){
    raf=0;if(document.hidden)return;
    var dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    if(visible&&desktop.matches&&!motion.matches&&!autoDeadline)autoDeadline=now+10000;
    if(navigation){
      var delta=targetPosition(navigation)-stage.scrollLeft;
      if(Math.abs(delta)<1.5){position(stage.scrollLeft+delta);navigation=null;}
      else position(stage.scrollLeft+Math.sign(delta)*Math.max(1,Math.abs(delta)*(1-Math.exp(-dt/.16))));
      normalize();
      if(navigation)raf=requestAnimationFrame(tick);
      return;
    }
    var at=stage.scrollLeft,expired=autoDeadline&&now>=autoDeadline;
    var hoverElapsed=hovered?now-hoverStarted:0;
    var hoverPaused=hovered&&hoverElapsed>=3000;
    var focused=section.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');
    var running=visible&&desktop.matches&&!motion.matches&&!expired&&!hoverPaused&&!touching&&!focused&&
      !document.body.classList.contains('menu-open')&&now-lastManual>2000&&travel>0;
    var hoverFade=hovered?Math.pow(clamp((3000-hoverElapsed)/1200,0,1),2):1;
    var finishFade=autoDeadline?Math.pow(clamp((autoDeadline-now)/1400,0,1),2):1;
    var wanted=running?Math.max(18,window.innerWidth*.028)*hoverFade*finishFade:0;
    speed+=(wanted-speed)*(1-Math.exp(-dt/.24));if(speed<.04)speed=0;
    if(!desktop.matches||motion.matches||hoverPaused||expired){speed=0;carry=0;}
    if(visible&&speed>0){
      carry+=speed*dt;var step=Math.floor(carry);
      if(step){carry-=step;position(at+step);normalize();}
    }
    if(running||speed>0)raf=requestAnimationFrame(tick);
  }
  function centerCard(card,instant){
    if(items.indexOf(card)<0)return;
    manual();
    if(instant||motion.matches){
      for(var attempt=0;attempt<items.length;attempt++){
        position(clamp(targetPosition(card),0,travel));normalize();
        if(Math.abs(targetPosition(card)-stage.scrollLeft)<1.5)break;
      }
    }else{navigation=card;wake();}
  }
  function goToCard(card,instant){
    if(items.indexOf(card)<0)return;
    centerCard(card,instant);
    var top=section.getBoundingClientRect().top+window.scrollY;
    window.scrollTo({left:0,top:top,behavior:instant||motion.matches?'instant':'smooth'});
  }
  function stepCard(direction){
    var nearest=nearestCard(),index=ordered.indexOf(nearest);
    if(index+direction<0)rotate(-1);
    else if(index+direction>=ordered.length)rotate(1);
    centerCard(ordered[ordered.indexOf(nearest)+direction]);
  }
  previous.addEventListener('click',function(){stepCard(-1);});
  next.addEventListener('click',function(){stepCard(1);});
  window.lgBrandRail={goToCard:goToCard};

  // Native wheel, touch and keyboard scrolling never capture the vertical page.
  stage.addEventListener('scroll',normalize,{passive:true});
  stage.addEventListener('wheel',function(event){
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)||(event.shiftKey&&event.deltaY)){manual();}
  },{passive:true});
  stage.addEventListener('keydown',function(event){
    if(event.key==='ArrowLeft'||event.key==='ArrowRight')manual();
  });
  // Page scrolling is independent; only a stationary hover starts the pause.
  window.addEventListener('scroll',function(){
    if(hovered){hoverStarted=performance.now();wake();}
  },{passive:true});
  stage.addEventListener('pointerdown',manual,{passive:true});
  stage.addEventListener('dragstart',function(event){event.preventDefault();},true);
  stage.addEventListener('touchstart',function(){touching=true;manual();},{passive:true});
  function endTouch(){touching=false;manual();}
  stage.addEventListener('touchend',endTouch,{passive:true});
  stage.addEventListener('touchcancel',endTouch,{passive:true});
  pin.addEventListener('pointerenter',function(event){
    if(hoverCapable.matches&&event.pointerType!=='touch'){hovered=true;hoverStarted=performance.now();wake();}
  });
  pin.addEventListener('pointerleave',function(event){
    if(event.pointerType!=='touch'){hovered=false;hoverStarted=0;wake();}
  });
  section.addEventListener('focusin',function(event){
    var card=event.target.closest('.card');
    if(card&&event.target.matches(':focus-visible'))centerCard(card);wake();
  });
  section.addEventListener('focusout',function(){setTimeout(wake,0);});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;if(!visible){speed=0;carry=0;}wake();}).observe(section);
  }else{
    window.addEventListener('scroll',function(){var bounds=section.getBoundingClientRect();visible=bounds.bottom>0&&bounds.top<window.innerHeight;wake();},{passive:true});
  }
  window.addEventListener('resize',function(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(measure);},{passive:true});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){cancelAnimationFrame(raf);raf=0;speed=0;carry=0;}else wake();
  });
  new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class']});
  motion.addEventListener('change',manual);desktop.addEventListener('change',manual);
  measure();
  var initial=null;
  if(location.hash){try{initial=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(initial&&cards.indexOf(initial)>=0)goToCard(initial,true);}catch(ignore){}}
  window.addEventListener('pageshow',function(event){measure();if(!event.persisted&&initial&&cards.indexOf(initial)>=0)goToCard(initial,true);});
})();
