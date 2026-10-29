/* LG Trading — griglia dei marchi.
   Il file mantiene il nome storico (carosello «brand rail»), sostituito nell’ottobre 2026
   da una griglia statica: non intercetta più lo scroll né duplica le card.
   Compito attuale: le card con data-demo (Picking) portano al modulo contatti
   e, se il messaggio è vuoto, lo precompilano con la richiesta di demo. */
(function () {
  'use strict';
  var grid = document.getElementById('brands');
  var message = document.getElementById('messaggio');
  if (!grid || !message) return;

  grid.addEventListener('click', function (event) {
    var card = event.target.closest('.card[data-demo]');
    if (!card || message.value.trim()) return;
    message.value = 'Vorremmo richiedere una demo di ' + card.getAttribute('data-demo') + '.';
    message.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Compatibilità con eventuali chiamate esistenti a window.lgBrandRail.goToCard().
  window.lgBrandRail = {
    goToCard: function (card) {
      if (!card || !card.scrollIntoView) return;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  };
})();
