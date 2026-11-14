/* Dados: cache em memória (já decifrado) + gravação cifrada campo a campo. Atualiza ao vivo quando outro aparelho grava. */
const Dados = (() => {
  const COLECOES = ['clientes', 'processos', 'atendimentos', 'documentos', 'pastas', 'notas', 'pendencias', 'auditoria'];
  const PRIV = 'conversas';
  const novoEstado = () => ({ master: null, b: null, uid: null, privado: null, cache: {}, brutos: {}, ouvintes: new Set(), unsubs: [], filas: new Map(), textos: null, ultima: 0, locais: {}, vez: {} });
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

  // Registros gravados aqui e ainda não confirmados pelo banco: uma atualização atrasada (tirada antes da gravação) não pode apagá-los da tela.
  const guardar = (nome, id) => { if (caminho(nome)) (st.locais[nome] || (st.locais[nome] = new Map())).set(id, true); };
  const liberar = (nome, id) => { if (st.locais[nome]) st.locais[nome].delete(id); };
  const guardado = (nome, id) => !!(st.locais[nome] && st.locais[nome].has(id));

  async function aplicar(nome, docs, e = st) {
    const mapa = e.cache[nome], brutos = e.brutos[nome], vistos = new Set();
    for (const d of docs) {
      vistos.add(d.id);
      if (e.locais[nome]) e.locais[nome].delete(d.id);                 // o banco já conhece este registro
      const s = JSON.stringify(d.data);
      if (brutos.get(d.id) === s) continue;                            // não mudou: não decifra de novo
      const reg = await decReg(d.data); reg.id = idNum(nome, d.id);
      brutos.set(d.id, s); mapa.set(d.id, reg);
    }
    for (const id of [...mapa.keys()]) if (!vistos.has(id) && !(e.locais[nome] && e.locais[nome].has(id))) { mapa.delete(id); brutos.delete(id); }
  }
  // as atualizações de uma mesma coleção são aplicadas uma de cada vez, na ordem em que chegam (uma antiga nunca passa por cima de uma nova)
  function enfileirar(nome, docs) {
    const e = st, p = (e.vez[nome] || Promise.resolve()).catch(() => {}).then(() => (e === st ? aplicar(nome, docs, e) : null));
    e.vez[nome] = p; return p;
  }
  // se a confirmação não chegar, confere direto no banco (cobre atualização perdida ou registro apagado por outra pessoa nesse intervalo)
  function conferirDepois(nome, id) {
    const e = st, t = setTimeout(async () => {
      if (e !== st || !guardado(nome, id)) return;
      try { const docs = await e.b.listar(caminho(nome)); if (e !== st) return; liberar(nome, id); await enfileirar(nome, docs); emitir(nome); } catch { /* tenta de novo na próxima gravação */ }
    }, 6000);
    if (t && t.unref) t.unref();
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
        try { await enfileirar(nome, docs); } catch (e) { if (primeiro) { primeiro = false; clearTimeout(limite); falha(e); } return; }
        if (primeiro) { primeiro = false; clearTimeout(limite); ok(); } else emitir(nome);
      }, (e) => { if (primeiro) { primeiro = false; clearTimeout(limite); falha(new Error(e && e.message ? e.message : 'Falha ao ler os dados.')); } });
      st.unsubs.push(un);
    })));
  }
  function fechar() { st.unsubs.forEach((u) => { try { u(); } catch { /* ok */ } }); st = novoEstado(); }

  const lista = (nome) => [...(st.cache[nome] || new Map()).values()];
  const obter = (nome, id) => (st.cache[nome] || new Map()).get(docId(nome, id)) || null;

  // Se a gravação falhar (sem permissão, sem conexão), a tela volta ao que estava: nada aparece como salvo sem estar.
  async function gravar(nome, reg) {
    const e = st, id = docId(nome, reg.id), mapa = e.cache[nome], antes = mapa.get(id), copia = { ...reg }; e.ultima = Date.now();
    mapa.set(id, copia); guardar(nome, id);
    try {
      await serial(nome + '/' + id, async () => { const c = caminho(nome); if (!c) return; await e.b.definir(c, id, await encReg(reg)); });
    } catch (er) {
      if (mapa.get(id) === copia) { if (antes) mapa.set(id, antes); else mapa.delete(id); }
      if (e.locais[nome]) e.locais[nome].delete(id);
      throw er;
    }
    if (e === st && guardado(nome, id)) conferirDepois(nome, id);
  }
  async function alterar(nome, idReg, campos) {
    const e = st, id = docId(nome, idReg), mapa = e.cache[nome], atual = mapa.get(id); e.ultima = Date.now();
    if (!atual) throw new Error('O registro não existe mais.');
    const novo = { ...atual, ...campos }; mapa.set(id, novo);
    try {
      await serial(nome + '/' + id, async () => {
        const c = caminho(nome); if (!c) return;
        try { await e.b.atualizar(c, id, await encReg(campos)); }
        catch (er) { if (er && er.code === 'invalid_argument') await e.b.definir(c, id, await encReg(novo)); else throw er; }   // alguém apagou: recria
      });
    } catch (er) { if (mapa.get(id) === novo) mapa.set(id, atual); throw er; }
  }
  async function remover(nome, idReg) {
    const e = st, id = docId(nome, idReg), mapa = e.cache[nome], antes = mapa.get(id); mapa.delete(id); liberar(nome, id); e.ultima = Date.now();
    try { await serial(nome + '/' + id, async () => { const c = caminho(nome); if (c) await e.b.remover(c, id); }); }
    catch (er) { if (antes && !mapa.has(id)) mapa.set(id, antes); throw er; }
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
