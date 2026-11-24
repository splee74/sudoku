"""img/cat_icon_img01.png (아이콘 모음 그림) 에서 아이콘을 하나씩 잘라 img/icons/이름.webp 로 저장합니다.

  쓰는 법 (게임 폴더에서) : python tools/make_icons.py
  확인용 모음 그림         : python tools/make_icons.py 확인.png

  BOXES 의 칸(대충 잡은 자리) 안에서 그림이 있는 곳만 딱 맞게 잘라 냅니다.
  아이콘 둘레의 옅은 빛 번짐은 지워서 어느 바탕에 놓아도 깔끔하게 보이게 합니다.
  저장 크기 : 긴 쪽 SIZE px (화면에서는 보통 24~48px 로 씀, 휴대폰 화면이 선명하도록 크게)
"""
import os
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'img', 'cat_icon_img01.png')
OUT_DIR = os.path.join(HERE, '..', 'img', 'icons')
SIZE = 128
CUT = 70  # 이보다 흐린(투명도) 곳은 빛 번짐으로 보고 지웁니다

# 이름 : (왼쪽, 위, 오른쪽, 아래)  원본 그림(1536 x 1024) 기준으로 대충 잡은 자리
BOXES = {
    'cat-sudoku': (20, 10, 265, 250),
    'cat-curious': (1265, 15, 1525, 262),
    'trophy': (15, 268, 228, 458),
    'crown': (245, 285, 432, 437),
    'eraser': (708, 298, 878, 448),
    'pencil': (885, 278, 1040, 452),
    'refresh': (1058, 288, 1222, 442),
    'gear': (1220, 285, 1382, 447),
    'house': (1385, 288, 1530, 432),
    'calendar': (630, 468, 802, 628),
    'heart': (815, 478, 987, 627),
    'gift': (1000, 468, 1172, 627),
    'bell': (1180, 468, 1352, 627),
    'paw': (12, 643, 167, 772),
    'cat-face': (188, 643, 347, 772),
    'star': (978, 640, 1112, 767),
    'paw-pink': (1273, 643, 1412, 772),
    'sparkle': (1418, 648, 1518, 748),
    'medal': (488, 773, 627, 902),
    'stopwatch': (638, 773, 797, 897),
    'podium': (828, 778, 1022, 897),
    'flag': (1232, 768, 1374, 889),
    'target': (1393, 768, 1532, 897),
}


def cut(src, box):
    tile = src.crop(box)
    r, g, b, a = tile.split()
    a = a.point(lambda v: 0 if v < CUT else min(255, int((v - CUT) * 255 / (235 - CUT))) if v < 235 else 255)
    tile = Image.merge('RGBA', (r, g, b, a))
    bbox = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    tile = tile.crop(bbox)
    w, h = tile.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(tile, ((side - w) // 2, (side - h) // 2))
    return sq.resize((SIZE, SIZE), Image.LANCZOS)


"""
홈 화면 큰 단추 그림 : img/cat_icon_img02.png (왼쪽 '이어서 하기', 오른쪽 '새 게임 시작')
  -> img/btn-continue.webp, img/btn-new.webp
  그림 둘레에 얼룩진 빛 번짐이 있어서, 짙은 바깥 테두리선 안쪽만 남기고 나머지를 지웁니다.
"""
SRC2 = os.path.join(HERE, '..', 'img', 'cat_icon_img02.png')
BUTTONS = {'btn-continue': (0, 0, 887, 887), 'btn-new': (887, 0, 1774, 887)}
BTN_W = 520


def cut_button(src, box):
    t = src.crop(box)
    pad = Image.new('RGBA', (t.width + 20, t.height + 20), (0, 0, 0, 0))
    pad.paste(t, (10, 10))
    t = pad
    a = t.getchannel('A')
    lum = t.convert('RGB').convert('L')
    dark = lum.point(lambda v: 255 if v < 120 else 0)
    solid = a.point(lambda v: 255 if v > 200 else 0)
    outline = ImageChops.multiply(dark, solid).filter(ImageFilter.MaxFilter(5))
    ImageDraw.floodfill(outline, (0, 0), 100)  # 바깥에서부터 테두리선까지 칠함
    inside = outline.point(lambda v: 0 if v == 100 else 255).filter(ImageFilter.MaxFilter(3))
    na = ImageChops.multiply(a, inside)
    t.putalpha(na)
    t = t.crop(na.getbbox())
    return t.resize((BTN_W, round(t.height * BTN_W / t.width)), Image.LANCZOS)


def main():
    if os.path.exists(SRC2):
        src2 = Image.open(SRC2).convert('RGBA')
        for name, box in BUTTONS.items():
            cut_button(src2, box).save(os.path.join(HERE, '..', 'img', name + '.webp'), 'WEBP', quality=88, method=6)
    src = Image.open(SRC).convert('RGBA')
    os.makedirs(OUT_DIR, exist_ok=True)
    tiles = {}
    for name, box in BOXES.items():
        tiles[name] = cut(src, box)
        tiles[name].save(os.path.join(OUT_DIR, name + '.webp'), 'WEBP', quality=88, method=6)
    if len(sys.argv) > 1:
        # 확인용 : 회색 바탕에 모두 늘어놓기
        cols = 8
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * (SIZE + 8), rows * (SIZE + 8)), (200, 200, 205, 255))
        for i, t in enumerate(tiles.values()):
            sheet.alpha_composite(t, ((i % cols) * (SIZE + 8) + 4, (i // cols) * (SIZE + 8) + 4))
        sheet.save(sys.argv[1])
    print('saved', len(tiles), 'icons ->', OUT_DIR)


if __name__ == '__main__':
    main()
