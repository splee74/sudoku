"""
img/ch002.png 에서 등급별 · 표정별 캐릭터를 잘라 한 장의 그림(img/chars.webp)으로 만듭니다.

  쓰는 법 (게임 폴더에서) : python tools/make_chars.py
  확인용 그림 (칸 경계 표시) : python tools/make_chars.py 확인.png

  가로 9칸 = 등급 (하수 중수 고수 영웅 지존 초인 패왕 대왕 신)
  세로 6줄 = 표정 (기본 화남 비웃음 놀람 울음 기쁨)
  ch002.png 를 바꿔서 칸 위치가 달라지면 아래 CX0, DX, CY0, DY 숫자를 고치세요.
"""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'img', 'ch002.png')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'chars.webp')
CX0, DX = 175, 121.6   # 첫 칸 가운데 x, 칸 간격
CY0, DY = 222, 113.2   # 첫 줄 가운데 y, 줄 간격
SIDE = 112             # 잘라 낼 정사각형 크기
CELL = 160             # 그림 한 칸 크기 (화면에서 80px 의 2배)
COLS, ROWS = 9, 6

im = Image.open(SRC).convert('RGB')
sheet = Image.new('RGB', (CELL * COLS, CELL * ROWS))
for r in range(ROWS):
    for c in range(COLS):
        cx = CX0 + c * DX
        cy = CY0 + r * DY + (8 if r == 0 else 0)  # 첫 줄은 등급 이름표를 피해 조금 아래로
        box = (round(cx - SIDE / 2), round(cy - SIDE / 2), round(cx + SIDE / 2), round(cy + SIDE / 2))
        tile = im.crop(box).resize((CELL, CELL), Image.LANCZOS)
        sheet.paste(tile, (c * CELL, r * CELL))

if OUT.endswith('.png'):
    # 확인용 : 칸 경계를 그려서 저장
    d = ImageDraw.Draw(sheet)
    for c in range(COLS + 1):
        d.line([(c * CELL, 0), (c * CELL, CELL * ROWS)], fill=(255, 0, 0))
    for r in range(ROWS + 1):
        d.line([(0, r * CELL), (CELL * COLS, r * CELL)], fill=(255, 0, 0))
    sheet.save(OUT)
else:
    sheet.save(OUT, 'WEBP', quality=80, method=6)
print('saved', OUT, sheet.size)
