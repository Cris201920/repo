const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (what = 'Registro') => new HttpError(404, `${what} não encontrado.`);

// texto opcional com limite; '' vira null
function txt(v, max = 500) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > max) throw bad(`Texto muito longo (máx. ${max} caracteres).`);
  return s;
}
function req_(v, nome, max = 300) {
  const s = txt(v, max);
  if (!s) throw bad(`Informe: ${nome}.`);
  return s;
}
function oneOf(v, lista, nome) {
  if (!lista.includes(v)) throw bad(`Valor inválido para ${nome}.`);
  return v;
}
function id_(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function dataISO(v, nome, { obrigatoria = false } = {}) {
  const s = txt(v, 40);
  if (!s) { if (obrigatoria) throw bad(`Informe: ${nome}.`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(s) || isNaN(Date.parse(s))) throw bad(`Data inválida: ${nome}.`);
  return s.replace('T', ' ');
}
const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => '\\' + c)}%`;

module.exports = { wrap, HttpError, bad, notFound, txt, req_, oneOf, id_, dataISO, like };
