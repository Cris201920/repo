#!/bin/sh
# Gera em dist/: LegacyOfEtheria_BP.mcpack, LegacyOfEtheria_RP.mcpack e (se existir) LegacyOfEtheria_Voz.mcpack — pacote de vozes, uso pessoal.
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/*.mcaddon dist/*.mcpack
for p in LegacyOfEtheria_BP LegacyOfEtheria_RP LegacyOfEtheria_Voz; do [ -d "$p" ] && (cd "$p" && zip -9 -qr -X "../dist/$p.mcpack" .); done
ls -la dist
