/*
 * 배경 음악 : 화면마다 곡이 정해져 있습니다.
 *   대문(시작 그림)   : 없음
 *   홈 · 배지 · 랭킹 · 내 기록 : audio/bgm01.mp3   ('home')
 *   게임              : audio/bgm02.mp3   ('game')
 *   성공 결과 창       : audio/clear.mp3   ('clear')
 *   실패 결과 창       : audio/failure.mp3 ('failure')
 * 같은 곡이 이어지는 화면끼리는 처음부터 다시 시작하지 않고 그대로 이어집니다.
 * 곡이 바뀔 때는 앞 곡을 짧게 줄이고 새 곡을 부드럽게 키웁니다 (두 곡이 겹치지 않게).
 * 곡을 더 넣으려면 아래 TRACKS 에 한 줄 더 적고 sw.js 의 FILES 에도 넣어 주세요.
 *
 * 소리 크기와 부드럽게 켜고 끄기는 Web Audio 를 거쳐서 합니다 (아이폰은 audio.volume 을 못 바꿔서).
 * 브라우저가 소리를 막아 두면, 화면을 처음 만지는 순간 이어서 나옵니다.
 *
 * 쓰는 법
 *   Music.play('home' | 'game' | 'clear' | 'failure')
 *   Music.stop()
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var TRACKS = {
    home: { src: 'audio/bgm01.mp3', level: 0.36 },
    game: { src: 'audio/bgm02.mp3', level: 0.36 },
    clear: { src: 'audio/clear.mp3', level: 0.5 },
    failure: { src: 'audio/failure.mp3', level: 0.5 }
  };
  var SWAP_OUT = 0.25; // 곡을 바꿀 때 앞 곡을 줄이는 시간(초)

  var audio = null, ctx = null, gain = null;
  var want = ''; // 지금 나와야 하는 곡 이름 ('' = 없음)
  var loaded = ''; // audio 에 들어 있는 곡 이름

  function enabled() {
    return !(S.Settings && S.Settings.get('music') === false);
  }

  function setup() {
    if (audio) return;
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
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
    clearTimeout(fadeTimer);
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
  function mute() {
    clearInterval(fadeTimer);
    clearTimeout(fadeTimer);
    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
    } else {
      audio.volume = 0;
    }
  }

  function start() {
    if (!want || !audio || (root.document && root.document.hidden)) return;
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var p = audio.paused ? audio.play() : null;
    if (p && p.catch) p.catch(function () { /* 막힘 : 화면을 만지면 다시 시도 */ });
    fade(TRACKS[want].level, want === 'clear' || want === 'failure' ? 0.3 : 1.2);
  }

  /* 새 곡을 처음부터 넣고 틉니다 */
  function load(name) {
    loaded = name;
    mute();
    audio.pause();
    audio.src = TRACKS[name].src;
    try { audio.currentTime = 0; } catch (e) { /* 아직 못 읽음 */ }
    start();
  }

  function play(name) {
    if (!TRACKS[name]) name = 'home';
    if (!enabled()) { stop(0); return Promise.resolve(false); }
    setup();
    if (want === name && loaded === name && !audio.paused) return Promise.resolve(true);
    var before = want;
    want = name;
    if (loaded === name) {
      start(); // 같은 곡 : 이어서
    } else if (before && loaded && !audio.paused) {
      // 앞 곡을 짧게 줄인 다음 새 곡으로 (그동안 또 바뀌었으면 마지막 곡으로)
      fade(0, SWAP_OUT, function () {
        if (want) load(want);
      });
    } else {
      load(name);
    }
    return Promise.resolve(true);
  }

  function stop(sec) {
    if (!audio || !want) return;
    want = '';
    fade(0, sec == null ? 0.6 : sec, function () {
      if (!want) audio.pause();
    });
    if (sec === 0 && !gain) audio.pause();
  }

  if (root.document) {
    // 앱이 뒤로 가면 쉬고, 돌아오면 이어서
    root.document.addEventListener('visibilitychange', function () {
      if (!audio) return;
      if (root.document.hidden) {
        audio.pause();
        if (ctx && ctx.suspend) ctx.suspend();
      } else if (want) {
        if (loaded !== want) load(want);
        else start();
      }
    });
    // 브라우저가 소리를 막았거나 (아이폰) 돌아온 뒤 멈춰 있으면, 처음 만질 때 다시 틉니다
    root.document.addEventListener('pointerdown', function () {
      if (!want || !audio || root.document.hidden) return;
      if (loaded !== want) return load(want);
      if (audio.paused || (ctx && ctx.state !== 'running')) start();
    }, true);
  }

  S.Music = { play: play, stop: stop, now: function () { return want; } };
})(typeof window !== 'undefined' ? window : globalThis);
