/*
 * 퍼즐 엔진 : 스도쿠 판을 새로 만들고, 정답이 하나뿐인지 검사합니다.
 * 화면과는 상관없는 순수 계산만 들어 있습니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  /*
   * 씨앗(seed) 숫자가 같으면 언제나 같은 순서의 숫자를 내는 주사위.
   * "오늘의 퍼즐"처럼 모든 사람에게 같은 퍼즐을 줄 때 씁니다.
   */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(a, rng) {
    rng = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function popcount(m) {
    var c = 0;
    while (m) {
      m &= m - 1;
      c++;
    }
    return c;
  }

  function boxOf(spec, r, c) {
    return Math.floor(r / spec.boxRows) * (spec.size / spec.boxCols) + Math.floor(c / spec.boxCols);
  }

  /*
   * 판을 풀어서 정답 개수를 셉니다 (limit개까지만 세고 멈춤).
   * grid : 길이 size*size 배열, 빈칸은 0
   * 반환 : { count: 정답 개수, first: 처음 찾은 정답 }
   */
  function solve(grid, spec, limit, randomize, rng) {
    var n = spec.size;
    var full = (1 << n) - 1;
    var g = grid.slice();
    var rows = [], cols = [], boxes = [];
    var i, r, c, b, bit;
    for (i = 0; i < n; i++) {
      rows.push(0);
      cols.push(0);
      boxes.push(0);
    }
    var empties = [];
    for (i = 0; i < n * n; i++) {
      r = Math.floor(i / n);
      c = i % n;
      b = boxOf(spec, r, c);
      if (g[i]) {
        bit = 1 << (g[i] - 1);
        if ((rows[r] | cols[c] | boxes[b]) & bit) return { count: 0, first: null };
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
      } else {
        empties.push(i);
      }
    }

    var count = 0;
    var first = null;

    function rec() {
      // 넣을 수 있는 숫자가 가장 적은 빈칸부터 채웁니다 (빠르게 풀기 위해)
      var best = -1, bestMask = 0, bestCnt = n + 1;
      for (var k = 0; k < empties.length; k++) {
        var idx = empties[k];
        if (g[idx]) continue;
        var rr = Math.floor(idx / n), cc = idx % n;
        var m = full & ~(rows[rr] | cols[cc] | boxes[boxOf(spec, rr, cc)]);
        var cnt = popcount(m);
        if (cnt === 0) return;
        if (cnt < bestCnt) {
          best = idx;
          bestMask = m;
          bestCnt = cnt;
          if (cnt === 1) break;
        }
      }
      if (best === -1) {
        count++;
        if (!first) first = g.slice();
        return;
      }
      var digits = [];
      for (var d = 1; d <= n; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
      if (randomize) shuffle(digits, rng);
      var br = Math.floor(best / n), bc = best % n, bb = boxOf(spec, br, bc);
      for (var q = 0; q < digits.length; q++) {
        var v = 1 << (digits[q] - 1);
        g[best] = digits[q];
        rows[br] |= v;
        cols[bc] |= v;
        boxes[bb] |= v;
        rec();
        g[best] = 0;
        rows[br] &= ~v;
        cols[bc] &= ~v;
        boxes[bb] &= ~v;
        if (count >= limit) return;
      }
    }

    rec();
    return { count: count, first: first };
  }

  /* 숫자가 전부 채워진 올바른 판을 무작위로 하나 만듭니다. */
  function generateSolution(spec, rng) {
    var empty = [];
    for (var i = 0; i < spec.size * spec.size; i++) empty.push(0);
    return solve(empty, spec, 1, true, rng).first;
  }

  /*
   * 퍼즐을 만듭니다.
   * 다 채워진 판에서 숫자를 하나씩 지워 보되,
   * 지웠을 때 정답이 둘 이상이 되면 다시 되돌립니다. → 정답은 항상 하나.
   * level 을 주면 (1 쉬움, 2 중간, 3 어려움) 그 어려운 정도에 맞는 판이 나올 때까지 다시 만듭니다.
   * rng 를 주면 (seeded 로 만든 주사위) 같은 씨앗에서 언제나 같은 퍼즐이 나옵니다.
   * 반환 : { puzzle: 문제 판(빈칸 0), solution: 정답 판, givens: 실제 채워진 개수, level: 어려운 정도 }
   */
  function generatePuzzle(spec, givens, level, rng) {
    var total = spec.size * spec.size;
    var best = null;
    var started = Date.now();
    for (var attempt = 0; attempt < 400; attempt++) {
      var solution = generateSolution(spec, rng);
      var puzzle = solution.slice();
      var order = [];
      for (var i = 0; i < total; i++) order.push(i);
      shuffle(order, rng);
      var remaining = total;
      for (var k = 0; k < order.length && remaining > givens; k++) {
        var idx = order[k];
        var keep = puzzle[idx];
        puzzle[idx] = 0;
        if (solve(puzzle, spec, 2, false).count === 1) {
          remaining--;
        } else {
          puzzle[idx] = keep;
        }
      }
      var made = { puzzle: puzzle, solution: solution, givens: remaining, level: 0 };
      // 빈칸 수가 목표에 가까운 것이 먼저, 그다음은 어려운 정도가 목표에 가까운 것
      if (level) made.level = rate(puzzle, spec);
      var off = level ? Math.abs(made.level - level) : 0;
      if (
        !best ||
        made.givens < best.givens ||
        (made.givens === best.givens && off < best.off)
      ) {
        best = made;
        best.off = off;
      }
      if (best.givens === givens && best.off === 0) break;
      // 너무 오래 걸리면 지금까지 중 가장 가까운 판을 씁니다
      // (씨앗으로 만들 때는 기기 속도와 상관없이 같은 판이 나와야 해서 시간은 보지 않습니다)
      if (attempt >= 29 && (best.givens !== givens || (!rng && Date.now() - started > 1500))) break;
    }
    return best;
  }

  /*
   * 퍼즐이 얼마나 어려운지 잽니다. 사람이 쓰는 요령으로 직접 풀어 봅니다.
   *   1 : 기본 요령만으로 풀림
   *       (한 칸에 들어갈 숫자가 하나뿐 / 줄·상자에서 그 숫자 자리가 하나뿐)
   *   2 : 중급 요령이 있어야 풀림
   *       (상자와 줄이 겹치는 곳의 후보 지우기 / 후보가 똑같은 두 칸 짝)
   *   3 : 그보다 어려운 요령이 있어야 풀림
   */
  var unitCache = {};
  function unitsOf(spec) {
    var key = spec.size + 'x' + spec.boxRows + 'x' + spec.boxCols;
    if (unitCache[key]) return unitCache[key];
    var n = spec.size, list = [];
    for (var u = 0; u < n; u++) {
      var row = [], col = [], box = [];
      for (var j = 0; j < n * n; j++) {
        var r = Math.floor(j / n), c = j % n;
        if (r === u) row.push(j);
        if (c === u) col.push(j);
        if (boxOf(spec, r, c) === u) box.push(j);
      }
      list.push(row, col, box);
    }
    unitCache[key] = list;
    return list;
  }

  function rate(puzzle, spec) {
    var n = spec.size, total = n * n, full = (1 << n) - 1;
    var g = puzzle.slice();
    var cand = [];
    var units = unitsOf(spec);
    var i, j, d, bit, u, p, list;

    for (i = 0; i < total; i++) {
      if (g[i]) {
        cand.push(0);
        continue;
      }
      var m = full;
      list = peers(spec, i);
      for (p = 0; p < list.length; p++) if (g[list[p]]) m &= ~(1 << (g[list[p]] - 1));
      cand.push(m);
    }

    function place(idx, digit) {
      g[idx] = digit;
      cand[idx] = 0;
      var ps = peers(spec, idx);
      for (var q = 0; q < ps.length; q++) cand[ps[q]] &= ~(1 << (digit - 1));
    }

    var level = 1;
    for (;;) {
      var progress = false;
      // 기본 요령 1 : 후보가 하나뿐인 칸
      for (i = 0; i < total; i++) {
        if (!g[i] && popcount(cand[i]) === 1) {
          for (d = 1; d <= n; d++) if (cand[i] === 1 << (d - 1)) break;
          place(i, d);
          progress = true;
        }
      }
      // 기본 요령 2 : 줄·상자에서 그 숫자가 들어갈 자리가 하나뿐
      for (u = 0; u < units.length; u++) {
        for (d = 1; d <= n; d++) {
          bit = 1 << (d - 1);
          var where = -1, cnt = 0;
          for (j = 0; j < n; j++) {
            if (!g[units[u][j]] && cand[units[u][j]] & bit) {
              cnt++;
              where = units[u][j];
            }
          }
          if (cnt === 1) {
            place(where, d);
            progress = true;
          }
        }
      }
      if (progress) continue;

      var left = 0;
      for (i = 0; i < total; i++) if (!g[i]) left++;
      if (!left) return level;

      // 중급 요령 : 후보를 지워서 길을 엽니다
      var removed = false;
      for (u = 0; u < units.length; u++) {
        var unit = units[u];
        // 한 숫자의 자리가 다른 줄·상자 하나 안에 다 모여 있으면, 그쪽의 나머지 칸에서 지움
        for (d = 1; d <= n; d++) {
          bit = 1 << (d - 1);
          var cells = [];
          for (j = 0; j < n; j++) if (!g[unit[j]] && cand[unit[j]] & bit) cells.push(unit[j]);
          if (cells.length < 2) continue;
          for (var v = 0; v < units.length; v++) {
            if (v === u) continue;
            var other = units[v], inside = true;
            for (j = 0; j < cells.length; j++) if (other.indexOf(cells[j]) < 0) inside = false;
            if (!inside) continue;
            for (j = 0; j < n; j++) {
              var o = other[j];
              if (cells.indexOf(o) < 0 && !g[o] && cand[o] & bit) {
                cand[o] &= ~bit;
                removed = true;
              }
            }
          }
        }
        // 후보 두 개가 똑같은 두 칸이 있으면, 같은 줄·상자의 나머지 칸에서 그 둘을 지움
        for (var a = 0; a < n; a++) {
          var ca = unit[a];
          if (g[ca] || popcount(cand[ca]) !== 2) continue;
          for (var b = a + 1; b < n; b++) {
            var cb = unit[b];
            if (g[cb] || cand[cb] !== cand[ca]) continue;
            for (j = 0; j < n; j++) {
              var x = unit[j];
              if (x !== ca && x !== cb && !g[x] && cand[x] & cand[ca]) {
                cand[x] &= ~cand[ca];
                removed = true;
              }
            }
          }
        }
      }
      if (!removed) return 3;
      level = 2;
    }
  }

  /* 한 칸과 같은 줄·같은 칸(세로)·같은 상자에 있는 칸 번호 목록 */
  var peerCache = {};
  function peers(spec, idx) {
    var key = spec.size + 'x' + spec.boxRows + 'x' + spec.boxCols;
    var table = peerCache[key];
    if (!table) {
      table = [];
      var n = spec.size;
      for (var i = 0; i < n * n; i++) {
        var r = Math.floor(i / n), c = i % n, b = boxOf(spec, r, c);
        var list = [];
        for (var j = 0; j < n * n; j++) {
          if (j === i) continue;
          var r2 = Math.floor(j / n), c2 = j % n;
          if (r2 === r || c2 === c || boxOf(spec, r2, c2) === b) list.push(j);
        }
        table.push(list);
      }
      peerCache[key] = table;
    }
    return table[idx];
  }

  S.Engine = {
    solve: solve,
    generateSolution: generateSolution,
    generatePuzzle: generatePuzzle,
    rate: rate,
    seeded: seeded,
    peers: peers,
    boxOf: boxOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
