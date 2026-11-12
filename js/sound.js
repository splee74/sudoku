/*
 * 효과음 : 소리 파일 없이 브라우저가 직접 소리를 만들어 냅니다.
 * (그래서 저작권 걱정이 없고, 인터넷이 없어도 소리가 납니다)
 *
 * 소리를 바꾸고 싶으면 아래 SOUNDS 안의 숫자를 고치면 됩니다.
 *   tone(주파수, 시작 시각, 길이, 음색, 크기, 끝 주파수)
 *     주파수 : 클수록 높은 음 (도 523, 미 659, 솔 784, 높은 도 1047)
 *     음색   : 'sine' 맑은 소리, 'triangle' 부드러운 소리, 'square' 거친 소리
 *   noise(시작 시각, 길이, 크기, 처음 밝기, 끝 밝기) : "쓱" 하는 바람 소리
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var VOLUME = 0.8; // 전체 소리 크기 (0 ~ 1)

  // 음 이름 → 주파수
  var N = {
    C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
    C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.0
  };
  // 연속으로 맞힐수록 한 음씩 올라갑니다 (도 레 미 솔 라)
  var COMBO = [N.C5, N.D5, N.E5, N.G5, N.A5];

  /*
   * 소리 목록. 각 소리는 "어떤 음을 언제 낼지"를 적은 함수입니다.
   * k 는 소리를 내는 도구 (k.tone, k.noise), arg 는 덧붙이는 값(연속 횟수 등)
   */
  var SOUNDS = {
    /* 메모 숫자를 적을 때 : 연필로 톡 */
    note: function (k) {
      k.tone(1250, 0, 0.045, 'triangle', 0.16);
    },
    /* 맞혔을 때 : 맑은 "딩동". 연속으로 맞히면 음이 점점 올라갑니다 */
    correct: function (k, streak) {
      var f = COMBO[Math.max(0, Math.min((streak || 1) - 1, COMBO.length - 1))];
      k.tone(f, 0, 0.1, 'sine', 0.3);
      k.tone(f * 1.5, 0.07, 0.2, 'sine', 0.28);
    },
    /* 틀렸을 때 : 낮게 "부웅" */
    wrong: function (k) {
      k.tone(196, 0, 0.16, 'square', 0.1, 150);
      k.tone(147, 0.11, 0.26, 'square', 0.1, 104);
      k.tone(98, 0, 0.3, 'triangle', 0.25, 82);
    },
    /* 한 줄을 완성했을 때 : 도-미-솔 올라가는 소리 */
    line: function (k) {
      k.tone(N.C5, 0, 0.16, 'triangle', 0.26);
      k.tone(N.E5, 0.08, 0.16, 'triangle', 0.26);
      k.tone(N.G5, 0.16, 0.34, 'triangle', 0.28);
      k.tone(N.G6, 0.16, 0.3, 'sine', 0.08);
    },
    /* 상자(9칸)를 완성했을 때 : 더 길고 반짝이는 소리 */
    box: function (k) {
      k.tone(N.C5, 0, 0.15, 'triangle', 0.24);
      k.tone(N.E5, 0.07, 0.15, 'triangle', 0.24);
      k.tone(N.G5, 0.14, 0.15, 'triangle', 0.24);
      k.tone(N.C6, 0.21, 0.5, 'triangle', 0.26);
      k.tone(N.E6, 0.3, 0.45, 'sine', 0.14);
      k.tone(N.G6, 0.38, 0.5, 'sine', 0.1);
    },
    /* 지우개 : "쓱" 문지르는 소리 */
    erase: function (k) {
      k.noise(0, 0.09, 0.3, 3200, 1400);
      k.noise(0.08, 0.11, 0.26, 2600, 900);
    },
    /* 힌트 : 반짝이는 종소리 */
    hint: function (k) {
      k.tone(N.D6, 0, 0.3, 'sine', 0.2);
      k.tone(N.G6, 0.09, 0.34, 'sine', 0.18);
      k.tone(N.C7, 0.18, 0.5, 'sine', 0.14);
      k.tone(N.D6 * 2, 0.27, 0.45, 'sine', 0.07);
    },
    /* 되돌리기 : "뾰롱" 하고 내려가는 소리 */
    undo: function (k) {
      k.tone(700, 0, 0.16, 'triangle', 0.26, 330);
    },
    /* 메모 켜기 : 낮은 음 → 높은 음 */
    memoOn: function (k) {
      k.tone(N.E5, 0, 0.06, 'triangle', 0.22);
      k.tone(N.A5, 0.065, 0.11, 'triangle', 0.22);
    },
    /* 메모 끄기 : 높은 음 → 낮은 음 */
    memoOff: function (k) {
      k.tone(N.A5, 0, 0.06, 'triangle', 0.2);
      k.tone(N.E5, 0.065, 0.11, 'triangle', 0.2);
    },
    /* 판을 깼을 때 : 짧은 축하 음악 */
    win: function (k) {
      var seq = [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6];
      for (var i = 0; i < seq.length; i++) k.tone(seq[i], 0.15 + i * 0.11, 0.2, 'triangle', 0.22);
      k.tone(N.C5, 0.85, 0.8, 'triangle', 0.14);
      k.tone(N.E5, 0.85, 0.8, 'triangle', 0.14);
      k.tone(N.G5, 0.85, 0.8, 'triangle', 0.14);
      k.tone(N.C6, 0.85, 0.9, 'sine', 0.16);
      k.tone(N.E6, 0.9, 0.8, 'sine', 0.08);
    },
    /* 판을 실패했을 때 : 힘없이 내려가는 소리 */
    lose: function (k) {
      k.tone(N.G4, 0.35, 0.26, 'triangle', 0.24);
      k.tone(N.E4, 0.6, 0.26, 'triangle', 0.24);
      k.tone(N.C4, 0.85, 0.6, 'triangle', 0.26, 247);
    },
    /* 승급했을 때 : 긴 팡파르 */
    promo: function (k) {
      var seq = [N.G4, N.C5, N.E5, N.G5, N.E5, N.G5, N.C6];
      var t = 0.1;
      for (var i = 0; i < seq.length; i++) {
        k.tone(seq[i], t, 0.22, 'triangle', 0.22);
        k.tone(seq[i] * 2, t, 0.18, 'sine', 0.06);
        t += i === 3 ? 0.2 : 0.12;
      }
      k.tone(N.C5, t, 1.1, 'triangle', 0.13);
      k.tone(N.E5, t, 1.1, 'triangle', 0.13);
      k.tone(N.G5, t, 1.1, 'triangle', 0.13);
      k.tone(N.C6, t, 1.2, 'sine', 0.16);
      k.tone(N.E6, t + 0.12, 1.0, 'sine', 0.09);
      k.tone(N.G6, t + 0.24, 0.9, 'sine', 0.07);
    }
  };

  /* 주어진 오디오 장치(ctx)에 소리를 그려 넣는 도구 */
  function kit(ctx, out, t0) {
    return {
      tone: function (freq, start, dur, type, vol, slideTo) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        var t = t0 + start;
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        // "탁" 튀지 않게 부드럽게 시작하고, 서서히 사라지게
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      },
      noise: function (start, dur, vol, f0, f1) {
        var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 1.2;
        var t = t0 + start;
        filter.frequency.setValueAtTime(f0, t);
        filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(out);
        src.start(t);
        src.stop(t + dur + 0.02);
      }
    };
  }

  var ctx = null, master = null;
  var log = []; // 테스트용 : 최근에 낸 소리 이름

  /* 소리 장치를 준비합니다 (브라우저 규칙상 화면을 한 번 누른 뒤에야 소리가 납니다) */
  function device() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  /* 효과음을 냅니다. 예) Sound.play('correct', 3) */
  function play(name, arg) {
    if (!SOUNDS[name]) return;
    if (S.Settings && !S.Settings.get('sound')) return;
    log.push(name);
    if (log.length > 60) log.shift();
    try {
      var c = device();
      if (!c) return;
      SOUNDS[name](kit(c, master, c.currentTime + 0.01), arg);
    } catch (e) {
      /* 소리가 안 나도 게임은 계속되어야 합니다 */
    }
  }

  /* 테스트용 : 소리를 실제로 내지 않고 계산만 해서, 크기와 길이를 알려 줍니다 */
  function measure(name, arg) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var off = new OAC(1, 44100 * 3, 44100);
    var m = off.createGain();
    m.gain.value = VOLUME;
    m.connect(off.destination);
    SOUNDS[name](kit(off, m, 0.01), arg);
    return off.startRendering().then(function (buf) {
      var d = buf.getChannelData(0);
      var peak = 0, last = 0, first = -1;
      for (var i = 0; i < d.length; i++) {
        var a = Math.abs(d[i]);
        if (a > peak) peak = a;
        if (a > 0.004) {
          last = i;
          if (first < 0) first = i;
        }
      }
      return { peak: peak, start: first / 44100, end: last / 44100 };
    });
  }

  S.Sound = { play: play, measure: measure, names: Object.keys(SOUNDS), log: log };
})(typeof window !== 'undefined' ? window : globalThis);
