/* Backends: onde os dados (já cifrados) ficam guardados.
   - BackendClaude: banco compartilhado + arquivos + IA da própria plataforma (página hospedada no claude.ai)
   - criarBackendLocal: guardado só neste aparelho (arquivo HTML aberto fora do Claude) e usado nos testes */

// Lê JSON de uma resposta de IA com tolerância (texto solto antes/depois, cercas ```)
function jsonTolerante(texto) {
  const t = String(texto || '').trim();
  try { return JSON.parse(t); } catch { /* tenta os outros formatos */ }
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) { try { return JSON.parse(cerca[1]); } catch { /* segue */ } }
  const i = t.search(/[{[]/), j = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch { /* segue */ } }
  const e = new Error('A IA não devolveu um resultado legível. Tente novamente.'); e.code = 'invalid_json'; e.text = t; throw e;
}

const BackendClaude = {
  tipo: 'claude',
  async iniciar() {
    const c = window.claude;
    this.db = await c.use('db');
    this.assets = await c.use('assets');
    this.sampleFn = await c.use('sample');
    this.user = await c.use('user');
    this.dl = await c.use('downloads');
    if (!this.db) { const e = new Error('sem-db'); e.code = 'sem-db'; throw e; }
    this.eu = this.user ? await this.user.me() : { id: null, name: '', isOwner: false, canEdit: false };
    const pode = this.user ? await this.user.can('data.write') : null;
    this.podeGravar = pode !== false;                              // null = a plataforma não disse: deixa a gravação decidir
    this.podeAdmin = !!(this.eu.isOwner || this.eu.canEdit);
    this.limites = this.sampleFn ? await this.sampleFn.limits().catch(() => null) : null;
    this.usuario = { id: this.eu.id, nome: this.eu.name || 'Colega' };
  },
  assinar(caminho, cb, err) {
    return this.db.collection(caminho).onSnapshot((snap) => cb(snap.docs.map((d) => ({ id: d.id, data: d.data() }))), (e) => err && err(e));
  },
  async obter(caminho, id) { const s = await this.db.collection(caminho).doc(id).get(); return s.exists ? s.data() : null; },
  async listar(caminho) { const s = await this.db.collection(caminho).get(); return s.docs.map((d) => ({ id: d.id, data: d.data() })); },
  definir(caminho, id, campos) { return this.db.collection(caminho).doc(id).set(campos); },
  atualizar(caminho, id, campos) { return this.db.collection(caminho).doc(id).update(campos); },
  remover(caminho, id) { return this.db.collection(caminho).doc(id).delete(); },
  caminhoPrivado(uid) { return uid ? 'data/users/' + uid : null; },
  get arquivosOk() { return !!this.assets; },
  async enviarArquivo(blob) { const r = await this.assets.upload(blob, { type: 'text/plain' }); return r.id; },
  async lerArquivo(id) {
    const r = await fetch('/_blob/' + id);
    if (!r.ok) throw new Error('O arquivo não foi encontrado no armazenamento (pode ter sido removido).');
    return r.text();
  },
  async excluirArquivo(id) { try { await this.assets.delete(id); } catch { /* já removido */ } },
  get iaOk() { return !!this.sampleFn; },
  get imagensOk() { return !!(this.limites && this.limites.images); },
  get limiteImagens() { return (this.limites && this.limites.images && this.limites.images.maxCount) || 0; },
  ia(entrada, opcoes) { return this.sampleFn(entrada, opcoes); },
  iaJson(entrada, opcoes) { return this.sampleFn.json(entrada, opcoes); },
  get downloadsOk() { return !!this.dl; },
  salvar(nome, dados) { return this.dl.save({ filename: nome, data: dados }); },
};

function criarBackendLocal({ memoria = false, banco = 'advocacia-local' } = {}) {
  const docs = new Map(), ouvintes = new Map(), arquivos = new Map();
  let idb = null, chaveIA = '';
  const colecao = (c) => { if (!docs.has(c)) docs.set(c, new Map()); return docs.get(c); };
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const tudo = (c) => [...colecao(c).entries()].map(([id, data]) => ({ id, data: copia(data) }));
  const avisar = (c) => { for (const f of ouvintes.get(c) || []) queueMicrotask(() => f(tudo(c))); };

  const pedido = (r) => new Promise((ok, falha) => { r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); });
  async function abrirIDB() {
    if (memoria || typeof indexedDB === 'undefined') return;
    try {
      idb = await new Promise((ok, falha) => {
        const q = indexedDB.open(banco, 1);
        q.onupgradeneeded = () => { q.result.createObjectStore('docs'); q.result.createObjectStore('arqs'); };
        q.onsuccess = () => ok(q.result); q.onerror = () => falha(q.error);
      });
      const tx = idb.transaction(['docs', 'arqs'], 'readonly');
      const chaves = await pedido(tx.objectStore('docs').getAllKeys()), vals = await pedido(tx.objectStore('docs').getAll());
      chaves.forEach((k, i) => { const [c, id] = String(k).split('\u0000'); colecao(c).set(id, vals[i]); });
      const ak = await pedido(tx.objectStore('arqs').getAllKeys()), av = await pedido(tx.objectStore('arqs').getAll());
      ak.forEach((k, i) => arquivos.set(String(k), av[i]));
    } catch { idb = null; }                                         // sem armazenamento: funciona só nesta sessão
  }
  const gravarIDB = (loja, chave, valor) => { if (!idb) return; try { const s = idb.transaction(loja, 'readwrite').objectStore(loja); valor === undefined ? s.delete(chave) : s.put(valor, chave); } catch { /* ignora */ } };

  const B = {
    tipo: 'local',
    async iniciar() {
      await abrirIDB();
      try { chaveIA = localStorage.getItem('adv_ia_key') || ''; } catch { chaveIA = ''; }
      this.podeGravar = true; this.podeAdmin = true; this.usuario = { id: 'local', nome: 'Você' };
      this.limites = { maxPromptBytes: 900000, images: { maxCount: 8, maxInputBytes: 5e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } };
    },
    assinar(caminho, cb) {
      if (!ouvintes.has(caminho)) ouvintes.set(caminho, new Set());
      ouvintes.get(caminho).add(cb); queueMicrotask(() => cb(tudo(caminho)));
      return () => ouvintes.get(caminho).delete(cb);
    },
    async obter(c, id) { const d = colecao(c).get(String(id)); return d ? copia(d) : null; },
    async listar(c) { return tudo(c); },
    async definir(c, id, campos) { colecao(c).set(String(id), copia(campos)); gravarIDB('docs', c + '\u0000' + id, copia(campos)); avisar(c); },
    async atualizar(c, id, campos) {
      const atual = colecao(c).get(String(id));
      if (!atual) { const e = new Error('O registro não existe mais.'); e.code = 'invalid_argument'; throw e; }
      const novo = { ...atual, ...copia(campos) }; colecao(c).set(String(id), novo); gravarIDB('docs', c + '\u0000' + id, novo); avisar(c);
    },
    async remover(c, id) { colecao(c).delete(String(id)); gravarIDB('docs', c + '\u0000' + id, undefined); avisar(c); },
    caminhoPrivado(uid) { return 'privado_' + uid; },
    arquivosOk: true,
    async enviarArquivo(blob) {
      const id = Cofre.b64(crypto.getRandomValues(new Uint8Array(18))).replace(/[+/=]/g, 'x');
      const texto = await blob.text(); arquivos.set(id, texto); gravarIDB('arqs', id, texto); return id;
    },
    async lerArquivo(id) { if (!arquivos.has(id)) throw new Error('O arquivo não foi encontrado neste aparelho.'); return arquivos.get(id); },
    async excluirArquivo(id) { arquivos.delete(id); gravarIDB('arqs', id, undefined); },
    // IA no modo local: usa a chave da Anthropic que a própria pessoa informar (fica só neste aparelho)
    get iaOk() { return !!chaveIA || typeof this.iaSimulada === 'function'; },
    definirChaveIA(k) { chaveIA = String(k || '').trim(); try { chaveIA ? localStorage.setItem('adv_ia_key', chaveIA) : localStorage.removeItem('adv_ia_key'); } catch { /* ok */ } },
    get chaveIA() { return chaveIA; },
    get imagensOk() { return true; },
    get limiteImagens() { return 8; },
    async ia(entrada, opcoes = {}) {
      if (typeof this.iaSimulada === 'function') return this.iaSimulada(entrada, opcoes);
      const turnos = typeof entrada === 'string' ? [{ role: 'user', content: entrada }] : entrada.map((t) => ({ role: t.role, content: t.content }));
      const imgs = opcoes.images ? [].concat(opcoes.images) : [];
      if (imgs.length) {
        const blocos = [];
        for (const b of imgs) blocos.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/jpeg', data: Cofre.b64(new Uint8Array(await b.arrayBuffer())) } });
        const u = turnos[turnos.length - 1]; u.content = [...blocos, { type: 'text', text: u.content }];
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: opcoes.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': chaveIA, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 16000, stream: true, messages: turnos }),
      });
      if (!r.ok) { const e = new Error(r.status === 401 ? 'A chave da IA é inválida.' : 'Falha ao consultar a IA (' + r.status + ').'); e.code = 'upstream_error'; throw e; }
      let texto = '', buf = ''; const rd = r.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          const m = ev.match(/^data: (.*)$/m); if (!m) continue;
          let d; try { d = JSON.parse(m[1]); } catch { continue; }
          if (d.type === 'content_block_delta' && d.delta && d.delta.text) { texto += d.delta.text; if (opcoes.onText) opcoes.onText({ text: texto, delta: d.delta.text }); }
        }
      }
      return { text: texto, truncated: false };
    },
    async iaJson(entrada, opcoes) { const r = await this.ia(entrada, { ...opcoes, onText: undefined }); return jsonTolerante(r.text); },
    downloadsOk: true,
    async salvar(nome, dados) {
      const blob = dados instanceof Blob ? dados : new Blob([dados]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    },
  };
  return B;
}
