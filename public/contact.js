(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;
  var success = document.getElementById('formSuccess');
  var errorBox = document.getElementById('formError');
  var button = form.querySelector('button[type="submit"]');
  var buttonLabel = button.innerHTML;
  var startedAt = Date.now();
  var sending = false;
  var fields = Array.from(form.querySelectorAll('[required]'));
  var emailRe = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;

  function validateField(field) {
    var value = field.value.trim();
    var valid = value.length > 0 && (field.maxLength < 0 || value.length <= field.maxLength);
    if (valid && field.type === 'email') valid = emailRe.test(value);
    if (valid && field.name === 'telefono') valid = /^[+0-9().\s-]+$/.test(value) && value.replace(/\D/g, '').length >= 6;
    field.closest('.field').classList.toggle('invalid', !valid);
    field.setAttribute('aria-invalid', String(!valid));
    return valid;
  }

  fields.forEach(function (field) {
    var hint = field.closest('.field').querySelector('.err');
    hint.id = field.id + 'Error';
    field.setAttribute('aria-describedby', hint.id);
    field.addEventListener('blur', function () { if (field.value.trim()) validateField(field); });
    field.addEventListener('input', function () {
      if (field.getAttribute('aria-invalid') === 'true') validateField(field);
    });
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending) return;
    errorBox.hidden = true;
    var invalid = fields.filter(function (field) { return !validateField(field); });
    if (invalid.length) { invalid[0].focus(); return; }
    // Keep the existing email handoff until the cloud endpoint is deployed and verified.
    // Activation only requires changing the form action to the deployed HTTPS endpoint.
    if (form.action.indexOf('mailto:') === 0) {
      var subject = 'Richiesta dal sito LG Trading SRL - ' + form.elements.referente.value.trim();
      var body = 'Nome referente: ' + form.elements.referente.value.trim() +
        '\nEmail: ' + form.elements.email.value.trim() +
        '\nTelefono: ' + form.elements.telefono.value.trim() +
        '\n\nMessaggio:\n' + form.elements.messaggio.value.trim();
      window.location.href = 'mailto:info@lgtrading.it?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      success.querySelector('h3').textContent = 'Completa l’invio';
      success.querySelector('p').textContent = 'Per inviare la richiesta, confermate il messaggio nel vostro programma di posta. Potete anche scrivere direttamente a info@lgtrading.it.';
      form.style.display = 'none';
      success.classList.add('show');
      success.focus({ preventScroll: true });
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (Date.now() - startedAt < 1000) {
      errorBox.textContent = 'Attendete un istante prima di inviare la richiesta.';
      errorBox.hidden = false;
      return;
    }
    sending = true;
    button.disabled = true;
    button.textContent = 'Invio in corso…';
    form.setAttribute('aria-busy', 'true');
    fields.forEach(function (field) { field.readOnly = true; });
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 25000);
    try {
      var payload = { website: form.elements.website.value, startedAt: startedAt };
      fields.forEach(function (field) { payload[field.name] = field.value.trim(); });
      var response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || result.ok !== true) {
        var error = new Error('send_failed');
        error.code = result.error;
        throw error;
      }
      form.style.display = 'none';
      success.querySelector('h3').textContent = 'Richiesta inviata';
      success.querySelector('p').textContent = 'Grazie per averci contattato. Il nostro team ha ricevuto la richiesta e vi risponderà all’indirizzo email indicato.';
      success.classList.add('show');
      success.focus({ preventScroll: true });
      success.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    } catch (error) {
      var messages = {
        rate_limited: 'Sono già state inviate diverse richieste. Riprovate tra un’ora oppure scrivete a info@lgtrading.it.',
        delivery_unconfirmed: 'Non riusciamo ancora a confermare l’invio. Attendete qualche istante e riprovate; in alternativa scrivete a info@lgtrading.it.',
        invalid_referente: 'Controllate il nome del referente.',
        invalid_email: 'Controllate l’indirizzo email.',
        invalid_telefono: 'Controllate il numero di telefono.',
        invalid_messaggio: 'Controllate il messaggio: è possibile inserire fino a 2.000 caratteri.'
      };
      errorBox.textContent = messages[error.code] || 'Non è stato possibile confermare l’invio. I dati sono ancora nel modulo: riprovate oppure scrivete a info@lgtrading.it.';
      errorBox.hidden = false;
      if (error.code === 'invalid_timing') startedAt = Date.now();
    } finally {
      clearTimeout(timer);
      sending = false;
      button.disabled = false;
      button.innerHTML = buttonLabel;
      form.removeAttribute('aria-busy');
      fields.forEach(function (field) { field.readOnly = false; });
    }
  });
})();
