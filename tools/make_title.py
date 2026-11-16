"""홈 화면 가운데 제목 그림(img/title.webp)을 만듭니다.  (게임 폴더에서)  python tools/make_title.py

글자를 그림으로 넣는 까닭 : 손가락으로 길게 누르면 글자가 선택(파랗게)되는 것을 막기 위해.
글꼴은 윈도우의 맑은 고딕 굵게. 글자 · 색을 바꾸려면 아래 숫자만 고치세요.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

TEXT = '스도쿠 승급전'
FONT = 'C:/Windows/Fonts/malgunbd.ttf'
SIZE = 132                      # 글자 크기 (화면에는 1/3 크기로 보임)
STROKE = 14                     # 하얀 테두리 두께
TOP, BOTTOM = (122, 78, 32), (52, 30, 10)   # 글자 색 : 위 → 아래 (나무 갈색)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'title.webp')

font = ImageFont.truetype(FONT, SIZE)
pad = STROKE + 30
l, t, r, b = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), TEXT, font=font, stroke_width=STROKE)
W, H = r - l + pad * 2, b - t + pad * 2
pos = (pad - l, pad - t)

def mask(stroke):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).text(pos, TEXT, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    return m

outline, inner = mask(STROKE), mask(0)

# 그림자 : 테두리 모양을 아래로 조금 내려 흐리게
shadow = Image.new('RGBA', (W, H), (40, 30, 10, 0))
sm = outline.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.45))
shadow.putalpha(Image.new('L', (W, H), 0))
shadow_layer = Image.new('RGBA', (W, H), (40, 30, 10, 255))
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
canvas.paste(shadow_layer, (0, 8), sm)

# 하얀 테두리
canvas.paste(Image.new('RGBA', (W, H), (255, 255, 255, 255)), (0, 0), outline)

# 글자 : 위아래로 색이 바뀌는 나무 갈색
grad = Image.new('RGBA', (W, H))
gd = ImageDraw.Draw(grad)
y0, y1 = pos[1] + t, pos[1] + b
for y in range(H):
    k = min(1, max(0, (y - y0) / max(1, (y1 - y0))))
    gd.line([(0, y), (W, y)], fill=tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * k) for i in range(3)) + (255,))
canvas.paste(grad, (0, 0), inner)

canvas = canvas.crop(canvas.getbbox())
canvas.save(OUT, 'WEBP', quality=90, method=6)
print('saved', OUT, canvas.size)
