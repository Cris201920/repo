#!/bin/sh
# Gera dist/LegacyOfEtheria.mcaddon (BP + RP) a partir desta pasta.
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/LegacyOfEtheria.mcaddon && zip -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP && ls -la dist
