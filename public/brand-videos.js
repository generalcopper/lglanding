(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var records = new Map();
  var observer = null, suspended = false, frame = 0;
  var MIN_VISIBLE = 0.12;
  // «Risparmio dati» del browser: restano i poster, nessun video scaricato.
  var connection = window.navigator && window.navigator.connection;
  function saveData() { return !!(connection && connection.saveData); }

  function visible(video) {
    var rect = video.getBoundingClientRect();
    var stage = video.closest('.brand-stage');
    var clip = stage ? stage.getBoundingClientRect() : rect;
    var width = Math.max(0, Math.min(rect.right, clip.right, window.innerWidth) - Math.max(rect.left, clip.left, 0));
    var height = Math.max(0, Math.min(rect.bottom, clip.bottom, window.innerHeight) - Math.max(rect.top, clip.top, 0));
    return rect.width > 0 && rect.height > 0 && width * height / (rect.width * rect.height) >= MIN_VISIBLE;
  }

  function stop(state) {
    state.attempt++;
    state.pending = false;
    state.video.autoplay = false;
    state.video.removeAttribute('autoplay');
    state.video.pause();
    state.video.classList.remove('is-playing');
  }

  function prepare(state) {
    var video = state.video, changed = false;
    // Set these before assigning any media URL, including inside a trusted gesture.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.autoplay = true;
    if (video.hasAttribute('data-src')) {
      video.src = video.getAttribute('data-src');
      video.removeAttribute('data-src');
      changed = true;
    }
    video.querySelectorAll('source[data-src]').forEach(function (source) {
      source.src = source.getAttribute('data-src');
      source.removeAttribute('data-src');
      changed = true;
    });
    if (changed) {
      video.preload = 'auto';
      video.load();
    }
  }

  function play(state, retry) {
    if (suspended || document.hidden || motion.matches || saveData() || !state.visible) return;
    if (retry) state.blocked = false;
    if (state.blocked || state.pending || !state.video.paused) return;
    prepare(state);
    state.pending = true;
    var attempt = ++state.attempt;
    function failed(error) {
      if (attempt !== state.attempt) return;
      state.pending = false;
      state.blocked = !!error && error.name === 'NotAllowedError';
      state.video.classList.remove('is-playing');
    }
    try {
      var promise = state.video.play();
      if (promise && typeof promise.then === 'function') {
        promise.then(function () {
          if (attempt === state.attempt) state.pending = false;
        }, failed);
      } else state.pending = false;
    } catch (error) { failed(error); }
  }

  function refresh(retry) {
    records.forEach(function (state) {
      state.visible = visible(state.video);
      if (suspended || document.hidden || motion.matches || saveData() || !state.visible) stop(state);
      else play(state, retry);
    });
  }

  function register(video) {
    if (!video || records.has(video)) return;
    var state = { video: video, visible: false, pending: false, blocked: false, attempt: 0 };
    records.set(video, state);
    stop(state);
    state.ready = function () { play(state, false); };
    state.playing = function () {
      if (suspended || document.hidden || motion.matches || !state.visible) { stop(state); return; }
      state.blocked = false;
      video.classList.add('is-playing');
    };
    state.paused = function () { video.classList.remove('is-playing'); };
    state.error = function () { state.pending = false; video.classList.remove('is-playing'); };
    video.addEventListener('loadeddata', state.ready);
    video.addEventListener('canplay', state.ready);
    video.addEventListener('playing', state.playing);
    video.addEventListener('pause', state.paused);
    video.addEventListener('error', state.error);
    if (observer) observer.observe(video);
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var state = records.get(entry.target);
        if (!state) return;
        state.visible = entry.isIntersecting && entry.intersectionRatio >= MIN_VISIBLE;
        if (state.visible) play(state, false);
        else stop(state);
      });
    }, { rootMargin: '0px', threshold: [0, MIN_VISIBLE] });
  }

  document.querySelectorAll('.card-video').forEach(register);
  // Called by the existing carousel only when very wide screens need extra cards.
  window.lgObserveBrandCard = function (card, enabled) {
    var video = card.querySelector('.card-video');
    if (!video) return;
    if (enabled) {
      card.classList.add('in-view');
      register(video);
      refresh(false);
    } else {
      var state = records.get(video);
      if (!state) return;
      if (observer) observer.unobserve(video);
      stop(state);
      video.removeEventListener('loadeddata', state.ready);
      video.removeEventListener('canplay', state.ready);
      video.removeEventListener('playing', state.playing);
      video.removeEventListener('pause', state.paused);
      video.removeEventListener('error', state.error);
      records.delete(video);
    }
  };

  // Keep play() directly in the trusted event: deferring it loses iOS activation.
  // Do not preventDefault or intercept links, swipes, the menu or cookie choices.
  function gesture(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    refresh(true);
  }
  document.addEventListener('touchend', gesture, { passive: true, capture: true });
  document.addEventListener('click', gesture, { passive: true, capture: true });
  document.addEventListener('keydown', gesture, { capture: true });
  document.addEventListener('visibilitychange', function () { refresh(!document.hidden); });
  window.addEventListener('pagehide', function () { suspended = true; records.forEach(stop); });
  window.addEventListener('pageshow', function () { suspended = false; refresh(true); });
  if (motion.addEventListener) motion.addEventListener('change', function () { refresh(true); });
  else if (motion.addListener) motion.addListener(function () { refresh(true); });

  function scheduleRefresh() {
    if (frame) return;
    frame = requestAnimationFrame(function () { frame = 0; refresh(false); });
  }
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  if (!observer) document.addEventListener('scroll', scheduleRefresh, { passive: true, capture: true });
  refresh(false);
})();
