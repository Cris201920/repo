# Versão em HTML único (com senha)

Um só arquivo HTML com o sistema do escritório:

- **Cadastro**: clientes (confere CPF/CNPJ, formata telefone, barra CPF/CNPJ repetido), casos, atendimentos, documentos e pendências em um só lugar.
- **Agenda de prazos**: providências de atendimentos e pendências em aberto, agrupadas em vencidos, hoje, 7 dias, 30 dias e adiante.
- **Documentos**: envio, escanear pela câmera, juntar imagens em PDF, busca no texto, visualizador, ZIP, pastas e observações.
- **Pendências**: o que falta de cada cliente, com modelos por tipo de ação e "conferir documentos".
- **Planilhas**: exportar clientes, casos, atendimentos e agenda em CSV (abre no Excel).
- **Segurança**: senha do escritório com criptografia, bloqueio automático após 30 minutos sem uso, auditoria, cópia de segurança e restauração.
- **Ficha do cliente em Word**: dados, casos, pendências, histórico de atendimentos, documentos e observações em um arquivo `.docx`.
- **Painel**: prazos, pendências, últimos atendimentos e aniversariantes dos próximos 30 dias; link para abrir a conversa no WhatsApp.
- Tema claro, escuro ou automático; no celular as listas viram cartões.

## Proteções contra perda de dados
- Uma janela com texto digitado não fecha ao clicar fora; o X e o Esc perguntam antes de descartar.
- Se a gravação falhar (sem permissão ou sem conexão), a tela volta ao que estava e mostra o erro: nada aparece como salvo sem estar.
- Uma atualização atrasada do banco não apaga da tela o que acabou de ser salvo (`src/dados.js`).

## Como funciona a senha
A senha do escritório **criptografa os dados no próprio navegador** (PBKDF2 600 mil iterações → chave AES‑256‑GCM).
O armazenamento só guarda texto cifrado. **Se a senha for perdida, ninguém recupera os dados**: faça cópias de segurança
(menu *Acesso e segurança*).

## Esqueci a senha
Ao criar a senha, o sistema mostra uma **chave de recuperação** (24 caracteres) uma única vez. Ela guarda a mesma chave mestra por outro caminho:
na tela de senha, **Esqueci a senha** aceita essa chave e permite criar uma nova senha **sem perder dados**.
Em *Acesso e segurança* (só quem administra) dá para gerar uma nova chave (a anterior deixa de valer; exige a senha atual).
Sistemas criados antes dessa função não têm chave: quem ainda consegue entrar gera uma em *Acesso e segurança*. Sem senha e sem chave, nada recupera os dados.

## Cópia de segurança e restauração
- *Baixar cópia de segurança* gera um ZIP com `dados.json` e a pasta `arquivos/`. **A cópia não é criptografada.**
- *Restaurar de uma cópia* (só quem administra) lê esse ZIP e **acrescenta apenas o que ainda não existe**; nada do que já está no sistema é alterado ou apagado. Serve para recuperar dados e para levar o sistema de um aparelho para outro.

## Dois modos (o mesmo arquivo)
- **Publicado como Artifact do Claude**: dados compartilhados entre quem for convidado como *Editor* (por e‑mail); downloads pedem confirmação.
- **Aberto direto no navegador** (`dist/sistema-advocacia.html`): dados só naquele aparelho (IndexedDB). Precisa de internet para carregar as bibliotecas (jsDelivr).

## Gerar de novo
```
cd sistema-advocacia/html
node build.js            # gera dist/artifact.html e dist/sistema-advocacia.html
node --test test/nucleo.test.js
```
Publicação do Artifact: capacidades `db` (regra: `config` só escrita por admin), `assets`, `user`, `downloads`.

## Limites
Arquivos até 14 MB; texto extraído até 90 mil caracteres por documento; perfis (admin/colaborador) seguem os níveis da plataforma, não há controle fino por usuário. O tempo do bloqueio automático é `INATIVIDADE_MIN` em `src/ui/main.js`.

## IA
A IA (Assistente e organização de documentos) está **desativada** nesta versão (`COM_IA = false` em `src/ui/core.js`). Para voltar,
mude para `true`, rode `node build.js` e republique incluindo a capacidade `sample` (`{"images": true}`).

## Animações
Ficam em `src/animacoes.css` (movimento e cores) e `src/ui/animacoes.js` (onda no clique, pulso ao digitar, números que contam).
São desligadas automaticamente para quem ativa "reduzir movimento" no aparelho. Para tirar tudo, remova `animacoes.css` da linha `ler('app.css') + ler('animacoes.css')` em `build.js`.

## Paletas de cores
Seis paletas (Ouro, Vinho, Esmeralda, Safira, Ametista, Cobre) no botão "Tema e cores", valem nos temas claro e escuro.
A escolha é de cada pessoa e fica guardada no aparelho. As cores estão no fim de `src/app.css` (`:root[data-paleta="…"]`) e a lista em `src/ui/tema.js`.

## Senha padrão
A senha `ADV2027` é aceita como exceção à regra dos 12 caracteres (botão "Usar a senha padrão" na criação). Com ela, a chave de recuperação também é `ADV2027`.
É fácil de lembrar, porém curta e previsível: quem conseguir copiar os dados armazenados pode tentar adivinhá-la. Para trocar a regra, veja `avaliarSenha` em `src/cofre.js`.
