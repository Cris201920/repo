# Instalação, execução e atualização (Windows)

## Requisitos
* Windows 10 ou 11, 64 bits.
* Python **3.10 a 3.13** (recomendado 3.12 ou 3.13) de <https://www.python.org/downloads/windows/> — marque
  *"Add python.exe to PATH"* e mantenha o *py launcher*.
* ~1 GB livres (PySide6 é grande).

## 1. Instalar
Abra o PowerShell **na pasta do projeto** (a pasta `jarmes`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Shortcut
```

O script cria `.venv`, instala `requirements.txt`, cria o arquivo `.env` (cópia de `.env.example`) e, com `-Shortcut`,
um atalho "JARMES" na Área de Trabalho. Para rodar os testes ao final, acrescente `-Tests`.

## 2. Iniciar
Duplo clique em `iniciar_jarmes.bat` (ou no atalho). A janela abre; o ícone fica na bandeja do sistema.
Pelo terminal: `.venv\Scripts\python.exe run_jarmes.py`.

Diagnóstico: `.venv\Scripts\python.exe run_jarmes.py --smoke-test` abre a interface, renderiza as 12 páginas e sai.

## 3. Configurar (tudo opcional)
Os dados ficam em `%APPDATA%\JARMES` (banco, documentos, backups, logs). Você pode configurar de duas formas:

* **Pelo próprio app**: *Configurações → Inteligência artificial / Voz / Google Drive*. Chaves são guardadas
  **criptografadas** (Fernet) em `%APPDATA%\JARMES\secrets.enc`; a chave mestra vai para o Gerenciador de Credenciais do
  Windows se você instalar `keyring` (`pip install keyring`), senão fica em `secret.key` ao lado (menos seguro).
* **Pelo `.env`**: edite `.env` (veja os comentários). Variáveis de ambiente `JARMES_*` têm prioridade e nunca são gravadas em disco.

Passo a passo de cada integração: [INTEGRACOES.md](INTEGRACOES.md).

## 4. Primeiro uso recomendado
1. *Central de estudos → Plano e ciclos*: confira horário (padrão 06:00), duração (120 min), dias e matérias → **Salvar** → **Iniciar plano hoje**.
2. *Configurações → Geral*: ajuste horário de silêncio e fechamento do dia.
3. Marque **Minimizar para a bandeja ao fechar** (já vem marcado) e, se quiser, **Iniciar com o Windows**.
4. No Windows: *Configurações → Sistema → Notificações → JARMES* ligado, e sem o modo "Não incomodar".

## 5. Iniciar com o Windows e segundo plano
*Configurações → Sistema e dados → Iniciar com o Windows* grava `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
(sem administrador) e o JARMES passa a abrir minimizado na bandeja. **Lembretes só existem enquanto o processo estiver
rodando.** Se você escolher *Sair* no menu da bandeja, nada mais avisa até abrir de novo.

## 6. Gerar o executável (.exe)
> Só é possível gerar um `.exe` **no Windows**. (Num teste em Linux, a mesma receita gerou e executou um binário Linux de
> ~290 MB, o que valida o `jarmes.spec`, mas não é um `.exe`.)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_exe.ps1            # dist\JARMES\JARMES.exe
powershell -ExecutionPolicy Bypass -File scripts\build_exe.ps1 -Installer # + dist\JARMES-Setup.exe (precisa do Inno Setup 6)
```
Copie a pasta `dist\JARMES` inteira (o `.exe` depende dos arquivos ao lado). O `.exe` inclui Python e as bibliotecas,
mas **não** inclui o Tesseract (OCR) nem modelos do Vosk — instale à parte se quiser esses recursos.

## 7. Atualizar
Substitua os arquivos do projeto (ou `git pull`) e rode de novo `scripts\install.ps1`. O banco é migrado
automaticamente e um backup é criado antes de qualquer migração. Para o `.exe`, gere-o novamente.

## 8. Desinstalar
* Versão do código-fonte: apague a pasta do projeto e (opcional) `%APPDATA%\JARMES`; desmarque *Iniciar com o Windows* antes.
* Versão instalada com o `JARMES-Setup.exe`: *Configurações → Aplicativos → JARMES → Desinstalar*.
* Seus dados ficam em `%APPDATA%\JARMES` até você apagá-los (ou usar *Apagar todas as informações do usuário*).
* Para revogar o Google Drive: botão *Desconectar e revogar* ou <https://myaccount.google.com/permissions>.

## Solução de problemas
| Sintoma | O que fazer |
|---|---|
| "Python não encontrado" | Reinstale o Python marcando o *py launcher* / PATH |
| Janela não abre | Veja `%APPDATA%\JARMES\logs\jarmes.log`; rode `run_jarmes.py` num terminal para ver mensagens |
| "JARMES já está em execução" | Procure o ícone na bandeja (perto do relógio) |
| Sem som / sem voz | *Assistente de voz* mostra o motivo; instale vozes pt-BR em *Configurações do Windows → Hora e idioma → Fala* |
| Sem microfone | *Configurações do Windows → Privacidade → Microfone* → permitir apps de área de trabalho |
| Notificação não aparece | Veja o aviso na *Central de notificações*; verifique o modo "Não incomodar" |
