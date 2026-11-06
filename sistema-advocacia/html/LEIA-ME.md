# Versão em HTML único (com senha)

Um só arquivo HTML com **todas** as funções do sistema (clientes, casos, atendimentos, documentos com upload/scanner/ZIP/busca,
pastas, observações, pendências e modelos, Assistente de IA, organização de documentos por IA, tema, auditoria, cópia de segurança).

## Como funciona a senha
A senha do escritório **criptografa os dados no próprio navegador** (PBKDF2 600 mil iterações → chave AES‑256‑GCM).
O armazenamento só guarda texto cifrado. **Se a senha for perdida, ninguém recupera os dados** — faça cópias de segurança
(menu *Acesso e segurança*).

## Dois modos (o mesmo arquivo)
- **Publicado como Artifact do Claude**: dados compartilhados entre quem for convidado como *Editor* (por e‑mail); a IA usa a conta Claude de cada pessoa; downloads pedem confirmação.
- **Aberto direto no navegador** (`dist/sistema-advocacia.html`): dados só naquele aparelho (IndexedDB); IA opcional com chave da Anthropic informada em *Acesso e segurança*. Precisa de internet para carregar as bibliotecas (jsDelivr).

## Gerar de novo
```
cd sistema-advocacia/html
node build.js            # gera dist/artifact.html e dist/sistema-advocacia.html
node --test test/nucleo.test.js
```
Publicação do Artifact: capacidades `db` (regra: `config` só escrita por admin), `assets`, `sample` (imagens), `user`, `downloads`.

## Limites
Arquivos até 14 MB; texto extraído até 90 mil caracteres por documento; perfis (admin/colaborador) seguem os níveis da plataforma, não há controle fino por usuário.
