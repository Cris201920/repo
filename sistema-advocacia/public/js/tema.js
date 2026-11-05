/* Tema (claro / escuro / automático). Roda no <head> para evitar "piscar" ao carregar. */
(function () {
  var KEY = 'tema', mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function pref() { try { var v = localStorage.getItem(KEY); if (v === 'claro' || v === 'escuro' || v === 'auto') return v; } catch (e) {} return 'auto'; }
  function aplicar() {
    var p = pref(), escuro = p === 'escuro' || (p === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', escuro ? '#0a0d13' : '#11161f');
  }
  window.Tema = { pref: pref, aplicar: aplicar, set: function (p) { try { localStorage.setItem(KEY, p); } catch (e) {} aplicar(); } };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', aplicar); else if (mq.addListener) mq.addListener(aplicar); }
  aplicar();
})();
