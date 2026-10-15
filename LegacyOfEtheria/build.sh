#!/bin/sh
# Gera em dist/: LegacyOfEtheria.mcaddon (BP + RP juntos), os .mcpack separados e (se existir) LegacyOfEtheria_Voz.mcpack — pacote de vozes em japonês, uso pessoal.
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/*.mcaddon dist/*.mcpack
for p in LegacyOfEtheria_BP LegacyOfEtheria_RP LegacyOfEtheria_Voz; do [ -d "$p" ] && (cd "$p" && zip -9 -qr -X "../dist/$p.mcpack" .); done
zip -9 -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP
ls -la dist
