/* LG Trading — header e menu mobile, condivisi da tutte le pagine. */
(function () {
  'use strict';
  var header = document.getElementById('header');
  if (!header) return;
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileNav');
  var wide = window.matchMedia('(min-width: 1101px)');
  var lastY = window.scrollY || 0, upTravel = 0, downTravel = 0, frame = 0;

  /* Il header resta visibile vicino alla cima e ricompare appena si risale. */
  function update() {
    frame = 0;
    var y = Math.max(0, window.scrollY || 0);
    var delta = y - lastY;
    header.classList.toggle('scrolled', y > 8);
    if (document.body.classList.contains('menu-open') || y < 160) {
      header.classList.remove('hidden');
      upTravel = downTravel = 0;
    } else if (delta > 0) {
      downTravel += delta; upTravel = 0;
      if (downTravel > 64) header.classList.add('hidden');
    } else if (delta < 0) {
      upTravel -= delta; downTravel = 0;
      if (upTravel > 8) header.classList.remove('hidden');
    }
    lastY = y;
  }
  window.addEventListener('scroll', function () {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  header.addEventListener('focusin', function () { header.classList.remove('hidden'); });
  update();

  if (!burger || !menu) return;
  var outside = Array.prototype.slice.call(document.querySelectorAll('[data-menu-inert]'));

  function setMenu(open, restoreFocus) {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    outside.forEach(function (el) { el.inert = open; });
    header.classList.remove('hidden');
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else if (restoreFocus) {
      burger.focus({ preventScroll: true });
    }
  }
  burger.addEventListener('click', function () {
    setMenu(!menu.classList.contains('open'), true);
  });
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) setMenu(false, false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.classList.contains('open')) setMenu(false, true);
  });
  function closeOnWide() { if (wide.matches && menu.classList.contains('open')) setMenu(false, false); }
  if (wide.addEventListener) wide.addEventListener('change', closeOnWide);
  else if (wide.addListener) wide.addListener(closeOnWide);
})();
