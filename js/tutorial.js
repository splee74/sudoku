/*
 * 따라 하기 : 처음 하는 사람이 4×4 판에서 직접 눌러 보며 규칙을 익히는 안내.
 * 처음 켰을 때 한 번 뜨고, 규칙 창의 "따라 하기 다시 보기"로 언제든 다시 볼 수 있습니다.
 *
 * 안내 내용을 바꾸려면 아래 STEPS 목록의 글만 고치면 됩니다.
 *   text   : 안내 글 (\n 은 줄바꿈)
 *   target : 사람이 채워야 할 칸 번호 (0~15, 왼쪽 위부터 오른쪽으로). 없으면 [다음] 단추로 넘어갑니다
 *   unit   : 함께 연하게 칠해 보여 줄 칸들
 *   free   : true 이면 남은 빈칸을 아무 순서로나 혼자 채웁니다
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  var N = 4, BOX_R = 2, BOX_C = 2;
  // 정답판
  var SOLUTION = [
    1, 2, 3, 4,
    3, 4, 1, 2,
    2, 1, 4, 3,
    4, 3, 2, 1
  ];
  // 처음에 비어 있는 칸
  var BLANKS = [2, 5, 9, 12, 15];

  var ROW0 = [0, 1, 2, 3];
  var COL0 = [0, 4, 8, 12];
  var BOX3 = [10, 11, 14, 15];

  var STEPS = [
    { text: '스도쿠는 빈칸에 숫자를 채우는 놀이예요.\n이 작은 판에는 1부터 4까지 들어가요.' },
    { text: '지킬 약속은 하나뿐이에요.\n가로줄, 세로줄, 굵은 선 상자 안에\n같은 숫자는 한 번씩만 들어가요.' },
    { text: '맨 위 가로줄에는 1, 2, 4가 있어요.\n반짝이는 빈칸을 눌러 보세요.', pick: '빠진 숫자는 무엇일까요?\n아래 숫자 단추를 눌러 넣어 보세요.', target: 2, unit: ROW0 },
    { text: '잘했어요! 이번엔 맨 왼쪽 세로줄이에요.\n1, 3, 2가 있어요. 빈칸을 눌러 보세요.', pick: '빠진 숫자를 눌러 보세요.', target: 12, unit: COL0 },
    { text: '이번엔 오른쪽 아래 굵은 상자예요.\n4, 3, 2가 있어요. 빈칸을 눌러 보세요.', pick: '상자에 빠진 숫자를 눌러 보세요.', target: 15, unit: BOX3 },
    { text: '이제 혼자 해 볼까요?\n남은 두 칸을 채워 보세요.', pick: '이 칸이 있는 줄을 잘 보고\n빠진 숫자를 눌러 보세요.', free: true },
    { text: '다 채웠어요! 🎉\n진짜 게임에서는 틀린 숫자를 3번 넣으면 실패예요.\n헷갈리면 메모를, 막히면 힌트를 쓰세요.', last: true }
  ];

  var cells = [];
  var step = 0;
  var sel = -1;
  var filled = {};
  var onClose = null;
  var wrongTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function isOpen() {
    var el = $('tutorial');
    return !!el && !el.hidden;
  }

  function play(name, k) {
    if (S.Sound) S.Sound.play(name, k);
  }

  function build() {
    var board = $('tut-board');
    board.innerHTML = '';
    board.style.setProperty('--n', N);
    board.style.setProperty('--cols', BOX_C);
    board.classList.add('small-pad');
    cells = [];
    for (var i = 0; i < N * N; i++) {
      var r = Math.floor(i / N), c = i % N;
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('data-idx', i);
      var cls = 'cell';
      if (c === N - 1) cls += ' last-c';
      else if ((c + 1) % BOX_C === 0) cls += ' edge-r';
      if (r === N - 1) cls += ' last-r';
      else if ((r + 1) % BOX_R === 0) cls += ' edge-b';
      var boxRow = Math.floor(r / BOX_R), boxCol = Math.floor(c / BOX_C);
      if ((boxRow + boxCol) % 2 === 0) cls += ' alt';
      cell.setAttribute('data-box', boxRow * (N / BOX_C) + boxCol);
      cell.setAttribute('data-base', cls);
      var val = document.createElement('span');
      val.className = 'val';
      cell.appendChild(val);
      board.appendChild(cell);
      cells.push(cell);
    }
    var pad = $('tut-pad');
    pad.innerHTML = '';
    pad.style.setProperty('--pad-cols', N);
    for (var d = 1; d <= N; d++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'num';
      b.setAttribute('data-d', d);
      b.textContent = d;
      pad.appendChild(b);
    }
  }

  function isBlank(i) {
    return BLANKS.indexOf(i) >= 0 && !filled[i];
  }

  /* 지금 눌러야 하는 칸들 */
  function targets() {
    var st = STEPS[step];
    if (st.free) return BLANKS.filter(isBlank);
    if (typeof st.target === 'number' && isBlank(st.target)) return [st.target];
    return [];
  }

  function render(msg) {
    var st = STEPS[step];
    var tg = targets();
    var unit = {};
    (st.unit || []).forEach(function (i) {
      unit[i] = true;
    });
    for (var i = 0; i < cells.length; i++) {
      var el = cells[i];
      var shown = BLANKS.indexOf(i) < 0 || filled[i];
      var cls = el.getAttribute('data-base');
      if (filled[i]) cls += ' user';
      if (unit[i]) cls += ' peer';
      if (tg.indexOf(i) >= 0 && i !== sel) cls += ' tut-target';
      if (i === sel) cls += ' sel';
      el.className = cls;
      el.firstChild.textContent = shown ? SOLUTION[i] : '';
      el.setAttribute('data-v', shown ? SOLUTION[i] : '');
      el.setAttribute('aria-label', (Math.floor(i / N) + 1) + '번째 줄 ' + (i % N + 1) + '번째 칸 ' + (shown ? SOLUTION[i] : '빈칸'));
    }
    var waiting = tg.length > 0;
    $('tut-text').textContent = msg || (sel >= 0 && st.pick ? st.pick : st.text);
    $('tut-step').textContent = (step + 1) + ' / ' + STEPS.length;
    $('tut-next').hidden = waiting;
    $('tut-next').textContent = st.last ? '게임 시작하기' : '다음';
    $('tut-pad').classList.toggle('tut-dim', !(waiting && sel >= 0));
  }

  function go(i) {
    step = i;
    sel = -1;
    render();
    if (!targets().length) $('tut-next').focus();
  }

  function pressCell(i) {
    if (targets().indexOf(i) < 0) {
      if (targets().length) render(isBlank(i) ? null : '숫자가 없는 빈칸을 눌러 주세요.');
      return;
    }
    sel = i;
    play('note');
    render();
  }

  function unitHas(list, d) {
    for (var k = 0; k < list.length; k++) {
      var i = list[k];
      if ((BLANKS.indexOf(i) < 0 || filled[i]) && SOLUTION[i] === d) return true;
    }
    return false;
  }

  /* 같은 가로줄·세로줄·상자에 이미 그 숫자가 있으면 어디에 있는지 알려 줍니다 */
  function whyWrong(i, d) {
    var r = Math.floor(i / N), c = i % N;
    var row = [], col = [], box = [];
    for (var k = 0; k < N * N; k++) {
      var kr = Math.floor(k / N), kc = k % N;
      if (kr === r) row.push(k);
      if (kc === c) col.push(k);
      if (Math.floor(kr / BOX_R) === Math.floor(r / BOX_R) && Math.floor(kc / BOX_C) === Math.floor(c / BOX_C)) box.push(k);
    }
    if (unitHas(row, d)) return d + '은(는) 이 가로줄에 벌써 있어요.\n다른 숫자를 눌러 보세요.';
    if (unitHas(col, d)) return d + '은(는) 이 세로줄에 벌써 있어요.\n다른 숫자를 눌러 보세요.';
    if (unitHas(box, d)) return d + '은(는) 이 상자에 벌써 있어요.\n다른 숫자를 눌러 보세요.';
    return '아쉬워요, 다시 생각해 보세요.';
  }

  function pressDigit(d) {
    if (!targets().length) return;
    if (sel < 0) {
      render('먼저 반짝이는 빈칸을 눌러 주세요.');
      return;
    }
    var i = sel;
    if (SOLUTION[i] !== d) {
      play('wrong');
      var el = cells[i];
      el.firstChild.textContent = d;
      el.classList.add('wrong', 'shake');
      window.clearTimeout(wrongTimer);
      var msg = whyWrong(i, d);
      $('tut-text').textContent = msg;
      wrongTimer = window.setTimeout(function () {
        render(msg);
      }, 700);
      return;
    }
    filled[i] = true;
    sel = -1;
    play('correct', 1);
    cells[i].classList.add('pop');
    if (targets().length) {
      render(STEPS[step].free ? '좋아요! 하나 남았어요.' : null);
      return;
    }
    // 이 단계 끝 : 잠깐 보여 준 다음 다음 단계로
    render('맞았어요! 👏');
    window.setTimeout(function () {
      if (isOpen()) go(step + 1);
    }, 700);
  }

  function next() {
    if (targets().length) return;
    if (STEPS[step].last) return close();
    go(step + 1);
  }

  function open(cb) {
    onClose = cb || null;
    filled = {};
    build();
    $('tutorial').hidden = false;
    go(0);
  }

  function close() {
    if (!isOpen()) return;
    window.clearTimeout(wrongTimer);
    $('tutorial').hidden = true;
    S.Settings.set('tutorialDone', true);
    var fn = onClose;
    onClose = null;
    if (fn) fn();
  }

  /* 키보드 : 숫자, Enter(다음), Esc(건너뛰기) */
  function key(k) {
    if (k === 'Escape') close();
    else if (k === 'Enter' && !$('tut-next').hidden) next();
    else if (k >= '1' && k <= String(N)) pressDigit(Number(k));
  }

  var bound = false;
  document.addEventListener('DOMContentLoaded', bind);
  if (document.readyState !== 'loading') bind();
  function bind() {
    if (bound || !$('tutorial')) return;
    bound = true;
    $('tut-board').addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.cell') : null;
      if (el) pressCell(Number(el.getAttribute('data-idx')));
    });
    $('tut-pad').addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.num') : null;
      if (el) pressDigit(Number(el.getAttribute('data-d')));
    });
    $('tut-next').addEventListener('click', next);
    $('tut-skip').addEventListener('click', close);
  }

  S.Tutorial = { open: open, close: close, isOpen: isOpen, key: key };
})(typeof window !== 'undefined' ? window : globalThis);
