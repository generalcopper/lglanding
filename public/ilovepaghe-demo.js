/* LG Trading — avvio della demo animata di iLovePaghe (motore «Carica cedolini»).
   L'animazione è solo CSS: questo script aggiunge .isVisible quando la scena entra
   nella finestra (come reveal.js su ilovepaghe.com) e la mette in pausa fuori schermo.
   Senza JavaScript la scena resta sul primo fotogramma. */
(function () {
  'use strict';
  var show = document.getElementById('ilovepaghe-demo');
  if (!show) return;
  if (!('IntersectionObserver' in window)) { show.classList.add('isVisible'); return; }
  var started = false;
  new IntersectionObserver(function (entries) {
    var entry = entries[entries.length - 1];
    if (entry.isIntersecting) {
      if (!started) { show.classList.add('isVisible'); started = true; }
      show.classList.remove('isPaused');
    } else if (started) {
      show.classList.add('isPaused');
    }
  }, { threshold: 0.12 }).observe(show);
})();
