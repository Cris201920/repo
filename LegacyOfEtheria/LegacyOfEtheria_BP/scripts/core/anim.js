// core/anim.js - 6.58: tocar uma animação do servidor de forma REPETÍVEL.
// Problema: playAnimation() com o mesmo nome no mesmo controlador não reinicia (o controlador "de execução" já está no estado de destino),
// então golpes/gestos/ataques de chefe funcionavam só na primeira vez. Aqui cada canal alterna o estado de destino (a/b) e a animação para ao
// terminar (query.any_animation_finished), então cada disparo começa do zero e nunca fica presa no último quadro.
const flip = new Map();   // `${entityId}|${canal}` -> 0/1
export function playAnim(e, anim, { channel = "etheria_main", blendOut = 0.2 } = {}) {
  const k = `${e.id}|${channel}`, n = (flip.get(k) ?? 0) ^ 1; flip.set(k, n);
  if (flip.size > 4000) flip.clear();
  try { e.playAnimation(anim, { blendOutTime: blendOut, controller: `${channel}`, nextState: n ? "a" : "b", stopExpression: "query.any_animation_finished" }); return true; }
  catch { return false; }
}
