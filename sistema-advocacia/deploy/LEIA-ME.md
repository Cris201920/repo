# Colocar o sistema no ar de graça (e para sempre)

Este guia usa uma **máquina virtual gratuita permanente** ("Always Free") — o único tipo de hospedagem grátis que
guarda os arquivos de verdade. Você faz **uma vez**; depois o sistema fica no ar, em qualquer celular, tablet ou
computador, com um link como `https://meuescritorio.duckdns.org`, com HTTPS e backup diário automáticos.

O caminho principal é o **Google Cloud**, porque tem um **terminal dentro do navegador** (não precisa instalar nada)
e um botão de **enviar arquivo**. A Oracle Cloud está no final como alternativa.

> **O que é grátis e o que não é**
> - **A máquina é grátis** dentro do limite do Google ("Always Free"): 1 máquina *e2-micro*, 30 GB de disco comum e 1 GB de
>   tráfego de saída por mês, **somente nas regiões** `us-central1` (Iowa), `us-west1` (Oregon) ou `us-east1` (Carolina do Sul).
>   Regras oficiais: <https://cloud.google.com/free>.
> - **Cartão e cobrança:** no cadastro o Google só faz uma verificação (não cobra). Durante o teste (US$ 300 por 90 dias)
>   **nada é cobrado**. Depois do teste, o endereço IP externo da máquina custa **cerca de US$ 3,60 por mês** (US$ 0,005 por
>   hora; <https://cloud.google.com/vpc/network-pricing>) — não encontramos isenção desse item no plano gratuito, então
>   considere "quase grátis", e não zero. **Crie o alerta de orçamento** (passo 2) e confira o relatório de faturamento todo mês.
> - **A IA não é grátis**: cada uso da API da Anthropic é cobrado (centavos). Sem a chave da IA, o resto funciona.
> - Nenhuma empresa garante "para sempre". Por isso o sistema faz **backup diário** — baixe uma cópia de vez em quando.

---

## Caminho recomendado — Google Cloud

### 1. Criar a conta
Acesse <https://cloud.google.com/free>, clique em **Começar gratuitamente**, entre com sua conta Google e cadastre o cartão.
Você ganha um crédito de teste e **não é cobrada automaticamente**: só passa a pagar se você clicar em "ativar a conta
completa". **Se não ativar**, ao fim do teste (90 dias, ou quando o crédito acabar) a máquina é desligada, pode ser recuperada
em até 30 dias ao ativar, e depois **é apagada junto com os dados** — baixe um backup antes. Para o site continuar no ar,
ative a conta completa: você paga só o que passar do gratuito (hoje, principalmente o IP externo, ~US$ 3,60/mês).
Dica: se o banco oferecer **cartão virtual com limite baixo**, use-o para limitar o risco (o Google às vezes recusa cartões pré-pagos).
Fontes: <https://cloud.google.com/signup-faqs> e <https://docs.cloud.google.com/free/docs/free-cloud-features>.

### 2. Alerta de gasto (recomendado)
Menu ☰ → **Faturamento** → **Orçamentos e alertas** → **Criar orçamento**: valor **R$ 10** (ou US$ 2) com alertas em 50% e 100%.

### 3. Criar a máquina
Menu ☰ → **Compute Engine** → **Instâncias de VM** → **Criar instância** (ative a API se pedir):
- **Nome:** `advocacia`
- **Região:** `us-central1 (Iowa)` (ou us-west1 / us-east1). *Qualquer outra região deixa de ser gratuita.*
- **Configuração da máquina:** série **E2**, tipo **e2-micro**.
- **Disco de inicialização → Alterar:** sistema **Ubuntu 22.04 LTS**, tipo **Disco permanente padrão** (não use "Equilibrado" nem SSD), tamanho **30 GB**.
- **Firewall:** marque **Permitir tráfego HTTP** e **Permitir tráfego HTTPS**.
- Clique em **Criar** e anote o **IP externo** da máquina.

*Dica:* em **Rede VPC → Endereços IP**, clique em **Promover para estático** no IP da máquina, para ele não mudar se você
desligar e ligar a máquina. (Se mudar, basta atualizar o endereço no DuckDNS, passo 4.)

### 4. Criar o endereço do site (grátis)
Em <https://www.duckdns.org> entre com sua conta Google, crie um nome (ex.: `meuescritorio`) e, em **current ip**, cole o
**IP externo** da máquina e clique em **update**. O endereço do site será `meuescritorio.duckdns.org`.

### 5. Enviar o sistema e instalar
1. Na lista de instâncias, clique em **SSH** na linha da máquina `advocacia` (abre um terminal no navegador; autorize se pedir).
2. Nessa janela, clique na **engrenagem ⚙ → Fazer upload do arquivo** e escolha o arquivo **`sistema-advocacia.tar.gz`**
   (enviado pelo Claude).
3. No terminal, cole **uma linha por vez**:
```bash
tar xzf sistema-advocacia.tar.gz
cd sistema-advocacia/deploy
sudo bash install.sh
```
4. O instalador pergunta o **endereço do site** (`meuescritorio.duckdns.org`) e a **chave da IA** (pode deixar em branco).
   Leva alguns minutos. No final mostra o link e a **chave de criptografia (`DATA_KEY`) — copie e guarde em lugar seguro**
   (sem ela os documentos não abrem).

### 6. Usar
Abra `https://meuescritorio.duckdns.org` (o certificado HTTPS pode levar 1–2 minutos na primeira vez), crie a conta de
administrador e, se quiser entrada só com link + senha, ative em **Administração → Usuários → Acesso por link e senha**.

### 7. Backups e manutenção
- Todo dia às 03:30 o sistema guarda uma cópia em `sistema-advocacia/deploy/backups` (14 dias).
- Para baixar uma cópia: no terminal do navegador, **⚙ → Fazer download do arquivo** e informe
  `sistema-advocacia/deploy/backups/advocacia-AAAA-MM-DD.tar.gz` (troque pela data). Faça isso toda semana ou mês.
- **Atualizar o sistema:** envie o novo `sistema-advocacia.tar.gz` (⚙ → upload) e rode:
```bash
tar xzf sistema-advocacia.tar.gz && cd sistema-advocacia/deploy && sudo docker compose up -d --build
```
- **Algo deu errado?** Rode `sudo docker compose logs --tail 60 app` e envie o resultado ao Claude.

---

## Alternativa — Oracle Cloud
Mais recursos, mas **exige terminal no seu computador** (SSH) e, segundo relatos recentes, às vezes não há vaga na máquina
gratuita em São Paulo, os limites gratuitos mudaram em 2026 e **máquinas ociosas podem ser recolhidas** (a saída é migrar a conta
para *Pay As You Go*, que continua gratuito dentro do limite "Always Free"). Confira sempre os limites em
<https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm>.

1. Conta em <https://www.oracle.com/br/cloud/free/>.
2. *Compute → Instances → Create instance*: Ubuntu 22.04, tipo marcado **Always Free-eligible**, gere e **baixe a chave privada**; anote o IP público.
3. Na *Security List* da sub-rede, libere **entrada** `0.0.0.0/0` nas portas TCP **80** e **443**.
4. Passos 4 e 6 do Google (DuckDNS e uso).
5. No terminal do seu computador (Windows: PowerShell):
```bash
scp -i CHAVE.key sistema-advocacia.tar.gz ubuntu@IP_PUBLICO:
ssh -i CHAVE.key ubuntu@IP_PUBLICO
tar xzf sistema-advocacia.tar.gz && cd sistema-advocacia/deploy && sudo bash install.sh
```

---

## Para quem prefere baixar direto do GitHub (avançado)
```bash
sudo apt-get update && sudo apt-get install -y git
git clone -b ccr-54c78786-wq98am https://github.com/Cris201920/repo.git
cd repo/sistema-advocacia/deploy && sudo bash install.sh
```
O repositório é privado: como senha use um *Personal Access Token* com permissão **Contents: Read**.

## Alternativa sem cartão (só se o computador ficar sempre ligado)
Rodar o sistema num computador do escritório e expô-lo com um túnel gratuito. O site sai do ar quando o computador desliga.
