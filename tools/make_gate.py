"""
시작 그림(대문)과 앱 아이콘을 만듭니다.  (게임 폴더에서)  python tools/make_gate.py

  원본 : img/18884.png  (인터넷에 올리지 않음)
  할 일 : 1) 그림 제목의 "수도쿠" 를 "스도쿠" 로 고침 (수 글자 아래 세로 막대를 지우고, 왼쪽 옆 모습으로 채움)
          2) img/gate.webp, img/splash.webp (예전 이름, 같은 그림) 저장
          3) icons/ 의 앱 아이콘 4개 저장
  확인용 : python tools/make_gate.py 확인  → _preview/gate_fix.png 에 고친 부분을 크게 저장
"""
import os
import sys
from PIL import Image, ImageFilter, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def p(*a):
    return os.path.join(ROOT, *a)


im = Image.open(p('img', '18884.png')).convert('RGB')
W, H = im.size
px = im.load()


def dark(c):
    r, g, b = c
    return b > 90 and r < 90 and g < 110  # 제목 글자의 진한 남색


def orange(c):
    r, g, b = c
    return r > 200 and 110 < g < 215 and b < 120  # 제목 아래 주황 띠


# ---- 1) "수" 의 가로 막대 아래쪽 경계선 찾기 (막대는 오른쪽으로 갈수록 올라감) ----
def bar_bottom(x):
    """세로로 훑어서 남색 덩어리들 중 가로 막대(위쪽 ㅅ 획 다음 덩어리)의 아래 끝"""
    runs, start = [], None
    for y in range(275, 440):
        if dark(px[x, y]):
            if start is None:
                start = y
        elif start is not None:
            runs.append((start, y))
            start = None
    bars = [r for r in runs if r[0] >= 305 and 25 <= r[1] - r[0] <= 50]
    return bars[0][1] if bars else None


xs = [x for x in list(range(180, 238)) + list(range(294, 322)) if bar_bottom(x)]
pts = [(x, bar_bottom(x)) for x in xs]
n = len(pts)
mx = sum(x for x, _ in pts) / n
my = sum(y for _, y in pts) / n
slope = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)


def line(x):
    return my + slope * (x - mx)


# ---- 세로 막대 자리(흰 테두리 포함)를 왼쪽 기준 줄의 모습으로 덮기 ----
X0, X1 = 218, 306          # 덮을 가로 범위 (세로 막대와 그 흰 테두리, 그림자까지)
REF = 200                  # 기준 줄 (막대가 없는 곳)
FEATHER = 10               # 가장자리를 부드럽게 섞는 폭
src = im.copy()
spx = src.load()


def sky_column(x):
    """x 줄의 하늘 색 (주황 띠나 흰 테두리 같은 하늘 아닌 곳은 바로 위 하늘 색으로 이어 씀)"""
    out, last = {}, spx[x, 300]
    for y in range(300, H):
        r, g, b = spx[x, y]
        if b > r + 15 and b > 200:  # 하늘(푸른 빛)
            last = (r, g, b)
        out[y] = last
    return out


SKY_L, SKY_R = sky_column(X0 - 1), sky_column(X1 + 1)
def mix(a, b, k):
    return tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3))


for x in range(X0, X1 + 1):
    w = min(1.0, (x - X0 + 1) / FEATHER, (X1 - x + 1) / FEATHER)
    t = (x - X0 + 1) / (X1 - X0 + 2)
    base = int(round(line(x)))
    # 주황 띠 윗선 (여기 바로 위까지만 덮고, 경계 몇 줄은 섞어서 부드럽게)
    otop = next((y for y in range(base + 20, min(H, base + 90)) if orange(spx[x, y])), base + 80)
    for y in range(base - 6, otop + 2):
        dy = y - base
        # 위쪽(막대 아랫선 · 흰 테두리 · 그림자)은 왼쪽 기준 줄을 그대로 옮기고,
        # 그 아래 하늘은 양옆 하늘 색을 이어서 칠합니다 (세로 이음매가 생기지 않게)
        fy = line(REF) + (y - line(x))  # 소수점까지 맞춰서 막대 아랫선이 계단지지 않게
        y0 = int(fy)
        ref = mix(spx[REF, y0], spx[REF, y0 + 1], fy - y0)
        sky = mix(SKY_L[y], SKY_R[y], t)
        k = min(1.0, max(0.0, (dy - 28) / 14))
        fill = mix(ref, sky, k)
        if y >= otop - 2:
            fill = mix(fill, spx[x, y], (y - (otop - 3)) / 5)
        px[x, y] = mix(spx[x, y], fill, w)
# 이음매를 아주 살짝 흐리게
box = (X0 - 4, int(line(X1)) - 8, X1 + 4, int(line(X0)) + 82)
im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(0.6)), box[:2])

if len(sys.argv) > 1:
    os.makedirs(p('_preview'), exist_ok=True)
    a = Image.open(p('img', '18884.png')).convert('RGB').crop((100, 150, 440, 460))
    b = im.crop((100, 150, 440, 460))
    out = Image.new('RGB', (a.width * 2 + 10, a.height), 'white')
    out.paste(a, (0, 0))
    out.paste(b, (a.width + 10, 0))
    out.resize((out.width * 2, out.height * 2)).save(p('_preview', 'gate_fix.png'))
    print('saved _preview/gate_fix.png')
    sys.exit()

# ---- 2) 시작 그림 ----
im.save(p('img', 'gate.webp'), 'WEBP', quality=80, method=6)
im.save(p('img', 'splash.webp'), 'WEBP', quality=80, method=6)

# ---- 3) 앱 아이콘 : 제목과 고양이가 들어가는 정사각형 ----
Y0 = 120
sq = im.crop((0, Y0, W, Y0 + W))
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    sq.resize((size, size), Image.LANCZOS).save(p('icons', name), optimize=True)
# maskable : 안전 영역(가운데 80%) 안에 그림이 다 들어가게, 바깥은 흐린 그림으로
S = 512
bg = sq.resize((S, S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18))
inner = int(S * 0.8)
fg = sq.resize((inner, inner), Image.LANCZOS)
mask = Image.new('L', (inner, inner), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=inner // 6, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(6))
off = (S - inner) // 2
bg.paste(fg, (off, off), mask)
bg.save(p('icons', 'icon-maskable-512.png'), optimize=True)
print('saved img/gate.webp, img/splash.webp, icons/*', 'slope=%.3f' % slope)
