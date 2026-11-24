/*
 * 효과음 : 소리 파일 없이 브라우저가 직접 소리를 만들어 냅니다.
 * (그래서 저작권 걱정이 없고, 인터넷이 없어도 소리가 납니다)
 *
 * 소리 느낌 : "마림바 & 벨" — 나무 실로폰과 맑은 종소리에 은은한 방 울림을 더했습니다.
 * 들어 보기 : tools/sound_test.html (이 파일을 그대로 불러 씁니다)
 *
 * 소리를 바꾸고 싶으면 아래 SOUNDS 안을 고치면 됩니다. 쓸 수 있는 악기 (t 는 시작 시각, 초)
 *   k.marimba(음, t, 크기, 길이, 좌우)      나무 실로폰 "통"
 *   k.bell(음, t, 크기, 길이, 맑기, 좌우)     종소리 "띵"
 *   k.brass(음, t, 길이, 크기, 좌우)         나팔
 *   k.pad([음들], t, 길이, 크기)             뒤에 깔리는 화음
 *   k.sparkle(t, [음들], 크기, 간격)          반짝이 종소리 여러 개
 *   k.swoosh(t, 길이, 크기, 처음 밝기, 끝 밝기) "쓱" 바람 소리
 *   k.click(t, 크기, 밝기)  k.thud(t, 크기, 처음 음, 끝 음)  "틱" / "둥"
 *   k.snare(t, 크기)  k.roll(t, 길이, 크기)  k.riser(t, 길이, 크기)  k.crash(t, 크기, 길이)
 *     작은북 "탁" / 두구두구 / 솟아오르는 "슈우웅" / 심벌 "촤아앙"
 *   좌우 : -1 왼쪽 … 0 가운데 … 1 오른쪽
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var VOLUME = 0.9; // 전체 소리 크기 (0 ~ 1)
  var REVERB = 0.22; // 방 울림 크기 (0 이면 울림 없음)

  // 음 이름 → 주파수
  var N = {
    A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
    C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093, D7: 2349.32, E7: 2637.02
  };
  // 연속으로 맞힐수록 한 음씩 올라갑니다 (도 레 미 솔 라)
  var COMBO = [N.C5, N.D5, N.E5, N.G5, N.A5];
  var UP = 1.1225; // 한 음 위 (승급 소리에서 조를 올릴 때)

  /*
   * 소리 목록. 각 소리는 "어떤 악기를 언제 울릴지"를 적은 함수입니다.
   * k 는 악기 묶음, arg 는 덧붙이는 값(연속 횟수 등)
   */
  var SOUNDS = {
    /* 메모 숫자를 적을 때 : 작게 "톡" */
    note: function (k) {
      k.marimba(N.G6, 0, 0.12, 0.12);
      k.click(0, 0.05);
    },
    /* 맞혔을 때 : 맑은 "통-똥". 연속으로 맞히면 음이 점점 올라갑니다 */
    correct: function (k, streak) {
      var f = COMBO[Math.max(0, Math.min((streak || 1) - 1, COMBO.length - 1))];
      k.marimba(f, 0, 0.32);
      k.marimba(f * 1.5, 0.06, 0.24);
      k.bell(f * 2, 0.06, 0.05, 0.6);
    },
    /* 틀렸을 때 : 낮게 "둥-둥" */
    wrong: function (k) {
      k.marimba(N.E4, 0, 0.3, 0.3);
      k.marimba(N.C4 * 1.06, 0.1, 0.3, 0.4);
      k.thud(0, 0.25, 120, 60);
    },
    /* 한 줄을 완성했을 때 : 도-미-솔-도 올라가는 소리 */
    line: function (k) {
      [N.C5, N.E5, N.G5, N.C6].forEach(function (f, i) { k.marimba(f, i * 0.06, 0.26, 0.4, (i - 1.5) * 0.25); });
      k.bell(N.E6, 0.22, 0.08, 0.9);
    },
    /* 상자를 완성했을 때 : 더 길고 반짝이는 소리 */
    box: function (k) {
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach(function (f, i) { k.marimba(f, i * 0.055, 0.24, 0.45, (i - 2) * 0.2); });
      k.pad([N.C4, N.E4, N.G4, N.B4], 0.2, 0.7, 0.03);
      k.sparkle(0.3, [N.G6, N.C7, N.E7], 0.05);
    },
    /* 지우개 : "쓱" */
    erase: function (k) {
      k.swoosh(0, 0.2, 0.22, 3000, 900);
      k.click(0.02, 0.04, 6000);
    },
    /* 힌트 · 아이템 · 되살아나기 : 반짝이는 종소리 */
    hint: function (k) {
      k.bell(N.G6, 0, 0.12, 1.1, 3.5, -0.3);
      k.bell(N.D7, 0.1, 0.09, 1.2, 3.5, 0.3);
      k.sparkle(0.22, [N.E7, N.G6 * 2], 0.04, 0.07);
    },
    /* 되돌리기 : "똥-통" 내려가는 소리 */
    undo: function (k) {
      k.marimba(N.G5, 0, 0.22, 0.25);
      k.marimba(N.D5, 0.07, 0.22, 0.35);
      k.swoosh(0, 0.12, 0.06, 1500, 3000);
    },
    /* 메모 켜기 : 낮은 음 → 높은 음 */
    memoOn: function (k) {
      k.marimba(N.E6, 0, 0.16, 0.15);
      k.marimba(N.A6, 0.06, 0.16, 0.25);
    },
    /* 메모 끄기 : 높은 음 → 낮은 음 */
    memoOff: function (k) {
      k.marimba(N.A6, 0, 0.16, 0.15);
      k.marimba(N.E6, 0.06, 0.16, 0.25);
    },
    /* 판을 깼을 때 : 두구두구 → 쾅! 나팔 "따따따 따~ 따다" → 큰 화음과 심벌 → 반짝이 */
    win: function (k) {
      // 1) 두구두구 + 슈우웅 + 마림바가 위로 촤르르
      k.roll(0, 0.6, 0.16);
      k.riser(0, 0.65, 0.16);
      [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6].forEach(function (f, i) {
        k.marimba(f, 0.2 + i * 0.045, 0.16, 0.3, (i / 8 - 0.5) * 0.8);
      });
      // 2) 쾅! 첫 화음 + 나팔 [음, 시작, 길이]
      var h = 0.65;
      k.thud(h, 0.4, 170, 45);
      k.crash(h, 0.12, 1.4);
      k.pad([N.C4, N.E4, N.G4, N.B4, N.D5], h, 1.0, 0.04);
      var tune = [[N.G5, 0, 0.1], [N.G5, 0.13, 0.1], [N.G5, 0.26, 0.1], [N.C6, 0.39, 0.32],
                  [N.G5, 0.8, 0.12], [N.C6, 0.95, 0.14]];
      tune.forEach(function (n) {
        k.brass(n[0], h + n[1], n[2], 0.05);
        k.marimba(n[0], h + n[1], 0.18, 0.3);
        k.bell(n[0] * 2, h + n[1], 0.03, 0.4);
      });
      // 3) 마지막 큰 화음 : 북·심벌 쾅 + 길게 울리는 화음
      var f2 = h + 1.12;
      k.roll(f2 - 0.25, 0.22, 0.12);
      k.thud(f2, 0.45, 180, 40);
      k.crash(f2, 0.16, 2.4);
      k.brass(N.E6, f2, 1.4, 0.05);
      k.brass(N.C6, f2, 1.4, 0.04, 0.3);
      k.brass(N.G5, f2, 1.4, 0.04, -0.3);
      k.pad([N.C4, N.G4, N.C5, N.E5, N.G5, N.B5], f2, 2.6, 0.04);
      [N.C5, N.E5, N.G5, N.C6].forEach(function (f) { k.marimba(f, f2, 0.18, 1.2); });
      k.bell(N.C6, f2, 0.12, 2.2);
      k.bell(N.G6, f2 + 0.1, 0.07, 2.0);
      // 4) 반짝이가 쏟아짐 (위에서 아래로) → 마지막에 위로 한 번 더
      var fall = [N.E7 * 2, N.C7 * 2, N.G6 * 2, N.E7, N.D7, N.C7, N.A6, N.G6, N.E6, N.D6, N.C6];
      k.sparkle(f2 + 0.15, fall, 0.04, 0.07);
      [N.C6, N.E6, N.G6, N.C7].forEach(function (f, i) { k.marimba(f, f2 + 1.0 + i * 0.06, 0.12, 0.5, (i - 1.5) * 0.3); });
      k.bell(N.C7, f2 + 1.24, 0.08, 1.6);
    },
    /* 판을 실패했을 때 : 힘없이 내려가는 소리 */
    lose: function (k) {
      [N.G4, N.E4, N.D4, N.C4].forEach(function (f, i) { k.marimba(f, i * 0.2, 0.26, 0.6); });
      k.pad([N.A3, N.C4, N.E4], 0.4, 1.2, 0.03);
    },
    /* 승급했을 때 : 긴 두구두구 → 영웅 나팔 → 한 음 올려서 더 큰 화음 → 반짝이 폭포 */
    promo: function (k) {
      // 1) 길게 두구두구 + 슈우웅 + 마림바 위로 한 번, 아래로 한 번
      k.roll(0, 0.85, 0.15);
      k.riser(0, 0.9, 0.18);
      var run = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6, N.G6, N.A6];
      run.forEach(function (f, i) { k.marimba(f, 0.1 + i * 0.04, 0.12, 0.25, (i / 9 - 0.5) * 0.8); });
      run.forEach(function (f, i) { k.marimba(f, 0.5 + i * 0.035, 0.15, 0.25, (0.5 - i / 9) * 0.8); });
      // 2) 쾅! 영웅 나팔 "따- 따- 따따 따~~"
      var h = 0.9;
      k.thud(h, 0.45, 180, 40);
      k.crash(h, 0.13, 1.6);
      k.pad([N.C4, N.G4, N.C5, N.E5], h, 1.3, 0.04);
      var tune = [[N.G4, 0, 0.18], [N.C5, 0.22, 0.18], [N.E5, 0.44, 0.1], [N.G5, 0.57, 0.1], [N.C6, 0.7, 0.45]];
      tune.forEach(function (n) {
        k.brass(n[0], h + n[1], n[2], 0.055);
        k.brass(n[0] * 1.5, h + n[1], n[2], 0.025);
        k.marimba(n[0] * 2, h + n[1], 0.12, 0.3);
        k.thud(h + n[1], 0.18, 140, 60);
      });
      k.sparkle(h + 0.75, [N.G6, N.C7, N.E7], 0.04, 0.06);
      // 3) 한 음 올라서 더 크게! 두구두구 → 쾅
      var h2 = h + 1.3;
      k.roll(h2 - 0.3, 0.28, 0.14);
      k.riser(h2 - 0.35, 0.35, 0.12);
      k.thud(h2, 0.5, 190, 38);
      k.crash(h2, 0.18, 2.8);
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach(function (f, j) { k.brass(f * UP, h2, 1.6, 0.04, (j - 2) * 0.25); });
      k.pad([N.C4 * UP, N.G4 * UP, N.C5 * UP, N.E5 * UP, N.B5 * UP, N.D6 * UP], h2, 3.0, 0.04);
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach(function (f) { k.marimba(f * UP, h2, 0.15, 1.4); });
      k.bell(N.C6 * UP, h2, 0.13, 2.6);
      k.bell(N.G6 * UP, h2 + 0.12, 0.08, 2.4);
      k.bell(N.C7 * UP, h2 + 0.24, 0.06, 2.2);
      // 4) 반짝이 폭포 두 번 + 마지막에 하늘로 솟는 종소리
      var fall = [N.E7 * 2, N.C7 * 2, N.G6 * 2, N.E7, N.D7, N.C7, N.A6, N.G6, N.E6, N.D6];
      var up = function (f) { return f * UP; };
      k.sparkle(h2 + 0.15, fall.map(up), 0.04, 0.06);
      k.sparkle(h2 + 0.85, fall.slice().reverse().map(up), 0.035, 0.05);
      k.bell(N.C7 * UP * 2, h2 + 1.45, 0.06, 1.6);
      k.crash(h2 + 1.4, 0.05, 1.2);
    }
  };

  /* ================= 아래는 소리를 만드는 장치 (보통은 고칠 일 없음) ================= */

  /* 오디오 장치(c)에 압축기 · 방 울림 · 잡음을 준비합니다 → { bus: 소리를 넣을 곳, noise: 잡음 } */
  function rig(c, dest) {
    var comp = c.createDynamicsCompressor(); // 소리 크기를 고르게
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    var master = c.createGain();
    master.gain.value = VOLUME;
    comp.connect(master);
    master.connect(dest);
    var bus = c.createGain();
    bus.connect(comp);
    if (REVERB > 0 && c.createConvolver) {
      var len = Math.floor(c.sampleRate * 1.6);
      var ir = c.createBuffer(2, len, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      var conv = c.createConvolver();
      conv.buffer = ir;
      var wet = c.createGain();
      wet.gain.value = REVERB;
      bus.connect(conv);
      conv.connect(wet);
      wet.connect(comp);
    }
    var noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    var nd = noise.getChannelData(0);
    for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    return { bus: bus, noise: noise };
  }

  /* 악기 묶음 : c 장치의 out 으로, t0 시각부터 */
  function kit(c, out, t0, noiseBuf) {
    function env(g, t, a, vol, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    }
    function panned(node, pan) {
      if (!pan || !c.createStereoPanner) return node.connect(out);
      var p = c.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      p.connect(out);
    }
    /* 음 하나 : 거르개(lp)와 음 미끄러짐(slide) 선택 */
    function voice(o) {
      var t = t0 + o.t, osc = c.createOscillator(), node = osc;
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || o.dur));
      if (o.detune) osc.detune.value = o.detune;
      if (o.lp) {
        var fl = c.createBiquadFilter();
        fl.type = 'lowpass';
        fl.Q.value = o.q || 0.8;
        fl.frequency.setValueAtTime(o.lp, t);
        if (o.lpEnd) fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + (o.lpT || o.dur * 0.6));
        osc.connect(fl);
        node = fl;
      }
      var g = c.createGain(), a = o.a || 0.004;
      env(g, t, a, o.vol, o.dur);
      node.connect(g);
      panned(g, o.pan);
      osc.start(t);
      osc.stop(t + a + o.dur + 0.05);
    }
    /* 잡음을 거르개에 통과시킨 소리 */
    function hiss(t, type, f0, f1, q, a, vol, dur, pan) {
      var tt = t0 + t, src = c.createBufferSource();
      src.buffer = noiseBuf;
      var fl = c.createBiquadFilter();
      fl.type = type;
      fl.Q.value = q;
      fl.frequency.setValueAtTime(f0, tt);
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, tt + a + dur);
      var g = c.createGain();
      env(g, tt, a, vol, dur);
      src.connect(fl);
      fl.connect(g);
      panned(g, pan);
      src.start(tt, Math.random());
      src.stop(tt + a + dur + 0.05);
    }
    var k = {
      marimba: function (f, t, vol, dur, pan) {
        dur = dur || 0.45;
        voice({ f: f, t: t, vol: vol, dur: dur, pan: pan });
        voice({ f: f * 3.93, t: t, vol: vol * 0.22, dur: dur * 0.18, pan: pan });
        voice({ f: f * 9.2, t: t, vol: vol * 0.06, dur: dur * 0.06, pan: pan });
      },
      bell: function (f, t, vol, dur, ratio, pan) {
        dur = dur || 0.9;
        var tt = t0 + t, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = f;
        mod.frequency.value = f * (ratio || 3.5);
        mg.gain.setValueAtTime(f * 1.6, tt);
        mg.gain.exponentialRampToValueAtTime(f * 0.02, tt + dur * 0.6);
        mod.connect(mg);
        mg.connect(car.frequency);
        env(g, tt, 0.003, vol, dur);
        car.connect(g);
        panned(g, pan);
        car.start(tt);
        mod.start(tt);
        car.stop(tt + dur + 0.05);
        mod.stop(tt + dur + 0.05);
      },
      brass: function (f, t, dur, vol, pan) {
        var o = { f: f, t: t, type: 'sawtooth', vol: vol, a: 0.02, dur: dur, lp: f * 2, lpEnd: f * 5, lpT: 0.06, q: 1 };
        voice(Object.assign({}, o, { detune: -7, pan: pan }));
        voice(Object.assign({}, o, { detune: 7, pan: -(pan || 0) }));
        voice({ f: f / 2, t: t, type: 'triangle', vol: vol * 0.8, a: 0.02, dur: dur });
      },
      pad: function (fs, t, dur, vol) {
        for (var i = 0; i < fs.length; i++) {
          voice({ f: fs[i], t: t, type: 'triangle', vol: vol, a: 0.06, dur: dur, lp: 2200, detune: -8 });
          voice({ f: fs[i], t: t, type: 'triangle', vol: vol, a: 0.06, dur: dur, lp: 2200, detune: 8 });
        }
      },
      sparkle: function (t, notes, vol, gap) {
        for (var i = 0; i < notes.length; i++) k.bell(notes[i], t + i * (gap || 0.05), vol, 0.5, 4.1, i % 2 ? 0.4 : -0.4);
      },
      swoosh: function (t, dur, vol, f0, f1, pan) {
        hiss(t, 'bandpass', f0, f1, 1.4, dur * 0.35, vol, dur * 0.65, pan);
      },
      click: function (t, vol, f) {
        hiss(t, 'highpass', f || 3500, 0, 0.7, 0.001, vol, 0.018);
      },
      thud: function (t, vol, f0, f1) {
        voice({ f: f0 || 140, slide: f1 || 55, slideT: 0.18, t: t, vol: vol, dur: 0.25 });
      },
      snare: function (t, vol, pan) {
        hiss(t, 'bandpass', 1800, 0, 0.7, 0.002, vol, 0.09, pan);
        voice({ f: 210, slide: 150, t: t, vol: vol * 0.5, dur: 0.07 });
      },
      roll: function (t, dur, vol) {
        var n = 14;
        for (var i = 0; i < n; i++) {
          var p = i / (n - 1);
          k.snare(t + dur * (1 - Math.pow(1 - p, 1.6)), vol * (0.3 + 0.7 * p), i % 2 ? 0.25 : -0.25);
        }
      },
      riser: function (t, dur, vol) {
        k.swoosh(t, dur, vol, 300, 7000);
        voice({ f: 200, slide: 1200, t: t, vol: vol * 0.25, a: dur * 0.8, dur: dur * 0.2, type: 'sawtooth', lp: 900, lpEnd: 5000, lpT: dur });
      },
      crash: function (t, vol, dur) {
        hiss(t, 'highpass', 5000, 0, 0.7, 0.004, vol, dur || 1.6);
      }
    };
    return k;
  }

  var ctx = null, gear = null;
  var log = []; // 테스트용 : 최근에 낸 소리 이름

  /* 소리 장치를 준비합니다 (브라우저 규칙상 화면을 한 번 누른 뒤에야 소리가 납니다) */
  function device() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      gear = rig(ctx, ctx.destination);
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
      SOUNDS[name](kit(c, gear.bus, c.currentTime + 0.02, gear.noise), arg);
    } catch (e) {
      /* 소리가 안 나도 게임은 계속되어야 합니다 */
    }
  }

  /* 테스트용 : 소리를 실제로 내지 않고 계산만 해서, 크기와 길이를 알려 줍니다 */
  function measure(name, arg) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var off = new OAC(2, 44100 * 7, 44100);
    var g = rig(off, off.destination);
    SOUNDS[name](kit(off, g.bus, 0.01, g.noise), arg);
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
