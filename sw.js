/*
 * 인터넷 없이도 게임이 켜지게 해 주는 파일 (서비스 워커).
 *
 * 하는 일
 *   - 처음 열 때 게임 파일을 기기에 한 벌 저장해 둡니다.
 *   - 인터넷이 될 때는 언제나 새 파일을 받아 오고, 저장해 둔 것도 새것으로 바꿉니다.
 *     (그래서 게임을 고쳐서 올리면 따로 손댈 것 없이 바로 반영됩니다)
 *   - 인터넷이 안 될 때만 저장해 둔 파일로 게임을 켭니다.
 *
 * 새 파일(그림, js, css)을 추가했으면 아래 FILES 목록에도 한 줄 넣어 주세요.
 * 버전을 올릴 때는  python tools/bump_version.py  를 쓰면 CACHE, 화면 버전, index.html 의 ?v= 가 한 번에 바뀝니다.
 */
var CACHE = 'sudoku-files-v48';
var FILES = [
  './',
  'index.html',
  'privacy.html',
  'manifest.json',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'img/skin-wood.jpg',
  'img/gate.webp',
  'img/sudoku_img01.webp',
  'img/chars.webp',
  'img/title.webp',
  'audio/bgm01.mp3',
  'css/style.css',
  'css/skins.css',
  'css/screens.css',
  'css/about.css',
  'css/dark.css',
  'css/fx.css',
  'js/config.js',
  'js/engine.js',
  'js/game.js',
  'js/progress.js',
  'js/settings.js',
  'js/skins.js',
  'js/sound.js',
  'js/music.js',
  'js/effects.js',
  'js/badges.js',
  'js/shop.js',
  'js/account.js',
  'js/ranking.js',
  'js/tutorial.js',
  'js/hero.js',
  'js/ui.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // 예전 이름으로 저장해 둔 묶음은 지웁니다
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          return name !== CACHE ? caches.delete(name) : null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // cache: 'no-cache' : 휴대폰 브라우저가 잠시 들고 있던 예전 파일 말고, 늘 서버에 새것인지 물어봅니다
    fetch(req, { cache: 'no-cache' })
      .then(function (res) {
        // 200 만 저장 (음악은 조각(206)으로 받아 와서 저장이 안 됨 → 위 FILES 로 미리 저장)
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      })
      .catch(function () {
        // 인터넷이 안 될 때 : 저장해 둔 파일. 주소 뒤에 ?... 가 붙어 있어도 찾습니다
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          // 화면을 여는 요청일 때만 게임 첫 화면으로 (그림·css 자리에 html 을 주면 깨져 보임)
          if (req.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
      })
  );
});
