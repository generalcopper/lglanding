// Controlli sulla struttura delle pagine da cui dipendono contact.js, brand-videos.js e la navigazione.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = name => readFileSync(join(__dirname, '../public', name), 'utf8');
const index = read('index.html');
const cards = ['bionee', 'ilovepaghe', 'cedoly', 'picking'];

function block(html, open, tag) {
  const start = html.indexOf(open);
  assert.ok(start >= 0, 'Missing ' + open);
  const end = html.indexOf('</' + tag + '>', start);
  assert.ok(end > start, 'Unclosed ' + open);
  return html.slice(start, end);
}

test('every card is reachable from a navigation landmark', () => {
  const navs = [...index.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)].map(m => m[0]).join('\n');
  for (const card of cards) {
    assert.match(navs, new RegExp('href="#' + card + '"'), 'No <nav> link to #' + card);
    assert.equal([...index.matchAll(new RegExp('id="' + card + '"', 'g'))].length, 1, 'Duplicate or missing id ' + card);
  }
});

test('each card keeps one lazy video registered by brand-videos.js', () => {
  for (const card of cards) {
    const markup = block(index, '<a id="' + card + '" class="card ', 'a');
    assert.equal((markup.match(/<video\b[^>]*class="card-video"/g) || []).length, 1, card + ' video');
    assert.match(markup, /<img\b[^>]*alt="[^"]+"/, card + ' logo alt text');
  }
});

test('contact form markup matches contact.js', () => {
  const form = block(index, '<form id="contactForm"', 'form');
  assert.match(form, /action="https:\/\/[^"]+\/api\/contact"/);
  assert.match(form, /<button type="submit"/);
  assert.match(form, /id="formError"[^>]*role="alert"[^>]*hidden/);
  assert.match(form, /<input id="website" name="website"/);
  const fields = form.split('<div class="field">').slice(1);
  const required = fields.filter(field => /\brequired\b/.test(field));
  assert.deepEqual(required.map(field => /name="([^"]+)"/.exec(field)[1]), ['referente', 'email', 'telefono', 'messaggio']);
  for (const field of required) assert.match(field, /<span class="err">[^<]+<\/span>/, 'Missing .err hint');
  assert.match(index, /id="formSuccess"[^>]*role="status"[^>]*>[\s\S]*?<h3>[^<]+<\/h3>\s*<p>[^<]+<\/p>/, 'formSuccess needs h3 and p');
});

test('the iLovePaghe dashboard is drawn in HTML and animated with CSS, not a video', () => {
  const hero = block(index, '<section class="hero"', 'section');
  assert.match(hero, /<div class="ilpd" id="ilovepaghe-demo" data-nosnippet>/);
  assert.match(hero, /<div class="ilpdScreen" role="img" aria-label="[^"]+">/);
  assert.match(hero, /<div class="ilpdCam" aria-hidden="true" inert>/);
  const demo = hero.slice(hero.indexOf('<div class="ilpd"'), hero.indexOf('<!-- demo:fine'));
  assert.ok(demo.length > 1000, 'demo block');
  assert.doesNotMatch(demo, /<video\b|<main\b|<nav\b|<h[1-6]\b/);
  assert.equal((index.match(/<main\b/g) || []).length, 1, 'one main element only');
  assert.equal((index.match(/<h1\b/g) || []).length, 1, 'one h1 only');
  assert.match(index, /<link rel="stylesheet" href="\/ilovepaghe-demo\.css\?v=[^"]+">/);
  assert.match(index, /<noscript><link rel="stylesheet" href="\/ilovepaghe-demo-static\.css\?v=[^"]+"><\/noscript>/);
  assert.match(index, /<script src="\/ilovepaghe-demo\.js\?v=[^"]+" defer><\/script>/);
  const css = read('ilovepaghe-demo.css');
  assert.match(css, /--u:calc\(100cqw \/ 1440\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css.replace(/@keyframes[\s\S]*$/, ''), /\btransition\s*:/, 'the scene moves only by keyframes');
});

test('shared chrome and consent assets are present on every page', () => {
  for (const page of ['index.html', 'privacy-policy.html', 'cookie-policy.html', '404.html']) {
    const html = read(page);
    assert.match(html, /<link rel="stylesheet" href="\/site\.css\?v=[^"]+">/, page + ' site.css');
    assert.match(html, /<script src="\/site\.js\?v=[^"]+" defer><\/script>/, page + ' site.js');
    assert.match(html, /<header class="header" id="header">[\s\S]*id="burger"/, page + ' header');
    assert.match(html, /id="mobileNav"/, page + ' mobile menu');
    assert.match(html, /<div class="fb-links">/, page + ' footer links for cookie preferences');
    assert.match(html, /id="contenuto"/, page + ' skip-link target');
    assert.ok(html.indexOf('/site.css?') < html.indexOf('/analytics.css?'), page + ' consent styles load last');
  }
});
