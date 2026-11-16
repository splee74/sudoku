/*
 * 축하 효과 : 색종이가 위에서 떨어집니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var COLORS = ['#e9b93b', '#d9534f', '#4d8558', '#2f6aa8', '#c77db3', '#f08a3c'];
  var rafId = 0;

  function stop() {
    if (rafId) root.cancelAnimationFrame(rafId);
    rafId = 0;
    var canvas = document.getElementById('confetti');
    if (canvas) canvas.hidden = true;
  }

  function confetti(durationMs) {
    var canvas = document.getElementById('confetti');
    if (!canvas || !canvas.getContext) return;
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();

    var ctx = canvas.getContext('2d');
    var w = (canvas.width = root.innerWidth);
    var h = (canvas.height = root.innerHeight);
    canvas.hidden = false;

    var pieces = [];
    for (var i = 0; i < 140; i++) {
      pieces.push({
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.6,
        size: 7 + Math.random() * 8,
        vy: 2 + Math.random() * 3.5,
        vx: -1.2 + Math.random() * 2.4,
        rot: Math.random() * Math.PI,
        vr: -0.15 + Math.random() * 0.3,
        color: COLORS[i % COLORS.length]
      });
    }

    var start = Date.now();
    function frame() {
      var t = Date.now() - start;
      ctx.clearRect(0, 0, w, h);
      var alive = false;
      for (var k = 0; k < pieces.length; k++) {
        var p = pieces[k];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 20) {
          if (t < durationMs) {
            p.y = -20;
            p.x = Math.random() * w;
          } else {
            continue;
          }
        }
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (alive) rafId = root.requestAnimationFrame(frame);
      else stop();
    }
    rafId = root.requestAnimationFrame(frame);
  }

  /* ---------------- 판을 깼을 때 : 화면이 환하게 번쩍이고 꽃이 휘날립니다 ----------------
   * 아래 양쪽 구석에서 꽃이 폭죽처럼 솟아오르고, 위에서는 꽃잎이 흔들리며 내려옵니다.
   * 꽃 색은 FLOWER_COLORS 에서 바꿀 수 있습니다.
   */
  var FLOWER_COLORS = ['#ff8fb1', '#ffb3c7', '#ffffff', '#ffd54f', '#ff9e80', '#c5a3ff', '#f8bbd0'];

  function drawFlower(ctx, p) {
    ctx.fillStyle = p.color;
    if (p.kind === 'petal') {
      // 꽃잎 하나 : 뒤집히며 떨어지는 느낌으로 납작하게
      ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.32, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // 다섯 장 꽃 + 꽃술
    for (var i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -p.size * 0.32, p.size * 0.22, p.size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.color === '#ffd54f' ? '#ff8a3d' : '#ffd54f';
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  function screenFlash() {
    var el = document.createElement('div');
    el.className = 'fx-screenflash';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    root.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
  }

  function flowers(durationMs) {
    var canvas = document.getElementById('confetti');
    if (!canvas || !canvas.getContext) return;
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();
    screenFlash();

    var ctx = canvas.getContext('2d');
    var w = (canvas.width = root.innerWidth);
    var h = (canvas.height = root.innerHeight);
    canvas.hidden = false;
    var unit = Math.max(1, Math.min(w, h) / 400); // 화면 크기에 맞춘 꽃 크기

    function piece(burst, side) {
      var p = {
        kind: Math.random() < 0.55 ? 'petal' : 'flower',
        size: (14 + Math.random() * 14) * unit,
        rot: Math.random() * Math.PI * 2,
        vr: -0.06 + Math.random() * 0.12,
        flip: Math.random() * Math.PI,
        vflip: 0.05 + Math.random() * 0.08,
        sway: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]
      };
      if (burst) {
        // 아래 구석에서 위로 솟아오름 (빵빠레 폭죽)
        p.x = side < 0 ? -10 : w + 10;
        p.y = h * (0.78 + Math.random() * 0.15);
        var sp = (h / 55) * (0.75 + Math.random() * 0.5);
        var ang = -Math.PI / 2 - side * (0.2 + Math.random() * 0.45);
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
      } else {
        p.x = Math.random() * w;
        p.y = -30 - Math.random() * h * 0.5;
        p.vx = 0;
        p.vy = 1.2 + Math.random() * 1.6;
      }
      return p;
    }

    var pieces = [];
    for (var i = 0; i < 70; i++) pieces.push(piece(true, i % 2 ? 1 : -1));
    for (var j = 0; j < 60; j++) pieces.push(piece(false));

    var start = Date.now(), tick = 0;
    function frame() {
      var t = Date.now() - start;
      tick++;
      ctx.clearRect(0, 0, w, h);
      var alive = false;
      for (var k = 0; k < pieces.length; k++) {
        var p = pieces[k];
        // 솟아오른 꽃은 공기에 막혀 느려지다가 천천히 떨어집니다
        p.vx *= 0.985;
        p.vy = Math.min(p.vy + 0.12, 2.6);
        p.x += p.vx + Math.sin(tick * 0.04 + p.phase) * p.sway;
        p.y += p.vy;
        p.rot += p.vr;
        p.flip += p.vflip;
        if (p.y > h + 40) {
          if (t < durationMs) {
            p = pieces[k] = piece(false);
            p.y = -30;
          } else {
            continue;
          }
        }
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.92;
        drawFlower(ctx, p);
        ctx.restore();
      }
      if (alive) rafId = root.requestAnimationFrame(frame);
      else stop();
    }
    rafId = root.requestAnimationFrame(frame);
  }

  /* ---------------- 판 위의 효과 (줄·상자 완성, 틀림, 실패) ----------------
   * 판을 감싼 상자(board-wrap) 위에 잠깐 그림 조각을 얹었다가 지웁니다.
   * 꾸밈(색, 움직임)은 css/style.css 의 "판 위의 효과" 에 있습니다.
   */
  function reduced() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function addTemp(wrap, cls, ms) {
    var el = document.createElement('span');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    wrap.appendChild(el);
    root.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, ms);
    return el;
  }

  /* 여러 칸을 감싸는 네모 (wrap 기준 위치) */
  function unionRect(wrap, els) {
    var w = wrap.getBoundingClientRect();
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (var i = 0; i < els.length; i++) {
      var x = els[i].getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top);
      r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    return { left: l - w.left, top: t - w.top, width: r - l, height: b - t };
  }

  function place(el, rc) {
    el.style.left = rc.left + 'px';
    el.style.top = rc.top + 'px';
    el.style.width = rc.width + 'px';
    el.style.height = rc.height + 'px';
  }

  /* 반짝이 조각을 (x, y)에서 사방으로 튀깁니다 */
  function sparks(wrap, x, y, count, spread, kind) {
    if (reduced()) return;
    for (var i = 0; i < count; i++) {
      var el = addTemp(wrap, 'fx-spark fx-spark-' + kind + (i % 3 === 0 ? ' star' : ''), 1050);
      var ang = Math.random() * Math.PI * 2;
      var dist = spread * (0.45 + Math.random() * 0.75);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      el.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      el.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
      el.style.animationDelay = Math.floor(Math.random() * 120) + 'ms';
    }
  }

  /*
   * 줄·상자 완성 : 완성된 묶음 둘레가 빛나고 반짝이가 튑니다.
   *   groups : [{ els: [칸 요소...], kind: 'line' | 'box' }]
   */
  function unitDone(wrap, groups) {
    if (!wrap || !groups || !groups.length) return;
    for (var g = 0; g < groups.length; g++) {
      var rc = unionRect(wrap, groups[g].els);
      var kind = groups[g].kind;
      var glow = addTemp(wrap, 'fx-unit fx-unit-' + kind, 1000 + g * 90 + 150);
      place(glow, rc);
      glow.style.animationDelay = g * 90 + 'ms';
      var cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      var spread = Math.max(rc.width, rc.height) * 0.55;
      sparks(wrap, cx, cy, kind === 'box' ? 18 : 12, spread, kind);
    }
  }

  /*
   * 틀림 : 칸에서 붉은 고리가 퍼지고, 판이 살짝 흔들리고, 겹치는 숫자가 깜박입니다.
   *   cellEl     : 틀린 칸
   *   conflicts  : 같은 줄·상자에 있는 같은 숫자 칸들
   */
  function wrong(wrap, board, cellEl, conflicts) {
    if (!wrap || !cellEl) return;
    var w = wrap.getBoundingClientRect(), c = cellEl.getBoundingClientRect();
    var ring = addTemp(wrap, 'fx-ring', 650);
    var size = Math.max(c.width, c.height);
    ring.style.left = (c.left - w.left + c.width / 2) + 'px';
    ring.style.top = (c.top - w.top + c.height / 2) + 'px';
    ring.style.width = ring.style.height = size + 'px';
    restart(board, 'fx-shake');
    restart(wrap, 'fx-redflash');
    for (var i = 0; i < (conflicts || []).length; i++) restart(conflicts[i], 'conflict');
  }

  /* 판 실패 : 판이 크게 흔들리고 빛이 빠지듯 흐려집니다 */
  function lose(wrap, board) {
    if (!board) return;
    restart(board, 'fx-lose');
    restart(wrap, 'fx-redflash');
  }

  /* 실패 효과를 지웁니다 (새 판을 시작할 때) */
  function clearBoard(board) {
    if (board) board.classList.remove('fx-lose', 'fx-shake');
  }

  function restart(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 효과를 처음부터 다시 틀기 위한 한 줄
    el.classList.add(cls);
  }

  S.Effects = {
    confetti: confetti,
    flowers: flowers,
    stop: stop,
    unitDone: unitDone,
    wrong: wrong,
    lose: lose,
    clearBoard: clearBoard,
    restart: restart,
    sparks: sparks
  };
})(typeof window !== 'undefined' ? window : globalThis);
