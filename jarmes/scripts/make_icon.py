"""Gera assets/jarmes.png e assets/jarmes.ico (anel ciano com a letra J). Requer Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "jarmes" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.ellipse((24, 24, SIZE - 24, SIZE - 24), fill=(6, 11, 22, 255))
# anel externo em segmentos (estilo painel holográfico)
for start, end, col in ((200, 330, (34, 211, 238, 255)), (350, 70, (59, 130, 246, 255)), (90, 180, (34, 211, 238, 160))):
    d.arc((90, 90, SIZE - 90, SIZE - 90), start=start, end=end, fill=col, width=44)
d.ellipse((190, 190, SIZE - 190, SIZE - 190), outline=(27, 50, 83, 255), width=14)
# letra J desenhada com formas simples
w = 74
cx = SIZE // 2 + 40
d.rounded_rectangle((cx - w // 2, 300, cx + w // 2, 650), radius=w // 2, fill=(230, 241, 255, 255))
d.arc((cx - 250, 470, cx + 40, 760), start=0, end=180, fill=(230, 241, 255, 255), width=w)
d.ellipse((cx - 250 - 2, 595 - 2, cx - 250 + w - 2, 595 + w - 2), fill=(230, 241, 255, 255))
img.save(OUT / "jarmes.png")
img.save(OUT / "jarmes.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ícones gerados em", OUT)
