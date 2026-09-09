import { createHmac } from 'node:crypto';

export const ORIGINS = new Set([
  'https://www.lgtrading.it',
  'https://lgtrading.it',
  'https://lgtrading-landing.web.app',
  'https://lgtrading-landing.firebaseapp.com'
]);
const LIMIT = 16384;

export class ContactError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  if (Number(req.headers['content-length'] || 0) > LIMIT) {
    throw new ContactError(413, 'payload_too_large');
  }
  const raw = await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        chunks.length = 0;
        reject(new ContactError(413, 'payload_too_large'));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
  try {
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return body;
  } catch {
    throw new ContactError(400, 'invalid_json');
  }
}

export function validateContact(body) {
  const contact = {};
  for (const [key, max] of Object.entries({ referente: 120, email: 254, telefono: 40, messaggio: 2000 })) {
    if (typeof body[key] !== 'string') throw new ContactError(400, 'invalid_' + key);
    const value = body[key].trim();
    const controls = key === 'messaggio' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (!value || value.length > max || controls.test(value)) throw new ContactError(400, 'invalid_' + key);
    contact[key] = value;
  }
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(contact.email)) {
    throw new ContactError(400, 'invalid_email');
  }
  if (!/^[+0-9().\s-]+$/.test(contact.telefono) || contact.telefono.replace(/\D/g, '').length < 6) {
    throw new ContactError(400, 'invalid_telefono');
  }
  contact.email = contact.email.toLowerCase();
  contact.messaggio = contact.messaggio.replace(/\r\n?/g, '\n');
  return contact;
}

export function postmarkSender(token, fetchImpl = fetch, fromEmail = 'info@lgtrading.it') {
  if (!['info@lgtrading.it', 'info@ilovepaghe.com'].includes(fromEmail)) {
    throw new Error('Unsupported contact sender');
  }
  return async function send(contact, id) {
    let response;
    let result;
    try {
      response = await fetchImpl('https://api.postmarkapp.com/email', {
        method: 'POST',
        signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Postmark-Server-Token': token },
        body: JSON.stringify({
          From: 'LG Trading SRL <' + fromEmail + '>',
          To: 'info@lgtrading.it',
          ReplyTo: contact.email,
          Subject: 'Richiesta dal sito LG Trading — ' + contact.referente,
          TextBody: 'Nuova richiesta dal sito www.lgtrading.it\n\nNome referente: ' + contact.referente +
            '\nEmail: ' + contact.email + '\nTelefono: ' + contact.telefono +
            '\n\nMessaggio:\n' + contact.messaggio + '\n\nPer rispondere al referente, rispondere a questa email.',
          MessageStream: 'outbound',
          Tag: 'lgtrading-contact',
          Metadata: { contact_id: id },
          TrackOpens: false,
          TrackLinks: 'None'
        })
      });
      result = await response.json();
    } catch {
      throw new ContactError(503, 'delivery_unconfirmed');
    }
    if (!response.ok || result.ErrorCode !== 0 || !result.MessageID) {
      const error = new ContactError(503, 'send_failed');
      error.definitelyRejected = response.status >= 400 && response.status < 500;
      error.providerStatus = response.status;
      error.providerCode = result.ErrorCode;
      throw error;
    }
    return result.MessageID;
  };
}

export function createHandler({ store, send, hashSecret, version = 'development', now = Date.now, log = console.error }) {
  const hash = (value) => createHmac('sha256', hashSecret).update(value).digest('hex');
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const path = req.url.split('?')[0];
    if (path === '/api/contact/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, service: 'lgtrading-contact', version });
    }
    if (path !== '/api/contact') return json(res, 404, { ok: false, error: 'not_found' });
    const origin = req.headers.origin;
    if (!ORIGINS.has(origin)) return json(res, 403, { ok: false, error: 'origin_not_allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '3600');
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return json(res, 405, { ok: false, error: 'method_not_allowed' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return json(res, 415, { ok: false, error: 'json_required' });
    }
    try {
      const body = await readBody(req);
      if (body.website) return json(res, 200, { ok: true });
      const contact = validateContact(body);
      const elapsed = now() - Number(body.startedAt);
      if (!Number.isFinite(elapsed) || elapsed < 1000 || elapsed > 7 * 86400000) {
        throw new ContactError(400, 'invalid_timing');
      }
      // Persistent HMAC keys prevent repeat sends across retries, restarts and instances.
      // Contact content is sent to the mailbox only; it is not saved in Firestore.
      const id = hash(JSON.stringify(contact));
      const reservation = await store.reserve(id, hash(contact.email), now());
      if (reservation === 'sent') return json(res, 200, { ok: true });
      if (reservation !== 'reserved') throw new ContactError(409, 'delivery_unconfirmed');
      let messageId;
      try {
        messageId = await send(contact, id);
      } catch (error) {
        await store.finish(id, error.definitelyRejected ? 'failed' : 'unknown');
        throw error;
      }
      await store.finish(id, 'sent', messageId);
      return json(res, 200, { ok: true });
    } catch (error) {
      const status = error.status || 503;
      if (status === 429) res.setHeader('Retry-After', '3600');
      if (status >= 500) log(JSON.stringify({ event: 'contact_failed', code: error.code || 'service_unavailable', providerStatus: error.providerStatus, providerCode: error.providerCode }));
      return json(res, status, { ok: false, error: error.code || 'service_unavailable' });
    }
  };
}
