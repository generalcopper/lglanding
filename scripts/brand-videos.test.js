const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const script = readFileSync(join(__dirname, '../public/brand-videos.js'), 'utf8');

class Events {
  constructor() { this.events = new Map(); }
  addEventListener(name, fn) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
  emit(name, props = {}) { this.events.get(name)?.forEach(fn => fn({ type: name, ...props })); }
}
function fixture({ reduced = false, hidden = false, observer = true, saveData = false } = {}) {
  const document = new Events(), window = new Events(), motion = new Events();
  let insideGesture = false, io;
  Object.assign(motion, { matches: reduced });
  Object.assign(window, { innerWidth: 390, innerHeight: 844, matchMedia: () => motion });
  if (saveData) window.navigator = { connection: { saveData: true } };
  document.hidden = hidden;
  class Video extends Events {
    constructor(left = 0) {
      super();
      this.attrs = new Map();
      this.classes = new Set();
      this.classList = { add: n => this.classes.add(n), remove: n => this.classes.delete(n) };
      this.paused = true; this.plays = 0; this.loads = 0; this.left = left; this.policyBlocked = false;
      this.sources = ['video/mp4', 'video/webm'].map(type => ({
        type, value: '/clip.' + type.split('/')[1],
        getAttribute() { return this.value; },
        removeAttribute() { this.value = null; }
      }));
    }
    hasAttribute(name) { return this.attrs.has(name); }
    getAttribute(name) { return this.attrs.get(name); }
    setAttribute(name, value) { this.attrs.set(name, value); }
    removeAttribute(name) { this.attrs.delete(name); }
    querySelectorAll() { return this.sources.filter(s => s.value !== null); }
    getBoundingClientRect() { return { left: this.left, right: this.left + 350, top: 100, bottom: 700, width: 350, height: 600 }; }
    closest() { return { getBoundingClientRect: () => ({ left: 0, right: 390, top: 0, bottom: 844 }) }; }
    load() { this.loads++; }
    pause() { this.paused = true; this.emit('pause'); }
    play() {
      this.plays++;
      assert.equal(this.muted, true);
      assert.equal(this.defaultMuted, true);
      assert.equal(this.playsInline, true);
      assert.equal(this.controls, false);
      assert.ok(this.sources.every(s => s.src));
      if (this.policyBlocked && !insideGesture) return Promise.reject({ name: 'NotAllowedError' });
      if (this.deferPlay) return new Promise((resolve, reject) => { this.resolvePlay = resolve; this.rejectPlay = reject; });
      this.paused = false;
      this.emit('playing');
      return Promise.resolve();
    }
  }
  const videos = [new Video(), new Video(500)];
  document.querySelectorAll = () => videos;
  if (observer) {
    window.IntersectionObserver = true;
    io = {
      observe() {}, unobserve() {},
      send(video, ratio) { this.callback([{ target: video, isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
    };
  }
  const context = { window, document, Map, requestAnimationFrame: fn => { fn(); return 1; } };
  if (observer) context.IntersectionObserver = class {
    constructor(callback) { io.callback = callback; return io; }
  };
  function start() { runInNewContext(script, context); }
  function gesture() {
    insideGesture = true;
    document.emit('touchend');
    insideGesture = false;
  }
  return { window, document, motion, videos, io, Video, start, gesture };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('loads and plays only the visible card, with inline muted playback', async () => {
  const f = fixture(); f.start(); await settle();
  assert.equal(f.videos[0].plays, 1);
  assert.equal(f.videos[0].loads, 1);
  assert.ok(f.videos[0].classes.has('is-playing'));
  assert.equal(f.videos[1].plays, 0);
  assert.equal(f.videos[1].loads, 0);
  f.document.emit('click'); await settle();
  assert.equal(f.videos[0].plays, 1, 'playing videos must not restart on every click');
});
test('rejected autoplay retries synchronously on a real gesture, without polling', async () => {
  const f = fixture(); f.videos[0].policyBlocked = true; f.start(); await settle();
  assert.equal(f.videos[0].plays, 1);
  assert.equal(f.videos[0].classes.has('is-playing'), false);
  f.videos[0].emit('canplay'); f.videos[0].emit('loadeddata'); await settle();
  assert.equal(f.videos[0].plays, 1);
  f.gesture(); await settle();
  assert.equal(f.videos[0].plays, 2);
  assert.equal(f.videos[0].paused, false, 'gesture activation must not be deferred');
  assert.ok(f.videos[0].classes.has('is-playing'));
});
test('pauses offscreen, hidden and cached pages and resumes on return', async () => {
  const f = fixture(); f.start(); await settle();
  f.videos[0].left = -500; f.io.send(f.videos[0], 0);
  assert.equal(f.videos[0].paused, true);
  assert.equal(f.videos[0].classes.has('is-playing'), false);
  f.videos[1].left = 0; f.io.send(f.videos[1], 1); await settle();
  assert.equal(f.videos[1].paused, false);
  f.document.hidden = true; f.document.emit('visibilitychange');
  assert.ok(f.videos.every(v => v.paused));
  f.document.hidden = false; f.document.emit('visibilitychange'); await settle();
  assert.equal(f.videos[1].paused, false);
  f.window.emit('pagehide');
  assert.ok(f.videos.every(v => v.paused));
  f.window.emit('pageshow'); await settle();
  assert.equal(f.videos[1].paused, false);
});
test('reduced motion and initial backgrounding do not download video', async () => {
  for (const options of [{ reduced: true }, { hidden: true }]) {
    const f = fixture(options); f.start(); f.gesture(); await settle();
    assert.ok(f.videos.every(v => v.loads === 0 && v.plays === 0));
    f.motion.matches = false; f.document.hidden = false; f.motion.emit('change'); await settle();
    assert.equal(f.videos[0].paused, false);
  }
});
test('data saver keeps the posters and downloads no video, even after a gesture', async () => {
  const f = fixture({ saveData: true }); f.start(); f.gesture(); await settle();
  assert.ok(f.videos.every(v => v.loads === 0 && v.plays === 0));
});
test('late rejection from an offscreen attempt cannot block a newer gesture', async () => {
  const f = fixture(); f.videos[0].deferPlay = true; f.start();
  const rejectOld = f.videos[0].rejectPlay;
  f.videos[0].left = -500; f.io.send(f.videos[0], 0);
  f.videos[0].deferPlay = false; f.videos[0].left = 0; f.gesture();
  rejectOld({ name: 'NotAllowedError' }); await settle();
  assert.equal(f.videos[0].paused, false);
  assert.ok(f.videos[0].classes.has('is-playing'));
});
test('extra carousel cards join lifecycle tracking and detach cleanly', async () => {
  const f = fixture(); f.start(); await settle();
  const video = new f.Video();
  const card = { querySelector: () => video, classList: { add() {} } };
  f.window.lgObserveBrandCard(card, true); await settle();
  assert.equal(video.paused, false);
  f.window.lgObserveBrandCard(card, false);
  const calls = video.plays;
  f.gesture(); await settle();
  assert.equal(video.paused, true);
  assert.equal(video.plays, calls);
  assert.equal([...video.events.values()].reduce((n, listeners) => n + listeners.size, 0), 0);
});
test('cards use only native video previews with MP4 first and lazy sources', () => {
  const html = readFileSync(join(__dirname, '../public/index.html'), 'utf8');
  const videos = [...html.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>/g)].map(m => m[0]);
  assert.equal(videos.length, 4);
  assert.doesNotMatch(html, /card-video-poster|\.card-video\.is-playing/);
  assert.doesNotMatch(html, /\.card-video\{[^}]*opacity/);
  for (const video of videos) {
    assert.match(video, /poster="[^"]+\.webp"/);
    assert.match(video, /muted loop playsinline webkit-playsinline/);
    assert.match(video, /<source data-src="[^"]+\.mp4" type="video\/mp4">\s*<source data-src="[^"]+\.webm"/);
    assert.doesNotMatch(video, /\scontrols(?:\s|=|>)/);
  }
  assert.ok(html.indexOf('/brand-videos.js?') < html.indexOf('/brand-rail.js?'));
});
