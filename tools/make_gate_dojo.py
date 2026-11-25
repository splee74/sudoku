"""시작 화면(대문) 그림을 숫자도장 마당으로 만듭니다.  (게임 폴더에서)  python tools/make_gate_dojo.py

재료 : img/home-dojo.webp (도장 마당), img/title.webp (제목 글씨),
       img/story/hero_v1.png (주인공 원본), img/char_list.png (사부 · 깜냥 원본)
결과 : img/gate-dojo.webp (941×1672, 예전 대문 img/gate.webp 와 같은 크기라 css 배치는 그대로)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_story as ms  # 인물 자르기 (keep_main, unwhite) 를 같이 씀

W, H = 941, 1672


def p(*a):
    return os.path.join(ROOT, *a)


def trim(im):
    return im.crop(im.split()[3].point(lambda v: 255 if v > 30 else 0).getbbox())


def fit_h(im, h):
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def shadow(canvas, cx, y, w):
    """발밑 그림자"""
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((cx - w / 2, y - w * 0.09, cx + w / 2, y + w * 0.09), fill=(40, 25, 10, 120))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))


def main():
    # 1) 도장 마당 : 세로로 꽉 차게 (가운데 기준으로 양옆을 자름)
    bg = Image.open(p('img', 'home-dojo.webp')).convert('RGB')
    s = H / bg.height
    bg = bg.resize((round(bg.width * s), H), Image.LANCZOS)
    x0 = (bg.width - W) // 2
    canvas = bg.crop((x0, 0, x0 + W, H)).convert('RGBA')

    # 2) 따뜻한 빛 + 가장자리를 살짝 어둡게 + 위쪽(제목 자리)은 살짝 밝게
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-200, 650, W + 200, 1700), fill=(255, 214, 150, 70))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    vig = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vig).ellipse((-260, -200, W + 260, H + 160), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new('RGBA', (W, H), (45, 28, 12, 150))
    dark.putalpha(vig.point(lambda v: 150 - v * 150 // 255))
    canvas.alpha_composite(dark)
    top = Image.new('RGBA', (W, 560), (0, 0, 0, 0))
    td = ImageDraw.Draw(top)
    for y in range(560):
        td.line((0, y, W, y), fill=(255, 246, 228, int(110 * (1 - y / 560) ** 1.6)))
    canvas.alpha_composite(top)

    # 3) 인물 : 사부(왼쪽 뒤) · 깜냥(오른쪽 뒤) · 주인공(가운데 앞)
    cl = Image.open(p('img', 'char_list.png')).convert('RGBA')
    master = trim(ms.keep_main(cl.crop(ms.SHEET['master_base'])))
    kkam = trim(ms.keep_main(cl.crop(ms.SHEET['kkam_base'])))
    hv = Image.open(p('img', 'story', 'hero_v1.png')).convert('RGBA')
    hero = trim(ms.keep_main(ms.unwhite(hv.crop(ms.HERO['hero_base']))))

    floor = 1440  # 발 놓는 줄 (아래 '터치해서 시작하기' 단추 위)
    m = fit_h(master, 520)
    k = fit_h(kkam, 500)
    hr = fit_h(hero, 700)
    shadow(canvas, 275, floor - 40, 240)
    canvas.alpha_composite(m, (275 - m.width // 2 - 10, floor - 40 - m.height))
    shadow(canvas, W - 270, floor - 40, 220)
    canvas.alpha_composite(k, (W - 270 - k.width // 2 + 10, floor - 40 - k.height))
    shadow(canvas, W // 2, floor, 360)
    canvas.alpha_composite(hr, (W // 2 - hr.width // 2 + 10, floor - hr.height))

    # 4) 제목 + 부제
    title = Image.open(p('img', 'title.webp')).convert('RGBA')
    t = title.resize((640, round(title.height * 640 / title.width)), Image.LANCZOS)  # 좁은 휴대폰은 양옆이 잘리므로 가운데 70% 안에
    ty = 205  # 제목이 간판(숫자도장)을 덮게 : 부제와 간판 글씨가 겹쳐 보이지 않음
    canvas.alpha_composite(t, ((W - t.width) // 2, ty))
    sub = '~ 숫자 도장의 전설 ~'
    f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 44)
    d = ImageDraw.Draw(canvas)
    bb = d.textbbox((0, 0), sub, font=f, stroke_width=6)
    sx = (W - (bb[2] - bb[0])) // 2 - bb[0]
    sy = ty + t.height + 14
    d.text((sx, sy), sub, font=f, fill=(255, 248, 232), stroke_width=6, stroke_fill=(92, 52, 18))

    canvas.convert('RGB').save(p('img', 'gate-dojo.webp'), 'WEBP', quality=84, method=6)
    print('img/gate-dojo.webp', W, H)


if __name__ == '__main__':
    main()
