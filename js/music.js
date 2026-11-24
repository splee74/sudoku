/*
 * 배경 음악 : audio/bgm01.mp3 → bgm02.mp3 → bgm01.mp3 … 두 곡을 번갈아 모든 화면에서 계속 틉니다.
 * 화면을 옮겨도 곡이 처음부터 다시 시작하지 않고 그대로 이어집니다.
 * 곡을 더 넣으려면 아래 LIST 에 한 줄 더 적고 sw.js 의 FILES 에도 넣어 주세요.
 *
 * 소리 크기와 부드럽게 켜고 끄기는 Web Audio 를 거쳐서 합니다 (아이폰은 audio.volume 을 못 바꿔서).
 * 브라우저가 소리를 막아 두면, 화면을 처음 만지는 순간 이어서 나옵니다.
 *
 * 쓰는 법
 *   Music.play()   (예전처럼 Music.play('title') / Music.play('game') 도 되고, 같은 곡이 나옵니다)
 *   Music.stop()
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var LIST = ['audio/bgm01.mp3', 'audio/bgm02.mp3'];
  var LEVEL = 0.36; // 소리 크기 (효과음보다 작게)
  var track = 0; // 지금 곡 (LIST 의 몇 번째)

  var audio = null, ctx = null, gain = null;
  var want = false; // 지금 음악이 나와야 하는지

  function enabled() {
    return !(S.Settings && S.Settings.get('music') === false);
  }

  function setup() {
    if (audio) return;
    audio = new Audio(LIST[track]);
    audio.loop = LIST.length < 2;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    // 한 곡이 끝나면 다음 곡으로 (마지막 곡 다음은 첫 곡)
    audio.addEventListener('ended', function () {
      track = (track + 1) % LIST.length;
      audio.src = LIST[track];
      if (want && !(root.document && root.document.hidden)) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
    var AC = root.AudioContext || root.webkitAudioContext;
    if (AC) {
      try {
        ctx = new AC();
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(audio).connect(gain);
        gain.connect(ctx.destination);
      } catch (e) {
        ctx = gain = null;
      }
    }
    if (!gain) audio.volume = 0;
  }

  /* 소리 크기를 sec 초 동안 to 로 */
  var fadeTimer = null;
  function fade(to, sec, done) {
    clearInterval(fadeTimer);
    if (gain) {
      var t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(to, t + sec);
      if (done) fadeTimer = setTimeout(done, sec * 1000 + 50);
      return;
    }
    // Web Audio 가 없는 옛 브라우저 : audio.volume 을 조금씩
    var from = audio.volume, steps = Math.max(1, Math.round(sec * 20)), i = 0;
    fadeTimer = setInterval(function () {
      i++;
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
      if (i >= steps) {
        clearInterval(fadeTimer);
        if (done) done();
      }
    }, 50);
  }

  function start() {
    if (!want || !audio || (root.document && root.document.hidden)) return;
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var p = audio.paused ? audio.play() : null;
    if (p && p.catch) p.catch(function () { /* 막힘 : 화면을 만지면 다시 시도 */ });
    fade(LEVEL, 1.2);
  }

  function play() {
    if (!enabled()) return Promise.resolve(false);
    setup();
    if (want && !audio.paused) return Promise.resolve(true);
    want = true;
    start();
    return Promise.resolve(true);
  }

  function stop(sec) {
    if (!audio || !want) return;
    want = false;
    fade(0, sec == null ? 0.6 : sec, function () {
      if (!want) audio.pause();
    });
  }

  if (root.document) {
    // 앱이 뒤로 가면 쉬고, 돌아오면 이어서
    root.document.addEventListener('visibilitychange', function () {
      if (!audio) return;
      if (root.document.hidden) {
        audio.pause();
        if (ctx && ctx.suspend) ctx.suspend();
      } else if (want) {
        start();
      }
    });
    // 브라우저가 소리를 막았거나 (아이폰) 돌아온 뒤 멈춰 있으면, 처음 만질 때 다시 틉니다
    root.document.addEventListener('pointerdown', function () {
      if (!want || !audio || root.document.hidden) return;
      if (audio.paused || (ctx && ctx.state !== 'running')) start();
    }, true);
  }

  S.Music = { play: play, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
