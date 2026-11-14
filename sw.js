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
 */
var CACHE = 'sudoku-files-v6';
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
  'img/splash.webp',
  'img/sudoku_img01.webp',
  'css/style.css',
  'css/skins.css',
  'css/screens.css',
  'css/about.css',
  'css/dark.css',
  'js/config.js',
  'js/engine.js',
  'js/game.js',
  'js/progress.js',
  'js/settings.js',
  'js/skins.js',
  'js/sound.js',
  'js/effects.js',
  'js/badges.js',
  'js/account.js',
  'js/tutorial.js',
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
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
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
          return hit || caches.match('index.html');
        });
      })
  );
});
