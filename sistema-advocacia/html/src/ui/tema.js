/* Tema (claro / escuro / automático). No automático não mexemos em nada: quem decide é o Claude (data-theme) ou o sistema do aparelho (prefers-color-scheme). */
const Tema = (() => {
  const KEY = 'tema', raiz = document.documentElement; let apliquei = false;
  const pref = () => { try { const v = localStorage.getItem(KEY); if (v === 'claro' || v === 'escuro' || v === 'auto') return v; } catch { /* sem armazenamento */ } return 'auto'; };
  function aplicar() {
    const p = pref();
    if (p === 'claro' || p === 'escuro') { raiz.setAttribute('data-theme', p === 'escuro' ? 'dark' : 'light'); apliquei = true; }
    else if (apliquei) { raiz.removeAttribute('data-theme'); apliquei = false; }
  }
  // paleta de cores (ouro é a padrão)
  const PALETAS = [['ouro', 'Ouro', '#b88a44'], ['vinho', 'Vinho', '#9b2f4a'], ['esmeralda', 'Esmeralda', '#1f7a5a'], ['safira', 'Safira', '#2c5fa8'], ['ametista', 'Ametista', '#6d4aa8'], ['cobre', 'Cobre', '#b5613a']];
  const paleta = () => { try { const v = localStorage.getItem('paleta'); if (PALETAS.some((p) => p[0] === v)) return v; } catch { /* sem armazenamento */ } return 'ouro'; };
  function aplicarPaleta() { const p = paleta(); if (p === 'ouro') raiz.removeAttribute('data-paleta'); else raiz.setAttribute('data-paleta', p); }
  aplicar(); aplicarPaleta();
  return { PALETAS, paleta, setPaleta(p) { try { localStorage.setItem('paleta', p); } catch { /* ok */ } raiz.classList.add('trocando-cor'); aplicarPaleta(); setTimeout(() => raiz.classList.remove('trocando-cor'), 500); }, pref, aplicar, set(p) { try { localStorage.setItem(KEY, p); } catch { /* ok */ } aplicar(); } };
})();
