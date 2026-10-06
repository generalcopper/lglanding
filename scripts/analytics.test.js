const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/../public/analytics.js', 'utf8');
const key = 'lg_analytics_consent_v1';
function setup(options = {}) {
  const calls = [], scripts = [], cookies = [], store = new Map(), listeners = {};
  if (options.choice !== undefined) store.set(key, JSON.stringify(options.choice));
  function element(tag) {
    return {tag, dataset: {}, handlers: {}, hidden: false, html: '', setAttribute() {},
      addEventListener(name, handler) {this.handlers[name] = handler;},
      appendChild(child) {if (tag === 'head') scripts.push(child);},
      focus() {this.focused = true;},
      set innerHTML(value) {this.html = value; this.buttons = ['false', 'true'].filter(v => value.includes('data-choice="' + v + '"')).map(v => {const b = element('button'); b.dataset.choice = v; return b;});},
      get innerHTML() {return this.html;},
      querySelectorAll() {return this.buttons || [];},
      querySelector() {return this.buttons[0];},
    };
  }
  const head = element('head'), footer = element('footer'), body = element('body');
  const window = {addEventListener(name, fn) {listeners[name] = fn;}};
  let panel;
  const document = {head, body, readyState: 'complete', referrer: 'https://example.com/private?email=test@example.com',
    createElement(tag) {const e = element(tag); if (tag === 'section') panel = e; return e;},
    querySelector() {return footer;},
    get cookie() {return '_ga=abc; _ga_QES62H0DND=xyz; necessary=keep';},
    set cookie(value) {cookies.push(value);},
  };
  const localStorage = {getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v)};
  const context = {window, document, localStorage, navigator: options.navigator || {},
    location: {hostname: 'www.lgtrading.it', pathname: '/', origin: 'https://www.lgtrading.it'}, URL, Date};
  vm.runInNewContext(source, context);
  return {window, scripts, cookies, store, panel, listeners, choose(value) {
    const button = panel.buttons.find(b => b.dataset.choice === String(value));
    button.handlers.click();
  }};
}
test('no Analytics script or data is sent before consent or after rejection', () => {
  const r = setup();
  assert.equal(r.scripts.length, 0);
  assert.equal(r.window.dataLayer, undefined);
  assert.equal(r.panel.hidden, false);
  r.choose(false);
  assert.equal(r.scripts.length, 0);
  assert.equal(JSON.parse(r.store.get(key)).analytics, false);
  assert.equal(r.window['ga-disable-G-QES62H0DND'], true);
});
test('consent loads exactly one tag, denies advertising and strips private URL data', () => {
  const r = setup(); r.choose(true); r.choose(true);
  assert.equal(r.scripts.length, 1);
  assert.equal(r.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-QES62H0DND');
  const calls = r.window.dataLayer.map(args => Array.from(args));
  assert.equal(calls[0][0], 'consent');
  assert.equal(calls[0][2].ad_user_data, 'denied');
  const config = calls.find(args => args[0] === 'config')[2];
  assert.equal(config.page_referrer, 'https://example.com/');
  assert.equal(config.page_location, 'https://www.lgtrading.it/');
  assert.equal(config.allow_google_signals, false);
  r.choose(false);
  assert.equal(r.window['ga-disable-G-QES62H0DND'], true);
  assert.ok(r.cookies.some(c => c.startsWith('_ga=; Max-Age=0')));
  assert.ok(r.cookies.every(c => !c.startsWith('necessary=')));
});
test('expired preferences, GPC, Do Not Track and automated checks do not enable statistics', () => {
  const choice = {version:1, analytics:true, at:Date.now()};
  assert.equal(setup({choice}).scripts.length, 1);
  assert.equal(setup({choice:{...choice, at:Date.now()-181*86400000}}).scripts.length, 0);
  for (const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'},{webdriver:true}]) {
    assert.equal(setup({choice, navigator}).scripts.length, 0);
  }
});
test('revocation in another tab immediately stops this tab', () => {
  const r = setup({choice:{version:1, analytics:true, at:Date.now()}});
  r.store.set(key, JSON.stringify({version:1, analytics:false, at:Date.now()}));
  r.listeners.storage({key});
  assert.equal(r.window['ga-disable-G-QES62H0DND'], true);
});
