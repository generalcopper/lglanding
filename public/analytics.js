(function () {
  'use strict';
  var measurementId = 'G-QES62H0DND';
  var storageKey = 'lg_analytics_consent_v1';
  var lifetime = 180 * 86400000;
  var loaded = false;
  var panel;
  var opener;
  var choice = readChoice();
  var allowedPaths = {'/': 'LG Trading SRL', '/privacy-policy': 'Privacy Policy — LG Trading SRL', '/cookie-policy': 'Cookie Policy — LG Trading SRL'};
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (path === '/index') path = '/';
  var blocked = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  window['ga-disable-' + measurementId] = true;

  function readChoice() {
    try {
      var value = JSON.parse(localStorage.getItem(storageKey));
      if (value && value.version === 1 && typeof value.analytics === 'boolean' &&
          Number.isFinite(value.at) && value.at <= Date.now() && Date.now() - value.at < lifetime) return value;
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
    if (loaded) window.gtag('consent', 'update', {analytics_storage: 'denied'});
  }
  function enable() {
    if (blocked || navigator.webdriver || !choice || !choice.analytics ||
        !['lgtrading.it', 'www.lgtrading.it'].includes(location.hostname) || !Object.hasOwn(allowedPaths, path)) return;
    window['ga-disable-' + measurementId] = false;
    if (loaded) { window.gtag('consent', 'update', {analytics_storage: 'granted'}); return; }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    var referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch (_) {}
    window.gtag('config', measurementId, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_expires: lifetime / 1000, cookie_flags: 'SameSite=Lax;Secure',
      page_location: location.origin + path, page_title: allowedPaths[path], page_referrer: referrer
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }
  function save(analytics) {
    choice = {version: 1, analytics: analytics && !blocked, at: Date.now()};
    try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch (_) {}
    if (choice.analytics) enable(); else disable();
    panel.hidden = true;
    if (opener) opener.focus();
  }
  function show(event) {
    opener = event && event.currentTarget;
    panel.hidden = false;
    panel.querySelector('[data-choice="false"]').focus();
  }
  function initialise() {
    panel = document.createElement('section');
    panel.className = 'lg-consent';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'lg-consent-title');
    panel.setAttribute('aria-describedby', 'lg-consent-description');
    panel.innerHTML = '<h2 id="lg-consent-title">Le tue preferenze</h2>' +
      '<p id="lg-consent-description">Con il tuo consenso usiamo Google Analytics per contare le visite al sito. Puoi rifiutare e navigare normalmente, oppure cambiare scelta in qualsiasi momento. <a href="/cookie-policy">Informazioni sui cookie</a>.</p>' +
      (blocked ? '<p>Le statistiche restano disattivate perché il browser richiede di non essere tracciato.</p>' : '') +
      '<div class="lg-consent-actions"><button type="button" data-choice="false">Solo necessari</button>' +
      (blocked ? '' : '<button type="button" data-choice="true">Accetta statistiche</button>') + '</div>';
    panel.hidden = !!choice;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-choice]').forEach(function (button) {
      button.addEventListener('click', function () { save(button.dataset.choice === 'true'); });
    });
    panel.addEventListener('keydown', function (event) { if (event.key === 'Escape') save(false); });
    var preferences = document.createElement('button');
    preferences.type = 'button'; preferences.className = 'lg-cookie-preferences';
    preferences.textContent = 'Preferenze cookie'; preferences.addEventListener('click', show);
    (document.querySelector('.fb-links') || document.querySelector('footer') || document.body).appendChild(preferences);
    if (choice && choice.analytics && !blocked) enable(); else disable();
    window.addEventListener('storage', function (event) {
      if (event.key !== storageKey && event.key !== null) return;
      choice = readChoice();
      if (choice && choice.analytics && !blocked) enable(); else disable();
      panel.hidden = !!choice;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, {once: true});
  else initialise();
}());
