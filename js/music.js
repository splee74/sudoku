/*
 * 배경 음악 : 효과음(sound.js)처럼 소리 파일 없이 브라우저가 직접 연주합니다.
 * (저작권 걱정 없음, 인터넷 없어도 됨)
 *
 *   title : 대문 음악 — 30초 반복. 통통 튀는 마림바 + 우쿨렐레 + 손가락 딱, 가끔 "야옹"
 *   game  : 게임 음악 — 1분 반복. 잔잔한 일렉 피아노 + 오르골, 생각을 방해하지 않게
 *
 * 들어 보기 : tools/music_test.html
 *
 * 곡을 2마디씩 미리 계산해 두고 이어 붙여 틉니다. 첫 조각은 0.5초 안에 준비되어 바로 나오고,
 * 나머지는 트는 동안 만듭니다. 곡 끝의 울림이 다음 바퀴 처음과 겹치므로 반복되는 이음새가 들리지 않습니다.
 *
 * 쓰는 법
 *   Music.play('title')  Music.play('game')   다른 곡이 나오고 있으면 부드럽게 바꿉니다
 *   Music.stop()
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var RATE = 32000; // 미리 계산할 때의 음질 (메모리를 아끼려고 조금 낮춤)
  var LEVEL = { title: 0.54, game: 0.5 }; // 곡별 소리 크기 (효과음보다 작게)

  /* ---------- 음 이름 → 주파수 ('C4', 'F#3', 'Bb4') ---------- */
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(name) {
    var m = /^([A-G])(#|b)?(\d)$/.exec(name);
    var midi = (+m[3] + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function hzs(list) { return list.map(hz); }

  /* 같은 곡은 늘 똑같이 들리도록 정해진 순서의 '무작위' */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================= 곡 ================= */
  /*
   * 박자 계산 : at(마디, 8분음표 칸) → 초. 마디는 0부터, 한 마디 = 8칸.
   * swing 이 0.5 보다 크면 뒷박이 살짝 늦게 와서 깡총깡총 튀는 느낌이 납니다.
   * 멜로디는 'G5:1 E5:1 C6:2 r:1' 처럼 적습니다 (음:칸 수, r 은 쉼표).
   */
  var SONGS = {
    /* ---------- 대문 : 다 장조, 128 BPM, 16마디 = 30초 ---------- */
    title: {
      bpm: 128, bars: 16, swing: 0.6, reverb: 0.24, seed: 7,
      chords: [
        ['C', 8], ['Am', 8], ['F', 8], ['G', 8],
        ['C', 8], ['Am', 8], ['Dm', 4, 'G', 4], ['C', 8],
        ['F', 8], ['G', 8], ['Em', 4, 'Am', 4], ['Dm', 4, 'G', 4],
        ['C', 8], ['Am', 8], ['F', 4, 'G', 4], ['C', 4, 'G7', 4]
      ],
      melody: [
        'G5:1 E5:1 G5:1 C6:2 r:1 G5:1 E5:1',
        'A5:2 G5:1 E5:1 C5:2 r:2',
        'F5:1 A5:1 C6:1 A5:1 G5:1 F5:1 E5:1 D5:1',
        'D5:2 G5:2 r:2 B4:1 D5:1',
        'G5:1 E5:1 G5:1 C6:2 r:1 D6:1 E6:1',
        'C6:2 A5:1 G5:1 E5:2 r:1 G5:1',
        'F5:1 E5:1 D5:1 F5:1 B5:2 A5:1 B5:1',
        'C6:3 r:5',
        'A5:1 C6:1 A5:1 F5:1 G5:2 A5:2',
        'B5:1 D6:1 B5:1 G5:1 A5:2 B5:2',
        'G5:2 E5:2 A5:2 C6:2',
        'D6:2 C6:1 B5:1 A5:1 G5:1 F5:1 D5:1',
        'G5:1 E5:1 G5:1 C6:2 r:1 G5:1 E5:1',
        'A5:1 C6:1 E6:1 D6:1 C6:2 A5:2',
        'F5:1 A5:1 C6:1 D6:1 B5:2 D6:2',
        'C6:2 r:2 G5:1 F5:1 E5:1 D5:1'
      ],
      voicing: {
        C: ['C4', 'E4', 'G4', 'C5'], Am: ['C4', 'E4', 'A4'], F: ['C4', 'F4', 'A4'], G: ['D4', 'G4', 'B4'],
        Dm: ['D4', 'F4', 'A4'], Em: ['E4', 'G4', 'B4'], G7: ['D4', 'F4', 'G4', 'B4']
      },
      bass: { C: ['C3', 'G2'], Am: ['A2', 'E3'], F: ['F2', 'C3'], G: ['G2', 'D3'], Dm: ['D3', 'A2'], Em: ['E3', 'B2'], G7: ['G2', 'D3'] },
      build: function (k, s) {
        var at = s.at;
        s.eachChord(function (name, bar, e, len) {
          var notes = hzs(s.voicing[name]), bass = hzs(s.bass[name]);
          // 우쿨렐레 "딴 따단 따다단" (내림 강하게, 올림 약하게)
          var strum = len === 8 ? [0, 2, 3, 5, 6, 7] : [0, 2, 3];
          strum.forEach(function (x) {
            var down = x % 2 === 0;
            k.strum(notes, at(bar, e + x), down ? 0.05 : 0.032, 0.32, down ? 1 : -1);
          });
          // 베이스 "둥- 둥-"
          k.bass(bass[0], at(bar, e), 0.34, 0.3);
          if (len === 8) k.bass(bass[1], at(bar, e + 4), 0.26, 0.28);
          else k.bass(bass[0], at(bar, e + 2), 0.16, 0.16);
        });
        // 가운데(9~12마디)는 은은한 화음을 뒤에 깔아 분위기를 바꿉니다
        for (var b = 8; b < 12; b++) {
          s.chordsIn(b).forEach(function (c) {
            k.pad(hzs(s.voicing[c.name]), at(b, c.e), at(b, c.e + c.len) - at(b, c.e), 0.012);
          });
        }
        // 멜로디 : 마림바 + 오르골 반짝임 (가운데는 오르골이 앞으로)
        s.eachNote(function (f, t, dur, bar) {
          var mid = bar >= 8 && bar < 12;
          k.marimba(f, t, mid ? 0.13 : 0.22, Math.max(0.3, dur * 1.3), 0.12);
          k.bell(f * 2, t, mid ? 0.05 : 0.026, mid ? 1.0 : 0.6, 3.5, -0.15);
        });
        // 북 : 쿵(1,3박) · 딱(2,4박) · 찰찰(8분음표마다)
        for (var bar = 0; bar < s.bars; bar++) {
          for (var x = 0; x < 8; x++) {
            var t = at(bar, x);
            if (x === 0 || x === 4) k.kick(t, 0.22);
            if (x === 2 || x === 6) k.snap(t, 0.07);
            k.shaker(t, x % 2 ? 0.032 : 0.02, x % 2 ? 0.3 : -0.3);
          }
        }
        // 고양이 "야옹~" (8마디 끝, 16마디 끝엔 "냥냥")
        k.meow(at(7, 4), 0.1, 1);
        k.meow(at(15, 2), 0.07, 1.25, 0.22);
        k.meow(at(15, 3), 0.07, 1.12, 0.24);
        // 4마디마다 끝에 반짝
        [3, 11].forEach(function (b) { k.sparkle(at(b, 5), hzs(['G6', 'C7', 'E7']), 0.03, 0.06); });
        k.sparkle(at(12, 0) - 0.15, hzs(['E7', 'C7', 'G6', 'E6']), 0.03, 0.05);
      }
    },

    /* ---------- 게임 : 바 장조, 80 BPM, 20마디 = 60초 ---------- */
    game: {
      bpm: 80, bars: 20, swing: 0.56, reverb: 0.32, seed: 11,
      chords: [
        ['Fmaj7', 8], ['Em7', 4, 'A7', 4], ['Dm7', 8], ['Cm7', 4, 'F7', 4],
        ['Bbmaj7', 8], ['Bbm6', 8], ['Am7', 4, 'D7', 4], ['Gm7', 4, 'C7', 4],
        ['Fmaj7', 8], ['Am7', 8], ['Bbmaj7', 8], ['C7sus', 4, 'C7', 4],
        ['Dm7', 8], ['Am7', 8], ['Bbmaj7', 8], ['Gm7', 4, 'C7', 4],
        ['Bbmaj7', 8], ['Am7', 8], ['Gm7', 8], ['C7sus', 4, 'C7', 4]
      ],
      melody: [
        'r:2 A4:1 C5:1 E5:3 r:1',
        'D5:2 C5:1 A4:1 C#5:3 r:1',
        'r:2 A4:1 C5:1 F5:3 r:1',
        'Eb5:2 D5:1 C5:1 A4:3 r:1',
        'r:2 D5:1 F5:1 A5:3 r:1',
        'G5:2 F5:1 Db5:1 F5:3 r:1',
        'E5:2 C5:1 A4:1 F#5:2 E5:1 D5:1',
        'D5:1 C5:1 Bb4:1 G4:1 E5:3 r:1',
        'C6:3 A5:1 G5:2 F5:2',
        'E5:3 G5:1 C6:2 r:2',
        'D6:3 C6:1 A5:2 F5:2',
        'G5:4 r:2 E5:1 G5:1',
        'A5:3 G5:1 F5:2 D5:2',
        'E5:3 C5:1 E5:2 G5:2',
        'F5:2 A5:2 D6:2 C6:1 A5:1',
        'G5:4 r:4',
        'r:4 D6:1 C6:1 A5:2',
        'G5:4 r:4',
        'r:4 Bb5:1 A5:1 F5:2',
        'G5:4 r:2 A4:1 C5:1'
      ],
      voicing: {
        Fmaj7: ['A3', 'C4', 'E4', 'G4'], Em7: ['G3', 'B3', 'D4', 'E4'], A7: ['G3', 'C#4', 'E4'],
        Dm7: ['F3', 'A3', 'C4', 'E4'], Cm7: ['Eb3', 'G3', 'Bb3', 'D4'], F7: ['Eb3', 'A3', 'C4'],
        Bbmaj7: ['A3', 'D4', 'F4'], Bbm6: ['G3', 'Db4', 'F4'], Am7: ['G3', 'C4', 'E4'],
        D7: ['F#3', 'C4', 'E4'], Gm7: ['F3', 'Bb3', 'D4'], C7: ['E3', 'Bb3', 'D4'], C7sus: ['F3', 'Bb3', 'D4']
      },
      bass: {
        Fmaj7: 'F2', Em7: 'E2', A7: 'A2', Dm7: 'D2', Cm7: 'C3', F7: 'F2', Bbmaj7: 'Bb2', Bbm6: 'Bb2',
        Am7: 'A2', D7: 'D3', Gm7: 'G2', C7: 'C3', C7sus: 'C3'
      },
      build: function (k, s) {
        var at = s.at;
        s.eachChord(function (name, bar, e, len) {
          var notes = hzs(s.voicing[name]), root = hz(s.bass[name]);
          var end = at(bar, e + len), t0 = at(bar, e);
          // 일렉 피아노 : 첫 박에 길게, 반 박 뒤에 살짝 한 번 더
          k.keys(notes, t0, 0.05, end - t0 + 0.6);
          if (len === 8) k.keys(notes.slice(1), at(bar, e + 3), 0.026, 0.9);
          // 베이스 : 으뜸음 길게, 마디 뒤쪽에 한 옥타브 위로 톡
          k.bass(root, t0, 0.3, len === 8 ? 1.4 : 0.9);
          if (len === 8) k.bass(root * 2, at(bar, e + 5), 0.14, 0.4);
        });
        // 마지막 4마디는 숨 고르기 : 화음을 은은하게 깔기
        for (var b = 16; b < 20; b++) {
          s.chordsIn(b).forEach(function (c) {
            k.pad(hzs(s.voicing[c.name]), at(b, c.e), at(b, c.e + c.len) - at(b, c.e), 0.014);
          });
        }
        // 멜로디 : 앞 8마디는 부드러운 마림바, 가운데는 오르골, 끝은 오르골만 드문드문
        s.eachNote(function (f, t, dur, bar) {
          if (bar < 8) {
            k.marimba(f, t, 0.14, Math.max(0.5, dur * 1.4), 0.15);
            k.bell(f * 2, t, 0.016, 0.9, 3.5, 0.15);
          } else if (bar < 16) {
            k.musicbox(f * 2, t, 0.05, 1.6, -0.1);
            k.marimba(f, t, 0.06, Math.max(0.5, dur * 1.2), 0.2);
          } else {
            k.musicbox(f * 2, t, 0.04, 2.0, 0.1);
          }
        });
        // 북 : 처음 4마디와 끝 4마디는 찰찰이만, 나머지는 살살 쿵·삭
        for (var bar = 0; bar < s.bars; bar++) {
          var full = bar >= 4 && bar < 16;
          for (var x = 0; x < 8; x++) {
            var t = at(bar, x);
            k.shaker(t, x % 2 ? 0.02 : 0.012, x % 2 ? 0.35 : -0.35);
            if (!full) continue;
            if (x === 0 || x === 5) k.kick(t, x ? 0.12 : 0.17);
            if (x === 2 || x === 6) k.brush(t, 0.035);
          }
        }
        // 8마디·16마디 끝에 고양이 발자국 같은 반짝임
        k.sparkle(at(7, 6), hzs(['C7', 'A6', 'F6']), 0.022, 0.09);
        k.sparkle(at(15, 5), hzs(['F6', 'A6', 'C7', 'E7']), 0.02, 0.09);
      }
    }
  };

  /* ================= 악보 도우미 ================= */
  function score(song) {
    var beat = 60 / song.bpm, swing = song.swing || 0.5;
    function at(bar, e) {
      var n = bar * 8 + e, b = Math.floor(n / 2);
      return b * beat + (n % 2 ? swing * beat : 0);
    }
    function chordsIn(bar) {
      var row = song.chords[bar], out = [], e = 0;
      for (var i = 0; i < row.length; i += 2) {
        out.push({ name: row[i], e: e, len: row[i + 1] });
        e += row[i + 1];
      }
      return out;
    }
    return {
      bars: song.bars, voicing: song.voicing, bass: song.bass, at: at, chordsIn: chordsIn,
      length: song.bars * 4 * beat,
      eachChord: function (fn) {
        for (var bar = 0; bar < song.bars; bar++) chordsIn(bar).forEach(function (c) { fn(c.name, bar, c.e, c.len); });
      },
      eachNote: function (fn) {
        song.melody.forEach(function (line, bar) {
          var e = 0;
          line.trim().split(/\s+/).forEach(function (tok) {
            var p = tok.split(':'), len = +p[1];
            if (p[0] !== 'r') fn(hz(p[0]), at(bar, e), at(bar, e + len) - at(bar, e), bar);
            e += len;
          });
        });
      }
    };
  }

  /* ================= 악기 ================= */
  function kit(c, out, noise, rand) {
    function jit(t) { return Math.max(0, t + (rand() - 0.5) * 0.008); }
    function vel(v) { return v * (0.88 + rand() * 0.24); }
    function env(g, t, a, vol, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    }
    // 좌우 위치 장치는 위치마다 하나만 만들어 함께 씁니다 (소리마다 만들면 계산이 두 배로 느려짐)
    var pans = {};
    function send(node, pan) {
      if (!pan || !c.createStereoPanner) return node.connect(out);
      var key = Math.round(pan * 20);
      if (!pans[key]) {
        pans[key] = c.createStereoPanner();
        pans[key].pan.value = key / 20;
        pans[key].connect(out);
      }
      node.connect(pans[key]);
    }
    function voice(o) {
      var t = o.t, osc = c.createOscillator(), node = osc;
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || o.dur));
      if (o.detune) osc.detune.value = o.detune;
      if (o.lp) {
        var fl = c.createBiquadFilter();
        fl.type = 'lowpass';
        fl.Q.value = o.q || 0.7;
        fl.frequency.setValueAtTime(o.lp, t);
        if (o.lpEnd) fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + (o.lpT || o.dur * 0.6));
        osc.connect(fl);
        node = fl;
      }
      var g = c.createGain(), a = o.a || 0.004;
      env(g, t, a, o.vol, o.dur);
      node.connect(g);
      send(g, o.pan);
      osc.start(t);
      osc.stop(t + a + o.dur + 0.05);
    }
    function hiss(t, type, f, q, a, vol, dur, pan) {
      var src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = noise;
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      env(g, t, a, vol, dur);
      src.connect(fl);
      fl.connect(g);
      send(g, pan);
      src.start(t, rand() * 1.5);
      src.stop(t + a + dur + 0.05);
    }
    function fm(f, t, vol, dur, ratio, index, pan, a) {
      var car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = f;
      mod.frequency.value = f * ratio;
      mg.gain.setValueAtTime(f * index, t);
      mg.gain.exponentialRampToValueAtTime(f * index * 0.02 + 0.01, t + Math.min(dur, 1.2) * 0.7);
      mod.connect(mg);
      mg.connect(car.frequency);
      env(g, t, a || 0.003, vol, dur);
      car.connect(g);
      send(g, pan);
      car.start(t);
      mod.start(t);
      car.stop(t + dur + 0.05);
      mod.stop(t + dur + 0.05);
    }
    var k = {
      marimba: function (f, t, vol, dur, pan) {
        t = jit(t);
        vol = vel(vol);
        voice({ f: f, t: t, vol: vol, dur: dur, pan: pan });
        voice({ f: f * 3.93, t: t, vol: vol * 0.2, dur: dur * 0.18, pan: pan });
        voice({ f: f * 9.2, t: t, vol: vol * 0.05, dur: dur * 0.06, pan: pan });
      },
      bell: function (f, t, vol, dur, ratio, pan) {
        fm(f, jit(t), vel(vol), dur, ratio || 3.5, 1.6, pan);
      },
      /* 오르골 : 맑고 길게 남는 "띵~" */
      musicbox: function (f, t, vol, dur, pan) {
        t = jit(t);
        vol = vel(vol);
        fm(f, t, vol, dur, 5.0, 0.7, pan);
        voice({ f: f * 2, t: t, vol: vol * 0.25, dur: dur * 0.3, pan: pan });
      },
      /* 우쿨렐레 : 줄을 위아래로 긁기 (dir 1 내림, -1 올림) */
      strum: function (fs, t, vol, dur, dir) {
        t = jit(t);
        var order = dir > 0 ? fs : fs.slice().reverse();
        order.forEach(function (f, i) {
          var tt = t + i * 0.011, v = vel(vol);
          voice({ f: f, t: tt, type: 'sawtooth', vol: v * 0.5, dur: dur, lp: f * 7, lpEnd: f * 1.6, lpT: 0.12, pan: (i / (fs.length - 1) - 0.5) * 0.5 });
          voice({ f: f, t: tt, type: 'triangle', vol: v, dur: dur * 0.9 });
        });
      },
      /* 일렉 피아노 : 부드러운 "똥~" */
      keys: function (fs, t, vol, dur) {
        t = jit(t);
        fs.forEach(function (f, i) {
          var tt = t + i * 0.014, v = vel(vol);
          fm(f, tt, v, dur, 1, 1.1, (i / Math.max(1, fs.length - 1) - 0.5) * 0.6, 0.008);
          voice({ f: f * 4, t: tt, vol: v * 0.12, dur: 0.12 });
        });
      },
      pad: function (fs, t, dur, vol) {
        fs.forEach(function (f) {
          voice({ f: f, t: t, type: 'triangle', vol: vol, a: dur * 0.3, dur: dur * 0.8, lp: 1800, detune: -9, pan: -0.4 });
          voice({ f: f, t: t, type: 'triangle', vol: vol, a: dur * 0.3, dur: dur * 0.8, lp: 1800, detune: 9, pan: 0.4 });
        });
      },
      /* 베이스 : 휴대폰 스피커에서도 들리도록 배음을 조금 섞음 */
      bass: function (f, t, vol, dur) {
        t = jit(t);
        vol = vel(vol);
        voice({ f: f, t: t, vol: vol, a: 0.006, dur: dur });
        voice({ f: f, t: t, type: 'triangle', vol: vol * 0.5, a: 0.006, dur: dur * 0.7, lp: f * 4, lpEnd: f * 1.5, lpT: 0.15 });
      },
      sparkle: function (t, fs, vol, gap) {
        fs.forEach(function (f, i) { k.bell(f, t + i * gap, vol, 0.6, 4.1, i % 2 ? 0.4 : -0.4); });
      },
      kick: function (t, vol) {
        voice({ f: 130, slide: 48, slideT: 0.12, t: t, vol: vel(vol), dur: 0.2 });
      },
      snap: function (t, vol) {
        hiss(jit(t), 'bandpass', 2300, 1.4, 0.001, vel(vol), 0.06, 0.15);
      },
      brush: function (t, vol) {
        hiss(jit(t), 'bandpass', 3200, 0.6, 0.012, vel(vol), 0.16, -0.1);
      },
      shaker: function (t, vol, pan) {
        hiss(jit(t), 'highpass', 6500, 0.7, 0.006, vel(vol), 0.045, pan);
      },
      /* 고양이 "야옹~" : 목소리처럼 들리게 거르개 두 개로 모음 소리를 만듦. p 는 음 높이 배수 */
      meow: function (t, vol, p, len) {
        p = p || 1;
        var dur = len || 0.42, peak = t + dur * 0.3, end = t + dur;
        var osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(560 * p, t);
        osc.frequency.linearRampToValueAtTime(860 * p, peak);
        osc.frequency.exponentialRampToValueAtTime(520 * p, end);
        lfo.frequency.value = 6.5;
        lg.gain.value = 10 * p;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        var mix = c.createGain();
        mix.gain.value = 1;
        [[750, 1150, 620, 6], [1600, 2300, 1100, 7]].forEach(function (fm2, i) {
          var bp = c.createBiquadFilter();
          bp.type = 'bandpass';
          bp.Q.value = fm2[3];
          bp.frequency.setValueAtTime(fm2[0] * p, t);
          bp.frequency.linearRampToValueAtTime(fm2[1] * p, peak);
          bp.frequency.exponentialRampToValueAtTime(fm2[2] * p, end);
          var bg = c.createGain();
          bg.gain.value = i ? 0.6 : 1;
          osc.connect(bp);
          bp.connect(bg);
          bg.connect(mix);
        });
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
        g.gain.setValueAtTime(vol, t + dur * 0.55);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        mix.connect(g);
        send(g, 0.1);
        // 속에 깔리는 맑은 음 (더 귀엽게)
        voice({ f: 560 * p * 2, slide: 520 * p * 2, slideT: dur, t: t + 0.02, vol: vol * 0.15, a: 0.05, dur: dur * 0.8 });
        osc.start(t);
        lfo.start(t);
        osc.stop(end + 0.05);
        lfo.stop(end + 0.05);
      }
    };
    return k;
  }

  /* ================= 미리 계산하기 ================= */
  /*
   * 곡을 2마디씩 조각으로 나눠 계산합니다. 첫 조각이 되자마자 틀기 시작하고, 나머지는 트는 동안 만듭니다.
   * 조각마다 뒤에 울림(TAIL초)까지 담아 두고, 틀 때 조각을 겹쳐 놓으므로 한 번에 계산한 것과 똑같이 들립니다.
   * 마지막 조각의 울림은 다음 바퀴의 처음과 겹치므로 반복되는 이음새도 들리지 않습니다.
   */
  var CHUNK_BARS = 2, TAIL = 6;
  var TIME_ARG = { marimba: 1, bell: 1, musicbox: 1, strum: 1, keys: 1, pad: 1, bass: 1,
    sparkle: 0, kick: 0, snap: 0, brush: 0, shaker: 0, meow: 0 };
  var cache = {};

  /* 곡 하나 → { length(초), chunks: [{ at: 시작 초, ready: Promise<AudioBuffer>, buf }] } */
  function render(name) {
    if (cache[name]) return cache[name];
    var song = SONGS[name], s = score(song);
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return null;

    // 1) 악보를 한 번 훑어서 "언제 무엇을 칠지" 목록을 만듦
    var calls = [], rec = {};
    Object.keys(TIME_ARG).forEach(function (fn) {
      rec[fn] = function () { calls.push({ fn: fn, args: [].slice.call(arguments) }); };
    });
    song.build(rec, s);

    // 2) 방 울림과 잡음은 한 번만 만들어 조각마다 함께 씀
    var ir = null, noise = null;
    function shared(c) {
      if (ir) return;
      var len = Math.floor(RATE * 2.2), r = rng(song.seed + 99);
      ir = c.createBuffer(2, len, RATE);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch), lp = 0;
        for (var i = 0; i < len; i++) {
          lp += ((r() * 2 - 1) - lp) * 0.35; // 고음을 살짝 깎아 따뜻하게
          d[i] = lp * Math.pow(1 - i / len, 3);
        }
      }
      noise = c.createBuffer(1, RATE * 2, RATE);
      var nd = noise.getChannelData(0), r2 = rng(song.seed + 5);
      for (var j = 0; j < nd.length; j++) nd[j] = r2() * 2 - 1;
    }

    function piece(a, b, idx) {
      var off = new OAC(2, Math.round((b - a + TAIL) * RATE), RATE);
      shared(off);
      var bus = off.createGain(), conv = off.createConvolver(), wet = off.createGain();
      bus.connect(off.destination);
      conv.buffer = ir;
      wet.gain.value = song.reverb;
      bus.connect(conv);
      conv.connect(wet);
      wet.connect(off.destination);
      var k = kit(off, bus, noise, rng(song.seed * 100 + idx));
      calls.forEach(function (cl) {
        var ti = TIME_ARG[cl.fn], t = cl.args[ti];
        if (t < a || t >= b) return;
        var args = cl.args.slice();
        args[ti] = t - a;
        k[cl.fn].apply(null, args);
      });
      return new Promise(function (ok, fail) {
        off.oncomplete = function (e) { ok(e.renderedBuffer); }; // 옛 사파리용
        var p = off.startRendering();
        if (p && p.then) p.then(ok, fail);
      });
    }

    // 3) 조각을 하나씩 차례로 계산 (한꺼번에 하면 휴대폰이 버벅임)
    var span = CHUNK_BARS * s.length / s.bars, chunks = [], chain = Promise.resolve();
    for (var i = 0; i * span < s.length - 0.001; i++) {
      (function (i) {
        var ch = { at: i * span };
        ch.ready = chain = chain.then(function () {
          return piece(i * span, Math.min(s.length, (i + 1) * span), i);
        }).then(function (buf) { ch.buf = buf; return buf; });
        chunks.push(ch);
      })(i);
    }
    cache[name] = { length: s.length, chunks: chunks, all: chain };
    return cache[name];
  }

  /* ================= 틀기 ================= */
  var ctx = null, now = null, timer = null;
  var AHEAD = 2; // 몇 초 앞까지 미리 걸어 둘지

  function device() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  function enabled() {
    return !(S.Settings && S.Settings.get('music') === false);
  }

  /* 조각들을 시간에 맞춰 차례로 걸어 둡니다 (계속 돌아감) */
  function pump() {
    if (!now || !ctx) return;
    var song = now.song, m = song.chunks.length, t = ctx.currentTime;
    while (true) {
      var lap = Math.floor(now.next / m), ch = song.chunks[now.next % m];
      var when = now.t0 + lap * song.length + ch.at;
      if (when > t + AHEAD || !ch.buf) break; // 아직 이르거나, 아직 계산 중
      now.next++;
      if (when + ch.buf.duration <= t) continue; // 이미 지나간 조각
      var src = ctx.createBufferSource();
      src.buffer = ch.buf;
      src.connect(now.gain);
      if (when >= t) src.start(when);
      else src.start(t, t - when); // 늦었으면 그만큼 건너뛰고
      now.srcs.push({ src: src, end: when + ch.buf.duration });
    }
    now.srcs = now.srcs.filter(function (x) { return x.end > t; });
  }

  function fadeOut(cur, sec) {
    if (!cur) return;
    var t = ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
    cur.gain.gain.linearRampToValueAtTime(0, t + sec);
    cur.srcs.forEach(function (x) {
      try { x.src.stop(t + sec + 0.05); } catch (e) { /* 이미 멈춤 */ }
    });
    setTimeout(function () { cur.gain.disconnect(); }, (sec + 0.2) * 1000);
  }

  /* 곡을 틉니다. 다른 곡이 나오고 있으면 부드럽게 바꿉니다. opts.from : 몇 초 지점부터 (들어 보기용) */
  function play(name, opts) {
    opts = opts || {};
    if (!SONGS[name] || !enabled()) return Promise.resolve(false);
    var c = device(), song = c && render(name);
    if (!song) return Promise.resolve(false);
    if (now && now.name === name && opts.from == null) return Promise.resolve(true);
    var from = opts.from || 0;
    // 중간부터 틀 때는 다 만들어질 때까지, 처음부터는 첫 조각만 기다림
    var wait = from ? song.all : song.chunks[0].ready;
    var ticket = {};
    now && (now.ticket = null);
    play.ticket = ticket;
    return wait.then(function () {
      if (play.ticket !== ticket) return false; // 그 사이에 다른 곡이나 멈춤을 눌렀음
      fadeOut(now, 0.8);
      var g = c.createGain(), t = c.currentTime + 0.05;
      g.connect(c.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(LEVEL[name], t + (from ? 0.3 : 1.2));
      now = { name: name, song: song, gain: g, t0: t - from, next: 0, srcs: [] };
      pump();
      if (!timer) timer = setInterval(pump, 250);
      return true;
    });
  }

  function stop(sec) {
    play.ticket = null;
    if (!now) return;
    fadeOut(now, sec == null ? 0.6 : sec);
    now = null;
  }

  /* 지금 몇 초 지점인지 (들어 보기 화면용) */
  function position() {
    if (!now || !ctx) return null;
    var p = Math.max(0, ctx.currentTime - now.t0);
    return { name: now.name, time: p % now.song.length, length: now.song.length, loops: Math.floor(p / now.song.length) };
  }

  // 앱이 뒤로 가면 쉬고, 돌아오면 이어서
  if (root.document) {
    root.document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (root.document.hidden) ctx.suspend && ctx.suspend();
      else if (now) ctx.resume && ctx.resume();
    });
    // 아이폰은 화면을 만져야 다시 소리를 내 줘서, 돌아온 뒤 처음 만질 때 한 번 더 깨웁니다
    root.document.addEventListener('pointerdown', function () {
      if (ctx && now && ctx.state !== 'running' && !root.document.hidden && ctx.resume) ctx.resume();
    }, true);
  }

  S.Music = { play: play, stop: stop, render: render, position: position, names: Object.keys(SONGS) };
})(typeof window !== 'undefined' ? window : globalThis);
