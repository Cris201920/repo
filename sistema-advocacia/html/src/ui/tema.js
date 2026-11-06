/* Tema (claro / escuro / automático). No automático não mexemos em nada: quem decide é o Claude (data-theme) ou o sistema do aparelho (prefers-color-scheme). */
const Tema = (() => {
  const KEY = 'tema', raiz = document.documentElement; let apliquei = false;
  const pref = () => { try { const v = localStorage.getItem(KEY); if (v === 'claro' || v === 'escuro' || v === 'auto') return v; } catch { /* sem armazenamento */ } return 'auto'; };
  function aplicar() {
    const p = pref();
    if (p === 'claro' || p === 'escuro') { raiz.setAttribute('data-theme', p === 'escuro' ? 'dark' : 'light'); apliquei = true; }
    else if (apliquei) { raiz.removeAttribute('data-theme'); apliquei = false; }
  }
  aplicar();
  return { pref, aplicar, set(p) { try { localStorage.setItem(KEY, p); } catch { /* ok */ } aplicar(); } };
})();
