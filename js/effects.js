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

  S.Effects = { confetti: confetti, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
