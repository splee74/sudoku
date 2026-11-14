/*
 * 화면 : 판을 그리고, 버튼 누름을 처리합니다.
 * 페이지를 열면 바로 게임이 시작되고, 결과·규칙·내 기록·설정은 창으로 뜹니다.
 */
(function () {
  var S = window.SUDOKU;
  var C = S.Config, Game = S.Game, Progress = S.Progress, Engine = S.Engine, Settings = S.Settings;
  var SHEETS = ['rules', 'record', 'settings', 'grades'];

  function $(id) {
    return document.getElementById(id);
  }

  var data = Progress.load(); // 내 기록
  var game = null; // 지금 하고 있는 판
  var sel = -1; // 고른 칸 번호
  var hl = 0; // 강조할 숫자
  var memo = false; // 메모 켜짐/꺼짐
  var paused = false; // 잠시 멈춤
  var cellEls = [];
  var numEls = [];
  var timerId = 0;
  var lastTick = 0;
  var lastSave = 0;
  var ending = false;
  var said = {}; // 이번 판에서 이미 보여 준 응원 메시지
  var toastTimer = 0;

  /* ---------------- 공통 ---------------- */
  function formatTime(ms) {
    var total = Math.floor(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* 1234 → "1,234" */
  function formatScore(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* 지금 하는 판이 오늘의 퍼즐인가? */
  function isDaily() {
    return !!(game && game.daily);
  }

  /* '2026-11-13' → "11월 13일" */
  function dayLabel(key) {
    var p = String(key).split('-');
    return Number(p[1]) + '월 ' + Number(p[2]) + '일';
  }

  function setGradeColor(grade) {
    document.documentElement.style.setProperty('--grade', grade.color);
  }

  function renderDots(el, filled) {
    el.innerHTML = '';
    for (var i = 0; i < C.WINS_TO_PROMOTE; i++) {
      var d = document.createElement('span');
      d.className = 'dot' + (i < filled ? ' on' : '');
      el.appendChild(d);
    }
  }

  function progressText() {
    var left = Progress.winsLeft(data);
    if (left < 0) return '지금이 가장 높은 등급이에요';
    return '승급까지 ' + left + '판 남았어요';
  }

  /*
   * 등급 목록 한 줄씩 만들기 (규칙 창, 내 기록 창, 등급 고르기 창에서 같이 씁니다)
   *   withBest : 최고 기록을 같이 보여 줌
   *   pick     : 줄을 눌러서 등급을 고를 수 있게 함
   */
  function renderGradeList(box, withBest, pick) {
    box.innerHTML = '';
    C.GRADES.forEach(function (g, i) {
      var row = document.createElement(pick ? 'button' : 'div');
      if (pick) {
        row.type = 'button';
        row.setAttribute('data-grade', i);
      }
      row.className = 'grade-row' + (pick ? ' grade-pick' : '') + (i === data.gradeIndex ? ' now' : '');
      var name = document.createElement('b');
      name.textContent = g.name;
      name.style.background = g.color;
      var info = document.createElement('span');
      // 9×9 등급이 여러 개라서 빈칸 수로 어려운 정도를 구분해 보여 줍니다
      info.textContent = g.size + '×' + g.size + ' · 빈칸 ' + (g.size * g.size - g.givens) + '칸' + (!withBest && i === data.gradeIndex ? ' · 지금 내 등급' : '');
      row.appendChild(name);
      row.appendChild(info);
      if (withBest) {
        var best = document.createElement('span');
        best.className = 'right';
        var sec = data.bestTimes[g.id];
        var pts = data.bestScores[g.id];
        var parts = [];
        if (typeof pts === 'number') parts.push(formatScore(pts) + '점');
        if (typeof sec === 'number') parts.push(formatTime(sec * 1000));
        best.textContent = parts.length ? parts.join(' · ') : '기록 없음';
        row.appendChild(best);
      }
      box.appendChild(row);
    });
  }

  /* ---------------- 확인 창 ---------------- */
  var modalOk = null, modalCancel = null;
  function showModal(text, okText, cancelText, onOk, onCancel) {
    $('modal-text').textContent = text;
    $('modal-ok').textContent = okText;
    $('modal-cancel').textContent = cancelText || '';
    $('modal-cancel').hidden = !cancelText;
    modalOk = onOk || null;
    modalCancel = onCancel || null;
    $('modal').hidden = false;
    $('modal-ok').focus();
  }
  function closeModal(ok) {
    $('modal').hidden = true;
    lastTick = Date.now();
    var fn = ok ? modalOk : modalCancel;
    modalOk = modalCancel = null;
    if (fn) fn();
  }

  /* ---------------- 규칙 · 내 기록 · 설정 창 ---------------- */
  function sheetOpen() {
    for (var i = 0; i < SHEETS.length; i++) if (!$('sheet-' + SHEETS[i]).hidden) return true;
    return false;
  }
  /* 무언가 창이 떠 있으면 시간이 멈추고 키보드 입력도 받지 않습니다 */
  function overlayOpen() {
    return sheetOpen() || !$('modal').hidden || !$('result').hidden || !$('promo').hidden || S.Tutorial.isOpen();
  }
  function openSheet(name) {
    closeSheets();
    if (name === 'settings') renderSettings();
    if (name === 'rules') renderRules();
    if (name === 'record') renderRecord();
    if (name === 'grades') renderGradeList($('pick-grades'), false, true);
    var sheet = $('sheet-' + name);
    sheet.hidden = false;
    sheet.querySelector('.sheet-body').scrollTop = 0;
    sheet.querySelector('.sheet-close').focus();
  }
  function closeSheets() {
    for (var i = 0; i < SHEETS.length; i++) $('sheet-' + SHEETS[i]).hidden = true;
    lastTick = Date.now();
  }

  function renderRules() {
    $('rules-wins').textContent = C.WINS_TO_PROMOTE;
    $('rules-fails').textContent = C.FAILS_TO_DEMOTE;
    renderGradeList($('rules-grades'), false);
  }

  function renderRecord() {
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    $('record-grade').textContent = grade.name;
    $('sheet-record').style.setProperty('--grade', grade.color); // 오늘의 퍼즐 중에도 내 등급 색으로
    $('record-grade-info').textContent = grade.size + '×' + grade.size + ' 판' + (next ? ' · 다음 등급은 ' + next.name : '');
    if (next) renderDots($('record-dots'), data.wins);
    else $('record-dots').innerHTML = '';
    $('record-left').textContent = progressText();
    var fail = '';
    if (!next) fail = '이 등급에서 ' + data.wins + '판 성공';
    if (data.failStreak > 0) {
      fail = '연속 실패 ' + data.failStreak + '번' +
        (data.gradeIndex > 0 ? ' (' + C.FAILS_TO_DEMOTE + '번이면 한 단계 내려가요)' : '');
    }
    $('record-fail').textContent = fail;
    // 오늘의 퍼즐 기록
    var today = Progress.dateKey();
    var dd = data.daily;
    if (dd.total > 0) {
      $('record-daily').textContent = '연속 ' + Progress.dailyStreak(data, today) + '일 · 모두 ' + dd.total + '번 풀었어요';
      $('record-daily-sub').textContent =
        (Progress.dailyDone(data, today)
          ? '오늘 퍼즐 완료 · ' + formatScore(dd.score) + '점 · ' + formatTime(dd.seconds * 1000)
          : '오늘 퍼즐은 아직 안 풀었어요') +
        '\n가장 길었던 연속 기록 ' + dd.bestStreak + '일';
    } else {
      $('record-daily').textContent = '아직 푼 적이 없어요';
      $('record-daily-sub').textContent = '판 위의 "오늘의 퍼즐"을 눌러 보세요';
    }

    renderStats();
    renderBadges();
    renderGradeList($('record-grades'), true);
    $('record-total').textContent = data.totalGames > 0
      ? '지금까지 ' + data.totalGames + '판 중 ' + data.totalWins + '판 성공 · 모은 점수 ' + formatScore(data.totalScore) + '점'
      : '아직 끝낸 판이 없어요';
  }

  /* 내 기록 창 : 통계 여섯 칸 */
  function renderStats() {
    var st = data.stats;
    var grade = C.GRADES[data.gradeIndex];
    var gs = data.gradeStats[grade.id] || {};
    var done = data.totalGames + (data.gradeStats.daily ? data.gradeStats.daily.played || 0 : 0);
    var wins = data.totalWins + (data.gradeStats.daily ? data.gradeStats.daily.won || 0 : 0);
    var items = [
      ['끝낸 판', done ? formatScore(done) + '판' : '-'],
      ['성공률', done ? Math.round((wins / done) * 100) + '%' : '-'],
      ['최다 연승', st.bestWinStreak + '연승'],
      ['무결점 성공', st.perfectWins + '판'],
      [grade.name + ' 평균 시간', gs.won ? formatTime(Math.round(gs.sec / gs.won) * 1000) : '-'],
      ['9×9 최고 기록', st.best9 ? formatTime(st.best9 * 1000) : '-']
    ];
    var box = $('record-stats');
    box.innerHTML = '';
    items.forEach(function (it) {
      var cell = document.createElement('div');
      cell.className = 'stat';
      var v = document.createElement('b');
      v.textContent = it[1];
      var l = document.createElement('span');
      l.textContent = it[0];
      cell.appendChild(v);
      cell.appendChild(l);
      box.appendChild(cell);
    });
  }

  /* 내 기록 창 : 배지 모음 (받은 것은 색, 아직인 것은 흐리게) */
  function renderBadges() {
    $('record-badge-count').textContent = S.Badges.count(data) + ' / ' + S.Badges.LIST.length;
    var box = $('record-badges');
    box.innerHTML = '';
    S.Badges.LIST.forEach(function (b) {
      var got = data.badges[b.id];
      var el = document.createElement('div');
      el.className = 'badge-tile' + (got ? ' got' : '');
      var icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.textContent = got ? b.icon : '🔒';
      icon.setAttribute('aria-hidden', 'true');
      var name = document.createElement('b');
      name.textContent = b.name;
      var desc = document.createElement('span');
      desc.className = 'badge-desc';
      desc.textContent = got ? dayLabel(got) + ' 받음' : b.desc;
      el.title = b.desc;
      el.setAttribute('aria-label', b.name + ', ' + b.desc + (got ? ', 받음' : ', 아직 못 받음'));
      el.appendChild(icon);
      el.appendChild(name);
      el.appendChild(desc);
      box.appendChild(el);
    });
  }

  /* 설정 화면은 settings.js의 ITEMS 목록대로 만들어집니다 */
  function renderSettings() {
    var body = $('settings-body');
    body.innerHTML = '';

    // 화면 밝기 (다크 모드)
    var th = document.createElement('h3');
    th.textContent = '화면 밝기';
    body.appendChild(th);
    var seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', '화면 밝기');
    S.Theme.LIST.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.setAttribute('role', 'radio');
      b.setAttribute('data-theme-id', t.id);
      b.setAttribute('aria-checked', Settings.get('theme') === t.id ? 'true' : 'false');
      b.textContent = t.name;
      seg.appendChild(b);
    });
    body.appendChild(seg);

    // 스킨 고르기 (목록은 skins.js)
    var sh = document.createElement('h3');
    sh.textContent = '스킨';
    body.appendChild(sh);
    var grid = document.createElement('div');
    grid.className = 'skin-grid';
    var now = S.Skins.current().id;
    S.Skins.LIST.forEach(function (skin) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-btn';
      btn.setAttribute('data-skin-id', skin.id);
      btn.setAttribute('aria-pressed', skin.id === now ? 'true' : 'false');
      var sw = document.createElement('span');
      sw.className = 'skin-swatch';
      if (skin.swatch.image) {
        // 그림으로 된 미리보기
        sw.className += ' skin-photo';
        sw.style.backgroundImage = 'url("' + skin.swatch.image + '")';
      } else {
        sw.style.background = skin.swatch.bg;
        skin.swatch.cells.forEach(function (color) {
          var c = document.createElement('span');
          c.style.background = color;
          sw.appendChild(c);
        });
      }
      var name = document.createElement('span');
      name.className = 'skin-name';
      name.textContent = skin.name;
      btn.appendChild(sw);
      btn.appendChild(name);
      grid.appendChild(btn);
    });
    body.appendChild(grid);

    var group = '';
    Settings.ITEMS.forEach(function (item) {
      if (item.group !== group) {
        group = item.group;
        var h = document.createElement('h3');
        h.textContent = group;
        body.appendChild(h);
      }
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'set-row';
      row.setAttribute('role', 'switch');
      row.setAttribute('data-key', item.key);
      row.setAttribute('aria-checked', Settings.get(item.key) ? 'true' : 'false');
      var text = document.createElement('span');
      text.className = 'set-text';
      var title = document.createElement('span');
      title.className = 'set-title';
      title.textContent = item.title;
      var desc = document.createElement('span');
      desc.className = 'set-desc';
      desc.textContent = item.desc;
      text.appendChild(title);
      text.appendChild(desc);
      var sw = document.createElement('span');
      sw.className = 'switch';
      row.appendChild(text);
      row.appendChild(sw);
      body.appendChild(row);
    });
  }

  function toggleSetting(row) {
    var key = row.getAttribute('data-key');
    var value = !Settings.get(key);
    Settings.set(key, value);
    row.setAttribute('aria-checked', value ? 'true' : 'false');
    if (game) renderGame(); // 바꾼 설정을 판에 바로 반영
  }

  /* ---------------- 응원 메시지 ---------------- */
  /* ms : 보여 주는 시간 (안 적으면 1.6초), wide : 두 줄짜리 긴 안내 */
  function toast(msg, ms, wide) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.toggle('toast-wide', !!wide);
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, ms || 1600);
  }
  function hideToast() {
    window.clearTimeout(toastTimer);
    $('toast').hidden = true;
  }

  /* ---------------- 등급 줄 ---------------- */
  function renderGradeBar() {
    var today = Progress.dateKey();
    var chip = $('grade-chip');
    if (isDaily()) {
      // 오늘의 퍼즐을 하는 동안 : 날짜와 연속 일수를 보여 줍니다
      setGradeColor(C.DAILY);
      chip.textContent = C.DAILY.name;
      chip.disabled = true;
      $('gradebar-label').textContent = '';
      var streak = Progress.dailyStreak(data, today);
      $('grade-text').textContent = dayLabel(game.daily) + (streak > 0 ? ' · 연속 ' + streak + '일' : '');
      $('grade-dots').innerHTML = '';
      $('btn-daily').textContent = '승급전으로';
      $('btn-new').textContent = '승급전으로 돌아가기';
      return;
    }
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    setGradeColor(grade);
    chip.textContent = grade.name + (C.FREE_GRADE_SELECT ? ' ▾' : '');
    chip.disabled = !C.FREE_GRADE_SELECT;
    chip.setAttribute('aria-label', grade.name + (C.FREE_GRADE_SELECT ? ' (눌러서 등급 고르기)' : ''));
    $('gradebar-label').textContent = '내 등급';
    $('btn-daily').textContent = '오늘의 퍼즐' + (Progress.dailyDone(data, today) ? ' ✓' : '');
    $('btn-new').textContent = '새 게임';
    if (next) {
      $('grade-text').textContent = '승급까지 ' + Progress.winsLeft(data) + '판';
      renderDots($('grade-dots'), data.wins);
    } else {
      $('grade-text').textContent = '가장 높은 등급';
      $('grade-dots').innerHTML = '';
    }
  }

  /* ---------------- 게임 시작 ---------------- */
  function launch() {
    S.Effects.stop();
    $('result').hidden = true;
    beginGame(Game.create(data.gradeIndex));
    persist();
  }

  function beginGame(state) {
    game = Game.upgrade(state);
    sel = -1;
    hl = 0;
    memo = false;
    ending = false;
    said = {};
    setPaused(false);
    hideToast();
    renderGradeBar();
    buildBoard();
    renderGame();
    startTimer();
  }

  /* 하던 판을 저장합니다. 승급전 판과 오늘의 퍼즐은 따로 저장합니다. */
  function persist() {
    var live = game && game.status === 'playing' ? game : null;
    if (isDaily()) data.dailyGame = live;
    else data.game = live;
    Progress.save(data);
    lastSave = Date.now();
  }

  /* 아직 아무것도 넣지 않은 판인가? (메모는 괜찮음) */
  function untouched() {
    if (game.mistakes > 0 || game.hintsLeft < C.MAX_HINTS) return false;
    for (var i = 0; i < game.cells.length; i++) {
      if (!game.fixed[i] && game.cells[i] !== 0) return false;
    }
    return true;
  }

  /* "새 게임" 버튼 : 숫자를 넣은 판을 버리면 실패로 기록됩니다 */
  function pressNew() {
    if (ending) return;
    if (isDaily()) return leaveDaily(); // 오늘의 퍼즐 중에는 "승급전으로 돌아가기" 단추
    if (!game || game.status !== 'playing' || untouched()) return launch();
    showModal('하던 판은 실패로 기록됩니다.\n새 게임을 시작할까요?', '새 게임', '아니요', function () {
      stopTimer();
      var res = Progress.recordLoss(data, game.score);
      Progress.recordStats(data, game, false);
      data.game = null;
      game.status = 'lost';
      Progress.save(data);
      if (res.demoted) {
        showModal('연속 ' + C.FAILS_TO_DEMOTE + '번 실패해서\n' + res.grade.name + '(으)로 내려왔어요.', '확인', '', launch);
      } else {
        launch();
      }
    });
  }

  /* ---------------- 등급 고르기 ---------------- */
  function pickGrade(index) {
    closeSheets();
    if (ending || isDaily() || !C.FREE_GRADE_SELECT || index === data.gradeIndex) return;
    function go() {
      Progress.setGrade(data, index);
      data.game = null;
      Progress.save(data);
      launch();
    }
    if (!game || game.status !== 'playing' || untouched()) return go();
    showModal('하던 판은 실패로 기록됩니다.\n' + C.GRADES[index].name + ' 등급으로 바꿀까요?', '바꾸기', '아니요', function () {
      stopTimer();
      Progress.recordLoss(data, game.score);
      Progress.recordStats(data, game, false);
      game.status = 'lost';
      go();
    });
  }

  /* ---------------- 오늘의 퍼즐 ---------------- */
  /* "오늘의 퍼즐" 단추 : 승급전 ↔ 오늘의 퍼즐을 오갑니다 */
  function pressDaily() {
    if (ending) return;
    if (isDaily()) return leaveDaily();
    var today = Progress.dateKey();
    if (Progress.dailyDone(data, today)) {
      var dd = data.daily;
      showModal(
        '오늘의 퍼즐은 이미 풀었어요!\n' + formatScore(dd.score) + '점 · ' + formatTime(dd.seconds * 1000) +
          '\n연속 ' + dd.streak + '일째 · 내일 새 퍼즐이 나와요',
        '확인', '');
      return;
    }
    persist(); // 하던 승급전 판은 그대로 두었다가, 돌아오면 이어서 합니다
    startDaily(today);
  }

  function startDaily(today) {
    S.Effects.stop();
    $('result').hidden = true;
    var saved = data.dailyGame;
    if (Game.isValidSaved(saved) && saved.daily === today) beginGame(saved);
    else beginGame(Game.createDaily(today));
    persist();
  }

  /* 오늘의 퍼즐에서 승급전으로 돌아갑니다 */
  function leaveDaily() {
    persist();
    S.Effects.stop();
    $('result').hidden = true;
    if (Game.isValidSaved(data.game) && !data.game.daily) beginGame(data.game);
    else launch();
  }

  /* 결과 창의 "다시 하기" 단추 */
  function pressAgain() {
    if (!isDaily()) return launch();
    if (game.status === 'won') return leaveDaily();
    data.dailyGame = null; // 실패한 오늘의 퍼즐 : 같은 판을 처음부터 다시
    startDaily(Progress.dateKey());
  }

  /* ---------------- 판 만들기 ---------------- */
  function buildBoard() {
    var n = game.size;
    var board = $('board');
    board.innerHTML = '';
    board.style.setProperty('--n', n);
    board.style.setProperty('--cols', game.boxCols);
    board.classList.toggle('small-pad', n <= 6);
    cellEls = [];
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.setAttribute('data-idx', i);
      var cls = 'cell';
      if (c === n - 1) cls += ' last-c';
      else if ((c + 1) % game.boxCols === 0) cls += ' edge-r';
      if (r === n - 1) cls += ' last-r';
      else if ((r + 1) % game.boxRows === 0) cls += ' edge-b';
      // 스킨용 : 상자 번호와, 상자를 하나 건너 하나씩 칠하기 위한 표시
      var boxRow = Math.floor(r / game.boxRows), boxCol = Math.floor(c / game.boxCols);
      if ((boxRow + boxCol) % 2 === 0) cls += ' alt';
      cell.setAttribute('data-box', Engine.boxOf(game, r, c));
      cell.setAttribute('data-v', '');
      cell.setAttribute('data-base', cls);
      cell.className = cls;
      var val = document.createElement('span');
      val.className = 'val';
      var notes = document.createElement('span');
      notes.className = 'notes';
      for (var d = 1; d <= n; d++) notes.appendChild(document.createElement('span'));
      cell.appendChild(val);
      cell.appendChild(notes);
      board.appendChild(cell);
      cellEls.push(cell);
    }

    var pad = $('numpad');
    pad.innerHTML = '';
    pad.classList.toggle('few', n <= 6);
    pad.style.setProperty('--pad-cols', n === 4 ? 2 : 3); // PC 화면에서 숫자 버튼 가로 개수
    numEls = [];
    for (var k = 1; k <= n; k++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'num';
      b.setAttribute('data-d', k);
      b.textContent = k;
      pad.appendChild(b);
      numEls.push(b);
    }
  }

  /* ---------------- 판 그리기 ---------------- */
  function renderGame() {
    if (!game) return;
    var n = game.size;
    var showSame = Settings.get('highlightSame');
    var peerSet = {};
    if (sel >= 0 && Settings.get('highlightArea')) {
      var p = Engine.peers(game, sel);
      for (var i = 0; i < p.length; i++) peerSet[p[i]] = true;
    }
    // 틀린 숫자와 같은 줄·상자에 있는 같은 숫자 (겹치는 숫자)
    var dupSet = {};
    if (Settings.get('highlightDup')) {
      for (var w = 0; w < n * n; w++) {
        var wv = game.cells[w];
        if (wv === 0 || wv === game.solution[w]) continue;
        var wp = Engine.peers(game, w);
        for (var j = 0; j < wp.length; j++) if (game.cells[wp[j]] === wv) dupSet[wp[j]] = true;
      }
    }

    for (var idx = 0; idx < n * n; idx++) {
      var el = cellEls[idx];
      var v = game.cells[idx];
      var cls = el.getAttribute('data-base');
      var wrong = v !== 0 && v !== game.solution[idx];
      if (game.hinted[idx]) cls += ' hinted';
      else if (!game.fixed[idx] && v !== 0) cls += ' user';
      if (wrong) cls += ' wrong';
      if (peerSet[idx]) cls += ' peer';
      if (showSame && hl && v === hl) cls += ' same';
      if (dupSet[idx]) cls += ' dup';
      if (idx === sel) cls += ' sel';
      el.className = cls;
      el.setAttribute('data-v', v ? v : ''); // 스킨에서 숫자별 색을 입힐 때 씁니다

      el.firstChild.textContent = v ? v : '';
      var noteEl = el.lastChild;
      var mask = v ? 0 : game.notes[idx];
      noteEl.hidden = mask === 0;
      if (mask !== 0) {
        for (var d = 1; d <= n; d++) {
          var sp = noteEl.children[d - 1];
          var has = (mask & (1 << (d - 1))) !== 0;
          sp.textContent = has ? d : '';
          sp.className = showSame && has && d === hl ? 'hl' : '';
        }
      }
      el.setAttribute('aria-label',
        (Math.floor(idx / n) + 1) + '번째 줄 ' + (idx % n + 1) + '번째 칸 ' + (v ? v : '빈칸'));
    }

    // 틀린 횟수
    var marks = $('game-marks');
    marks.innerHTML = '';
    for (var m = 0; m < C.MAX_MISTAKES; m++) {
      var mk = document.createElement('span');
      mk.className = 'mark' + (m < game.mistakes ? ' on' : '');
      marks.appendChild(mk);
    }
    $('game-mistakes').textContent = game.mistakes + '/' + C.MAX_MISTAKES;

    // 도구 버튼
    var live = game.status === 'playing';
    $('btn-memo').classList.toggle('on', memo);
    $('btn-memo').setAttribute('aria-pressed', memo ? 'true' : 'false');
    $('memo-onoff').textContent = memo ? '켜짐' : '꺼짐';
    $('game-score').textContent = formatScore(game.score);
    $('game-score-wrap').hidden = !Settings.get('showScore');
    $('hint-left').textContent = game.hintsLeft;
    $('btn-hint').disabled = !live || game.hintsLeft <= 0;
    $('btn-undo').disabled = !live || game.history.length === 0;
    $('btn-pause').disabled = !live;

    // 숫자 버튼 : 다 채운 숫자는 흐리게
    for (var k = 1; k <= n; k++) {
      var b = numEls[k - 1];
      b.classList.toggle('on', showSame && hl === k);
      b.classList.toggle('done', Game.placedCount(game, k) >= n);
    }

    $('game-timer').textContent = formatTime(game.elapsedMs);
    $('game-timer').hidden = !Settings.get('showTimer');
  }

  /* 칸들이 차례로 반짝이는 효과. 반환 : 효과가 끝날 때까지 걸리는 시간(ms) */
  function wave(cells, origin) {
    var n = game.size;
    var or = Math.floor(origin / n), oc = origin % n;
    var max = 0;
    for (var i = 0; i < cells.length; i++) {
      var el = cellEls[cells[i]];
      var dist = Math.abs(Math.floor(cells[i] / n) - or) + Math.abs(cells[i] % n - oc);
      if (dist > max) max = dist;
      el.style.setProperty('--d', dist * 30 + 'ms');
      el.classList.remove('wave');
      void el.offsetWidth;
      el.classList.add('wave');
    }
    return max * 30 + 500;
  }

  /* idx 칸이 들어 있는 가로줄·세로줄·상자 중에서 방금 완성된 것을 찾습니다 */
  function completedUnits(idx) {
    var n = game.size;
    var r = Math.floor(idx / n), c = idx % n, b = Engine.boxOf(game, r, c);
    var row = [], col = [], box = [];
    for (var i = 0; i < n * n; i++) {
      var ir = Math.floor(i / n), ic = i % n;
      if (ir === r) row.push(i);
      if (ic === c) col.push(i);
      if (Engine.boxOf(game, ir, ic) === b) box.push(i);
    }
    function done(list) {
      for (var k = 0; k < list.length; k++) {
        if (game.cells[list[k]] !== game.solution[list[k]]) return false;
      }
      return true;
    }
    var out = { cells: [], line: false, box: false };
    if (done(row)) { out.cells = out.cells.concat(row); out.line = true; }
    if (done(col)) { out.cells = out.cells.concat(col); out.line = true; }
    if (done(box)) { out.cells = out.cells.concat(box); out.box = true; }
    return out;
  }

  /* 맞힌 칸 위로 "+30" 같은 점수가 떠오릅니다 */
  function floatGain(idx, gain) {
    if (!gain || !Settings.get('showScore')) return;
    var cell = cellEls[idx];
    var wrap = $('board').parentNode;
    if (!cell) return;
    var r = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    var el = document.createElement('span');
    el.className = 'gain';
    el.textContent = '+' + formatScore(gain);
    el.style.left = (r.left - w.left + r.width / 2) + 'px';
    el.style.top = (r.top - w.top + r.height / 2) + 'px';
    wrap.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 950);
  }

  /* 맞는 숫자가 들어간 뒤 : 효과와 응원 메시지 */
  function afterCorrect(idx, byPlayer) {
    flash(idx, 'pop');
    var units = completedUnits(idx);
    if (units.cells.length && Settings.get('unitEffect')) wave(units.cells, idx);
    if (!byPlayer || !Settings.get('cheer')) return;

    var remaining = 0;
    for (var i = 0; i < game.cells.length; i++) {
      if (game.cells[i] !== game.solution[i]) remaining++;
    }
    var blanks = 0; // 처음에 비어 있던 칸 수 (힌트로 채운 칸도 원래는 빈칸)
    for (var b = 0; b < game.cells.length; b++) {
      if (!game.fixed[b] || game.hinted[b]) blanks++;
    }
    if (!said.half && remaining === Math.floor(blanks / 2)) {
      said.half = true;
      toast('절반 왔어요! 💪');
    } else if (!said.near && blanks >= 12 && remaining === 3) {
      said.near = true;
      toast('거의 다 왔어요! 🔥');
    } else if (units.box) {
      toast('상자 하나 완성! 👍');
    } else if (units.line) {
      toast('한 줄 완성! 👏');
    }
  }

  function flash(idx, name) {
    var el = cellEls[idx];
    if (!el) return;
    el.classList.remove(name);
    void el.offsetWidth; // 효과를 처음부터 다시 틀기 위한 한 줄
    el.classList.add(name);
  }

  /* ---------------- 시간 · 잠시 멈춤 ---------------- */
  function startTimer() {
    stopTimer();
    lastTick = Date.now();
    timerId = window.setInterval(tick, 250);
  }
  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = 0;
  }
  function tick() {
    var now = Date.now();
    var delta = now - lastTick;
    lastTick = now;
    if (!game || game.status !== 'playing' || paused || document.hidden || overlayOpen()) return;
    // 화면이 꺼져 있던 시간은 세지 않습니다
    game.elapsedMs += Math.min(delta, 1000);
    $('game-timer').textContent = formatTime(game.elapsedMs);
    if (now - lastSave > 5000) persist();
  }

  function setPaused(on) {
    paused = on;
    $('pause-cover').hidden = !on;
    $('game').classList.toggle('is-paused', on);
    lastTick = Date.now();
  }
  function pressPause() {
    if (!game || game.status !== 'playing' || ending) return;
    setPaused(!paused);
    if (paused) {
      hideToast();
      persist();
      $('btn-resume').focus();
    }
  }

  /* ---------------- 조작 ---------------- */
  function playing() {
    return game && game.status === 'playing' && !ending && !paused;
  }

  function selectCell(idx) {
    if (!playing()) return;
    sel = idx;
    hl = game.cells[idx] || 0;
    renderGame();
  }

  function pressDigit(d) {
    if (!playing() || d < 1 || d > game.size) return;
    // 칸을 고르지 않았거나 바꿀 수 없는 칸이면 → 같은 숫자 강조만
    if (sel < 0 || !Game.isEditable(game, sel)) {
      hl = hl === d ? 0 : d;
      renderGame();
      return;
    }
    if (memo) {
      if (Game.toggleNote(game, sel, d)) {
        persist();
        S.Sound.play('note');
      }
      renderGame();
      return;
    }
    var result = Game.enter(game, sel, d, Settings.get('autoNotes'));
    if (result === 'ignored') return;
    hl = d;
    persist();
    renderGame();
    if (result === 'wrong') {
      flash(sel, 'shake');
      if (Settings.get('vibrate') && navigator.vibrate) navigator.vibrate(80);
      S.Sound.play('wrong');
    } else {
      floatGain(sel, game.lastGain);
      if (game.status === 'playing') {
        // 효과음 : 상자 완성 > 줄 완성 > 그냥 맞힘 (연속으로 맞힐수록 음이 올라감)
        var done = completedUnits(sel);
        if (done.box) S.Sound.play('box');
        else if (done.line) S.Sound.play('line');
        else S.Sound.play('correct', game.streak);
        afterCorrect(sel, true);
      }
    }
    if (game.status !== 'playing') finishGame(sel);
  }

  function pressErase() {
    if (!playing() || sel < 0) return;
    if (Game.erase(game, sel)) {
      S.Sound.play('erase');
      hl = 0;
      persist();
      renderGame();
    }
  }

  function pressUndo() {
    if (!playing()) return;
    if (Game.undo(game)) {
      S.Sound.play('undo');
      if (sel >= 0) hl = game.cells[sel] || 0;
      persist();
      renderGame();
    }
  }

  function pressMemo() {
    if (!playing()) return;
    memo = !memo;
    S.Sound.play(memo ? 'memoOn' : 'memoOff');
    renderGame();
  }

  function pressHint() {
    if (!playing() || game.hintsLeft <= 0) return;
    var target = Game.hint(game, sel, Settings.get('autoNotes'));
    if (target < 0) return;
    S.Sound.play('hint');
    sel = target;
    hl = game.cells[target];
    persist();
    renderGame();
    if (game.status === 'playing') afterCorrect(target, false);
    else finishGame(target);
  }

  /* ---------------- 한 판 끝 ---------------- */
  function finishGame(lastIdx) {
    if (ending) return;
    ending = true;
    stopTimer();
    hideToast();
    var won = game.status === 'won';
    S.Sound.play(won ? 'win' : 'lose');
    var fancy = won && Settings.get('winEffect');
    var wait = won ? 450 : 900;
    if (fancy) {
      // 마지막에 넣은 칸에서부터 판 전체가 물결처럼 반짝입니다
      var all = [];
      for (var i = 0; i < game.cells.length; i++) all.push(i);
      wait = wave(all, lastIdx >= 0 ? lastIdx : 0) + 150;
    }
    var finished = game;
    var seconds = Math.floor(finished.elapsedMs / 1000);
    var before = C.GRADES[data.gradeIndex];
    var res;
    if (finished.daily) {
      // 오늘의 퍼즐은 등급에 영향을 주지 않습니다
      res = won ? Progress.recordDaily(data, finished.daily, seconds, finished.score) : {};
      data.dailyGame = null;
    } else {
      res = won ? Progress.recordWin(data, seconds, finished.score) : Progress.recordLoss(data, finished.score);
      data.game = null;
    }
    Progress.recordStats(data, finished, won);
    var newBadges = S.Badges.check(data);
    Progress.save(data);

    // 마지막 숫자가 들어간 모습을 잠깐 보여 준 다음 결과 창을 띄웁니다
    window.setTimeout(function () {
      ending = false;
      memo = false;
      renderGame();
      renderGradeBar();
      renderResult(won, finished, before, res);
      renderNewBadges(newBadges);
      closeSheets();
      $('result').hidden = false;
      if (won && res.promoted) showPromo(res.grade);
      else {
        $('btn-again').focus();
        if (fancy) S.Effects.confetti(1200);
      }
    }, wait);
  }

  function renderResult(won, finished, before, res) {
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    $('result-mark').textContent = won ? '○' : '×';
    $('result-mark').className = 'result-mark' + (won ? '' : ' fail');
    $('result-title').textContent = won ? '성공!' : '실패';
    $('result-sub').textContent = won
      ? (finished.daily ? dayLabel(finished.daily) + ' 오늘의 퍼즐을 풀었어요' : before.name + ' 한 판을 깼어요')
      : '틀린 숫자가 ' + C.MAX_MISTAKES + '번 나왔어요';
    $('result-time').textContent = formatTime(finished.elapsedMs);
    $('result-score').textContent = formatScore(finished.score);

    var detail = '틀린 횟수 ' + finished.mistakes + '번 · 힌트 ' + (C.MAX_HINTS - finished.hintsLeft) + '번 사용';
    if (won && finished.clearBonus > 0) detail += '\n완성 보너스 +' + formatScore(finished.clearBonus) + '점';
    if (won && res.newBestScore) detail += ' · 최고 점수!';
    if (won && res.newBest) detail += ' · 가장 빠른 기록!';
    $('result-detail').textContent = detail;

    var msg;
    if (finished.daily) {
      msg = won
        ? '연속 ' + res.streak + '일째 풀었어요!\n내일 새 퍼즐이 나와요'
        : '등급에는 영향이 없어요\n풀 때까지 다시 도전할 수 있어요';
      $('result-progress').textContent = msg;
      $('result-dots').innerHTML = '';
      $('btn-again').textContent = won ? '승급전 하기' : '다시 도전';
      return;
    }
    $('btn-again').textContent = '다시 하기';
    if (won) {
      if (res.promoted) msg = '축! ' + grade.name + ' 승급!';
      else msg = progressText();
    } else if (res.demoted) {
      msg = '연속 ' + C.FAILS_TO_DEMOTE + '번 실패해서\n' + grade.name + '(으)로 내려왔어요.\n다시 올라가 봐요!';
    } else if (data.gradeIndex === 0) {
      msg = '괜찮아요, ' + grade.name + ' 밑으로는 내려가지 않아요';
    } else {
      msg = '연속 실패 ' + data.failStreak + '번\n' + C.FAILS_TO_DEMOTE + '번이면 한 단계 내려가요';
    }
    $('result-progress').textContent = msg;
    if (next) renderDots($('result-dots'), data.wins);
    else $('result-dots').innerHTML = '';
  }

  /* 따라 하기 (js/tutorial.js) : 끝나면 하던 판으로 돌아옵니다 */
  function openTutorial() {
    if (paused) setPaused(false);
    S.Tutorial.open(function () {
      lastTick = Date.now();
    });
  }

  /* 결과 창 : 이번 판에서 새로 받은 배지 */
  function renderNewBadges(list) {
    var box = $('result-badges');
    box.innerHTML = '';
    box.hidden = !list.length;
    if (!list.length) return;
    var label = document.createElement('p');
    label.className = 'card-label';
    label.textContent = '새 배지를 받았어요!';
    box.appendChild(label);
    list.forEach(function (b) {
      var row = document.createElement('p');
      row.className = 'new-badge';
      var icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.textContent = b.icon;
      var name = document.createElement('b');
      name.textContent = b.name;
      row.appendChild(icon);
      row.appendChild(name);
      box.appendChild(row);
    });
  }

  function showPromo(grade) {
    $('promo-grade').textContent = grade.name;
    $('promo-text').textContent = grade.name + ' 승급!';
    $('promo').hidden = false;
    S.Sound.play('promo');
    S.Effects.confetti(3500);
    $('btn-promo-ok').focus();
  }

  /* ---------------- 버튼 연결 ---------------- */
  $('btn-new').addEventListener('click', pressNew);
  $('btn-again').addEventListener('click', pressAgain);
  $('btn-daily').addEventListener('click', pressDaily);
  $('grade-chip').addEventListener('click', function () {
    if (!isDaily() && C.FREE_GRADE_SELECT) openSheet('grades');
  });
  $('btn-result-close').addEventListener('click', function () {
    $('result').hidden = true;
    S.Effects.stop();
  });
  $('btn-pause').addEventListener('click', pressPause);
  $('btn-resume').addEventListener('click', pressPause);
  $('btn-undo').addEventListener('click', pressUndo);
  $('btn-erase').addEventListener('click', pressErase);
  $('btn-memo').addEventListener('click', pressMemo);
  $('btn-hint').addEventListener('click', pressHint);
  $('btn-promo-ok').addEventListener('click', function () {
    $('promo').hidden = true;
    S.Effects.stop();
    $('btn-again').focus();
  });
  $('modal-ok').addEventListener('click', function () {
    closeModal(true);
  });
  $('modal-cancel').addEventListener('click', function () {
    closeModal(false);
  });
  $('btn-tutorial').addEventListener('click', function () {
    closeSheets();
    openTutorial();
  });
  $('btn-reset').addEventListener('click', function () {
    showModal('등급과 기록을 모두 지우고\n하수부터 다시 시작할까요?', '지우기', '아니요', function () {
      data = Progress.reset();
      closeSheets();
      launch();
    });
  });

  /* 메뉴의 규칙·내 기록·설정 버튼, 창 닫기, 설정 켜고 끄기 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var opener = t.closest('[data-open]');
    if (opener) return openSheet(opener.getAttribute('data-open'));
    if (t.closest('[data-close]')) return closeSheets();
    var gradeRow = t.closest('.grade-pick');
    if (gradeRow) return pickGrade(Number(gradeRow.getAttribute('data-grade')));
    var row = t.closest('.set-row');
    if (row) return toggleSetting(row);
    var themeBtn = t.closest('.seg-btn[data-theme-id]');
    if (themeBtn) {
      var themeId = themeBtn.getAttribute('data-theme-id');
      S.Theme.apply(themeId);
      var segs = document.querySelectorAll('.seg-btn[data-theme-id]');
      for (var s = 0; s < segs.length; s++) {
        segs[s].setAttribute('aria-checked', segs[s].getAttribute('data-theme-id') === themeId ? 'true' : 'false');
      }
      return;
    }
    var skinBtn = t.closest('.skin-btn');
    if (skinBtn) {
      var picked = S.Skins.apply(skinBtn.getAttribute('data-skin-id'));
      var all = document.querySelectorAll('.skin-btn');
      for (var i = 0; i < all.length; i++) {
        all[i].setAttribute('aria-pressed', all[i].getAttribute('data-skin-id') === picked.id ? 'true' : 'false');
      }
      return;
    }
    // 창 바깥의 어두운 부분을 눌러도 닫힙니다
    if (t.id && t.id.indexOf('sheet-') === 0) closeSheets();
  });

  $('board').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.cell') : null;
    if (el) selectCell(Number(el.getAttribute('data-idx')));
  });
  $('numpad').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.num') : null;
    if (el) pressDigit(Number(el.getAttribute('data-d')));
  });

  /* PC 키보드 : 숫자, 화살표, 지우기(Backspace), 메모(M), 되돌리기(Z), 멈춤(P) */
  document.addEventListener('keydown', function (e) {
    if (S.Tutorial.isOpen()) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      S.Tutorial.key(e.key);
      if (e.key === 'Enter' || e.key === 'Escape' || (e.key >= '1' && e.key <= '9')) e.preventDefault();
      return;
    }
    if (!$('modal').hidden) {
      if (e.key === 'Escape') closeModal(false);
      return;
    }
    if (sheetOpen()) {
      if (e.key === 'Escape') closeSheets();
      return;
    }
    if (overlayOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key;
    if (key === 'p' || key === 'P' || key === 'ㅔ') {
      pressPause();
      e.preventDefault();
      return;
    }
    if (!playing()) return;
    var n = game.size;
    if (key >= '1' && key <= '9') {
      pressDigit(Number(key));
    } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
      pressErase();
    } else if (key === 'm' || key === 'M' || key === 'ㅡ') {
      pressMemo();
    } else if (key === 'z' || key === 'Z' || key === 'ㅋ') {
      pressUndo();
    } else if (key.indexOf('Arrow') === 0 && sel >= 0) {
      // 칸을 고른 상태에서만 화살표로 칸을 옮깁니다 (아니면 페이지가 위아래로 움직임)
      var r = Math.floor(sel / n), c = sel % n;
      if (key === 'ArrowUp') r = (r + n - 1) % n;
      if (key === 'ArrowDown') r = (r + 1) % n;
      if (key === 'ArrowLeft') c = (c + n - 1) % n;
      if (key === 'ArrowRight') c = (c + 1) % n;
      selectCell(r * n + c);
    } else {
      return;
    }
    e.preventDefault();
  });

  /* ---------------- 휴대폰 '뒤로 가기' 버튼 ----------------
   * 앱으로 설치해서 열었을 때만 동작합니다. (인터넷 창에서는 보통의 뒤로 가기)
   *   창이 떠 있으면        → 그 창을 닫습니다
   *   게임 중이면           → 잠시 멈추고 "한 번 더 누르면 나가요"를 알려 줍니다
   *   그 밖에는             → "한 번 더 누르면 나가요"를 알려 줍니다
   * 안내가 뜬 뒤 화면을 만지지 않고 한 번 더 누르면 앱이 닫힙니다.
   *
   * 방법 : 화면을 만질 때 "가짜 페이지"를 하나 쌓아 둡니다. 뒤로 가기를 누르면
   * 가짜 페이지가 빠지면서 popstate 가 오고, 쌓인 것이 없으면 앱이 닫힙니다.
   * (크롬은 화면을 만지기 전에 쌓은 페이지는 뒤로 가기에서 건너뛰기 때문에, 만질 때 쌓습니다)
   */
  var BACK_STATE = { sudokuBack: true };
  var backReady = false; // 가짜 페이지가 쌓여 있는가

  function isAppMode() {
    if (/[?&]app=1/.test(location.search)) return true; // 시험용 : 주소 뒤에 ?app=1
    if (document.referrer.indexOf('android-app://') === 0) return true; // 플레이스토어 앱
    var mq = window.matchMedia;
    return !!(mq && (mq('(display-mode: standalone)').matches || mq('(display-mode: fullscreen)').matches)) ||
      navigator.standalone === true;
  }

  function armBack() {
    if (backReady || !isAppMode()) return;
    try {
      history.pushState(BACK_STATE, '');
      backReady = true;
    } catch (e) {
      /* 막혀 있으면 보통의 뒤로 가기 */
    }
  }

  /* 가장 위에 떠 있는 창 하나를 닫습니다. 닫은 게 있으면 true */
  function closeTopOverlay() {
    if (S.Tutorial && S.Tutorial.isOpen()) { S.Tutorial.close(); return true; }
    if (!$('modal').hidden) { closeModal(false); return true; }
    if (!$('promo').hidden) { $('btn-promo-ok').click(); return true; }
    if (sheetOpen()) { closeSheets(); return true; }
    if (!$('result').hidden) { $('btn-result-close').click(); return true; }
    return false;
  }

  function onBack() {
    backReady = false;
    if (closeTopOverlay()) return armBack(); // 창만 닫고, 다음 뒤로 가기도 받을 준비
    if (game && game.status === 'playing' && !ending && !paused) {
      setPaused(true);
      persist();
    } else if (game && game.status === 'playing') {
      persist();
    }
    // 여기서는 다시 쌓지 않습니다 : 한 번 더 누르면 앱이 닫힙니다
    toast('한 번 더 누르면 나가요\n하던 판은 저장돼요', 2500, true);
  }

  window.addEventListener('popstate', onBack);
  // 화면을 만지면 다시 뒤로 가기를 받을 준비를 합니다
  document.addEventListener('pointerdown', armBack, true);
  document.addEventListener('keydown', armBack, true);

  /* 화면을 떠날 때 하던 판을 저장합니다 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game && game.status === 'playing') persist();
    lastTick = Date.now();
  });
  window.addEventListener('pagehide', function () {
    if (game && game.status === 'playing') persist();
  });

  /* 테스트용 : 자동 점검 프로그램이 지금 판 상태를 읽을 수 있게 합니다 */
  S._debug = {
    game: function () { return game; },
    data: function () { return data; }
  };

  /* 인터넷에 올렸을 때만 앱 설치 정보(manifest.json)를 연결합니다.
     (내 컴퓨터에서 파일을 바로 열 때는 브라우저가 막기 때문) */
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.json';
    document.head.appendChild(link);
    // 한 번 열어 본 뒤에는 인터넷이 끊겨도 켜지게 합니다 (sw.js)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  /* 저장해 둔 스킨을 입힙니다 */
  S.Skins.apply(Settings.get('skin'));
  S.Theme.apply();

  /* 시작 : 하던 판이 있으면 이어서, 없으면 새 판 */
  if (Game.isValidSaved(data.game)) {
    beginGame(data.game);
  } else {
    data.game = null;
    launch();
  }

  /* 처음 켠 사람에게는 따라 하기를 먼저 보여 줍니다 (한 판이라도 해 본 사람은 건너뜀) */
  if (!Settings.get('tutorialDone') && data.totalGames === 0 && !data.daily.total) openTutorial();
})();
