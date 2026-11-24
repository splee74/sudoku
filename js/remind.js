/*
 * 매일 알림 : 하루 한 번 "오늘의 스도쿠가 기다려요" 알림을 띄웁니다.
 *
 * 서버 없이 크롬의 '주기적 백그라운드 동기화(periodicSync)'를 씁니다.
 *   - 안드로이드 크롬에서 홈 화면에 설치한 앱(플레이 스토어 앱 포함)에서 됩니다.
 *   - 알림이 뜨는 정확한 시각은 크롬이 정합니다 (보통 하루에 한 번쯤, 휴대폰을 쓰는 시간대).
 *   - 아이폰 · 설치하지 않은 인터넷 창에서는 안 됩니다 (그때는 켜려고 하면 안내만 보여 줌).
 *
 * 알림을 띄우는 쪽은 sw.js 의 'periodicsync' 입니다.
 * 오늘 이미 앱을 열었거나, 오늘 이미 알림을 보냈으면 띄우지 않습니다.
 * (앱을 연 날짜는 아래 touch() 가 저장소 'sudoku-meta' 에 적어 두고 sw.js 가 읽습니다)
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var TAG = 'daily-remind';
  var META = 'sudoku-meta';

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function reg() {
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no-sw'));
    return navigator.serviceWorker.ready;
  }

  /* 이 기기에서 쓸 수 있는지 */
  function supported() {
    return 'Notification' in root && 'serviceWorker' in navigator && 'PeriodicSyncManager' in root;
  }

  /* 오늘 앱을 열었다고 적어 둡니다 (그날은 알림을 보내지 않음) */
  function touch() {
    if (!root.caches) return;
    root.caches.open(META).then(function (c) {
      return c.put('remind-open', new Response(today()));
    }).catch(function () {});
  }

  /* 켜기 : 알림 허락을 받고 하루 한 번 깨워 달라고 등록합니다. 결과 { ok, why } */
  function enable() {
    if (!supported()) return Promise.resolve({ ok: false, why: 'unsupported' });
    return Promise.resolve(Notification.permission === 'granted' ? 'granted' : Notification.requestPermission())
      .then(function (perm) {
        if (perm !== 'granted') return { ok: false, why: 'denied' };
        return reg().then(function (r) {
          return r.periodicSync.register(TAG, { minInterval: 24 * 60 * 60 * 1000 });
        }).then(function () {
          return { ok: true };
        }, function () {
          // 설치하지 않은 창이면 크롬이 등록을 거절합니다
          return { ok: false, why: 'install' };
        });
      });
  }

  function disable() {
    if (!supported()) return Promise.resolve();
    return reg().then(function (r) {
      return r.periodicSync.unregister(TAG);
    }).catch(function () {});
  }

  /* 앱을 켤 때 : 켜 둔 사람이면 등록을 다시 확인 (휴대폰을 바꿨거나 등록이 풀렸을 때) */
  function start() {
    touch();
    if (S.Settings && S.Settings.get('remind') && supported() && Notification.permission === 'granted') {
      reg().then(function (r) {
        return r.periodicSync.getTags().then(function (tags) {
          if (tags.indexOf(TAG) < 0) return r.periodicSync.register(TAG, { minInterval: 24 * 60 * 60 * 1000 });
        });
      }).catch(function () {});
    }
  }

  S.Remind = { supported: supported, enable: enable, disable: disable, start: start, touch: touch };
})(typeof window !== 'undefined' ? window : globalThis);
