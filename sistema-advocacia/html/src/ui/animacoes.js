/* Animações que precisam de script: onda no clique, pulso ao digitar e números que contam */
'use strict';

const SEM_MOVIMENTO = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// onda que nasce no ponto do clique
document.addEventListener('pointerdown', (e) => {
  if (SEM_MOVIMENTO()) return;
  const alvo = e.target.closest && e.target.closest('.btn, .nav a, .cad-card, .tema-btn, .userbtn');
  if (!alvo || alvo.disabled) return;
  const r = alvo.getBoundingClientRect(), t = Math.max(r.width, r.height), o = document.createElement('span');
  o.className = 'onda'; o.style.width = o.style.height = t + 'px'; o.style.left = e.clientX - r.left - t / 2 + 'px'; o.style.top = e.clientY - r.top - t / 2 + 'px';
  alvo.append(o); setTimeout(() => { if (o.parentNode) o.parentNode.removeChild(o); }, 650);
}, { passive: true });

// pulso dourado no campo enquanto a pessoa digita
document.addEventListener('input', (e) => {
  const c = e.target; if (SEM_MOVIMENTO() || !c.matches || !c.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea')) return;
  c.classList.remove('digitando'); void c.offsetWidth; c.classList.add('digitando');
  clearTimeout(c._tDig); c._tDig = setTimeout(() => c.classList.remove('digitando'), 460);
}, true);

// números dos cartões contam de zero até o valor
function contarNumeros(raiz) {
  if (SEM_MOVIMENTO()) return;
  for (const el of raiz.querySelectorAll('.stat .n')) {
    const alvo = Number(el.textContent.trim()); if (!Number.isInteger(alvo) || alvo <= 0 || alvo > 100000) continue;
    const ini = performance.now(), dur = 700;
    const passo = (agora) => { const k = Math.min(1, (agora - ini) / dur); el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - k, 3)))); if (k < 1 && el.isConnected) requestAnimationFrame(passo); else el.textContent = String(alvo); };
    el.textContent = '0'; requestAnimationFrame(passo);
  }
}
// entrada da página: reinicia a cascata a cada troca de tela
function animarEntrada() {
  const v = document.getElementById('view'); if (!v) return;
  v.classList.remove('entrando'); void v.offsetWidth; v.classList.add('entrando');
  contarNumeros(v);
}
