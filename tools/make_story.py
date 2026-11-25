"""이야기(숫자 도장의 전설) 그림을 게임용 webp 로 만듭니다.  (게임 폴더에서)  python tools/make_story.py

원본 (인터넷에 올리지 않음)
  img/char_list.png        사부 · 깜냥 · 혼돈쥐 대왕 · 쥐 삼형제 (배경 투명, 인물마다 큰 그림 1 + 표정 4)
  img/story/hero_v1.png    주인공 (흰 배경, 큰 그림 1 + 표정 4)
  img/story/bg_village.png, bg_forest.png, bg_summit.png   배경
  (도장 마당 배경은 홈 배경 img/home-dojo.webp 를 그대로 씁니다)

만드는 것 (게임이 씀)
  img/story/c/<인물>_<표정>.webp   인물 그림 (가장 긴 쪽 520px 까지)
  img/story/bg-village.webp, bg-forest.webp, bg-summit.webp
"""
import os
from collections import deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT_C = os.path.join(ROOT, 'img', 'story', 'c')
MAX_SIDE = 520


def p(*a):
    return os.path.join(ROOT, *a)


def keep_main(im):
    """잘라 낸 칸에 옆 인물 조각이 묻어 들어오면 지웁니다 (가장 큰 덩어리의 4% 보다 작은 덩어리)."""
    a = im.split()[3]
    w, h = im.size
    f = 2
    sw, sh = w // f, h // f
    sm = a.resize((sw, sh)).load()
    lab = [[0] * sw for _ in range(sh)]
    comps = []
    for y in range(sh):
        for x in range(sw):
            if sm[x, y] > 40 and not lab[y][x]:
                n = len(comps) + 1
                q = deque([(x, y)])
                lab[y][x] = n
                size = 0
                while q:
                    cx, cy = q.popleft()
                    size += 1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < sw and 0 <= ny < sh and sm[nx, ny] > 40 and not lab[ny][nx]:
                            lab[ny][nx] = n
                            q.append((nx, ny))
                comps.append(size)
    if not comps:
        return im
    big = max(comps)
    keep = set(i + 1 for i, s in enumerate(comps) if s >= big * 0.04)
    px = im.load()
    for y in range(h):
        for x in range(w):
            l = lab[min(y // f, sh - 1)][min(x // f, sw - 1)]
            if (l and l not in keep) or (not l and px[x, y][3] < 40):
                px[x, y] = (0, 0, 0, 0)
    return im


def unwhite(im):
    """가장자리에서 이어진 흰 바탕을 투명하게 하고, 테두리를 부드럽게."""
    w, h = im.size
    px = im.load()

    def white(c):
        return c[0] > 236 and c[1] > 236 and c[2] > 236

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white(px[x, y]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if white(px[x, y]) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and white(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = px[x, y]
            if c[3] and (px[x - 1, y][3] == 0 or px[x + 1, y][3] == 0 or px[x, y - 1][3] == 0 or px[x, y + 1][3] == 0):
                lum = (c[0] + c[1] + c[2]) / 3
                if lum > 200:
                    px[x, y] = (c[0], c[1], c[2], int(255 * max(0.2, (255 - lum) / 55)))
    return im


def save_sprite(im, name):
    bb = im.split()[3].point(lambda v: 255 if v > 30 else 0).getbbox()
    im = im.crop(bb)
    s = min(1.0, MAX_SIDE / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(OUT_C, name + '.webp'), 'WEBP', quality=82, method=6)
    print('  c/%s.webp %dx%d' % (name, im.width, im.height))


# char_list.png 에서 자를 자리 (1536×1024 그림 기준)
SHEET = {
    'master_base': (338, 20, 668, 495),
    'kkam_base': (648, 40, 905, 495),
    'king_base': (888, 60, 1210, 495),
    'trio_base': (1200, 90, 1536, 495),
    'master_joy': (344, 585, 508, 785), 'master_calm': (508, 585, 668, 785),
    'master_stern': (344, 790, 508, 1000), 'master_smile': (508, 790, 668, 1000),
    'kkam_sulky': (664, 590, 802, 785), 'kkam_shout': (800, 590, 930, 785),
    'kkam_think': (664, 795, 808, 1000), 'kkam_side': (806, 795, 940, 1000),
    'king_angry': (922, 590, 1082, 785), 'king_smile': (1080, 590, 1228, 785),
    'king_confused': (940, 795, 1092, 1000), 'king_surprise': (1090, 795, 1230, 1000),
    'trio_laugh': (1228, 600, 1536, 785), 'trio_mixed': (1228, 795, 1536, 1000),
}
# hero_v1.png 에서 자를 자리 (1248×832 그림 기준)
HERO = {
    'hero_base': (24, 10, 566, 760), 'hero_joy': (570, 34, 926, 418),
    'hero_surprise': (922, 30, 1210, 420), 'hero_determined': (566, 414, 882, 798),
    'hero_sad': (918, 422, 1214, 802),
}
BGS = ['village', 'forest', 'summit']


def main():
    os.makedirs(OUT_C, exist_ok=True)
    print('인물')
    cl = Image.open(p('img', 'char_list.png')).convert('RGBA')
    for n, b in SHEET.items():
        save_sprite(keep_main(cl.crop(b)), n)
    hv = Image.open(p('img', 'story', 'hero_v1.png')).convert('RGBA')
    for n, b in HERO.items():
        save_sprite(keep_main(unwhite(hv.crop(b))), n)
    print('배경')
    for b in BGS:
        im = Image.open(p('img', 'story', 'bg_%s.png' % b)).convert('RGB')
        im.save(p('img', 'story', 'bg-%s.webp' % b), 'WEBP', quality=80, method=6)
        print('  bg-%s.webp %dx%d' % (b, im.width, im.height))


if __name__ == '__main__':
    main()
