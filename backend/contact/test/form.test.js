import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../../public/contact.js', import.meta.url), 'utf8');

function setup(action, fetchImpl) {
  let now = 1800000000000;
  function element() {
    const attributes = new Map();
    const classes = new Set();
    return {
      value: '', style: {}, listeners: {}, classList: {
        add: value => classes.add(value),
        toggle: (value, active) => active ? classes.add(value) : classes.delete(value),
        contains: value => classes.has(value)
      },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      removeAttribute: name => attributes.delete(name),
      addEventListener(name, listener) { this.listeners[name] = listener; },
      focus() {}, scrollIntoView() {}
    };
  }
  const values = { referente: 'Test LG Trading', email: 'test@example.com', telefono: '+39 123 456 7890', messaggio: 'Richiesta di informazioni.' };
  const fields = Object.entries(values).map(([name, value]) => {
    const field = Object.assign(element(), { id: name, name, value, maxLength: 2000, type: name === 'email' ? 'email' : 'text' });
    const wrapper = element();
    const hint = element();
    wrapper.querySelector = () => hint;
    field.closest = () => wrapper;
    return field;
  });
  const button = Object.assign(element(), { innerHTML: 'Invia', disabled: false });
  const error = Object.assign(element(), { hidden: true });
  const success = element();
  const heading = element();
  const message = element();
  success.querySelector = selector => selector === 'h3' ? heading : message;
  const form = Object.assign(element(), { action, elements: { ...Object.fromEntries(fields.map(field => [field.name, field])), website: { value: '' } }, querySelector: () => button, querySelectorAll: () => fields });
  const location = {};
  const context = vm.createContext({
    document: { getElementById: id => ({ contactForm: form, formSuccess: success, formError: error }[id]) },
    window: { location, matchMedia: () => ({ matches: true }) },
    Date: { now: () => now }, AbortController, setTimeout, clearTimeout, fetch: fetchImpl
  });
  vm.runInContext(source, context);
  now += 5000;
  return { form, button, error, success, heading, message, location, fields, submit: () => form.listeners.submit({ preventDefault() {} }) };
}

test('existing email fallback opens a draft and does not claim cloud delivery', async () => {
  const page = setup('mailto:info@lgtrading.it', () => { throw new Error('No backend call expected'); });
  await page.submit();
  assert.ok(page.location.href.startsWith('mailto:info@lgtrading.it?subject='));
  assert.match(page.heading.textContent, /Completa/);
  assert.doesNotMatch(page.message.textContent, /ricevuto/);
});

test('network failure preserves form data and enables retry', async () => {
  const page = setup('https://contacts.example/api/contact', async () => { throw new Error('offline'); });
  await page.submit();
  assert.equal(page.error.hidden, false);
  assert.equal(page.form.style.display, undefined);
  assert.equal(page.button.disabled, false);
  assert.equal(page.fields[0].value, 'Test LG Trading');
  assert.equal(page.success.classList.contains('show'), false);
});

test('cloud success appears only after confirmed acceptance; repeated clicks send once', async () => {
  let resolve;
  let calls = 0;
  const response = new Promise(done => { resolve = done; });
  const page = setup('https://contacts.example/api/contact', () => { calls++; return response; });
  const submission = page.submit();
  assert.equal(page.button.disabled, true);
  assert.equal(page.success.classList.contains('show'), false);
  await page.submit();
  assert.equal(calls, 1);
  resolve({ ok: true, json: async () => ({ ok: true }) });
  await submission;
  assert.equal(page.success.classList.contains('show'), true);
  assert.equal(page.heading.textContent, 'Richiesta inviata');
});
