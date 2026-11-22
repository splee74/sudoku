"""
img/cat_grades_84/ 의 고양이 그림(등급별 · 표정별 낱장)을 한 장의 그림(img/chars.webp)으로 모읍니다.

  쓰는 법 (게임 폴더에서) : python tools/make_chars.py
  확인용 그림 (칸 경계 표시) : python tools/make_chars.py 확인.png

  가로 14칸 = 등급 (grade01 가장 낮음 … grade14 가장 높음)
  세로 6줄  = 표정 (기본 기쁨 화남 슬픔 당황 궁금)  ← js/hero.js 의 MOODS 와 같은 순서
  게임 등급이 어느 칸을 쓰는지는 js/config.js 의 GRADES 의 char 로 정합니다.
"""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'img', 'cat_grades_84')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'img', 'chars.webp')
MOODS = ['basic', 'happy', 'angry', 'sad', 'surprised', 'curious']
COLS, ROWS = 14, len(MOODS)
CELL = 168  # 그림 한 칸 크기 (화면에서 84px 의 2배)

sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
for c in range(COLS):
    g = 'grade%02d' % (c + 1)
    for r, mood in enumerate(MOODS):
        name = '%s_%02d_%s.png' % (g, r + 1, mood)
        tile = Image.open(os.path.join(SRC, g, name)).convert('RGBA')
        sheet.paste(tile.resize((CELL, CELL), Image.LANCZOS), (c * CELL, r * CELL))

if OUT.endswith('.png'):
    # 확인용 : 칸 경계를 그려서 저장
    d = ImageDraw.Draw(sheet)
    for c in range(COLS + 1):
        d.line([(c * CELL, 0), (c * CELL, CELL * ROWS)], fill=(255, 0, 0, 255))
    for r in range(ROWS + 1):
        d.line([(0, r * CELL), (CELL * COLS, r * CELL)], fill=(255, 0, 0, 255))
    sheet.save(OUT)
else:
    sheet.save(OUT, 'WEBP', quality=82, method=6)
print('saved', OUT, sheet.size)
