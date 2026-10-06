const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/../public/analytics.js', 'utf8');
const key = 'lg_analytics_consent_v1';
const flag = 'ga-disable-G-QES62H0DND';

function setup(options = {}) {
  const scripts = [], cookies = [], store = new Map(), listeners = {}, documentListeners = {}, timers = new Map();
  let now = options.now || Date.UTC(2026, 9, 6, 20), sequence = 0, reloads = 0, panel, focused;
  if (options.choice !== undefined) store.set(key, typeof options.choice === 'string' ? options.choice : JSON.stringify(options.choice));
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  function element(tag, attributes = '') {
    const e = {tag, dataset: {}, handlers: {}, children: [], hidden: /\bhidden\b/.test(attributes), disabled: /\bdisabled\b/.test(attributes), checked: false, html: '',
      setAttribute(name, value) { this[name] = value; },
      addEventListener(name, handler) {this.handlers[name] = handler;},
      appendChild(child) {this.children.push(child); if (tag === 'head') scripts.push(child);},
      focus() {focused = this;},
      set innerHTML(value) {
        this.html = value; this.children = [];
        for (const match of value.matchAll(/<(h2|p|button|input)\b([^>]*)>/g)) this.children.push(element(match[1], match[2]));
      },
      get innerHTML() {return this.html;},
      querySelectorAll(selector) {
        if (selector === '[data-action]') return this.children.filter(c => c.dataset.action);
        return this.children.filter(c => c.matches(selector));
      },
      querySelector(selector) {return this.querySelectorAll(selector)[0] || null;},
      matches(selector) {
        if (selector.startsWith('#')) return this.id === selector.slice(1);
        if (selector === '[data-storage-error]') return this.storageError;
        const action = /^\[data-action="([^"]+)"\]$/.exec(selector);
        return !!action && this.dataset.action === action[1];
      }
    };
    for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {
      if (name === 'data-action') e.dataset.action = value;
      else e[name] = value;
    }
    e.storageError = /\bdata-storage-error\b/.test(attributes);
    return e;
  }
  const head = element('head'), footer = element('footer'), body = element('body'), policyButton = element('button');
  const window = {addEventListener(name, fn) {listeners[name] = fn;}};
  const document = {head, body, visibilityState: 'visible', readyState: 'complete',
    referrer: 'https://example.com/private?email=test@example.com',
    createElement(tag) {const e = element(tag); if (tag === 'section') panel = e; return e;},
    querySelector() {return footer;},
    querySelectorAll(selector) {return selector === '[data-cookie-preferences]' ? [policyButton] : [];},
    addEventListener(name, fn) {documentListeners[name] = fn;},
    get cookie() {return '_ga=abc; _ga_QES62H0DND=xyz; necessary=keep';},
    set cookie(value) {cookies.push(value);}
  };
  const localStorage = {
    getItem(k) {if (options.storageReadError) throw new Error('disabled'); return store.get(k) || null;},
    setItem(k,v) {if (options.storageWriteError) throw new Error('disabled'); store.set(k,v);},
    removeItem(k) {store.delete(k);}
  };
  const navigator = options.navigator || {};
  const context = {window, document, localStorage, navigator,
    location: {hostname: options.host || 'www.lgtrading.it', pathname: options.path || '/', origin: 'https://' + (options.host || 'www.lgtrading.it'), reload() {reloads++;}},
    URL, Date:Clock, setTimeout(fn, ms) {const id = ++sequence; timers.set(id, {fn,ms}); return id;}, clearTimeout(id) {timers.delete(id);}
  };
  vm.runInNewContext(source, context);
  return {window, scripts, cookies, store, panel, listeners, documentListeners, navigator, timers,
    get focused() {return focused;}, get reloads() {return reloads;},
    saved() {return JSON.parse(store.get(key));},
    act(action) {
      const b = panel.querySelector('[data-action="' + action + '"]');
      assert.ok(b, 'missing action: ' + action); assert.equal(b.disabled, false);
      b.handlers.click();
    },
    reopen() {const b = footer.children[0]; b.handlers.click({currentTarget: b});},
    policyOpen() {policyButton.handlers.click({currentTarget: policyButton});},
    tick(at) {now = at; const timer = timers.values().next().value; assert.ok(timer); timer.fn();}
  };
}

test('first visit has reject, preferences and accept; no Analytics before a choice', () => {
  const r = setup();
  assert.equal(r.scripts.length, 0);
  assert.equal(r.window.dataLayer, undefined);
  assert.equal(r.window[flag], true);
  assert.equal(r.panel.hidden, false);
  assert.match(r.panel.innerHTML, /Accetta tutti/);
  assert.match(r.panel.innerHTML, /href="\/cookie-policy"/);
  assert.match(r.panel.innerHTML, /href="\/privacy-policy"/);
  for (const action of ['reject','settings','accept']) assert.ok(r.panel.querySelector('[data-action="' + action + '"]'));
  r.act('reject');
  assert.equal(r.scripts.length, 0);
  assert.equal(r.saved().analytics, false);
  assert.equal(r.saved().action, 'reject');
  assert.equal(r.panel.hidden, true);
  assert.equal(setup({choice:r.saved()}).panel.hidden, true);
});

test('accept sends one tag, records the choice and excludes advertising and private URL data', () => {
  const r = setup();
  r.act('accept'); r.reopen(); r.act('save');
  assert.equal(r.scripts.length, 1);
  assert.equal(r.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-QES62H0DND');
  assert.equal(r.saved().analytics, true);
  assert.equal(r.saved().policy, '2026-10-06');
  assert.equal(r.saved().expiresAt, Date.UTC(2027,3,6,20));
  const calls = r.window.dataLayer.map(args => Array.from(args));
  assert.equal(calls[0][0], 'consent');
  for (const field of ['analytics_storage','ad_storage','ad_user_data','ad_personalization']) assert.equal(calls[0][2][field], 'denied');
  const config = calls.find(args => args[0] === 'config')[2];
  assert.equal(config.page_referrer, 'https://example.com/');
  assert.equal(config.page_location, 'https://www.lgtrading.it/');
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.cookie_update, false);
  assert.ok(config.cookie_expires <= 180 * 86400);
});

test('preferences default to off; only explicit save enables statistics', () => {
  const r = setup(); r.act('settings');
  const checkbox = r.panel.querySelector('#lg-consent-analytics');
  assert.equal(checkbox.checked, false);
  assert.equal(r.scripts.length, 0);
  checkbox.checked = true;
  assert.equal(r.scripts.length, 0);
  r.act('save');
  assert.equal(r.scripts.length, 1);
  assert.equal(r.saved().action, 'preferences');
  r.reopen();
  assert.equal(r.panel.querySelector('#lg-consent-analytics').checked, true);
  r.panel.querySelector('#lg-consent-analytics').checked = false;
  r.act('back');
  assert.equal(r.saved().analytics, true, 'cancel does not silently change consent');
});

test('revocation from the footer or policy disables Analytics, deletes its cookies and reloads', () => {
  const r = setup(); r.act('accept'); r.reopen();
  r.panel.querySelector('#lg-consent-analytics').checked = false;
  r.act('save');
  assert.equal(r.saved().analytics, false);
  assert.equal(r.window[flag], true);
  assert.equal(r.reloads, 1);
  assert.ok(r.cookies.some(c => c.startsWith('_ga=; Max-Age=0')));
  assert.ok(r.cookies.some(c => c.includes('Domain=.lgtrading.it')));
  assert.ok(r.cookies.every(c => !c.startsWith('necessary=')));
  const next = setup({choice:r.saved()}); next.policyOpen();
  assert.equal(next.panel.hidden, false);
  assert.equal(next.panel.querySelector('#lg-consent-analytics').checked, false);
  assert.equal(next.scripts.length, 0);
});

test('six calendar months are respected, including legacy choices and end-of-month dates', () => {
  const at = Date.UTC(2026,2,31,12);
  const choice = {version:1, analytics:false, at};
  assert.equal(setup({choice,now:Date.UTC(2026,8,29,12)}).panel.hidden, true, 'do not re-prompt after just 180 days');
  assert.equal(setup({choice,now:Date.UTC(2026,8,30,12)}).panel.hidden, false);
  const legacy = setup({choice:{version:1,analytics:true,at:Date.UTC(2026,9,5,20)}});
  assert.equal(legacy.scripts.length, 1);
});

test('invalid, future, expired and changed-policy records cannot enable Analytics', () => {
  const at = Date.UTC(2026,9,6,20);
  for (const choice of ['invalid', {version:1,analytics:'true',at}, {version:1,analytics:true,at:at+1},
    {version:2,analytics:true,at}, {version:1,analytics:true,at,policy:'unknown'},
    {version:1,analytics:true,at:Date.UTC(2026,3,6,20)}]) {
    const r=setup({choice}); assert.equal(r.scripts.length,0); assert.equal(r.panel.hidden,false);
  }
});

test('GPC, Do Not Track, automation and unpublished domains do not load Analytics', () => {
  const choice={version:1,analytics:true,at:Date.UTC(2026,9,5,20)};
  for (const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'},{webdriver:true}]) {
    const r=setup({choice,navigator}); assert.equal(r.scripts.length,0);
    r.reopen();
    if (!navigator.webdriver) assert.equal(r.panel.querySelector('#lg-consent-analytics').disabled,true);
  }
  for (const host of ['localhost','lgtrading-landing.web.app']) assert.equal(setup({choice,host}).scripts.length,0);
  assert.equal(setup({choice,path:'/not-found'}).scripts.length,0);
});

test('expiry and cross-tab withdrawal stop active statistics', () => {
  const r=setup(); r.act('accept'); r.tick(Date.UTC(2027,3,6,20));
  assert.equal(r.window[flag],true); assert.equal(r.store.has(key),false); assert.equal(r.reloads,1);
  const second=setup(); second.act('accept');
  second.store.set(key,JSON.stringify({...second.saved(),analytics:false}));
  second.listeners.storage({key});
  assert.equal(second.window[flag],true); assert.equal(second.reloads,1);
  const third=setup(); third.act('accept'); third.store.clear(); third.listeners.storage({key:null});
  assert.equal(third.window[flag],true); assert.equal(third.panel.hidden,false);
});

test('blocked storage never activates Analytics and removes an obsolete stored acceptance', () => {
  const r=setup({storageWriteError:true}); r.act('accept');
  assert.equal(r.scripts.length,0); assert.equal(r.window[flag],true);
  assert.equal(r.panel.querySelector('[data-storage-error]').hidden,false);
  const old=setup({storageWriteError:true,choice:{version:1,analytics:true,at:Date.UTC(2026,9,5,20)}});
  old.reopen(); old.act('reject');
  assert.equal(old.window[flag],true); assert.equal(old.store.has(key),false);
  assert.equal(setup({storageReadError:true}).scripts.length,0);
});

test('Escape rejects an undecided banner and cancels edits to an existing choice', () => {
  const r=setup(); r.panel.handlers.keydown({key:'Escape'});
  assert.equal(r.saved().analytics,false); assert.equal(r.scripts.length,0);
  const second=setup(); second.act('accept'); second.reopen();
  second.panel.querySelector('#lg-consent-analytics').checked=false;
  second.panel.handlers.keydown({key:'Escape'});
  assert.equal(second.saved().analytics,true);
});

test('all served pages expose the same current consent controls and legal links', () => {
  for (const page of ['index','privacy-policy','cookie-policy','404']) {
    const html=fs.readFileSync(__dirname + '/../public/'+page+'.html','utf8');
    assert.match(html,/\/analytics\.css\?v=20261006-consent/);
    assert.match(html,/\/analytics\.js\?v=20261006-consent/);
    assert.match(html,/href="\/privacy-policy"/);
    assert.match(html,/href="\/cookie-policy"/);
  }
  const css=fs.readFileSync(__dirname + '/../public/analytics.css','utf8');
  assert.match(css,/background:#000;color:#fff/);
  const cookies=fs.readFileSync(__dirname + '/../public/cookie-policy.html','utf8');
  assert.match(cookies,/lg_analytics_consent_v1/);
  assert.match(cookies,/_ga_QES62H0DND/);
  assert.match(cookies,/data-cookie-preferences/);
});
