import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const pages = ['index.html', 'privacy-policy.html', 'cookie-policy.html', '404.html'];
const files = [...pages, 'analytics.js', 'analytics.css', 'brand-rail.js'];
const cards = ['bionee', 'ilovepaghe', 'cedoly', 'capannone3d', 'ubi-ia', 'picking'];
const html = readFileSync('public/index.html', 'utf8');
const actualCards = [...html.matchAll(/<a id="([^"]+)" class="card /g)].map(match => match[1]);
assert.deepEqual(actualCards, cards, 'The complete published card list and order must be preserved');
for (const card of cards) {
  assert.ok(html.includes('href="#' + card + '"'), 'Missing navigation: ' + card);
}
for (const page of pages) {
  const content = readFileSync('public/' + page, 'utf8');
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(content), 'Unresolved merge conflict');
  assert.ok(content.includes('/analytics.js?v=20261006-consent'), 'Missing current consent script');
  assert.ok(content.includes('/analytics.css?v=20261006-consent'), 'Missing current consent style');
  for (const match of content.matchAll(/\b(?:src|href|poster|data-src)="(\/[^"#]+)"/g)) {
    const pathname = decodeURIComponent(new URL(match[1], 'https://www.lgtrading.it').pathname);
    if (/\.[a-z0-9]+$/i.test(pathname)) assert.ok(existsSync('public' + pathname), 'Missing asset: ' + pathname);
  }
}
console.log('Verified all six cards, navigation, consent references and page assets.');
if (process.argv.includes('--check-only')) process.exit(0);

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Production is deployed only by the tracked GitHub workflow');
assert.equal(process.env.GITHUB_REPOSITORY, 'generalcopper/lglanding', 'Unexpected repository');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main may deploy production');
const commit = git('rev-parse', 'HEAD');
assert.equal(commit, process.env.GITHUB_SHA, 'The workflow must deploy its exact commit');
assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], commit, 'A newer main commit exists; stale deploy blocked');
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'public', 'firebase.json', 'scripts', '.github']);

const base = 'https://www.lgtrading.it';
async function get(pathname) {
  return fetch(base + pathname + '?release-check=' + Date.now(), {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000)
  });
}
const response = await get('/release.json');
let previous;
if (response.status === 404) {
  // One-time adoption of the exact production version observed before recovery.
  const baseline = '8cfee032b19fcaa133e739c2adcfe2990357a0e1';
  previous = { sourceCommit: baseline, files: Object.fromEntries(files.map(name => [name,
    sha256(execFileSync('git', ['show', baseline + ':public/' + name]))])) };
} else {
  assert.equal(response.status, 200, 'Cannot verify the current production release');
  previous = await response.json();
  assert.equal(previous.schema, 1, 'Unknown release manifest');
}
assert.match(previous.sourceCommit, /^[a-f0-9]{40}$/, 'Invalid production commit');
execFileSync('git', ['merge-base', '--is-ancestor', previous.sourceCommit, commit]);
await Promise.all(files.map(async name => {
  assert.match(previous.files[name] || '', /^[a-f0-9]{64}$/, 'Missing production fingerprint: ' + name);
  const live = await get(name === 'index.html' ? '/' : '/' + name.replace(/\.html$/, ''));
  assert.equal(live.status, 200, 'Cannot read current production file: ' + name);
  assert.equal(sha256(Buffer.from(await live.arrayBuffer())), previous.files[name],
    'Production changed outside its recorded release; reconcile before deploying: ' + name);
}));
const manifest = { schema: 1, sourceCommit: commit, createdAt: new Date().toISOString(), cards,
  files: Object.fromEntries(files.map(name => [name, sha256(readFileSync('public/' + name))])) };
writeFileSync('public/release.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Production matches its recorded source; prepared release ' + commit);
