#!/bin/sh
# Gera em dist/: LegacyOfEtheria.mcaddon (BP + RP juntos), os .mcpack separados e (se existir) LegacyOfEtheria_Voz.mcpack — pacote de vozes em japonês, uso pessoal.
# 8.x: + LegacyOfEtheria_SageUI.mcpack — visual OPCIONAL do Grande Sábio (telas verdes). Antes de empacotar, a cópia do server_form.json dele é
# refeita a partir do principal e validada (tools/gen_sage_ui.py --sync); se a validação falhar, o pacote opcional fica FORA do .mcaddon.
cd "$(dirname "$0")" && mkdir -p dist && rm -f dist/*.mcaddon dist/*.mcpack
SAGEUI=""
if false && [ -d LegacyOfEtheria_SageUI ]; then   # 8.12: o visual do Sábio agora está DENTRO do pacote principal (RP/ui/server_form.json + textures/ui/etheria_sg); o pacote opcional não é mais gerado
  if python3 tools/gen_sage_ui.py --sync; then SAGEUI=LegacyOfEtheria_SageUI; else echo "AVISO: Sábio UI não passou na validação — fora do pacote."; fi
fi
# 9.3: estruturas grandes em LADRILHOS (structures/etheria_t, gerados e fora do git; colocação sem pico de lag). As originais já ladrilhadas
# ficam fora do pacote (o jogo usa os ladrilhos; mesmo resultado bloco a bloco). Se a geração/validação falhar, vão as originais (como antes).
# KEEP_ORIG=1 bash build.sh mantém as originais também.
EXCL=""
if python3 tools/wg_tiles.py >/dev/null && python3 tools/wg_tiles.py --check >/dev/null; then
  [ "${KEEP_ORIG:-0}" = "1" ] || EXCL=$(python3 tools/wg_tiles.py --originals)
else
  echo "AVISO: ladrilhos das estruturas grandes não validaram — pacote com as originais."; rm -rf LegacyOfEtheria_BP/structures/etheria_t
fi
for p in LegacyOfEtheria_BP LegacyOfEtheria_RP LegacyOfEtheria_Voz $SAGEUI; do
  X=""; [ "$p" = LegacyOfEtheria_BP ] && X="$EXCL"
  [ -d "$p" ] && (cd "$p" && zip -9 -qr -X "../dist/$p.mcpack" . ${X:+-x $X})
done
# 6.55: o pacote de vozes originais (se existir) vai junto no .mcaddon — um único arquivo para importar
EXTRA=""; [ -d LegacyOfEtheria_Voz ] && EXTRA="LegacyOfEtheria_Voz"
XA=""; for f in $EXCL; do XA="$XA LegacyOfEtheria_BP/$f"; done
zip -9 -qr -X dist/LegacyOfEtheria.mcaddon LegacyOfEtheria_BP LegacyOfEtheria_RP $EXTRA $SAGEUI ${XA:+-x $XA}
ls -la dist
