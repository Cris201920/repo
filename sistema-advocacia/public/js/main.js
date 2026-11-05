/* Início: login, estrutura do sistema e rotas */
'use strict';
function renderLogin(setup = false) {
  const f = S.firma;
  $('#app').innerHTML = `<div class="login"><form class="login-card" id="lf" autocomplete="on">
    <img class="logo" src="${esc(S.logo)}" alt="${esc(f.nome)}">
    <h2>${setup ? 'Primeiro acesso' : 'Acesso restrito'}</h2>
    <p class="sub">${setup ? 'Crie a conta do administrador do sistema.' : 'Sistema interno do escritório. Entre com seu e-mail e senha.'}</p>
    <div id="le"></div>
    ${setup ? `<div style="margin-bottom:12px"><label for="nome">Seu nome</label><input id="nome" type="text" required autocomplete="name"></div>` : ''}
    <div style="margin-bottom:12px" id="wemail"><label for="email">E-mail</label><input id="email" type="email" required autocomplete="username"></div>
    <div style="margin-bottom:18px"><label for="senha">Senha</label><input id="senha" type="password" required autocomplete="${setup ? 'new-password' : 'current-password'}">${setup ? '<div class="small" style="color:#9aa3b5;margin-top:4px">Mínimo de 10 caracteres, com letras e números.</div>' : ''}</div>
    <button class="btn gold" style="width:100%;justify-content:center;padding:11px" id="lb">${setup ? 'Criar administrador e entrar' : 'Entrar'}</button>
    ${!setup && S.compartilhado ? '<button type="button" class="linkbtn" id="alt">Tenho apenas o link e a senha de acesso do escritório</button>' : ''}
    <div class="login-foot">Conteúdo protegido por sigilo profissional · ${esc(f.nome)}</div></form></div>`;
  let soSenha = false;
  if ($('#alt')) $('#alt').onclick = () => {
    soSenha = !soSenha; $('#wemail').hidden = soSenha; $('#email').required = !soSenha; if (soSenha) $('#email').value = '';
    $('#alt').textContent = soSenha ? 'Entrar com e-mail e senha pessoais' : 'Tenho apenas o link e a senha de acesso do escritório';
    $('#senha').labels[0].textContent = soSenha ? 'Senha de acesso do escritório' : 'Senha'; $('.sub').textContent = soSenha ? 'Digite a senha de acesso do escritório.' : 'Sistema interno do escritório. Entre com seu e-mail e senha.'; $('#senha').focus();
  };
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); $('#lb').disabled = true; $('#le').innerHTML = '';
    try {
      await api(setup ? '/auth/setup' : '/auth/login', { method: 'POST', body: { nome: $('#nome')?.value, email: soSenha ? '' : $('#email').value, senha: $('#senha').value } });
      await iniciar();
    } catch (err) { $('#le').innerHTML = `<div class="err-msg">${esc(err.message)}</div>`; $('#lb').disabled = false; }
  };
  $('#' + (setup ? 'nome' : 'email')).focus();
}

// Recarrega o estado público (ex.: se o acesso por senha foi ligado) e mostra o login
async function mostrarLogin() {
  try { const st = await api('/auth/status'); S.firma = st.firma; if (st.logo) S.logo = st.logo; S.compartilhado = st.acessoCompartilhado; renderLogin(st.precisaCriarAdmin); }
  catch { renderLogin(); }
}

const NAV = [
  ['#/painel', 'Painel', 'home'], ['#/atendimentos', 'Atendimentos', 'chat'], ['#/clientes', 'Clientes', 'users'], ['#/processos', 'Casos e processos', 'scale'], ['#/documentos', 'Documentos', 'file'],
];
function renderShell() {
  const u = S.usuario, f = S.firma;
  $('#app').innerHTML = `<div class="shell"><aside class="side" id="side">
      <div class="brand"><img src="${esc(S.logo)}" alt="${esc(f.nome)}"></div>
      <nav class="nav">${NAV.map(([h, t, i]) => `<a href="${h}" data-h="${h}">${ico(i)} ${t}</a>`).join('')}
        <a class="ia" href="#/assistente" data-h="#/assistente">${ico('spark')} ${esc(f.assistenteNome || 'Assistente IA')}</a>
        ${u.papel === 'admin' ? `<div class="grp">Administração</div><a href="#/usuarios" data-h="#/usuarios">${ico('shield')} Usuários</a><a href="#/auditoria" data-h="#/auditoria">${ico('log')} Auditoria</a>` : ''}</nav>
      <div class="side-foot">Ambiente privado e criptografado<br>${esc(f.nome)}</div></aside>
    <div class="main"><header class="top"><button class="burger" id="burger" aria-label="Menu">${ico('menu').replace('<svg', '<svg width="24" height="24"')}</button>
      <div class="search">${ico('search')}<input id="gs" type="search" placeholder="Buscar clientes, casos, atendimentos, documentos…" autocomplete="off"><div class="search-res" id="gr" hidden></div></div>
      <div style="position:relative;margin-left:auto"><button class="userbtn" id="ub"><span class="avatar">${esc(iniciais(u.nome))}</span><span class="small" style="font-weight:600">${esc(primeiroNome(u.nome))}</span></button>
        <div class="menu" id="um" hidden><div class="who"><b>${esc(u.nome)}</b><div class="small muted">${u.compartilhado ? 'Acesso por link e senha' : esc(u.email) + ' · ' + L.papel[u.papel]}</div></div>${u.compartilhado ? '' : '<button id="msenha">Alterar senha</button>'}<button id="msair">Sair</button></div></div></header>
      <main class="content" id="view"></main></div></div>`;
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  $('#ub').onclick = (e) => { e.stopPropagation(); $('#um').hidden = !$('#um').hidden; };
  document.addEventListener('click', (e) => { if (!e.target.closest('#um')) $('#um') && ($('#um').hidden = true); if (!e.target.closest('.search')) $('#gr') && ($('#gr').hidden = true); });
  if ($('#msenha')) $('#msenha').onclick = () => { $('#um').hidden = true; abrirSenha(); };
  $('#msair').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); S.usuario = null; S.opcoes = null; cache.clientes = null; location.hash = ''; mostrarLogin(); };
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
    } catch {}
  }, 250);
  $('#gs').oninput = buscar; $('#gr').onclick = () => { $('#gr').hidden = true; $('#gs').value = ''; };
}

// ---------- Rotas ----------
async function rotear() {
  if (!S.usuario) return;
  const [caminho, query = ''] = (location.hash || '#/painel').slice(1).split('?');
  const partes = caminho.split('/').filter(Boolean); const params = Object.fromEntries(new URLSearchParams(query));
  const base = '#/' + (partes[0] || 'painel');
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.h === base));
  $('#side')?.classList.remove('open');
  const id = partes[1];
  try {
    switch (partes[0] || 'painel') {
      case 'painel': return await pagePainel();
      case 'atendimentos': return id ? await pageAtendimento(id) : await pageAtendimentos(params);
      case 'clientes': return id ? await pageCliente(id) : await pageClientes(params);
      case 'processos': return id ? await pageProcesso(id) : await pageProcessos(params);
      case 'documentos': return await pageDocumentos(params);
      case 'assistente': return await pageAssistente();
      case 'usuarios': return S.usuario.papel === 'admin' ? await pageUsuarios() : (location.hash = '#/painel');
      case 'auditoria': return S.usuario.papel === 'admin' ? await pageAuditoria() : (location.hash = '#/painel');
      default: location.hash = '#/painel';
    }
  } catch (e) { if (S.usuario) view(`<div class="card"><div class="empty">${esc(e.message)}<br><br><a class="btn" href="#/painel">Voltar ao painel</a></div></div>`); }
}

async function iniciar() {
  const st = await api('/auth/status');
  S.firma = st.firma; if (st.logo) S.logo = st.logo; S.usuario = st.usuario; S.compartilhado = st.acessoCompartilhado;
  document.title = `${S.firma.nome} — Sistema Interno`;
  if (!S.usuario) return renderLogin(st.precisaCriarAdmin);
  renderShell(); await carregarOpcoes().catch(() => {});
  if (!location.hash || location.hash === '#') location.hash = '#/painel'; else rotear();
}
window.addEventListener('hashchange', rotear);
iniciar().catch((e) => { $('#app').innerHTML = `<div class="login"><div class="login-card"><h2>Não foi possível carregar</h2><p class="sub">${esc(e.message)}</p></div></div>`; });
