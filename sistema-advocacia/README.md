# Sistema Interno — Forgiarini Fernandes Advocacia

Sistema **privado** (acesso somente com login) para o escritório: registro de atendimentos,
cadastro de clientes e casos, arquivo digital de documentos e **Assistente Jurídico com IA**.

## O que ele faz

| Módulo | Descrição |
|---|---|
| **Painel** | Prazos e providências pendentes, últimos atendimentos, documentos recentes e atalhos. |
| **Atendimentos** | Registro de cada contato (canal, assunto, relato, providências, prazo), vinculado a cliente e caso; marca providência como concluída. |
| **Clientes / Casos** | Cadastro completo (PF/PJ), histórico em linha do tempo, casos com nº CNJ, juízo, parte contrária, valor da causa e responsável. |
| **Documentos** | Envio por arrastar-e-soltar (PDF, Word, imagens, planilhas, áudios — até 25 MB), classificação, vínculo a cliente/caso/atendimento, visualização, download e **busca dentro do texto** dos documentos. |
| **Assistente Jurídico (IA)** | Chat que lê o cadastro do cliente, o histórico de atendimentos e os documentos que você marcar. Modelos prontos: resumo de documento, ata de atendimento, petição inicial, contestação, notificação, contrato, procuração, análise de riscos, linha do tempo, checklist, mensagem ao cliente, revisão de texto. Respostas saem em **Word (.docx)** formatado e podem ser salvas direto no caso. |
| **Usuários e auditoria** | Perfis (administrador, advogado, estagiário) e registro de quem acessou/baixou/alterou o quê. |

A IA é instruída a **não inventar fatos, leis ou jurisprudência**, a marcar lacunas como `[PREENCHER]`
e dúvidas como `[CONFERIR]`, e a tratar tudo como sigilo profissional. Ainda assim, **toda peça é
rascunho para revisão do advogado responsável.**

## Como rodar

Requisitos: **Node.js 22.13 ou superior**.

```bash
cd sistema-advocacia
npm install
cp .env.example .env        # preencha ANTHROPIC_API_KEY (veja abaixo)
npm start                   # http://localhost:3000
```

No **primeiro acesso** a tela de login pede para criar a conta do administrador
(só funciona enquanto não existir nenhum usuário). Depois, crie os demais usuários em *Administração → Usuários*.

### Quem pode entrar
- **Contas pessoais** (recomendado): cada pessoa com e-mail e senha, criadas em *Administração → Usuários*. Fica registrado quem fez cada ação.
- **Acesso por link e senha:** em *Administração → Usuários → Acesso por link e senha* o administrador liga uma senha única do escritório. Quem tiver o **link + essa senha** entra (opção “Tenho apenas o link e a senha de acesso” na tela de login), sem conta pessoal. O sistema gera uma senha forte (ou você define a sua), mostra **uma vez** para copiar, e você pode trocar ou desativar quando quiser — trocar derruba todos os acessos por essa senha. Como a senha é compartilhada, o registro de auditoria mostra “Acesso compartilhado” em vez do nome da pessoa.

### Documentos escaneados e arquivos
- Em qualquer tela de documentos: **Enviar / escanear**. No celular, o botão *Escanear com a câmera* abre a câmera; fotografe cada página e o sistema **junta tudo em um único PDF** (uma página por foto).
- **Baixar:** cada documento tem o botão de download (arquivo original). Na lista de *Documentos* marque vários e use *Baixar selecionados (ZIP)*; nas páginas de cliente e de caso há *Baixar todos (ZIP)*.
- PDFs escaneados (imagem) não têm texto pesquisável, mas o **Assistente de IA consegue lê-los** (leitura visual). A busca por conteúdo funciona em PDFs com texto, Word e TXT.

### Chave da IA
Crie uma chave em <https://console.anthropic.com/> e coloque em `ANTHROPIC_API_KEY`.
A chave fica **somente no servidor**; o navegador nunca a vê. Sem ela o sistema funciona normalmente,
só o Assistente fica desativado. O modelo é configurável em `ANTHROPIC_MODEL`.

### Tema (claro / escuro / automático)
O botão de tema (sol/lua/monitor) fica no topo de todas as telas e também no canto da tela de login. A escolha fica salva no navegador de cada pessoa; “Automático” segue o modo claro/escuro do aparelho. A logo troca sozinha: nome escuro no tema claro e nome claro (`logo-claro.png`) no tema escuro.

### Logo e identidade
A logo está em `public/assets/logo.png` (fundo transparente), com o emblema isolado em
`emblema.png` e o ícone da aba em `favicon.png`. Para trocar, substitua os arquivos mantendo os nomes.
Nome, subtítulo e nome do assistente ficam em `firm.config.json`.
> A logo foi extraída de uma foto do cartão; para qualidade máxima (impressão, timbrado) use o arquivo
> vetorial/PNG original do designer no mesmo caminho.

## Colocando no ar (para ter um link)

**Caminho mais simples — Render (HTTPS e disco incluídos):**
1. Crie uma conta em <https://render.com> e conecte o GitHub deste repositório.
2. *New + → Blueprint* → escolha o repositório e a branch. O arquivo `render.yaml` cria tudo sozinho.
3. Quando pedir, informe `ANTHROPIC_API_KEY`. Depois do primeiro deploy, abra *Environment* e **anote o valor de `DATA_KEY`** (guarde uma cópia segura).
4. O Render entrega um link do tipo `https://advocacia-xxxx.onrender.com`. Abra-o e crie o administrador. Dá para ligar um domínio próprio (ex.: `sistema.seudominio.com.br`) em *Settings → Custom Domains*.

> O disco persistente exige plano pago (cerca de US$ 7/mês). Sem disco, banco e arquivos seriam apagados a cada atualização. Qualquer plataforma que rode Docker com volume (Fly.io, Railway, VPS) serve — há um `Dockerfile` pronto.

**Passos genéricos / VPS:**

O sistema precisa de um servidor Node com **disco persistente** (ele guarda um banco SQLite e os arquivos).
Funciona em uma VPS (Ubuntu + Caddy/nginx), Render, Railway, Fly.io etc.

1. Defina as variáveis: `ANTHROPIC_API_KEY`, `DATA_DIR` (pasta do disco persistente), `DATA_KEY`
   (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
   `COOKIE_SECURE=1` e, se houver proxy/HTTPS gerenciado, `TRUST_PROXY=1`.
2. **Sempre use HTTPS.** Caddy faz isso automaticamente: `seudominio.com.br { reverse_proxy localhost:3000 }`.
3. **Backup:** copie periodicamente toda a pasta `DATA_DIR` (banco + `uploads/`) e guarde a `DATA_KEY`
   **separadamente** — sem ela os documentos não podem ser abertos.

## Segurança — o que já está implementado

- Login obrigatório (conta pessoal ou senha de acesso do escritório) em todas as rotas de dados; sessão em cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` em HTTPS), expira em 12 h.
- Senhas com `scrypt`; mínimo de 10 caracteres com letras e números; bloqueio após 5 tentativas erradas (15 min).
- Documentos **criptografados em disco** (AES-256-GCM); só são decifrados ao serem baixados por usuário autenticado.
- Proteção CSRF, cabeçalhos de segurança (CSP, etc.), `noindex` e `robots.txt` bloqueando buscadores.
- Auditoria de acessos, downloads, edições e consultas à IA.
- Conversas com a IA são **privadas por usuário**.

## LGPD e sigilo — atenção

- Ao usar o Assistente, os dados do cliente e os documentos **marcados** são enviados à API da Anthropic para gerar a resposta.
  Envie apenas o necessário e informe isso na política de privacidade/contrato de honorários. Consulte os termos de
  uso de dados da Anthropic para API (por padrão, dados da API não são usados para treinar modelos).
- Defina um responsável pelo backup, pela gestão de usuários (desative quem sair do escritório) e pela revisão periódica da auditoria.

## Testes

```bash
npm test
```
Os testes cobrem login/CSRF, limite de tentativas, cadastros, criptografia dos arquivos, extração de texto,
streaming da IA (com servidor simulado), perfis de acesso e auditoria.

## Estrutura

```
server/      API (Express) — auth, clientes/casos/atendimentos, documentos, IA, administração
public/      Interface (HTML/CSS/JS puro, sem build) e a logo
data/        Banco SQLite e arquivos cifrados (criada na execução; fora do Git)
```
