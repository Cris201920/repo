"""Ícone do pacote (pack_icon.png do BP e do RP, 256x256) a partir da imagem do círculo mágico com a Terra no centro.
Uso: python3 tools/pack_icon.py <imagem do círculo mágico (.webp/.png/.jpg)>
Recorta um quadrado centrado no círculo (o centro da imagem), aplica uma máscara circular suave (fundo preto fora do anel) e reduz para 256 px.
Idempotente: sempre gera a partir da imagem de origem; não lê o ícone anterior."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTS = [os.path.join(ROOT, "LegacyOfEtheria_BP", "pack_icon.png"), os.path.join(ROOT, "LegacyOfEtheria_RP", "pack_icon.png")]
SIZE = 256

def make(src):
    im = Image.open(src).convert("RGB"); W, H = im.size
    cx, cy = W * 0.5, H * 0.497                     # o círculo está no centro do quadro
    side = int(min(W, H) * 0.96)                     # pega o anel externo inteiro
    box = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
    sq = im.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    sq = ImageEnhance.Contrast(sq).enhance(1.12)
    mask = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).ellipse((6, 6, SIZE * 4 - 6, SIZE * 4 - 6), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
    out.paste(sq, (0, 0), mask)
    return out

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    icon = make(sys.argv[1])
    for p in OUTS: icon.save(p, optimize=True); print("ok", p, icon.size)
