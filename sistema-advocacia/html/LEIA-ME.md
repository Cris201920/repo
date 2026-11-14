# Versão em HTML único (com senha)

Um só arquivo HTML com o sistema do escritório:

- **Cadastro**: clientes (confere CPF/CNPJ, formata telefone, barra CPF/CNPJ repetido), casos, atendimentos, documentos e pendências em um só lugar.
- **Agenda de prazos**: providências de atendimentos e pendências em aberto, agrupadas em vencidos, hoje, 7 dias, 30 dias e adiante.
- **Documentos**: envio, escanear pela câmera, juntar imagens em PDF, busca no texto, visualizador, ZIP, pastas e observações.
- **Pendências**: o que falta de cada cliente, com modelos por tipo de ação e "conferir documentos".
- **Planilhas**: exportar clientes, casos, atendimentos e agenda em CSV (abre no Excel).
- **Segurança**: senha do escritório com criptografia, bloqueio automático após 30 minutos sem uso, auditoria, cópia de segurança e restauração.
- Tema claro, escuro ou automático; funciona no computador e no celular.

## Como funciona a senha
A senha do escritório **criptografa os dados no próprio navegador** (PBKDF2 600 mil iterações → chave AES‑256‑GCM).
O armazenamento só guarda texto cifrado. **Se a senha for perdida, ninguém recupera os dados**: faça cópias de segurança
(menu *Acesso e segurança*).

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
