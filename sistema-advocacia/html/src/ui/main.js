/* Início: tela da senha do escritório (cofre), estrutura do sistema e rotas */
'use strict';
let B = null;                                   // backend em uso (Claude ou este aparelho)

const guardaSessao = {
  ler() { try { return sessionStorage.getItem('adv_k'); } catch { return null; } },
  gravar(v) { try { v ? sessionStorage.setItem('adv_k', v) : sessionStorage.removeItem('adv_k'); } catch { /* sem armazenamento */ } },
};

// ---------- tela do cofre ----------
function telaCofre({ modo, meta, mensagem = '' }) {
  const f = S.firma;
  const criar = modo === 'criar', aguardar = modo === 'aguardar', semAcesso = modo === 'sem-acesso';
  const titulo = criar ? 'Crie a senha do escritório' : aguardar ? 'Senha ainda não criada' : semAcesso ? 'Sem acesso aos dados' : 'Acesso restrito';
  const sub = criar ? 'Esta senha protege TODOS os dados do escritório com criptografia no seu navegador. Combine-a com a equipe.'
    : aguardar ? 'O administrador do escritório ainda não criou a senha. Peça a ele para abrir este endereço primeiro.'
      : semAcesso ? 'Abra esta página pelo Claude, logado na sua conta, e peça ao administrador para convidar você como Editor.'
        : 'Sistema interno do escritório. Digite a senha do escritório.';
  $('#app').innerHTML = `<div class="login"><div class="login-tema">${botaoTema()}</div><form class="login-card" id="lf" autocomplete="off">
    ${logoImg('logo', f.nome)}
    <h2>${titulo}</h2><p class="sub">${sub}</p><div id="le">${mensagem ? `<div class="err-msg">${esc(mensagem)}</div>` : ''}</div>
    ${aguardar || semAcesso ? '' : `<div style="margin-bottom:12px"><label for="senha">${criar ? 'Nova senha do escritório' : 'Senha do escritório'}</label><input id="senha" type="password" required autocomplete="${criar ? 'new-password' : 'current-password'}">
      ${criar ? '<div class="small" style="color:var(--ink-3);margin-top:4px">Mínimo de 12 caracteres, com letras e números — de preferência uma frase longa.</div>' : ''}</div>`}
    ${criar ? `<div style="margin-bottom:12px"><label for="senha2">Repita a senha</label><input id="senha2" type="password" required autocomplete="new-password"><button type="button" class="linkbtn-inline" id="padrao">Usar a senha padrão (ADV2027)</button><div class="small" id="avisoPadrao" style="color:var(--warn)" hidden>Senha curta e previsível: protege menos. Quem conseguir copiar os dados armazenados pode tentar adivinhá-la com programas.</div></div>
      <label class="chk small" style="margin-bottom:14px;align-items:flex-start"><input type="checkbox" id="ciente" style="margin-top:3px"> <span>Entendo que <b>se esta senha e a chave de recuperação (que será mostrada a seguir) forem perdidas, ninguém consegue recuperar os dados</b> (nem o Claude nem eu). Vou guardá-las em local seguro.</span></label>` : ''}
    ${aguardar || semAcesso ? '' : `<label class="chk small" style="margin-bottom:14px"><input type="checkbox" id="lembrar" checked> Manter aberto enquanto esta aba estiver aberta</label>
      <button class="btn gold" style="width:100%;justify-content:center;padding:11px" id="lb">${criar ? 'Criar senha e entrar' : 'Entrar'}</button>`}
    ${modo === 'abrir' ? '<button type="button" class="linkbtn" id="esqueci">Esqueci a senha</button>' : ''}
    <div class="login-foot">Conteúdo protegido por sigilo profissional · ${esc(f.nome)}</div></form></div>`;
  ligarTema();
  if ($('#padrao')) { const av = () => { $('#avisoPadrao').hidden = $('#senha').value !== Cofre.SENHA_PADRAO; }; $('#padrao').onclick = () => { $('#senha').value = $('#senha2').value = Cofre.SENHA_PADRAO; av(); }; $('#senha').addEventListener('input', av); }
  if ($('#esqueci')) $('#esqueci').onclick = () => esqueciASenha(meta);
  if (!$('#senha')) return;
  $('#senha').focus();
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const bt = $('#lb'), erro = (m) => { $('#le').innerHTML = `<div class="err-msg">${esc(m)}</div>`; bt.disabled = false; bt.textContent = criar ? 'Criar senha e entrar' : 'Entrar'; };
    bt.disabled = true; bt.textContent = 'Verificando…'; $('#le').innerHTML = '';
    try {
      const senha = $('#senha').value; let master, chaveNova = null;
      if (criar) {
        const msg = Cofre.avaliarSenha(senha); if (msg) return erro(msg);
        if (senha !== $('#senha2').value) return erro('As duas senhas não são iguais.');
        if (!$('#ciente').checked) return erro('Marque que entendeu que, sem a senha e a chave de recuperação, os dados não podem ser recuperados.');
        if (await B.obter('config', 'seguranca')) return erro('Outra pessoa acabou de criar a senha. Recarregue a página e entre com ela.');
        const c = await Cofre.criar(senha); master = c.master;
        chaveNova = senha === Cofre.SENHA_PADRAO ? Cofre.SENHA_PADRAO : Cofre.gerarChaveRecuperacao();   // com a senha padrão, a chave também é a padrão
        await B.definir('config', 'seguranca', await Cofre.comRecuperacao(c.meta, master, chaveNova));
      } else {
        master = await Cofre.abrir(meta, senha);
        if (!master) return erro('Senha incorreta.');
      }
      if ($('#lembrar').checked) guardaSessao.gravar(await Cofre.exportar(master)); else guardaSessao.gravar(null);
      await entrar(master);
      if (chaveNova) mostrarChaveRecuperacao(chaveNova, true);
    } catch (err) { erro(err && err.code === 'invalid_argument' ? 'Sem permissão para criar a senha: só o dono ou um Editor pode.' : (err.message || 'Falha ao entrar.')); }
  };
}

async function entrar(master) {
  ultimaAtividade = Date.now();
  await Dados.abrir(master, B, B.usuario.id);
  S.usuario = { id: B.usuario.id, nome: B.usuario.nome, papel: B.podeAdmin ? 'admin' : 'advogado', email: '' };
  LocalAPI.definirUsuario(S.usuario);
  Dados.aoMudar(aoMudarDados);
  renderShell(); await carregarOpcoes().catch(() => {});
  if (!location.hash || location.hash === '#') location.hash = '#/painel'; else rotear();
}
function bloquear(mensagem) {
  const aviso = typeof mensagem === 'string' ? mensagem : '';
  for (const o of $$('.overlay')) o.parentNode.removeChild(o);          // nenhuma janela com dados fica aberta sobre a tela de senha
  guardaSessao.gravar(null); Dados.fechar(); S.usuario = null; S.opcoes = null; cache.clientes = null; location.hash = '';
  $('#app').innerHTML = '<div class="splash"></div>';
  B.obter('config', 'seguranca').then((meta) => telaCofre({ modo: 'abrir', meta, mensagem: aviso })).catch((e) => telaCofre({ modo: 'sem-acesso', mensagem: e.message }));
}

// ---------- bloqueio automático: sem uso por um tempo, volta a pedir a senha ----------
const INATIVIDADE_MIN = 30;
let ultimaAtividade = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => { ultimaAtividade = Date.now(); }, { capture: true, passive: true }));
function conferirInatividade() {
  if (S.usuario && Date.now() - ultimaAtividade > INATIVIDADE_MIN * 60000) bloquear(`Bloqueado após ${INATIVIDADE_MIN} minutos sem uso. Digite a senha para continuar.`);
}
setInterval(conferirInatividade, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirInatividade(); });

// ---------- estrutura ----------
const NAV = [
  ['#/painel', 'Painel', 'home'], ['#/cadastro', 'Cadastro', 'plus'], ['#/agenda', 'Agenda de prazos', 'clock'],['#/atendimentos', 'Atendimentos', 'chat'], ['#/clientes', 'Clientes', 'users'], ['#/processos', 'Casos e processos', 'scale'], ['#/pendencias', 'Pendências', 'check'], ['#/documentos', 'Documentos', 'file'],
];
function renderShell() {
  const u = S.usuario, f = S.firma;
  $('#app').innerHTML = `<div class="shell"><aside class="side" id="side">
      <div class="brand">${logoImg('', f.nome)}</div>
      <nav class="nav">${NAV.map(([h, t, i]) => `<a href="${h}" data-h="${h}">${ico(i)} ${t}</a>`).join('')}
        ${COM_IA ? `<a class="ia" href="#/assistente" data-h="#/assistente">${ico('spark')} ${esc(f.assistenteNome || 'Assistente IA')}</a>` : ''}
        <div class="grp">Administração</div><a href="#/usuarios" data-h="#/usuarios">${ico('shield')} Acesso e segurança</a>${u.papel === 'admin' ? `<a href="#/auditoria" data-h="#/auditoria">${ico('log')} Auditoria</a>` : ''}</nav>
      <div class="side-foot">Dados criptografados com a senha do escritório<br>${esc(f.nome)}</div></aside>
    <div class="main"><header class="top"><button class="burger" id="burger" aria-label="Menu">${ico('menu').replace('<svg', '<svg width="24" height="24"')}</button>
      <div class="search">${ico('search')}<input id="gs" type="search" placeholder="Buscar clientes, casos, atendimentos, documentos…" autocomplete="off"><div class="search-res" id="gr" hidden></div></div>
      <button class="btn sm gold" id="novidades" hidden>↻ Há novidades de colegas — atualizar</button>
      <div style="margin-left:auto">${botaoTema()}</div>
      <div style="position:relative"><button class="userbtn" id="ub"><span class="avatar">${esc(iniciais(u.nome))}</span><span class="small" style="font-weight:600">${esc(primeiroNome(u.nome))}</span></button>
        <div class="menu" id="um" hidden><div class="who"><b>${esc(u.nome)}</b><div class="small muted">${B.tipo === 'claude' ? (u.papel === 'admin' ? 'Editor / dono' : 'Colaborador') : 'Neste aparelho'}</div></div>${u.papel === 'admin' ? '<button id="msenha">Alterar senha do escritório</button>' : ''}<button id="msair">Bloquear (sair)</button></div></div></header>
      ${B.podeGravar === false ? '<div class="note" style="margin:12px 28px 0">Você está com acesso <b>somente leitura</b>: peça ao dono para convidar você como Editor para poder lançar dados.</div>' : ''}
      <main class="content" id="view"></main></div></div>`;
  ligarTema();
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  $('#ub').onclick = (e) => { e.stopPropagation(); $('#um').hidden = !$('#um').hidden; };
  document.addEventListener('click', (e) => { if (!e.target.closest('#um')) $('#um') && ($('#um').hidden = true); if (!e.target.closest('.search')) $('#gr') && ($('#gr').hidden = true); });
  if ($('#msenha')) $('#msenha').onclick = () => { $('#um').hidden = true; abrirSenha(); };
  $('#msair').onclick = bloquear;
  $('#novidades').onclick = () => { $('#novidades').hidden = true; rotear(); };
  const buscar = debounce(async () => {
    const q = $('#gs').value.trim(), box = $('#gr'); if (q.length < 2) { box.hidden = true; return; }
    try {
      const r = await api('/busca' + qs({ q }));
      const sec = (t, a, fn) => (a.length ? `<h4>${t}</h4>${a.map(fn).join('')}` : '');
      const html = sec('Clientes', r.clientes, (x) => `<a href="#/clientes/${x.id}">${esc(x.nome)} <span class="muted small">${esc(x.documento || '')}</span></a>`) +
        sec('Casos', r.processos, (x) => `<a href="#/processos/${x.id}">${esc(x.titulo)} <span class="muted small">${esc(x.cliente)}</span></a>`) +
        sec('Atendimentos', r.atendimentos, (x) => `<a href="#/atendimentos/${x.id}">${esc(x.assunto)} <span class="muted small">${esc(x.cliente)} · ${fData(x.data_hora)}</span></a>`) +
        sec('Documentos', r.documentos, (x) => `<a href="#/documentos?q=${encodeURIComponent(q)}">${esc(x.titulo)}</a>`);
      box.innerHTML = html || '<div class="empty small">Nada encontrado.</div>'; box.hidden = false;
    } catch { /* ignora */ }
  }, 250);
  $('#gs').oninput = buscar; $('#gr').onclick = () => { $('#gr').hidden = true; $('#gs').value = ''; };
}

// Quando outra pessoa grava: telas sem filtros atualizam sozinhas; as demais avisam (para não perder o que a pessoa está fazendo)
let tAtualiza = null;
function aoMudarDados(colecao, info = {}) {
  if (!S.usuario || colecao === 'auditoria' || colecao === 'conversas' || info.propria) return;
  clearTimeout(tAtualiza);
  tAtualiza = setTimeout(() => {
    const h = location.hash || '#/painel', ocupado = $('.overlay') || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.closest('#view'));
    if (h.startsWith('#/assistente')) return;
    if (/^#\/(painel|agenda|cadastro|clientes\/\d|processos\/\d|atendimentos\/\d)/.test(h) && !ocupado) rotear();
    else if ($('#novidades')) $('#novidades').hidden = false;
  }, 500);
}

// ---------- rotas ----------
async function rotear() {
  if (!S.usuario) return;
  const [caminho, query = ''] = (location.hash || '#/painel').slice(1).split('?');
  const partes = caminho.split('/').filter(Boolean), params = Object.fromEntries(new URLSearchParams(query));
  const base = '#/' + (partes[0] || 'painel');
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.h === base));
  $('#side') && $('#side').classList.remove('open');
  if ($('#novidades')) $('#novidades').hidden = true;
  const id = partes[1];
  try {
    switch (partes[0] || 'painel') {
      case 'painel': return await pagePainel();
      case 'atendimentos': return id ? await pageAtendimento(id) : await pageAtendimentos(params);
      case 'clientes': return id ? await pageCliente(id) : await pageClientes(params);
      case 'processos': return id ? await pageProcesso(id) : await pageProcessos(params);
      case 'documentos': return await pageDocumentos(params);
      case 'pendencias': return await pagePendencias(params);
      case 'assistente': return COM_IA ? await pageAssistente() : (location.hash = '#/painel');
      case 'cadastro': return await pageCadastro();
      case 'agenda': return await pageAgenda();
      case 'usuarios': return await pageAcesso();
      case 'auditoria': return S.usuario.papel === 'admin' ? await pageAuditoria() : (location.hash = '#/painel');
      default: location.hash = '#/painel';
    }
  } catch (e) { if (S.usuario) view(`<div class="card"><div class="empty">${esc(e.message)}<br><br><a class="btn" href="#/painel">Voltar ao painel</a></div></div>`); }
}

// ---------- download dos links internos (/api/documentos/ID/arquivo) ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="/api/documentos/"]'); if (!a) return;
  e.preventDefault(); const id = +/\/documentos\/(\d+)\//.exec(a.getAttribute('href'))[1];
  LocalAPI.baixarDoc(id).then((ok) => ok && toast('Arquivo salvo.')).catch(falha);
});

// ---------- início ----------
async function iniciar() {
  document.title = `${S.firma.nome} — Sistema Interno`;
  $('#app').innerHTML = `<div class="splash"><div style="text-align:center"><img src="${EMBLEMA.claro}" alt="" style="width:120px"><p id="spmsg" style="color:#9aa3b5;margin-top:14px;font-size:13px">Conectando…</p></div></div>`;
  const limite = setTimeout(() => { const m = $('#spmsg'); if (m) m.textContent = 'Ainda conectando… se demorar, abra esta página pelo Claude, logado na sua conta.'; }, 8000);
  try {
    B = window.claude ? BackendClaude : criarBackendLocal();
    await B.iniciar();
  } catch (e) { clearTimeout(limite); return telaCofre({ modo: 'sem-acesso', mensagem: e.code === 'sem-db' ? '' : e.message }); }
  clearTimeout(limite);
  let meta;
  try { meta = await B.obter('config', 'seguranca'); } catch (e) { return telaCofre({ modo: 'sem-acesso', mensagem: e.message || 'Não foi possível ler os dados.' }); }
  if (!meta) return telaCofre({ modo: B.podeAdmin ? 'criar' : 'aguardar' });
  const salva = guardaSessao.ler();
  if (salva) { const m = await Cofre.abrirComChaveSalva(meta, salva); if (m) return entrar(m).catch((e) => telaCofre({ modo: 'abrir', meta, mensagem: e.message })); }
  telaCofre({ modo: 'abrir', meta });
}
window.addEventListener('hashchange', rotear);
iniciar().catch((e) => { $('#app').innerHTML = `<div class="login"><div class="login-card"><h2>Não foi possível carregar</h2><p class="sub">${esc(e.message)}</p></div></div>`; });


// ---------- esqueci a senha ----------
function esqueciASenha(meta) {
  if (!meta || !meta.rec) {
    return modal({ titulo: 'Esqueci a senha', tamanho: 'sm', corpo: `<p style="margin-top:0">Este sistema <b>não consegue recuperar a senha</b>: ela protege os dados com criptografia, e nem o Claude nem quem o criou tem como abri-los sem ela.</p>
      <p><b>O que você pode fazer:</b></p><ol style="padding-left:20px;line-height:1.6;margin-top:0"><li>Procurar a senha onde ela foi anotada ou com quem a criou (a pessoa que publicou o sistema).</li><li>Se o sistema foi criado antes da <b>chave de recuperação</b> existir e alguém ainda está com ele aberto neste navegador, entre em <i>Acesso e segurança</i> e gere uma chave agora.</li><li>Tendo um arquivo de <b>cópia de segurança</b>, os dados podem ser restaurados em um sistema novo.</li></ol>`, botoes: [{ texto: 'Entendi' }] });
  }
  modal({ titulo: 'Esqueci a senha', tamanho: 'sm', corpo: `<p style="margin-top:0">Digite a <b>chave de recuperação</b> (a que foi mostrada quando a senha foi criada) e escolha uma nova senha. Os dados continuam os mesmos.</p>
    <form class="f" id="fr" onsubmit="return false"><div class="c6"><label for="rc">Chave de recuperação</label><input id="rc" type="text" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" style="font-family:ui-monospace,Menlo,Consolas,monospace;text-transform:uppercase"></div>
    <div class="c6"><label for="rn">Nova senha do escritório</label><input id="rn" type="password" autocomplete="new-password"><div class="small muted">Mínimo de 12 caracteres, com letras e números.</div></div>
    <div class="c6"><label for="rn2">Repita a nova senha</label><input id="rn2" type="password" autocomplete="new-password"></div></form>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Criar nova senha', classe: 'gold', acao: async (ov) => {
      const chave = $('#rc', ov).value, nova = $('#rn', ov).value;
      const msg = Cofre.avaliarSenha(nova); if (msg) throw new Error(msg);
      if (nova !== $('#rn2', ov).value) throw new Error('As duas senhas não são iguais.');
      const master = await Cofre.abrirComRecuperacao(meta, chave); if (!master) throw new Error('Chave de recuperação incorreta. Confira os caracteres e os hifens.');
      let novo; try { novo = await Cofre.trocarSenha(master, nova, undefined, meta); await B.definir('config', 'seguranca', novo); } catch (e) { throw new Error(e && e.code === 'invalid_argument' ? 'Sem permissão para trocar a senha: só o dono ou um Editor pode.' : (e.message || 'Não foi possível gravar a nova senha.')); }
      guardaSessao.gravar(null);
      ov.parentNode && ov.parentNode.removeChild(ov);
      await entrar(master); toast('Nova senha criada. Você já está dentro.');
      return false;
    } }] });
}

// ---------- mostrar a chave de recuperação (uma única vez) ----------
function mostrarChaveRecuperacao(chave, primeira = false) {
  const m = modal({ titulo: 'Guarde a chave de recuperação', tamanho: 'sm',
    corpo: `<p style="margin-top:0">${primeira ? 'A senha foi criada. ' : ''}Se um dia a senha do escritório for esquecida, <b>esta chave</b> permite criar uma nova <b>sem perder nenhum dado</b>. Ela <b>não será mostrada de novo</b>.</p>
      <div style="background:var(--gold-soft);border-radius:8px;padding:14px;text-align:center;font:600 18px/1.4 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;user-select:all;word-break:break-all">${esc(chave)}</div>
      <p class="note small">Anote no papel e guarde em local seguro, <b>separado da senha</b> (por exemplo, no cofre do escritório). Quem tiver esta chave consegue abrir os dados.</p>
      <label class="chk"><input type="checkbox" id="anotei"> Já guardei a chave em local seguro</label>`,
    botoes: [{ texto: 'Copiar chave', acao: async () => { try { await copiarTexto(chave); toast('Chave copiada.'); } catch { toast('Não foi possível copiar: selecione o texto e copie.', true); } return false; } },
      { texto: 'Baixar (.txt)', acao: async () => { try { await Docs.entregar('chave-de-recuperacao.txt', `Chave de recuperação - ${S.firma.nome}\r\n\r\n${chave}\r\n\r\nGuarde em local seguro, separado da senha. Quem tiver esta chave consegue abrir os dados.\r\n`); } catch (e) { falha(e); } return false; } },
      { texto: 'Concluir', classe: 'gold', acao: async (ov) => { if (!$('#anotei', ov).checked) throw new Error('Marque que guardou a chave antes de concluir.'); } }] });
  m.el.dataset.travar = '1';
  const x = $('.x', m.el); if (x) x.hidden = true;
  return m;
}
