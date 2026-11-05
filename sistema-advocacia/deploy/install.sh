#!/usr/bin/env bash
# Instala o sistema do escritório em uma máquina Ubuntu/Debian (ex.: VM gratuita Oracle/Google Cloud).
# Uso:  sudo bash install.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Execute com sudo:  sudo bash install.sh"; exit 1; fi
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "== Sistema do escritório: instalação =="

# 1) Memória extra (VMs gratuitas pequenas têm 1 GB e precisam de swap para montar o sistema)
mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if [ "$mem_kb" -lt 1900000 ] && ! swapon --show | grep -q .; then
  echo "-> Criando 2 GB de memória swap..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "-> Instalando o Docker..."
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose não encontrado. Instale o plugin 'docker-compose-plugin'."; exit 1; }

# 3) Configuração (.env) — só pergunta na primeira vez
if [ ! -f .env ]; then
  read -rp "Endereço do site (ex.: meuescritorio.duckdns.org): " DOMINIO
  DOMINIO="${DOMINIO#http://}"; DOMINIO="${DOMINIO#https://}"; DOMINIO="${DOMINIO%%/*}"
  [ -n "$DOMINIO" ] || { echo "O endereço é obrigatório."; exit 1; }
  read -rp "Chave da IA (ANTHROPIC_API_KEY) — Enter para configurar depois: " CHAVE
  if command -v openssl >/dev/null 2>&1; then DATA_KEY="$(openssl rand -hex 32)"; else DATA_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi
  umask 077
  cat > .env <<EOF
DOMINIO=$DOMINIO
ANTHROPIC_API_KEY=$CHAVE
ANTHROPIC_MODEL=claude-sonnet-5-5
DATA_KEY=$DATA_KEY
EOF
  NOVA_CHAVE=1
else
  echo "-> Usando a configuração existente (.env)."
  NOVA_CHAVE=0
fi
chmod 600 .env
# shellcheck disable=SC1091
DOMINIO="$(grep '^DOMINIO=' .env | cut -d= -f2-)"

# 4) Pasta de dados (o usuário "node" do contêiner tem UID 1000)
mkdir -p data backups
chown -R 1000:1000 data

# 5) Libera as portas 80 e 443 no firewall da máquina (Oracle Ubuntu bloqueia por padrão)
if command -v iptables >/dev/null 2>&1; then
  for p in 80 443; do iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$p" -j ACCEPT; done
  if command -v netfilter-persistent >/dev/null 2>&1; then netfilter-persistent save >/dev/null 2>&1 || true; fi
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

# 6) Sobe o sistema
echo "-> Montando e iniciando (na primeira vez demora alguns minutos)..."
docker compose up -d --build

# 7) Backup diário às 03:30 (mantém 14 dias)
chmod +x backup.sh
echo "30 3 * * * root $DIR/backup.sh >> $DIR/backups/backup.log 2>&1" > /etc/cron.d/advocacia-backup

echo
echo "=============================================================="
echo " Pronto! Abra:  https://$DOMINIO"
echo " (o certificado HTTPS pode levar 1 a 2 minutos na primeira vez)"
if [ "$NOVA_CHAVE" = "1" ]; then
  echo
  echo " GUARDE ESTA CHAVE em local seguro (sem ela os documentos não abrem):"
  echo "   $(grep '^DATA_KEY=' .env | cut -d= -f2-)"
fi
echo
echo " Logs:       cd $DIR && docker compose logs -f app"
echo " Atualizar:  cd $DIR/../.. && git pull && cd $DIR && sudo docker compose up -d --build"
echo " Backups:    $DIR/backups  (baixe uma cópia de vez em quando)"
echo "=============================================================="
