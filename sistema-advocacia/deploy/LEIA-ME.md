# Colocar o sistema no ar de graça (e para sempre)

Este guia usa uma **máquina virtual gratuita permanente** ("Always Free") — o único tipo de hospedagem grátis que
guarda os arquivos de verdade. Você faz uma vez; depois o sistema fica no ar com um link como
`https://meuescritorio.duckdns.org`, com HTTPS e backup diário automáticos.

> **O que é grátis e o que não é**
> - **Hospedagem: grátis.** Oracle e Google pedem um cartão de crédito só para confirmar a identidade e **não cobram**
>   se você ficar dentro do gratuito (este sistema fica bem dentro).
> - **A IA não é grátis.** Cada pergunta/análise usa a API da Anthropic (cobrada por uso, em centavos). Sem a chave
>   todo o resto funciona; só o Assistente e a organização por IA ficam desligados.
> - Nenhuma empresa garante "para sempre": os planos gratuitos podem mudar. Por isso há **backup diário** — baixe uma
>   cópia de vez em quando (passo 7).

---

## Opção A — Oracle Cloud (recomendada)

**1. Crie a conta** em <https://www.oracle.com/br/cloud/free/> (escolha a região *Brazil East — São Paulo* ou *Vinhedo*).

**2. Crie a máquina:** *Compute → Instances → Create instance*
- Imagem: **Ubuntu 22.04**.
- Tipo (*Shape*): escolha um marcado **"Always Free-eligible"** — `VM.Standard.A1.Flex` (1 OCPU e 6 GB) ou, se não houver vaga, `VM.Standard.E2.1.Micro`.
- Em *Add SSH keys* escolha **Generate a key pair** e **baixe a chave privada** (guarde o arquivo!).
- Crie e anote o **IP público** da máquina.

**3. Libere o acesso web:** na página da máquina → *Subnet* → *Security List* → **Add Ingress Rules**:
- Origem `0.0.0.0/0`, protocolo TCP, porta de destino **80**; e outra regra igual com a porta **443**.

**4. Crie o endereço do site (grátis):** em <https://www.duckdns.org> entre com sua conta Google, crie um nome
(ex.: `meuescritorio`) e coloque o **IP público** da máquina. O endereço será `meuescritorio.duckdns.org`.

**5. Entre na máquina e instale:** no computador, abra o terminal (no Windows: PowerShell) e rode:
```bash
ssh -i CAMINHO/DA/CHAVE.key ubuntu@IP_PUBLICO
```
Depois, já dentro da máquina:
```bash
sudo apt-get update && sudo apt-get install -y git
git clone -b ccr-54c78786-wq98am https://github.com/Cris201920/repo.git
cd repo/sistema-advocacia/deploy
sudo bash install.sh
```
> O repositório é privado: o GitHub vai pedir usuário e senha — como senha use um **token**
> (GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained*, permissão **Contents: Read** neste repositório).

O instalador pergunta o **endereço do site** (`meuescritorio.duckdns.org`) e a **chave da IA** (pode pular).
No final mostra o link e a **chave de criptografia (`DATA_KEY`) — copie e guarde em lugar seguro**.

**6. Abra o link**, crie a conta de administrador e pronto.

**7. Backups:** todo dia às 03:30 o sistema salva uma cópia em `deploy/backups` (14 dias). Para baixar para o seu computador:
```bash
scp -i CAMINHO/DA/CHAVE.key ubuntu@IP_PUBLICO:repo/sistema-advocacia/deploy/backups/*.tar.gz .
```
Faça isso a cada semana ou mês e guarde também a `DATA_KEY`.

### Importante na Oracle (para não ser desligada)
A Oracle pode **recolher máquinas gratuitas que ficam ociosas** por muitos dias. Para evitar, depois de criar a conta
clique em **Upgrade to Pay As You Go** (*Billing*): continua grátis dentro dos limites "Always Free", mas a máquina deixa de ser recolhida.
Confirme sempre que a máquina esteja marcada como *Always Free-eligible*.

---

## Opção B — Google Cloud (alternativa)
1. Crie conta em <https://cloud.google.com/free> (é preciso ativar o faturamento com cartão; o *e2-micro* fica no "Always Free").
2. *Compute Engine → Criar instância*: tipo **e2-micro**, região **us-west1**, **us-central1** ou **us-east1**, disco padrão de até 30 GB, imagem **Ubuntu 22.04**, e marque **Permitir tráfego HTTP** e **HTTPS**.
3. Siga os passos 4 a 7 acima (o usuário SSH é o do seu Google; o botão **SSH** do console abre o terminal direto no navegador).

---

## Atualizar o sistema depois
```bash
cd repo && git pull && cd sistema-advocacia/deploy && sudo docker compose up -d --build
```

## Alternativa sem cartão (só se o computador ficar sempre ligado)
Rodar o sistema num computador do escritório e expô-lo com um túnel gratuito (Cloudflare Tunnel). Funciona, mas o
site sai do ar quando o computador desliga. Posso preparar essa versão se preferir.
