/* Dados: cache em memória (já decifrado) + gravação cifrada campo a campo. Atualiza ao vivo quando outro aparelho grava. */
const Dados = (() => {
  const COLECOES = ['clientes', 'processos', 'atendimentos', 'documentos', 'pastas', 'notas', 'pendencias', 'auditoria'];
  const PRIV = 'conversas';
  const novoEstado = () => ({ master: null, b: null, uid: null, privado: null, cache: {}, brutos: {}, ouvintes: new Set(), unsubs: [], filas: new Map(), textos: null, ultima: 0 });
  let st = novoEstado();

  const caminho = (nome) => (nome === PRIV ? st.privado : nome);       // null = sem identidade: conversas só em memória
  const docId = (nome, id) => (nome === PRIV ? 'c' + id : String(id));
  const idNum = (nome, d) => Number(nome === PRIV ? String(d).slice(1) : d);
  const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  function novoId(nome) {
    for (;;) {
      const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      if (!st.cache[nome] || !st.cache[nome].has(docId(nome, id))) return id;
    }
  }

  async function decReg(campos) {
    const o = {};
    await Promise.all(Object.entries(campos || {}).map(async ([k, v]) => { try { o[k] = await Cofre.lerCampo(st.master, v); } catch { o[k] = null; } }));
    return o;
  }
  async function encReg(obj) {
    const f = {};
    await Promise.all(Object.entries(obj).filter(([k]) => k !== 'id').map(async ([k, v]) => { f[k] = await Cofre.campo(st.master, v); }));
    return f;
  }
  const serial = (chave, fn) => {                                      // uma gravação por vez em cada registro
    const anterior = st.filas.get(chave) || Promise.resolve();
    const p = anterior.catch(() => {}).then(fn);
    st.filas.set(chave, p); p.finally(() => { if (st.filas.get(chave) === p) st.filas.delete(chave); }).catch(() => {});
    return p;
  };
  const emitir = (nome) => st.ouvintes.forEach((f) => { try { f(nome, { propria: Date.now() - st.ultima < 3000 }); } catch { /* ouvinte com erro não derruba os outros */ } });

  async function aplicar(nome, docs) {
    const mapa = st.cache[nome], brutos = st.brutos[nome], vistos = new Set();
    for (const d of docs) {
      vistos.add(d.id);
      const s = JSON.stringify(d.data);
      if (brutos.get(d.id) === s) continue;                            // não mudou: não decifra de novo
      brutos.set(d.id, s);
      const reg = await decReg(d.data); reg.id = idNum(nome, d.id); mapa.set(d.id, reg);
    }
    for (const id of [...mapa.keys()]) if (!vistos.has(id)) { mapa.delete(id); brutos.delete(id); }
  }

  async function abrir(master, backend, uid) {
    fechar();
    st.master = master; st.b = backend; st.uid = uid; st.privado = backend.caminhoPrivado(uid);
    const alvos = COLECOES.map((n) => [n, n]);
    if (st.privado) alvos.push([PRIV, st.privado]);
    for (const [n] of [...alvos, [PRIV]]) { st.cache[n] = new Map(); st.brutos[n] = new Map(); }
    await Promise.all(alvos.map(([nome, c]) => new Promise((ok, falha) => {
      let primeiro = true;
      const limite = setTimeout(() => { if (primeiro) { primeiro = false; falha(new Error('Não foi possível alcançar o banco de dados. Verifique a conexão e tente de novo.')); } }, 15000);
      const un = backend.assinar(c, async (docs) => {
        try { await aplicar(nome, docs); } catch (e) { if (primeiro) { primeiro = false; clearTimeout(limite); falha(e); } return; }
        if (primeiro) { primeiro = false; clearTimeout(limite); ok(); } else emitir(nome);
      }, (e) => { if (primeiro) { primeiro = false; clearTimeout(limite); falha(new Error(e && e.message ? e.message : 'Falha ao ler os dados.')); } });
      st.unsubs.push(un);
    })));
  }
  function fechar() { st.unsubs.forEach((u) => { try { u(); } catch { /* ok */ } }); st = novoEstado(); }

  const lista = (nome) => [...(st.cache[nome] || new Map()).values()];
  const obter = (nome, id) => (st.cache[nome] || new Map()).get(docId(nome, id)) || null;

  async function gravar(nome, reg) {
    const id = docId(nome, reg.id); st.ultima = Date.now();
    st.cache[nome].set(id, { ...reg });
    return serial(nome + '/' + id, async () => {
      const c = caminho(nome); if (!c) return;
      await st.b.definir(c, id, await encReg(reg));
    });
  }
  async function alterar(nome, idReg, campos) {
    const id = docId(nome, idReg), atual = st.cache[nome].get(id); st.ultima = Date.now();
    if (!atual) throw new Error('O registro não existe mais.');
    const novo = { ...atual, ...campos }; st.cache[nome].set(id, novo);
    return serial(nome + '/' + id, async () => {
      const c = caminho(nome); if (!c) return;
      try { await st.b.atualizar(c, id, await encReg(campos)); }
      catch (e) { if (e && e.code === 'invalid_argument') await st.b.definir(c, id, await encReg(novo)); else throw e; }   // alguém apagou: recria
    });
  }
  async function remover(nome, idReg) {
    const id = docId(nome, idReg); st.cache[nome].delete(id); st.ultima = Date.now();
    return serial(nome + '/' + id, async () => { const c = caminho(nome); if (c) await st.b.remover(c, id); });
  }

  // textos extraídos dos documentos (busca e IA): ficam em coleção própria para não pesar na abertura
  async function gravarTexto(id, texto) {
    await st.b.definir('textos', String(id), { t: await Cofre.campo(st.master, texto || '') });
    if (st.textos) st.textos.set(Number(id), texto || '');
  }
  async function lerTexto(id) {
    if (st.textos && st.textos.has(Number(id))) return st.textos.get(Number(id));
    const d = await st.b.obter('textos', String(id));
    return d ? Cofre.lerCampo(st.master, d.t).catch(() => '') : '';
  }
  async function todosTextos() {
    if (!st.textos) {
      const m = new Map();
      for (const d of await st.b.listar('textos')) { try { m.set(Number(d.id), await Cofre.lerCampo(st.master, d.data.t)); } catch { /* ignora */ } }
      st.textos = m;
    }
    return st.textos;
  }
  async function removerTexto(id) { try { await st.b.remover('textos', String(id)); } catch { /* ok */ } if (st.textos) st.textos.delete(Number(id)); }

  return {
    abrir, fechar, lista, obter, gravar, alterar, remover, novoId, agora,
    gravarTexto, lerTexto, todosTextos, removerTexto,
    aoMudar(f) { st.ouvintes.add(f); return () => st.ouvintes.delete(f); },
    get master() { return st.master; }, get backend() { return st.b; }, get aberto() { return !!st.master; },
  };
})();
