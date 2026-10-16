#!/bin/sh
# Gera em dist/: LegacyOfEtheria.mcaddon (BP + RP juntos), os .mcpack separados e (se existir) LegacyOfEtheria_Voz.mcpack — pacote de vozes em japonês, uso pessoal.
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/*.mcaddon dist/*.mcpack
for p in LegacyOfEtheria_BP LegacyOfEtheria_RP LegacyOfEtheria_Voz; do [ -d "$p" ] && (cd "$p" && zip -9 -qr -X "../dist/$p.mcpack" .); done
# 6.55: o pacote de vozes originais (se existir) vai junto no .mcaddon — um único arquivo para importar
if [ -d LegacyOfEtheria_Voz ]; then zip -9 -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP LegacyOfEtheria_Voz; else zip -9 -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP; fi
ls -la dist
