#!/bin/sh
# Gera dist/LegacyOfEtheria.mcaddon (BP + RP juntos) e também os dois .mcpack separados (para envio quando o .mcaddon passar de limites de upload).
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/*.mcaddon dist/*.mcpack
zip -9 -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP
(cd LegacyOfEtheria_BP && zip -9 -qr -X ../dist/LegacyOfEtheria_BP.mcpack .)
(cd LegacyOfEtheria_RP && zip -9 -qr -X ../dist/LegacyOfEtheria_RP.mcpack .)
ls -la dist
