(function () {
  'use strict';
  var measurementId = 'G-QES62H0DND';
  var storageKey = 'lg_analytics_consent_v1';
  var policyVersion = '2026-10-06';
  var cookieLifetime = 180 * 86400;
  var loaded = false;
  var panel, opener, expiryTimer, preferencesButton;
  var choice = readChoice();
  var allowedPaths = {'/': 'LG Trading SRL', '/privacy-policy': 'Privacy Policy — LG Trading SRL', '/cookie-policy': 'Cookie Policy — LG Trading SRL'};
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (path === '/index') path = '/';
  window['ga-disable-' + measurementId] = true;

  function blocked() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  }
  function expiresAt(at) {
    var date = new Date(at);
    var day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 6);
    var end = new Date(date.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, end.getUTCDate()));
    return date.getTime();
  }
  function readChoice() {
    try {
      var value = JSON.parse(localStorage.getItem(storageKey));
      if (value && value.version === 1 && typeof value.analytics === 'boolean' &&
          Number.isFinite(value.at) && value.at <= Date.now() && Date.now() < expiresAt(value.at) &&
          (!value.policy || value.policy === policyVersion)) return value;
    } catch (_) {}
    return null;
  }
  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) return;
      ['', '; Domain=' + location.hostname, '; Domain=.lgtrading.it'].forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; Path=/' + domain + '; SameSite=Lax; Secure';
      });
    });
  }
  function disable() {
    window['ga-disable-' + measurementId] = true;
    clearAnalyticsCookies();
    if (loaded) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied'
      });
    }
  }
  function enable() {
    if (blocked() || navigator.webdriver || !choice || !choice.analytics ||
        Date.now() >= expiresAt(choice.at) ||
        !['lgtrading.it', 'www.lgtrading.it'].includes(location.hostname) || !Object.hasOwn(allowedPaths, path)) return;
    window['ga-disable-' + measurementId] = false;
    if (loaded) {
      window.gtag('consent', 'update', {analytics_storage: 'granted'});
      return;
    }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    var referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch (_) {}
    window.gtag('config', measurementId, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_expires: Math.min(cookieLifetime, Math.floor((expiresAt(choice.at) - Date.now()) / 1000)),
      cookie_update: false, cookie_flags: 'SameSite=Lax;Secure',
      page_location: location.origin + path, page_title: allowedPaths[path], page_referrer: referrer
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!choice) return;
    expiryTimer = setTimeout(function () {
      if (Date.now() >= expiresAt(choice.at)) {
        choice = null;
        try { localStorage.removeItem(storageKey); } catch (_) {}
        var wasLoaded = loaded;
        disable();
        render(false);
        panel.hidden = false;
        if (wasLoaded) location.reload();
      } else scheduleExpiry();
    }, Math.min(expiresAt(choice.at) - Date.now(), 2147483647));
  }
  function save(analytics, action) {
    var at = Date.now();
    choice = {version: 1, policy: policyVersion, analytics: analytics === true && !blocked(), at: at, expiresAt: expiresAt(at), action: action};
    var saved = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(choice));
      saved = localStorage.getItem(storageKey) === JSON.stringify(choice);
    } catch (_) {}
    if (!saved) {
      choice.analytics = false;
      try { localStorage.removeItem(storageKey); } catch (_) {}
    }
    var wasLoaded = loaded;
    if (choice.analytics && saved) enable(); else disable();
    scheduleExpiry();
    if (!saved) {
      panel.querySelector('[data-storage-error]').hidden = false;
      return;
    }
    panel.hidden = true;
    if (opener) opener.focus({preventScroll: true});
    if (wasLoaded && !choice.analytics) location.reload();
  }
  function show(event) {
    opener = event && event.currentTarget;
    choice = readChoice();
    render(true);
    panel.hidden = false;
    panel.querySelector('#lg-consent-title').focus({preventScroll: true});
  }
  function render(settings) {
    panel.setAttribute('aria-describedby', settings ? 'lg-consent-settings-description' : 'lg-consent-description');
    var links = '<p class="lg-consent-links"><a href="/cookie-policy">Cookie Policy</a><a href="/privacy-policy">Privacy Policy</a></p>';
    var blockedNotice = blocked() ? '<p class="lg-consent-browser">Statistiche disattivate dalle impostazioni del browser.</p>' : '';
    if (settings) {
      panel.innerHTML = '<h2 id="lg-consent-title" tabindex="-1">Preferenze cookie</h2>' +
        '<p id="lg-consent-settings-description">Puoi modificare o revocare il consenso in qualsiasi momento.</p>' +
        '<div class="lg-consent-category"><div><strong>Necessari</strong><p>Memorizzano la tua scelta sui cookie.</p></div><span class="lg-consent-status">Sempre attivi</span></div>' +
        '<div class="lg-consent-category"><div><label for="lg-consent-analytics">Statistiche · Google Analytics</label><p>Misurano visite e utilizzo del sito.</p></div>' +
        '<input type="checkbox" id="lg-consent-analytics" aria-label="Consenti cookie statistici di Google Analytics"' + (blocked() ? ' disabled' : '') + '></div>' +
        blockedNotice + links +
        '<div class="lg-consent-actions"><button type="button" data-action="reject">Rifiuta</button><button type="button" data-action="save">Salva preferenze</button></div>' +
        '<button type="button" class="lg-consent-back" data-action="back">' + (choice ? 'Annulla' : 'Indietro') + '</button>';
    } else {
      panel.innerHTML = '<h2 id="lg-consent-title" tabindex="-1">Cookie</h2>' +
        '<p id="lg-consent-description">LG Trading SRL utilizza cookie tecnici e, con il tuo consenso, cookie statistici di Google Analytics. Puoi accettare, rifiutare o scegliere le tue preferenze.</p>' +
        blockedNotice + links +
        '<div class="lg-consent-actions"><button type="button" data-action="reject">Rifiuta</button><button type="button" data-action="settings">Preferenze</button><button type="button" data-action="accept"' + (blocked() ? ' disabled' : '') + '>Accetta tutti</button></div>';
    }
    panel.innerHTML += '<p class="lg-consent-error" data-storage-error role="status" hidden>Impossibile salvare la scelta. Abilita la memorizzazione dei dati del sito nelle impostazioni del browser. Le statistiche restano disattivate.</p>';
    if (settings) panel.querySelector('#lg-consent-analytics').checked = !!(choice && choice.analytics && !blocked());
    panel.querySelectorAll('[data-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.dataset.action;
        if (action === 'accept') save(true, 'accept');
        if (action === 'reject') save(false, 'reject');
        if (action === 'save') save(panel.querySelector('#lg-consent-analytics').checked, 'preferences');
        if (action === 'settings') {
          render(true);
          panel.querySelector('#lg-consent-title').focus({preventScroll: true});
        }
        if (action === 'back') {
          if (choice) {
            panel.hidden = true;
            if (opener) opener.focus({preventScroll: true});
          } else {
            render(false);
            panel.querySelector('[data-action="settings"]').focus({preventScroll: true});
          }
        }
      });
    });
  }
  function syncChoice() {
    choice = readChoice();
    var wasLoaded = loaded;
    if (choice && choice.analytics && !blocked()) enable(); else disable();
    scheduleExpiry();
    render(false);
    panel.hidden = !!choice;
    if (wasLoaded && (!choice || !choice.analytics || blocked())) location.reload();
  }
  function initialise() {
    panel = document.createElement('section');
    panel.className = 'lg-consent';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'lg-consent-title');
    render(false);
    panel.hidden = !!choice;
    document.body.appendChild(panel);
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!choice) save(false, 'reject');
      else {
        panel.hidden = true;
        if (opener) opener.focus({preventScroll: true});
      }
    });
    preferencesButton = document.createElement('button');
    preferencesButton.type = 'button';
    preferencesButton.className = 'lg-cookie-preferences';
    preferencesButton.textContent = 'Preferenze cookie';
    preferencesButton.addEventListener('click', show);
    (document.querySelector('.fb-links') || document.querySelector('footer') || document.body).appendChild(preferencesButton);
    document.querySelectorAll('[data-cookie-preferences]').forEach(function (button) { button.addEventListener('click', show); });
    if (choice && choice.analytics && !blocked()) enable(); else disable();
    scheduleExpiry();
    window.addEventListener('storage', function (event) {
      if (event.key === storageKey || event.key === null) syncChoice();
    });
    window.addEventListener('pageshow', function (event) { if (event.persisted) syncChoice(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && (choice && Date.now() >= expiresAt(choice.at) || blocked())) syncChoice();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, {once: true});
  else initialise();
}());
