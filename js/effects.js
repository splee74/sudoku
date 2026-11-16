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
      var el = addTemp(wrap, 'fx-spark fx-spark-' + kind + (i % 3 === 0 ? ' star' : ''), 900);
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
      var glow = addTemp(wrap, 'fx-unit fx-unit-' + kind, 1100);
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
    stop: stop,
    unitDone: unitDone,
    wrong: wrong,
    lose: lose,
    clearBoard: clearBoard,
    restart: restart,
    sparks: sparks
  };
})(typeof window !== 'undefined' ? window : globalThis);
