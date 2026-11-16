"""버전 숫자를 한 번에 올립니다.  (게임 폴더에서)  python tools/bump_version.py

바꾸는 곳 세 군데
  js/config.js : VERSION: 'v13'            (화면 오른쪽 위 버전 표시)
  sw.js        : CACHE = 'sudoku-files-v13' (오프라인 저장 묶음 이름)
  index.html   : css/js 주소 뒤의 ?v=13     (휴대폰이 예전 파일을 다시 쓰지 않게)
숫자를 직접 주면 그 숫자로 맞춥니다 : python tools/bump_version.py 20
"""
import os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def path(name):
    return os.path.join(ROOT, name)


def read(name):
    with open(path(name), encoding='utf-8') as f:
        return f.read()


def write(name, text):
    with open(path(name), 'w', encoding='utf-8', newline='') as f:
        f.write(text)


sw = read('sw.js')
now = int(re.search(r"sudoku-files-v(\d+)", sw).group(1))
new = int(sys.argv[1]) if len(sys.argv) > 1 else now + 1

write('sw.js', re.sub(r"sudoku-files-v\d+", 'sudoku-files-v%d' % new, sw))
cfg = read('js/config.js')
cfg = re.sub(r"VERSION: 'v\d+'", "VERSION: 'v%d'" % new, cfg)
cfg = re.sub(r"sudoku-files-v\d+ → 'v\d+'", "sudoku-files-v%d → 'v%d'" % (new, new), cfg)
write('js/config.js', cfg)
html = read('index.html')
html = re.sub(r'((?:href|src)="(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=\d+)?"', r'\1?v=%d"' % new, html)
write('index.html', html)
print('version v%d -> v%d' % (now, new))
