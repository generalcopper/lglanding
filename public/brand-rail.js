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
  var AUTO_INTERVAL=5000,SWIPE_DURATION=650;
  var travel=0,raf=0,resizeFrame=0,autoTimer=0;
  var hovered=false,touching=false,visible=false,initialized=false;
  var navigation=null,normalizing=false;
  var clamp=function(v,min,max){return Math.max(min,Math.min(max,v));};
  cards.forEach(function(card,index){card.dataset.brandIndex=index;});

  // Reserve the same measured caption height on every card at each viewport size.
  // This keeps the logos and actions aligned without clipping longer descriptions.
  var captionFrame=0;
  function sizeCaptions(){
    captionFrame=0;
    track.style.setProperty('--card-caption-height','auto');
    var height=0;
    cards.forEach(function(card){
      var caption=card.querySelector('.card-caption');
      if(caption)height=Math.max(height,caption.getBoundingClientRect().height);
    });
    track.style.setProperty('--card-caption-height',Math.ceil(height)+'px');
  }
  function scheduleCaptions(){cancelAnimationFrame(captionFrame);captionFrame=requestAnimationFrame(sizeCaptions);}
  sizeCaptions();
  window.addEventListener('resize',scheduleCaptions,{passive:true});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(scheduleCaptions);


  // One gesture controller owns dragging, looping and the final centered snap.
  // Looping uses transforms, so the original cards and videos stay mounted.
  var nativeMobile=window.matchMedia('(pointer: coarse)');
  if(nativeMobile.matches&&window.EmblaCarousel){
    section.classList.add('is-native-mobile','is-snap-loop');
    cards.forEach(function(card){card.classList.add('in-view');});
    var nativeInitial=0,nativeMoving=false;
    if(location.hash){try{
      var nativeHashCard=document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if(cards.indexOf(nativeHashCard)>=0)nativeInitial=cards.indexOf(nativeHashCard);
    }catch(ignore){}}
    var touchRail=window.EmblaCarousel(stage,{
      container:track,slides:cards,align:'center',loop:true,
      dragFree:false,skipSnaps:false,slidesToScroll:1,containScroll:false,
      startIndex:nativeInitial,duration:25,
      breakpoints:{'(prefers-reduced-motion: reduce)':{duration:0}}
    });
    var nativeVideoMoving=false;
    var nativeVideoTolerance=1/Math.max(stage.clientWidth*cards.length,1);
    function nativeSyncVideo(moving){
      nativeVideoMoving=Boolean(moving||touching);
      if(window.lgSetBrandVideoState)window.lgSetBrandVideoState(cards[touchRail.selectedScrollSnap()],nativeVideoMoving);
    }
    function nativeResumeVideo(){
      if(touching||!nativeVideoMoving)return;
      // Resume at the visible snap, without waiting for the spring's subpixel tail.
      var target=touchRail.scrollSnapList()[touchRail.selectedScrollSnap()];
      var distance=Math.abs((touchRail.scrollProgress()-target)%1);
      if(Math.min(distance,1-distance)<=nativeVideoTolerance)nativeSyncVideo(false);
    }
    function nativeCanAutoplay(){
      var focused=section.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');
      return visible&&!motion.matches&&!document.hidden&&!touching&&!nativeMoving&&!focused&&
        !document.body.classList.contains('menu-open')&&cards.length>1;
    }
    function nativeScheduleAutoplay(){
      clearAutoplay();
      if(nativeCanAutoplay())autoTimer=setTimeout(function(){
        autoTimer=0;
        if(nativeCanAutoplay())touchRail.scrollNext();
      },AUTO_INTERVAL);
    }
    function nativeGoToCard(card,instant){
      var index=cards.indexOf(card);
      if(index<0)return;
      clearAutoplay();
      touchRail.scrollTo(index,Boolean(instant||motion.matches));
      var top=section.getBoundingClientRect().top+window.scrollY;
      window.scrollTo({left:0,top:top,behavior:instant||motion.matches?'instant':'smooth'});
      if(instant||motion.matches){nativeSyncVideo(false);nativeScheduleAutoplay();}
    }
    window.lgBrandRail={goToCard:nativeGoToCard};
    touchRail.on('pointerDown',function(){touching=true;clearAutoplay();nativeSyncVideo(true);});
    touchRail.on('pointerUp',function(){
      touching=false;
      if(!nativeMoving)nativeSyncVideo(false);
      else nativeResumeVideo();
      nativeScheduleAutoplay();
    });
    touchRail.on('scroll',function(){
      if(!nativeMoving){nativeMoving=true;clearAutoplay();nativeSyncVideo(true);}
      nativeResumeVideo();
    });
    touchRail.on('settle',function(){nativeMoving=false;nativeSyncVideo(false);nativeScheduleAutoplay();});
    touchRail.on('reInit',function(){
      nativeMoving=false;
      nativeVideoTolerance=1/Math.max(stage.clientWidth*cards.length,1);
      nativeSyncVideo(false);nativeScheduleAutoplay();
    });
    section.addEventListener('focusin',nativeScheduleAutoplay);
    section.addEventListener('focusout',function(){setTimeout(nativeScheduleAutoplay,0);});
    stage.addEventListener('keydown',function(event){
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();clearAutoplay();
      if(event.key==='ArrowLeft')touchRail.scrollPrev(motion.matches);
      else touchRail.scrollNext(motion.matches);
    });
    function nativeVisibility(){
      var bounds=section.getBoundingClientRect();
      visible=bounds.bottom>0&&bounds.top<window.innerHeight;
      nativeScheduleAutoplay();
    }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        visible=entries[0].isIntersecting;nativeScheduleAutoplay();
      }).observe(section);
    }else window.addEventListener('scroll',nativeVisibility,{passive:true});
    document.addEventListener('visibilitychange',nativeScheduleAutoplay);
    new MutationObserver(nativeScheduleAutoplay).observe(document.body,{attributes:true,attributeFilter:['class']});
    motion.addEventListener('change',nativeScheduleAutoplay);
    window.addEventListener('pageshow',function(event){
      if(event.persisted)touchRail.reInit();
      nativeVisibility();
    },{passive:true});
    nativeSyncVideo(false);
    nativeVisibility();
    return;
  }

  section.classList.add('is-enhanced');

  function clearAutoplay(){clearTimeout(autoTimer);autoTimer=0;}
  function cancelNavigation(){cancelAnimationFrame(raf);raf=0;navigation=null;}
  function canAutoplay(){
    var focused=section.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');
    return visible&&desktop.matches&&!motion.matches&&!document.hidden&&!hovered&&!touching&&!focused&&
      !document.body.classList.contains('menu-open')&&!navigation&&travel>0;
  }
  // Stay still between swipes. Only animate while advancing to the next card.
  function scheduleAutoplay(){
    clearAutoplay();
    if(canAutoplay())autoTimer=setTimeout(function(){
      autoTimer=0;
      if(canAutoplay())stepCard(1);
    },AUTO_INTERVAL);
  }
  function wake(){if(navigation&&!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
  function manual(){cancelNavigation();scheduleAutoplay();}
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
    cancelNavigation();
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
    if(initialized)position(targetPosition(anchor)-offset);
    else centerCard(cards[0],true);
    initialized=true;normalize();
    previous.disabled=next.disabled=cards.length<2||travel<1;
    var rect=section.getBoundingClientRect();visible=rect.bottom>0&&rect.top<window.innerHeight;scheduleAutoplay();
  }
  function targetPosition(card){
    var bounds=card.getBoundingClientRect(),viewport=stage.getBoundingClientRect();
    return stage.scrollLeft+bounds.left+bounds.width/2-viewport.left-stage.clientWidth/2;
  }
  function tick(now){
    raf=0;if(document.hidden||!navigation)return;
    var progress=clamp((now-navigation.started)/SWIPE_DURATION,0,1);
    var eased=1-Math.pow(1-progress,3);
    var fraction=(eased-navigation.progress)/(1-navigation.progress);
    var delta=targetPosition(navigation.card)-stage.scrollLeft;
    position(stage.scrollLeft+delta*fraction);
    navigation.progress=eased;normalize();
    if(progress>=1){
      var card=navigation.card;
      for(var attempt=0;attempt<items.length;attempt++){
        position(clamp(targetPosition(card),0,travel));normalize();
        if(Math.abs(targetPosition(card)-stage.scrollLeft)<1.5)break;
      }
      navigation=null;scheduleAutoplay();
    }else wake();
  }
  function centerCard(card,instant){
    if(items.indexOf(card)<0)return;
    manual();
    if(instant||motion.matches){
      for(var attempt=0;attempt<items.length;attempt++){
        position(clamp(targetPosition(card),0,travel));normalize();
        if(Math.abs(targetPosition(card)-stage.scrollLeft)<1.5)break;
      }
      scheduleAutoplay();
    }else{
      clearAutoplay();navigation={card:card,started:performance.now(),progress:0};wake();
    }
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
  stage.addEventListener('scroll',function(){
    normalize();
    if(!navigation)scheduleAutoplay();
  },{passive:true});
  stage.addEventListener('wheel',function(event){
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)||(event.shiftKey&&event.deltaY))manual();
  },{passive:true});
  stage.addEventListener('keydown',function(event){
    if(event.key==='ArrowLeft'||event.key==='ArrowRight')manual();
  });
  stage.addEventListener('pointerdown',function(){touching=true;manual();},{passive:true});
  function endPointer(){if(touching){touching=false;manual();}}
  window.addEventListener('pointerup',endPointer,{passive:true});
  window.addEventListener('pointercancel',endPointer,{passive:true});
  stage.addEventListener('dragstart',function(event){event.preventDefault();},true);
  function pauseForPointer(event){
    if(!hovered&&hoverCapable.matches&&event.pointerType!=='touch'){hovered=true;scheduleAutoplay();}
  }
  pin.addEventListener('pointerenter',pauseForPointer);
  pin.addEventListener('pointermove',pauseForPointer);
  // Scrolling the page must not leave the rail paused under a stationary cursor.
  window.addEventListener('scroll',function(){
    if(hovered){hovered=false;scheduleAutoplay();}
  },{passive:true});
  pin.addEventListener('pointerleave',function(event){
    if(event.pointerType!=='touch'){hovered=false;scheduleAutoplay();}
  });
  section.addEventListener('focusin',function(event){
    var card=event.target.closest('.card');
    if(card&&event.target.matches(':focus-visible'))centerCard(card);
    scheduleAutoplay();
  });
  section.addEventListener('focusout',function(){setTimeout(scheduleAutoplay,0);});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      visible=entries[0].isIntersecting;
      if(!visible)cancelNavigation();
      scheduleAutoplay();
    }).observe(section);
  }else{
    window.addEventListener('scroll',function(){
      var bounds=section.getBoundingClientRect();visible=bounds.bottom>0&&bounds.top<window.innerHeight;
      if(!visible)cancelNavigation();
      scheduleAutoplay();
    },{passive:true});
  }
  window.addEventListener('resize',function(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(measure);},{passive:true});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)cancelNavigation();
    scheduleAutoplay();
  });
  new MutationObserver(function(){
    if(document.body.classList.contains('menu-open'))cancelNavigation();
    scheduleAutoplay();
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  motion.addEventListener('change',manual);desktop.addEventListener('change',manual);
  measure();
  var initial=null;
  if(location.hash){try{initial=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(initial&&cards.indexOf(initial)>=0)goToCard(initial,true);}catch(ignore){}}
  window.addEventListener('pageshow',function(event){measure();if(!event.persisted&&initial&&cards.indexOf(initial)>=0)goToCard(initial,true);});
})();
