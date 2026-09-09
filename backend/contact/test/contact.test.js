import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler, postmarkSender, ContactError } from '../handler.js';

const NOW = 1800000000000;
const valid = { referente: 'Test LG Trading', email: 'test@example.com', telefono: '+39 123 456 7890', messaggio: 'Richiesta di informazioni.', website: '', startedAt: NOW - 5000 };

async function fixture(t, options = {}) {
  const records = new Map();
  let sends = 0;
  const store = {
    async reserve(id) {
      if (records.has(id) && records.get(id) !== 'failed') return records.get(id);
      records.set(id, 'pending');
      return 'reserved';
    },
    async finish(id, state) { records.set(id, state); }
  };
  const server = http.createServer(createHandler({
    store,
    send: async () => { sends++; if (options.send) return options.send(); return 'message-id'; },
    hashSecret: 'test-only-secret',
    now: () => NOW,
    log: () => {},
    ...options.handler
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    records, sends: () => sends,
    request: (body = valid, options = {}) => fetch(base + '/api/contact', {
      method: 'POST',
      headers: { Origin: 'https://www.lgtrading.it', 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(body),
      ...options
    })
  };
}

test('delivers once and confirms identical retries', async t => {
  const f = await fixture(t);
  const first = await f.request();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  assert.equal((await f.request()).status, 200);
  assert.equal(f.sends(), 1);
});

test('concurrent requests cannot duplicate the message', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { send: async () => { await gate; return 'message-id'; } });
  const first = f.request();
  while (!f.sends()) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.request()).status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.equal(f.sends(), 1);
});

test('rejects missing origins, cross-site calls and invalid inputs without sending', async t => {
  const f = await fixture(t);
  assert.equal((await f.request(valid, { headers: { 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await f.request(valid, { headers: { Origin: 'https://unrelated.example' } })).status, 403);
  for (const patch of [ { email: 'invalid' }, { email: 'hello@example.com\r\nBcc: other@example.com' }, { referente: 'Test\nInjected' }, { messaggio: '' }, { messaggio: 'x'.repeat(2001) }, { telefono: '++++++' }, { startedAt: NOW } ]) {
    assert.equal((await f.request({ ...valid, ...patch })).status, 400);
  }
  assert.equal(f.sends(), 0);
});

test('ignores honeypots, rejects non-JSON and oversized bodies', async t => {
  const f = await fixture(t);
  assert.equal((await f.request({ ...valid, website: 'spam.example' })).status, 200);
  assert.equal((await f.request(valid, { headers: { Origin: 'https://www.lgtrading.it', 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request({ ...valid, messaggio: 'x'.repeat(17000) })).status, 413);
  assert.equal(f.sends(), 0);
});

test('provider uncertainty is not reported as success or automatically retried', async t => {
  const f = await fixture(t, { send: () => { throw new ContactError(503, 'delivery_unconfirmed'); } });
  const result = await f.request();
  assert.equal(result.status, 503);
  assert.equal((await result.json()).ok, false);
  assert.equal((await f.request()).status, 409);
  assert.equal(f.sends(), 1);
});

test('definite rejection can be retried; rate limits never send', async t => {
  const f = await fixture(t, { send: () => { const error = new ContactError(503, 'send_failed'); error.definitelyRejected = true; throw error; } });
  assert.equal((await f.request()).status, 503);
  assert.equal((await f.request()).status, 503);
  assert.equal(f.sends(), 2);
  const limited = await fixture(t, { handler: { store: { reserve: async () => { throw new ContactError(429, 'rate_limited'); } } } });
  const result = await limited.request();
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('retry-after'), '3600');
  assert.equal(limited.sends(), 0);
});

test('mail destination and sender are fixed; visitor can only set ReplyTo', async () => {
  const send = postmarkSender('secret', async (url, config) => {
    assert.equal(url, 'https://api.postmarkapp.com/email');
    const payload = JSON.parse(config.body);
    assert.equal(payload.To, 'info@lgtrading.it');
    assert.equal(payload.From, 'LG Trading SRL <info@lgtrading.it>');
    assert.equal(payload.ReplyTo, valid.email);
    assert.equal(payload.TrackOpens, false);
    assert.equal(payload.TrackLinks, 'None');
    return { ok: true, status: 200, json: async () => ({ ErrorCode: 0, MessageID: 'accepted' }) };
  });
  assert.equal(await send({ ...valid, To: 'attacker@example.com' }, 'id'), 'accepted');
});

test('invalid Postmark acknowledgement is never success', async () => {
  const send = postmarkSender('secret', async () => ({ ok: true, status: 200, json: async () => ({ ErrorCode: 300 }) }));
  await assert.rejects(send(valid, 'id'), error => error.code === 'send_failed' && !error.definitelyRejected);
});

test('an explicitly configured verified sender keeps LG Trading identity and fixed recipient', async () => {
  const send = postmarkSender('secret', async (_url, config) => {
    const payload = JSON.parse(config.body);
    assert.equal(payload.From, 'LG Trading SRL <info@ilovepaghe.com>');
    assert.equal(payload.To, 'info@lgtrading.it');
    assert.equal(payload.ReplyTo, valid.email);
    return { ok: true, status: 200, json: async () => ({ ErrorCode: 0, MessageID: 'accepted' }) };
  }, 'info@ilovepaghe.com');
  assert.equal(await send(valid, 'id'), 'accepted');
  assert.throws(() => postmarkSender('secret', fetch, 'attacker@example.com'), /Unsupported contact sender/);
});
