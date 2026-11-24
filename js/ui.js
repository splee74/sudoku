/*
 * 화면 : 판을 그리고, 버튼 누름을 처리합니다.
 * 시작 그림(1.5초) → 홈 화면 → "계속하기"나 "새 게임"을 누르면 게임 화면으로 갑니다.
 * 아래쪽 메뉴로 홈 · 배지 · 랭킹 · 내 기록 화면을 오가고, 결과·규칙·설정은 창으로 뜹니다.
 */
(function () {
  var S = window.SUDOKU;
  var C = S.Config, Game = S.Game, Progress = S.Progress, Engine = S.Engine, Settings = S.Settings;
  var SHEETS = ['rules', 'settings', 'grades', 'items', 'stars', 'crowns'];

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
  var spotSet = {}; // 돋보기로 보여 주는 칸
  var spotTimer = 0;
  var magnifyPick = false; // 돋보기를 쓰고 숫자를 고르는 중

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

  /* 승급 미션 진행 동그라미 : 깬 미션은 색칠 */
  function renderDots(el) {
    el.innerHTML = '';
    var mc = Progress.missionCount(data);
    for (var i = 0; i < mc.total; i++) {
      var d = document.createElement('span');
      d.className = 'dot' + (i < mc.done ? ' on' : '');
      el.appendChild(d);
    }
  }
  function missionShort() {
    var mc = Progress.missionCount(data);
    return '승급 미션 ' + mc.done + '/' + mc.total;
  }

  function progressText() {
    if (!C.GRADES[data.gradeIndex + 1]) return '지금이 가장 높은 등급이에요';
    var left = Progress.missions(data).filter(function (m) { return !m.done; });
    return '승급까지 남은 미션\n' + left.map(function (m) { return '· ' + m.text + ' (' + m.have + '/' + m.need + ')'; }).join('\n');
  }

  /* 승급 미션 창 : 지금 등급의 미션과, 등급 사다리 (위 등급은 잠김) */
  function renderMissionSheet() {
    var box = $('pick-grades');
    box.innerHTML = '';
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    $('grades-title').textContent = '승급 미션';
    $('grades-note').textContent = next
      ? grade.name + '에서 아래 미션을 모두 깨면 ' + next.name + '(으)로 올라가요.'
      : '가장 높은 등급 ' + grade.name + '에 올랐어요! 🎉';
    if (next) {
      var ul = document.createElement('ul');
      ul.className = 'mission-list';
      Progress.missions(data).forEach(function (m) {
        var li = document.createElement('li');
        li.className = m.done ? 'done' : '';
        var mark = document.createElement('span');
        mark.className = 'mission-mark';
        mark.textContent = m.done ? '✓' : '';
        var text = document.createElement('span');
        text.className = 'mission-text';
        text.textContent = m.text;
        var cnt = document.createElement('span');
        cnt.className = 'mission-count';
        cnt.textContent = m.have + ' / ' + m.need;
        li.appendChild(mark);
        li.appendChild(text);
        li.appendChild(cnt);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    var tip = document.createElement('p');
    tip.className = 'sheet-note';
    tip.textContent = '열린 등급은 눌러서 해 볼 수 있어요. 🔒 위 등급은 승급해야 열려요.';
    box.appendChild(tip);
    var ladder = document.createElement('div');
    ladder.className = 'grade-list';
    box.appendChild(ladder);
    renderGradeList(ladder, false, true);
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
      var locked = !Progress.isUnlocked(data, i);
      row.className = 'grade-row' + (pick ? ' grade-pick' : '') + (i === data.gradeIndex ? ' now' : '') + (locked ? ' locked' : '');
      var name = document.createElement('b');
      name.textContent = g.name;
      name.style.background = g.color;
      var info = document.createElement('span');
      // 9×9 등급이 여러 개라서 빈칸 수로 어려운 정도를 구분해 보여 줍니다
      info.textContent = (locked ? '🔒 ' : '') + g.size + '×' + g.size + ' · 빈칸 ' + (g.size * g.size - g.givens) + '칸' +
        (!withBest && i === data.gradeIndex ? ' · 지금 하는 등급' : !withBest && pick && !locked ? ' · 눌러서 하기' : '');
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
    return sheetOpen() || !$('modal').hidden || !$('result').hidden || !$('promo').hidden || !$('attend').hidden || !$('stairs').hidden || !$('login-ask').hidden || !$('nick').hidden || S.Tutorial.isOpen();
  }
  function openSheet(name) {
    if (name === 'stars' && !C.SHOP_ENABLED) return; // 상점을 껐으면 별 충전 창도 열지 않음
    closeSheets();
    if (name === 'settings') renderSettings();
    if (name === 'rules') renderRules();
    if (name === 'grades') {
      if (C.FREE_GRADE_SELECT) renderGradeList($('pick-grades'), false, true);
      else renderMissionSheet();
    }
    if (name === 'items') renderItems();
    if (name === 'stars') renderStars();
    if (name === 'crowns') {
      crownYear = Number(Progress.dateKey().slice(0, 4));
      renderCrowns();
    }
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
    $('rules-fails').textContent = C.FAILS_TO_DEMOTE;
    renderGradeList($('rules-grades'), false);
  }

  /* ---------------- 화면 바꾸기 : 홈 · 배지 · 내 기록 · 게임 ---------------- */
  var screen = 'home';
  var recordMode = 'grade'; // 내 기록 화면 : 'grade' 승급전, 'daily' 오늘의 퍼즐
  var recordGrade = -1; // 내 기록 화면에서 고른 등급 (-1 = 지금 내 등급)

  function showScreen(name) {
    if (name !== 'game' && screen === 'game' && game && game.status === 'playing') persist();
    // 화면 넘김 효과의 방향 (css/screens.css 의 "화면 넘김") : 아래 메뉴에서 오른쪽 화면으로 가면 오른쪽에서, 왼쪽이면 왼쪽에서 들어옵니다
    var TAB_ORDER = ['home', 'badges', 'ranking', 'record'];
    var from = TAB_ORDER.indexOf(screen), to = TAB_ORDER.indexOf(name);
    // 같은 화면을 다시 그릴 때(처음 켤 때의 홈 등)는 움직이지 않고, 게임에서 나올 때는 살짝 떠오르듯
    document.body.setAttribute('data-dir', name === screen ? 'none' : from < 0 || to < 0 ? 'fade' : to < from ? 'back' : 'fwd');
    screen = name;
    document.body.setAttribute('data-screen', name);
    var tabs = document.querySelectorAll('.tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === name;
      tabs[i].classList.toggle('on', on);
      if (on) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
    if (name === 'home') renderHome();
    if (name === 'badges') renderBadges();
    if (name === 'record') renderRecord();
    if (name === 'ranking') {
      S.Ranking.render();
      S.Ranking.checkRewards();
    }
    playMusic();
    if (name === 'game') {
      renderGradeBar();
      renderGame();
    } else {
      hideToast();
    }
    lastTick = Date.now();
    window.scrollTo(0, 0);
  }

  /* 배경 음악 (js/music.js) : 게임 화면은 잔잔한 곡, 나머지 화면(시작 그림 포함)은 대문 곡.
     시작 그림이 뜰 때부터 틀어 봅니다. 설치한 앱은 크롬이 바로 소리를 내 주고,
     인터넷 창처럼 막혀 있으면 화면을 처음 만지는 순간 이어서 나옵니다 (music.js 가 깨움) */
  function playMusic() {
    if (!S.Music) return;
    if (!Settings.get('music')) return S.Music.stop();
    S.Music.play(splashDone && screen === 'game' ? 'game' : 'title');
  }

  /* 화면마다 있는 작은 음악 단추 🔊/🔇 (index.html 의 data-music) : 설정의 '배경 음악'과 같은 스위치 */
  var MUSIC_ICON = {
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="mb-body" d="M3.5 9.5h3.6L11.5 6v12l-4.4-3.5H3.5Z"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="mb-body" d="M3.5 9.5h3.6L11.5 6v12l-4.4-3.5H3.5Z"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/></svg>'
  };
  function renderMusicBtns() {
    var on = !!Settings.get('music');
    var btns = document.querySelectorAll('[data-music]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].innerHTML = on ? MUSIC_ICON.on : MUSIC_ICON.off;
      btns[i].classList.toggle('off', !on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].setAttribute('aria-label', on ? '배경 음악 끄기' : '배경 음악 켜기');
    }
    var row = document.querySelector('.set-row[data-key="music"]');
    if (row) row.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  function toggleMusic() {
    Settings.set('music', !Settings.get('music'));
    renderMusicBtns();
    playMusic();
  }

  /* 이어서 할 수 있는 판 (지금 판이 끝났으면 저장해 둔 승급전 판) */
  function resumable() {
    if (game && game.status === 'playing') return game;
    if (Game.isValidSaved(data.game)) return data.game;
    return null;
  }

  function renderHome() {
    var today = Progress.dateKey();
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    $('home-streak').querySelector('b').textContent = Progress.dailyStreak(data, today) + '일';
    $('home-score').querySelector('b').textContent = formatScore(data.totalScore);
    $('home-bag').querySelector('b').textContent = Progress.itemTotal(data);
    $('home-stars').querySelector('b').textContent = formatScore(Progress.stars(data));
    $('home-stars').hidden = !C.SHOP_ENABLED;
    renderAttendBar(today);

    // 오늘의 퍼즐 카드
    $('home-daily-date').textContent = dayLabel(today);
    var climbed = Progress.stairs(data, today);
    $('home-daily-btn').textContent = dailyLive(today) ? (climbed + 1) + '단계 이어서' : climbed ? (climbed + 1) + '단계 도전' : '플레이';
    $('home-daily').classList.remove('done');

    // 내 등급 카드
    var card = $('home-grade');
    card.style.setProperty('--grade', grade.color);
    $('home-grade-name').textContent = grade.name;
    if (next) {
      renderDots($('home-grade-dots'));
      $('home-grade-left').textContent = missionShort();
    } else {
      $('home-grade-dots').innerHTML = '';
      $('home-grade-left').textContent = '가장 높은 등급';
    }
    card.querySelector('.hcard-btn').textContent = C.FREE_GRADE_SELECT ? '등급 고르기' : '승급 미션';

    // 계속하기 · 새 게임
    var r = resumable();
    $('home-continue').hidden = !r;
    if (r) {
      $('home-continue-sub').textContent = formatTime(r.elapsedMs) + ' · ' + (r.daily ? '오늘의 퍼즐' : (C.GRADES[r.gradeIndex] || grade).name);
    }
    $('home-new-sub').textContent = grade.name;
    $('home-new').classList.toggle('solo', !r); // 이어서 할 판이 없으면 새 게임이 주인공
  }

  /* 홈의 "계속하기" */
  function homeContinue() {
    if (game && game.status === 'playing') return showScreen('game');
    if (Game.isValidSaved(data.game)) {
      beginGame(data.game);
      return showScreen('game');
    }
    homeNew();
  }

  /* 홈의 "새 게임" : 숫자를 넣은 승급전 판이 있으면 실패로 기록됩니다 */
  function homeNew() {
    if (ending) return;
    persist();
    var cur = Game.isValidSaved(data.game) ? data.game : null;
    if (game && !game.daily && game.status === 'playing') cur = game;
    function go() {
      launch();
      showScreen('game');
    }
    if (!cur || untouched(cur)) return go();
    showModal('하던 판은 실패로 기록됩니다.\n새 게임을 시작할까요?', '새 게임', '아니요', function () {
      abandon(cur, go);
    });
  }

  /* 하던 승급전 판을 실패로 기록하고 next 를 부릅니다 (연속 실패로 강등되면 먼저 알려 줌) */
  function abandon(cur, next) {
    if (cur === game) stopTimer();
    var before = data.totalScore;
    var res = Progress.recordLoss(data, cur.score);
    S.Ranking.addScore(data, data.totalScore - before);
    Progress.recordStats(data, cur, false);
    cur.status = 'lost';
    data.game = null;
    Progress.save(data);
    if (res.demoted) {
      showModal('연속 ' + C.FAILS_TO_DEMOTE + '번 실패해서\n' + res.grade.name + '(으)로 내려왔어요.', '확인', '', next);
    } else {
      next();
    }
  }

  /* 홈의 "오늘의 퍼즐" 카드 */
  function homeDaily() {
    if (ending) return;
    openStairs();
  }

  /* ---------------- 내 기록 화면 ---------------- */
  function renderRecord() {
    renderProfile();

    // 전체 요약
    var dailyGs = data.gradeStats.daily || {};
    var done = data.totalGames + (dailyGs.played || 0);
    var wins = data.totalWins + (dailyGs.won || 0);
    fillStats($('record-summary'), [
      ['끝낸 판', done ? formatScore(done) + '판' : '0판'],
      ['성공률', done ? Math.round((wins / done) * 100) + '%' : '-'],
      ['모은 점수', formatScore(data.totalScore)]
    ]);

    // 승급전 / 오늘의 퍼즐 탭
    var tabs = document.querySelectorAll('.mode-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-mode') === recordMode ? 'true' : 'false');
    }
    var chips = $('record-chips');
    chips.innerHTML = '';
    chips.hidden = recordMode !== 'grade';
    var gi = recordGrade >= 0 ? recordGrade : data.gradeIndex;
    if (recordMode === 'grade') {
      C.GRADES.forEach(function (g, idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gchip' + (idx === gi ? ' on' : '');
        b.setAttribute('data-rec-grade', idx);
        b.setAttribute('aria-pressed', idx === gi ? 'true' : 'false');
        b.style.setProperty('--c', g.color);
        b.textContent = g.name;
        chips.appendChild(b);
      });
    }

    var cards;
    if (recordMode === 'grade') {
      var g = C.GRADES[gi];
      var gs = data.gradeStats[g.id] || {};
      var bt = data.bestTimes[g.id];
      cards = [
        ['grid', '깬 판', (gs.won || 0) + (gs.played ? ' / ' + gs.played : '')],
        ['thumb', '완벽한 승리', gs.perfect || 0],
        ['flag', '최다 연승', gs.best || 0],
        ['clock', '최고 시간', typeof bt === 'number' ? formatTime(bt * 1000) : '-'],
        ['star', '최고 점수', typeof data.bestScores[g.id] === 'number' ? formatScore(data.bestScores[g.id]) : '-'],
        ['avg', '평균 시간', gs.won ? formatTime(Math.round(gs.sec / gs.won) * 1000) : '-']
      ];
    } else {
      var today = Progress.dateKey();
      var dd = data.daily;
      cards = [
        ['grid', '푼 날', dd.total + '일'],
        ['fire', '지금 연속', Progress.dailyStreak(data, today) + '일'],
        ['flag', '가장 긴 연속', dd.bestStreak + '일'],
        ['avg', '오늘 계단', Progress.stairs(data, today) + '단계'],
        ['star', '최고 계단', (dd.bestStairs || 0) + '단계'],
        ['thumb', '받은 왕관', (function (c) { return c[0] + c[1] + c[2] ? '금' + c[2] + ' 은' + c[1] + ' 동' + c[0] : '0'; })(Progress.crownCounts(data))]
      ];
    }
    var box = $('record-cards');
    box.innerHTML = '';
    cards.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'rec-card';
      var icon = document.createElement('span');
      icon.className = 'rec-icon';
      icon.innerHTML = ICONS[c[0]] || '';
      var label = document.createElement('span');
      label.className = 'rec-label';
      label.textContent = c[1];
      var val = document.createElement('b');
      val.className = 'rec-val';
      val.textContent = c[2];
      el.appendChild(icon);
      el.appendChild(label);
      el.appendChild(val);
      box.appendChild(el);
    });

    var fail = data.failStreak > 0 && data.gradeIndex > 0
      ? ' · 연속 실패 ' + data.failStreak + '번 (' + C.FAILS_TO_DEMOTE + '번이면 강등)'
      : '';
    $('record-total').textContent = '지금 내 등급 ' + C.GRADES[data.gradeIndex].name + ' · ' + progressText() + fail;
  }

  /* 기록 카드 아이콘 (선 그림) */
  var ICONS = {
    grid: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>',
    thumb: '<svg viewBox="0 0 24 24"><path d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Zm0 0 4-7a2 2 0 0 1 2.6 2.3l-.8 3.7h5.4a2 2 0 0 1 2 2.4l-1.4 7a2 2 0 0 1-2 1.6H7"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4m0 0h11l-2.5 4.5L16 13H5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>',
    avg: '<svg viewBox="0 0 24 24"><path d="M4 19.5h16M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8.5"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.5-4-6.5-4.5-10.5-2.5 1.5-4 4-3.5 7-1.5-.5-2.5-2-2.5-3.5-1.5 1.5-2.5 4-2.5 7A6.5 6.5 0 0 0 12 21Z"/></svg>'
  };

  function fillStats(box, items) {
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

  /* 게임한 시간 : 95분 → "1시간 35분" */
  function playTime(sec) {
    var m = Math.floor(sec / 60);
    if (m < 60) return m + '분';
    return Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '');
  }

  /* ---------------- 로그인 (js/account.js) ---------------- */
  var accountState = 'out';
  var accountMsg = '';

  function renderProfile() {
    var A = S.Account;
    var u = A.user();
    var avatar = $('profile-avatar');
    avatar.innerHTML = '';
    avatar.style.backgroundImage = '';
    if (u && u.photo) avatar.style.backgroundImage = 'url("' + u.photo.replace(/"/g, '') + '")';
    else avatar.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2"/><path d="M4 21c.6-4 3.9-6.5 8-6.5s7.4 2.5 8 6.5"/></svg>';

    var name = $('profile-name');
    if (u) name.textContent = u.name;
    else if (accountState === 'restoring') name.textContent = (A.lastName() || '') + ' 로그인 확인 중…';
    else name.textContent = '로그인하여 기록 지키기';
    var sub = '게임한 시간 ' + playTime(data.stats.playSec || 0);
    if (u) sub = providerLabel(u.provider) + ' 계정에 저장 중 · ' + sub;
    $('profile-sub').textContent = sub;

    var box = $('login-btns');
    box.innerHTML = '';
    if (u) {
      box.appendChild(loginButton('logout', '로그아웃'));
      var del = loginButton('delete', '계정과 저장된 기록 지우기');
      del.className = 'link login-delete';
      box.appendChild(del);
    } else if (accountState !== 'restoring') {
      A.providers().forEach(function (p) {
        box.appendChild(loginButton(p, loginText(p)));
      });
    }
    var note = accountMsg;
    if (!note && !u) {
      note = A.configured()
        ? '로그인하면 휴대폰을 바꾸거나 앱을 지웠다 깔아도 등급과 기록이 그대로 남아요.'
        : '로그인은 준비 중이에요. 지금은 기록이 이 기기에만 저장돼요.';
    }
    if (!note && u) note = accountState === 'syncing' ? '기록을 맞추는 중…' : '기록이 계정에 저장되고 있어요.';
    $('login-note').textContent = note;
  }

  function providerLabel(p) {
    return p === 'kakao' ? '카카오' : p === 'facebook' ? '페이스북' : '구글';
  }
  function loginText(p) {
    return p === 'kakao' ? '카카오로 로그인' : p === 'facebook' ? '페이스북으로 로그인' : 'Google로 로그인';
  }

  var LOGO = {
    kakao: '<svg viewBox="0 0 24 24"><path fill="#191919" d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .5.1.8.1 5 0 9-3.1 9-7s-4-7.2-9-7.2Z"/></svg>',
    google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1877F2"/><path fill="#fff" d="M13.4 22v-7h2.3l.4-2.8h-2.7v-1.8c0-.8.3-1.4 1.4-1.4h1.4V6.6c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.1H8.3V15h2.3v7Z"/></svg>'
  };

  function loginButton(id, text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'login-btn login-' + id;
    b.setAttribute('data-login', id);
    b.disabled = accountState === 'busy';
    if (LOGO[id]) {
      var i = document.createElement('span');
      i.className = 'login-logo';
      i.innerHTML = LOGO[id];
      b.appendChild(i);
    }
    b.appendChild(document.createTextNode(text));
    return b;
  }

  function pressLogin(id) {
    accountMsg = '';
    if (id === 'delete') {
      showModal('계정에 저장된 기록과 로그인 정보를 지울까요?\n되돌릴 수 없어요.\n(이 기기에 있는 기록은 그대로 남아요)', '지우기', '아니요', function () {
        S.Account.deleteAccount();
      });
      return;
    }
    if (id === 'logout') {
      showModal('로그아웃할까요?\n기록은 이 기기에도 그대로 남아요.', '로그아웃', '아니요', function () {
        S.Account.signOut();
      });
      return;
    }
    if (!$('login-ask').hidden) closeLoginAsk();
    S.Account.signIn(id);
  }

  /*
   * 승급할 때 로그인 권하기 : 로그인하지 않았으면 승급 축하 창을 닫은 뒤에 매번 뜹니다.
   * (로그인이 준비되지 않았으면 — js/config.js 의 FIREBASE 가 비어 있으면 — 뜨지 않습니다)
   */
  function maybeAskLogin(grade) {
    if (!S.Account.configured() || S.Account.user() || accountState === 'restoring') return;
    $('login-ask-title').textContent = grade.name + ' 승급을 축하해요!';
    var box = $('login-ask-btns');
    box.innerHTML = '';
    S.Account.providers().forEach(function (p) {
      box.appendChild(loginButton(p, loginText(p)));
    });
    $('login-ask').hidden = false;
  }
  function closeLoginAsk() {
    $('login-ask').hidden = true;
    lastTick = Date.now();
  }

  S.Account.onChange(function (status, user, msg) {
    accountState = status;
    accountMsg = status === 'error' ? msg || '' : '';
    if (status === 'error' && msg && screen !== 'record') appToast(msg);
    if (status === 'in' && user && splashDone) appToast(user.name + '님, 반가워요!');
    if (status === 'deleted') appToast('계정을 지웠어요');
    if (screen === 'record') renderProfile();
    if (screen === 'ranking' && (status === 'in' || status === 'out' || status === 'deleted')) S.Ranking.render();
  });

  /* 배지 화면 : 받기 어려운 정도(브론즈 → 전설)로 묶어서 보여 줍니다 (받은 것은 색, 아직인 것은 흐리게) */
  function badgeTile(b) {
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
    return el;
  }
  function renderBadges() {
    $('record-badge-count').textContent = S.Badges.count(data) + ' / ' + S.Badges.LIST.length;
    var box = $('record-badges');
    box.innerHTML = '';
    S.Badges.TIERS.forEach(function (t) {
      var list = S.Badges.LIST.filter(function (b) { return S.Badges.tierOf(b) === t; });
      if (!list.length) return;
      var have = list.filter(function (b) { return data.badges[b.id]; }).length;
      var sec = document.createElement('section');
      sec.className = 'badge-tier tier-' + t.id;
      sec.style.setProperty('--tier', t.color);
      var head = document.createElement('h3');
      head.className = 'badge-tier-head';
      head.innerHTML = '<span class="tier-icon" aria-hidden="true"></span><span class="tier-name"></span>' +
        '<span class="tier-hint"></span><span class="tier-count"></span>';
      head.querySelector('.tier-icon').textContent = t.icon;
      head.querySelector('.tier-name').textContent = t.name;
      head.querySelector('.tier-hint').textContent = t.hint;
      head.querySelector('.tier-count').textContent = have + ' / ' + list.length;
      var grid = document.createElement('div');
      grid.className = 'badge-grid';
      list.forEach(function (b) { grid.appendChild(badgeTile(b)); });
      sec.appendChild(head);
      sec.appendChild(grid);
      box.appendChild(sec);
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

    // 개인정보처리방침 (앱에서는 맨 아래 줄이 없어서 여기에 둡니다)
    var info = document.createElement('a');
    info.className = 'link settings-privacy';
    info.href = 'privacy.html';
    info.textContent = '개인정보처리방침';
    body.appendChild(info);
  }

  function toggleSetting(row) {
    var key = row.getAttribute('data-key');
    var value = !Settings.get(key);
    Settings.set(key, value);
    row.setAttribute('aria-checked', value ? 'true' : 'false');
    if (key === 'music') {
      renderMusicBtns();
      playMusic();
    }
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
  /* 어느 화면에서나 아래쪽에 잠깐 뜨는 알림 (로그인, 나가기 안내) */
  var appToastTimer = 0;
  function appToast(msg) {
    var el = $('app-toast');
    el.textContent = msg;
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
    window.clearTimeout(appToastTimer);
    appToastTimer = window.setTimeout(function () {
      el.hidden = true;
    }, 2200);
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
      $('grade-text').textContent = dayLabel(game.daily) + ' · ' + (game.stage || 1) + '단계';
      $('grade-dots').innerHTML = '';
      $('btn-daily').textContent = '승급전으로';
      $('btn-new').textContent = '승급전으로 돌아가기';
      return;
    }
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    setGradeColor(grade);
    chip.textContent = grade.name + ' ▾';
    chip.disabled = false;
    chip.setAttribute('aria-label', grade.name + (C.FREE_GRADE_SELECT ? ' (눌러서 등급 고르기)' : ' (눌러서 승급 미션 보기)'));
    $('gradebar-label').textContent = '내 등급';
    $('btn-daily').textContent = '오늘의 퍼즐' + (Progress.stairs(data, today) ? ' ' + Progress.stairs(data, today) + '단계' : '');
    $('btn-new').textContent = '새 게임';
    if (next) {
      $('grade-text').textContent = missionShort();
      renderDots($('grade-dots'));
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
    magnifyPick = false;
    spotSet = {};
    setPaused(false);
    hideToast();
    S.Effects.clearBoard($('board'));
    renderGradeBar();
    buildBoard();
    renderGame();
    startTimer();
    S.Hero.setGrade(data.gradeIndex); // 오늘의 퍼즐도 내 등급 캐릭터
    S.Hero.reset();
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
  function untouched(g) {
    g = g || game;
    if (g.mistakes > 0 || g.hintsLeft < C.MAX_HINTS || g.itemsUsed > 0) return false;
    for (var i = 0; i < g.cells.length; i++) {
      if (!g.fixed[i] && g.cells[i] !== 0) return false;
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
      var before = data.totalScore;
      var res = Progress.recordLoss(data, game.score);
      S.Ranking.addScore(data, data.totalScore - before);
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
    if (ending || index === data.gradeIndex) return;
    if (!Progress.isUnlocked(data, index)) {
      var top = C.GRADES[data.reach];
      return showModal('🔒 ' + C.GRADES[index].name + ' 등급은 아직 잠겨 있어요.\n먼저 ' + top.name + ' 등급의 승급 미션을 깨서\n승급해야 할 수 있어요.', '확인', '');
    }
    persist();
    var cur = Game.isValidSaved(data.game) ? data.game : null;
    if (game && !game.daily && game.status === 'playing') cur = game;
    function go() {
      Progress.setGrade(data, index);
      data.game = null;
      Progress.save(data);
      launch();
      showScreen('game');
    }
    if (!cur || untouched(cur)) return go();
    showModal('하던 판은 실패로 기록됩니다.\n' + C.GRADES[index].name + ' 등급으로 바꿀까요?\n(승급 미션 진행은 등급마다 그대로 남아요)', '바꾸기', '아니요', function () {
      abandon(cur, go);
    });
  }

  /* ---------------- 오늘의 퍼즐 ---------------- */
  /* "오늘의 퍼즐" 단추 : 승급전 ↔ 오늘의 퍼즐을 오갑니다 */
  function pressDaily() {
    if (ending) return;
    if (isDaily()) return leaveDaily();
    openStairs();
  }

  /* 오늘 이어서 할 단계 판이 있는가? (하던 판이 있으면 그 판, 없으면 오늘 오른 단계 + 1 판) */
  function dailyLive(today) {
    var stage = Progress.stairs(data, today) + 1;
    if (isDaily() && game.status === 'playing' && game.daily === today) return true;
    var g = data.dailyGame;
    return Game.isValidSaved(g) && g.daily === today && (g.stage || stage) === stage;
  }

  /* 오늘의 퍼즐 : 오늘 오른 단계 + 1 단계 판을 엽니다 (밤 12시가 지나면 1단계부터) */
  function startDaily(today) {
    S.Effects.stop();
    $('result').hidden = true;
    var stage = Progress.stairs(data, today) + 1;
    var saved = data.dailyGame;
    if (Game.isValidSaved(saved) && saved.daily === today && (saved.stage || stage) === stage) {
      saved.stage = stage;
      beginGame(saved);
    } else {
      beginGame(Game.createDaily(today, stage));
    }
    persist();
  }

  /* ---------------- 오늘의 퍼즐 창 : 달력 + 계단 ---------------- */
  var calMonth = ''; // 달력에 보이는 달 '2026-11'
  var stairsDay = ''; // 창을 그린 날짜 (밤 12시가 지나면 다시 그림)
  var stairsTimer = 0;
  var CROWN = {
    bronze: ['#e09a5f', '#9c5a2b'],
    silver: ['#dfe5ec', '#8d98a5'],
    gold: ['#ffd23f', '#c98a00']
  };
  function crownSvg(tier) {
    var c = CROWN[tier] || CROWN.gold;
    return '<svg viewBox="0 0 32 26" aria-hidden="true">' +
      '<path d="M3 8.5l7 6 6-11.5 6 11.5 7-6-2.6 13H5.6Z" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="5" y="20.5" width="22" height="4" rx="1.4" fill="' + c[1] + '"/>' +
      '<circle cx="16" cy="3" r="2.2" fill="' + c[1] + '"/><circle cx="3" cy="8" r="1.9" fill="' + c[1] + '"/><circle cx="29" cy="8" r="1.9" fill="' + c[1] + '"/>' +
      '<circle cx="16" cy="15" r="2" fill="#fff" opacity="0.8"/></svg>';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthStep(mk, n) {
    var p = mk.split('-'), y = +p[0], m = +p[1] + n;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return y + '-' + pad2(m);
  }
  /* 달력을 거슬러 볼 수 있는 가장 앞 달 (기록이 있는 첫 달) */
  function firstMonth(today) {
    var first = today.slice(0, 7), days = data.daily.days || {};
    for (var k in days) if (k.slice(0, 7) < first) first = k.slice(0, 7);
    return first;
  }

  function openStairs() {
    calMonth = Progress.dateKey().slice(0, 7);
    renderStairs();
    $('stairs').hidden = false;
    window.clearInterval(stairsTimer);
    stairsTimer = window.setInterval(tickStairs, 1000);
    $('stairs').querySelector('.stairs-box').scrollTop = 0;
    try { $('stairs-go').focus({ preventScroll: true }); } catch (e) { /* 예전 브라우저 */ }
  }
  function closeStairs() {
    $('stairs').hidden = true;
    window.clearInterval(stairsTimer);
    lastTick = Date.now();
    if (screen === 'home') renderHome();
    if (screen === 'game') renderGame();
  }
  function tickStairs() {
    var today = Progress.dateKey();
    if (today !== stairsDay) {
      if (calMonth === stairsDay.slice(0, 7)) calMonth = today.slice(0, 7);
      return renderStairs();
    }
    var now = new Date();
    var left = Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now) / 1000));
    $('stairs-reset').textContent = '밤 12시에 1단계부터 다시 · ' +
      Math.floor(left / 3600) + ':' + pad2(Math.floor((left % 3600) / 60)) + ':' + pad2(left % 60) + ' 남음';
  }

  function renderStairs() {
    var today = Progress.dateKey();
    stairsDay = today;
    var n = Progress.stairs(data, today);
    var every = Math.max(1, C.DAILY.bonusEvery || 5);
    var hints = C.DAILY.bonusHints || 0;
    // 계단 : 지금 오르는 구간의 5칸 (마지막 칸에 선물)
    var start = Math.floor(n / every) * every;
    var box = $('stairs-steps');
    box.innerHTML = '';
    for (var i = 1; i <= every; i++) {
      var stage = start + i;
      var st = document.createElement('div');
      st.className = 'step' + (stage <= n ? ' on' : stage === n + 1 ? ' now' : '');
      st.style.height = Math.round(28 + (i - 1) * (72 / Math.max(1, every - 1))) + '%';
      st.textContent = stage;
      if (stage === n + 1) {
        var me = document.createElement('span');
        me.className = 'step-me';
        me.textContent = '🐾';
        st.appendChild(me);
      }
      if (i === every) {
        var gift = document.createElement('span');
        gift.className = 'step-gift';
        gift.textContent = '🎁 💡' + hints;
        st.appendChild(gift);
      }
      box.appendChild(st);
    }
    var info = $('stairs-info');
    info.innerHTML = '';
    var left = Progress.stairsToBonus(n);
    if (n) {
      info.appendChild(document.createTextNode('오늘 '));
      var em = document.createElement('em');
      em.textContent = n + '단계';
      info.appendChild(em);
      info.appendChild(document.createTextNode('까지 올랐어요\n'));
    } else {
      info.appendChild(document.createTextNode('깰 때마다 같은 난이도의 다음 단계가 나와요\n'));
    }
    info.appendChild(document.createTextNode(left + '단계 더 오르면 💡 힌트 ' + hints + '개'));
    $('stairs-go').textContent = (n + 1) + '단계 ' + (dailyLive(today) ? '이어서 하기' : '도전');
    renderCalendar(today);
    tickStairs();
  }

  function renderCalendar(today) {
    var thisMonth = today.slice(0, 7);
    var p = calMonth.split('-'), y = +p[0], m = +p[1];
    $('cal-month').textContent = y + '년 ' + m + '월';
    $('cal-prev').disabled = calMonth <= firstMonth(today);
    $('cal-next').disabled = calMonth >= thisMonth;
    // 날짜 칸
    var grid = $('cal-grid');
    grid.innerHTML = '';
    var lead = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate();
    for (var b = 0; b < lead; b++) grid.appendChild(document.createElement('li'));
    for (var d = 1; d <= last; d++) {
      var key = calMonth + '-' + pad2(d);
      var v = Progress.dayStairs(data, key);
      var li = document.createElement('li');
      li.className = 'cal-d' + (v ? ' played' : '') + (key === today ? ' today' : '') + (key > today ? ' future' : '');
      var num = document.createElement('b');
      num.textContent = d;
      li.appendChild(num);
      if (v) {
        var sm = document.createElement('small');
        sm.textContent = v;
        li.appendChild(sm);
        li.setAttribute('aria-label', m + '월 ' + d + '일 ' + v + '단계');
      }
      grid.appendChild(li);
    }
    // 목표 막대와 왕관
    var goals = C.DAILY_MONTH_GOALS || [];
    var top = goals.length ? Progress.goalDays(goals[goals.length - 1], calMonth) : 30;
    var count = Progress.monthDays(data, calMonth), level = Progress.monthCrown(data, calMonth);
    $('cal-fill').style.width = Math.min(100, (count / top) * 100) + '%';
    var goal = $('cal-goal');
    var old = goal.querySelectorAll('.cal-mark');
    for (var o = 0; o < old.length; o++) goal.removeChild(old[o]);
    goals.forEach(function (g, i) {
      var mk = document.createElement('span');
      mk.className = 'cal-mark' + (level > i ? ' got' : '');
      var gd = Progress.goalDays(g, calMonth);
      mk.style.left = (gd / top) * 100 + '%';
      mk.innerHTML = crownSvg(g.crown) + '<b>' + gd + '</b>';
      goal.appendChild(mk);
    });
    var t = $('cal-goal-t');
    t.innerHTML = '';
    var next = null;
    for (var gi = 0; gi < goals.length; gi++) if (count < Progress.goalDays(goals[gi], calMonth)) { next = goals[gi]; break; }
    t.appendChild(document.createTextNode((calMonth === thisMonth ? '이번 달 ' : m + '월에 ') + count + '일 했어요'));
    if (calMonth === thisMonth && next) {
      t.appendChild(document.createTextNode('\n' + (Progress.goalDays(next, calMonth) - count) + '일 더 하면 '));
      var bb = document.createElement('b');
      bb.textContent = next.name + '왕관 + 💡 힌트 ' + next.hints + '개';
      t.appendChild(bb);
    } else if (level) {
      t.appendChild(document.createTextNode(' · ' + goals[level - 1].name + '왕관을 받았어요'));
    }
    // 지금까지 받은 왕관
    var cc = Progress.crownCounts(data);
    var cr = $('cal-crowns');
    cr.innerHTML = '';
    cr.appendChild(document.createTextNode('내 왕관'));
    [['gold', 2], ['silver', 1], ['bronze', 0]].forEach(function (x) {
      var sp = document.createElement('span');
      sp.innerHTML = crownSvg(x[0]);
      sp.appendChild(document.createTextNode(String(cc[x[1]])));
      cr.appendChild(sp);
    });
    var go = document.createElement('em');
    go.textContent = '진열장 ›';
    cr.appendChild(go);
  }

  /* ---------------- 왕관 진열장 ---------------- */
  var crownYear = 0;
  // 등급(0 없음 · 1 동 · 2 은 · 3 금)별 색 : 몸통, 테두리, 띠, 보석
  var CROWN_TONE = [
    { body: '#f4f6f9', edge: '#c3cbd5', band: '#e2e7ee', gems: ['#d3d9e1'] },
    { body: '#e6a46e', edge: '#8f5326', band: '#bf7a43', gems: ['#fff1de', '#3c9a64', '#2f7bd6'] },
    { body: '#e9eef3', edge: '#7c8896', band: '#c3ccd6', gems: ['#2f7bd6', '#e5533d', '#7c4dcc'] },
    { body: '#ffd54a', edge: '#ad7a00', band: '#f0b000', gems: ['#e5533d', '#2f7bd6', '#2f9e5b'] }
  ];
  var CROWN_POINTS = [3, 5, 4, 7, 5, 3, 6, 4, 5, 3, 7, 5]; // 달마다 뾰족한 끝의 수
  /*
   * 달마다 모양이 다른 왕관 그림 (받침대 위에 놓임)
   *   m : 0~11 (1월~12월),  level : 0~3,  label : 받침대 글씨 ('2/30')
   */
  function crownArt(m, level, label) {
    var t = CROWN_TONE[level] || CROWN_TONE[0];
    var n = CROWN_POINTS[m % 12], tip = m % 3, jewel = Math.floor(m / 3) % 4, round = m % 2 === 1;
    var left = 14, right = 66, base = 46, out = [];
    var xs = [], ys = [];
    for (var i = 0; i < n; i++) {
      var off = n > 1 ? Math.abs(i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      xs.push(left + (i * (right - left)) / (n - 1));
      ys.push(14 + off * 9);
    }
    // 몸통 : 끝과 끝 사이가 파이거나(뾰족) 둥글게 파임
    var d = 'M' + left + ' ' + base + ' L' + xs[0] + ' ' + ys[0];
    for (var k = 1; k < n; k++) {
      var mx = (xs[k - 1] + xs[k]) / 2;
      if (round) d += ' Q' + mx + ' ' + (base + 2) + ' ' + xs[k] + ' ' + ys[k];
      else d += ' L' + mx + ' 35 L' + xs[k] + ' ' + ys[k];
    }
    d += ' L' + right + ' ' + base + ' Z';
    out.push('<path d="' + d + '" fill="' + t.body + '" stroke="' + t.edge + '" stroke-width="2" stroke-linejoin="round"/>');
    out.push('<path d="M' + (left + 4) + ' 42 L' + (xs[0] + 2) + ' ' + (ys[0] + 8) + '" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>');
    // 끝 장식 : 구슬 · 마름모 · 별
    for (var q = 0; q < n; q++) {
      var x = xs[q], y = ys[q] - 3, g = t.gems[q % t.gems.length];
      if (tip === 0) out.push('<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="' + g + '" stroke="' + t.edge + '" stroke-width="1.4"/>');
      else if (tip === 1) out.push('<path d="M' + x + ' ' + (y - 4.5) + 'l3.5 4.5-3.5 4.5-3.5-4.5Z" fill="' + g + '" stroke="' + t.edge + '" stroke-width="1.3" stroke-linejoin="round"/>');
      else out.push('<path d="M' + x + ' ' + (y - 5) + 'l1.5 3.2 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4Z" fill="' + g + '" stroke="' + t.edge + '" stroke-width="1.1" stroke-linejoin="round"/>');
    }
    // 띠와 보석
    out.push('<rect x="11" y="' + base + '" width="58" height="10" rx="2.5" fill="' + t.band + '" stroke="' + t.edge + '" stroke-width="2"/>');
    var cy = base + 5;
    if (jewel === 0) {
      for (var a = 0; a < 5; a++) out.push('<circle cx="' + (20 + a * 10) + '" cy="' + cy + '" r="2.4" fill="' + t.gems[a % t.gems.length] + '"/>');
    } else if (jewel === 1) {
      out.push('<ellipse cx="40" cy="' + cy + '" rx="6" ry="4" fill="' + t.gems[0] + '" stroke="' + t.edge + '" stroke-width="1.2"/>');
      out.push('<circle cx="24" cy="' + cy + '" r="2.4" fill="' + t.gems[1 % t.gems.length] + '"/><circle cx="56" cy="' + cy + '" r="2.4" fill="' + t.gems[1 % t.gems.length] + '"/>');
    } else if (jewel === 2) {
      for (var b2 = 0; b2 < 4; b2++) out.push('<path d="M' + (22 + b2 * 12) + ' ' + (cy - 3.5) + 'l3 3.5-3 3.5-3-3.5Z" fill="' + t.gems[b2 % t.gems.length] + '"/>');
    } else {
      out.push('<path d="M14 ' + (cy - 2) + 'H66M14 ' + (cy + 2) + 'H66" stroke="' + t.edge + '" stroke-width="1.2" opacity="0.6"/>');
      out.push('<circle cx="40" cy="' + cy + '" r="3.2" fill="' + t.gems[0] + '" stroke="' + t.edge + '" stroke-width="1"/>');
    }
    // 받침대
    out.push('<path d="M16 62h48l-3 5H19Z" fill="#dfe4ea" stroke="#b9c2cc" stroke-width="1.2"/>');
    out.push('<rect x="20" y="67" width="40" height="15" rx="2" fill="#eef1f5" stroke="#b9c2cc" stroke-width="1.2"/>');
    out.push('<text x="40" y="78.5" text-anchor="middle" font-size="9.5" font-weight="800" fill="#3b4656">' + label + '</text>');
    return '<svg viewBox="0 0 80 84" aria-hidden="true">' + out.join('') + '</svg>';
  }

  function renderCrowns() {
    var today = Progress.dateKey();
    var thisYear = Number(today.slice(0, 4)), thisMonth = Number(today.slice(5, 7));
    var firstYear = Number(firstMonth(today).slice(0, 4));
    if (crownYear > thisYear) crownYear = thisYear;
    if (crownYear < firstYear) crownYear = firstYear;
    $('crown-year').textContent = crownYear + '년';
    $('crown-prev').disabled = crownYear <= firstYear;
    $('crown-next').disabled = crownYear >= thisYear;
    var goals = C.DAILY_MONTH_GOALS || [];
    var shelf = $('crown-shelf');
    shelf.innerHTML = '';
    var last = crownYear === thisYear ? thisMonth : 12, got = 0;
    for (var m = last; m >= 1; m--) {
      var mk = crownYear + '-' + pad2(m);
      var days = new Date(crownYear, m, 0).getDate();
      var count = Progress.monthDays(data, mk), level = Progress.monthCrown(data, mk);
      if (level) got++;
      var li = document.createElement('li');
      li.className = 'crown-item' + (level ? ' got lv' + level : '') + (mk === today.slice(0, 7) ? ' now' : '');
      li.innerHTML = crownArt(m - 1, level, count + '/' + days);
      var cap = document.createElement('span');
      cap.className = 'crown-cap';
      cap.textContent = m + '월' + (level ? ' · ' + goals[level - 1].name + '왕관' : '');
      li.appendChild(cap);
      li.setAttribute('aria-label', crownYear + '년 ' + m + '월 ' + count + '일' + (level ? ', ' + goals[level - 1].name + '왕관' : ''));
      shelf.appendChild(li);
    }
    var cc = Progress.crownCounts(data);
    $('crown-sum').textContent = crownYear + '년에 받은 왕관 ' + got + '개 · 모두 금 ' + cc[2] + ' · 은 ' + cc[1] + ' · 동 ' + cc[0];
  }

  /* 창의 "N단계 도전" 단추 */
  function pressStairsGo() {
    var today = Progress.dateKey();
    closeStairs();
    if (isDaily() && game.status === 'playing' && game.daily === today) return showScreen('game');
    persist(); // 하던 승급전 판은 그대로 두었다가, 돌아오면 이어서 합니다
    startDaily(today);
    showScreen('game');
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
    if (game.status !== 'won') data.dailyGame = null; // 실패한 단계 : 같은 판을 처음부터 다시
    startDaily(Progress.dateKey()); // 깼으면 다음 단계 (밤 12시가 지났으면 1단계)
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
      b.appendChild(document.createTextNode(k));
      var left = document.createElement('span'); // 이 숫자가 더 들어갈 칸 수 (오른쪽 위 작은 숫자)
      left.className = 'left';
      left.setAttribute('aria-hidden', 'true');
      b.appendChild(left);
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

    // 마지막 한 칸만 남으면 그 칸이 은은하게 깜박입니다
    var lastOne = -1;
    if (game.status === 'playing' && !ending) {
      var miss = 0;
      for (var q = 0; q < n * n; q++) {
        if (game.cells[q] !== game.solution[q]) { miss++; lastOne = q; }
      }
      if (miss !== 1) lastOne = -1;
    }

    for (var idx = 0; idx < n * n; idx++) {
      var el = cellEls[idx];
      var v = game.cells[idx];
      var cls = el.getAttribute('data-base');
      if (idx === lastOne) cls += ' last-one';
      var wrong = v !== 0 && v !== game.solution[idx];
      if (game.hinted[idx]) cls += ' hinted';
      else if (!game.fixed[idx] && v !== 0) cls += ' user';
      if (wrong) cls += ' wrong';
      if (peerSet[idx]) cls += ' peer';
      if (showSame && hl && v === hl) cls += ' same';
      if (dupSet[idx]) cls += ' dup';
      if (spotSet[idx] && !v) cls += ' spot';
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
    $('game-score-wrap').classList.toggle('x2', !!game.double);
    $('game-score-wrap').hidden = !Settings.get('showScore');
    // 힌트를 다 쓰면 힌트권 개수를 보여 줍니다
    var tickets = Progress.itemCount(data, 'hint');
    var useTicket = game.hintsLeft <= 0 && tickets > 0;
    $('hint-left').parentNode.firstChild.nodeValue = useTicket ? '힌트권 ' : '힌트 ';
    $('hint-left').textContent = useTicket ? tickets : game.hintsLeft;
    $('btn-hint').classList.toggle('ticket', useTicket);
    $('btn-hint').disabled = !live || (game.hintsLeft <= 0 && tickets <= 0);
    var bag = Progress.itemTotal(data);
    $('bag-count').textContent = bag > 99 ? '99+' : bag;
    $('bag-count').hidden = bag <= 0;
    $('btn-bag').disabled = !live;
    $('btn-undo').disabled = !live || game.history.length === 0;
    $('btn-pause').disabled = !live;

    // 숫자 버튼 : 다 채운 숫자는 흐리게
    for (var k = 1; k <= n; k++) {
      var b = numEls[k - 1];
      b.classList.toggle('on', showSame && hl === k);
      var leftN = Math.max(0, n - Game.placedCount(game, k));
      b.classList.toggle('done', leftN === 0);
      b.disabled = leftN === 0; // 다 채운 숫자는 눌리지 않음 (되돌리기 등으로 빈자리가 생기면 다시 눌림)
      b.querySelector('.left').textContent = leftN > 0 ? leftN : '';
      b.setAttribute('aria-label', k + ', ' + (leftN > 0 ? leftN + '개 남음' : '다 채움'));
    }

    $('game-timer').textContent = formatTime(game.elapsedMs);
    $('game-timer').hidden = !Settings.get('showTimer');
    $('game').classList.toggle('no-hero', !Settings.get('hero'));
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

  /* 판을 깼을 때 : 왼쪽 위에서 오른쪽 아래로 칸이 차례로 뒤집힙니다. 반환 : 걸리는 시간(ms) */
  function flipBoard() {
    var n = game.size, STEP = 45, DUR = 600;
    for (var i = 0; i < n * n; i++) {
      var el = cellEls[i];
      el.style.setProperty('--d', (Math.floor(i / n) + i % n) * STEP + 'ms');
      el.classList.remove('win-flip');
      void el.offsetWidth;
      el.classList.add('win-flip');
    }
    return (n - 1) * 2 * STEP + DUR;
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
    var out = { cells: [], line: false, box: false, groups: [] };
    function add(list, kind) {
      out.cells = out.cells.concat(list);
      out[kind] = true;
      out.groups.push({ els: list.map(function (k) { return cellEls[k]; }), kind: kind });
    }
    if (done(row)) add(row, 'line');
    if (done(col)) add(col, 'line');
    if (done(box)) add(box, 'box');
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
    el.className = 'gain' + (gain >= basePts() * 5 ? ' big' : '');
    el.textContent = '+' + formatScore(gain);
    // 덤 내역 : "7콤보 · 빠른 손"
    if (game.lastParts && game.lastParts.length) {
      var sm = document.createElement('small');
      sm.textContent = game.lastParts.join(' · ');
      el.appendChild(sm);
    }
    el.style.left = (r.left - w.left + r.width / 2) + 'px';
    el.style.top = (r.top - w.top + r.height / 2) + 'px';
    wrap.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 950);
  }

  /* 이번 판의 기본 점수 (큰 점수를 받았을 때 글씨를 키우는 데 씀) */
  function basePts() {
    return C.SCORE.BASE * (game.daily ? C.DAILY.points : game.gradeIndex + 1) * (game.double ? 2 : 1);
  }

  /* 맞는 숫자가 들어간 뒤 : 효과와 응원 메시지 */
  function afterCorrect(idx, byPlayer, hintDelay) {
    if (byPlayer) flash(idx, 'pop');
    else hintAppear(idx, hintDelay || 0);
    var d = game.cells[idx];
    if (Settings.get('unitEffect') && Game.placedCount(game, d) === game.size) {
      var same = [];
      for (var s = 0; s < game.cells.length; s++) if (game.cells[s] === d) same.push(cellEls[s]);
      window.setTimeout(function () {
        S.Effects.numberDone($('board').parentNode, same, numEls[d - 1], $('numpad'));
      }, hintDelay || 0);
    }
    var units = completedUnits(idx);
    if (units.cells.length && Settings.get('unitEffect')) {
      wave(units.cells, idx);
      S.Effects.unitDone($('board').parentNode, units.groups);
    }
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

  /* 힌트 숫자 : 반짝이 가루가 도착하면(delay 뒤) 숫자가 빛나며 나타납니다 */
  function hintAppear(idx, delay) {
    var el = cellEls[idx];
    if (!el) return;
    el.style.setProperty('--hd', delay + 'ms');
    flash(idx, 'hint-in');
    window.setTimeout(function () {
      S.Effects.cellSparkle($('board').parentNode, el, 'box');
    }, delay + 120);
  }

  /* 틀렸을 때 : 붉은 고리, 판 흔들림, 겹치는 숫자 깜박임, 틀림 표시 톡 */
  function wrongEffect(idx, d) {
    var marks = $('game-marks').children;
    if (marks[game.mistakes - 1]) S.Effects.restart(marks[game.mistakes - 1], 'pop');
    if (!Settings.get('wrongEffect')) return;
    var conflicts = [];
    var p = Engine.peers(game, idx);
    for (var i = 0; i < p.length; i++) if (game.cells[p[i]] === d) conflicts.push(cellEls[p[i]]);
    S.Effects.wrong($('board').parentNode, $('board'), cellEls[idx], conflicts);
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
    if (!game || game.status !== 'playing' || paused || document.hidden || overlayOpen() || screen !== 'game') return;
    // 화면이 꺼져 있던 시간은 세지 않습니다
    game.elapsedMs += Math.min(delta, 1000);
    $('game-timer').textContent = formatTime(game.elapsedMs);
    if (now - lastSave > 5000) persist();
  }

  var coverTimer = 0;
  function setPaused(on) {
    paused = on;
    var cover = $('pause-cover');
    window.clearTimeout(coverTimer);
    cover.classList.remove('leaving');
    if (on || cover.hidden || S.Effects.reduced()) {
      cover.hidden = !on;
    } else {
      // 막을 위로 걷어 올리고, 판이 흐릿한 데서 또렷하게 돌아옵니다
      cover.classList.add('leaving');
      S.Effects.restart($('board'), 'fx-reveal');
      coverTimer = window.setTimeout(function () {
        cover.classList.remove('leaving');
        cover.hidden = true;
      }, 380);
    }
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
    if (Game.placedCount(game, d) >= game.size) return; // 다 채운 숫자 (키보드로 눌러도 무시)
    if (magnifyPick) {
      magnifyPick = false;
      return applyMagnify(d);
    }
    clearSpots();
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
      wrongEffect(sel, d);
      if (Settings.get('vibrate') && navigator.vibrate) navigator.vibrate(80);
      S.Sound.play('wrong');
      if (game.status === 'playing') S.Hero.react(game.mistakes >= C.MAX_MISTAKES - 1 ? 'wrong2' : 'wrong1', 1800);
    } else {
      floatGain(sel, game.lastGain);
      if (game.status === 'playing') {
        // 효과음 : 상자 완성 > 줄 완성 > 그냥 맞힘 (연속으로 맞힐수록 음이 올라감)
        var done = completedUnits(sel);
        if (done.box) S.Sound.play('box');
        else if (done.line) S.Sound.play('line');
        else S.Sound.play('correct', game.streak);
        afterCorrect(sel, true);
        // 캐릭터 : 상자 > 줄 > 연속 5번 이상(자신만만) > 그냥 맞힘
        if (done.box) S.Hero.react('box', 1800);
        else if (done.line) S.Hero.react('unit', 1600);
        else S.Hero.react(game.streak >= 5 ? 'combo' : 'correct', 1200);
        // 틀리지 않고 5번, 10번, 15번… 이어서 맞히면 "5연속!"
        if (game.streak >= 5 && game.streak % 5 === 0 && Settings.get('cheer')) {
          S.Effects.combo($('board').parentNode, game.streak);
        }
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

  /* 힌트 : 3번을 다 쓰면 힌트권(아이템)을 씁니다 */
  function pressHint() {
    if (!playing()) return;
    var ticket = game.hintsLeft <= 0;
    if (ticket && Progress.itemCount(data, 'hint') <= 0) return;
    var target = Game.hint(game, sel, Settings.get('autoNotes'), ticket);
    if (target < 0) return;
    if (ticket) {
      Progress.useItem(data, 'hint');
      toast('💡 힌트권 1장을 썼어요');
    }
    S.Sound.play('hint');
    if (game.status === 'playing') S.Hero.react('hint', 1400);
    sel = target;
    hl = game.cells[target];
    persist();
    renderGame();
    var flyMs = S.Effects.fly($('btn-hint'), cellEls[target], ['✨', '⭐'], 5);
    if (game.status === 'playing') afterCorrect(target, false, flyMs);
    else {
      hintAppear(target, flyMs);
      finishGame(target);
    }
  }

  /* ---------------- 한 판 끝 ---------------- */
  function finishGame(lastIdx) {
    if (ending) return;
    ending = true;
    stopTimer();
    hideToast();
    clearSpots();
    magnifyPick = false;
    var won = game.status === 'won';
    S.Sound.play(won ? 'win' : 'lose');
    if (!won && Settings.get('wrongEffect')) S.Effects.lose($('board').parentNode, $('board'));
    S.Hero.react(won ? 'win' : 'lose', 0); // 이기면 기쁨, 지면 울음 (다음 판까지 그대로)
    // 되살리기권이 있으면 이어서 할지 먼저 물어봅니다
    var reviveLeft = won ? 0 : Progress.itemCount(data, 'revive');
    if (reviveLeft > 0) {
      window.setTimeout(function () {
        showModal('틀린 숫자가 ' + C.MAX_MISTAKES + '번 나왔어요.\n💖 되살리기권을 쓰고\n이어서 할까요?\n(남은 되살리기권 ' + reviveLeft + '장)',
          '이어 하기', '그만하기', reviveGame, function () {
            settleGame(lastIdx, 150);
          });
      }, 1000);
      return;
    }
    settleGame(lastIdx, won ? 450 : 1100);
  }

  /* 되살리기권으로 실패한 판을 이어서 합니다 */
  function reviveGame() {
    if (!game || !Progress.useItem(data, 'revive') || !Game.revive(game)) return;
    ending = false;
    S.Effects.clearBoard($('board'));
    startTimer();
    persist();
    renderGame();
    S.Sound.play('hint');
    S.Effects.restart($('game-marks'), 'fx-heal');
    toast('💖 되살아났어요! 틀림 1번을 지웠어요');
    S.Hero.react('revive', 1800);
  }

  /* 한 판의 결과를 기록하고 결과 창을 띄웁니다 */
  function settleGame(lastIdx, wait) {
    var won = game.status === 'won';
    var fancy = won && Settings.get('winEffect');
    if (fancy) {
      if (S.Effects.reduced()) {
        S.Effects.flowers(3200);
      } else {
        // 칸들이 왼쪽 위부터 차례로 뒤집히며 금빛으로 바뀌고, 다 바뀔 즈음 화면이 번쩍이며 꽃이 휘날립니다
        var flipMs = flipBoard();
        window.setTimeout(function () { S.Effects.flowers(3200); }, Math.max(0, flipMs - 350));
        wait = flipMs + 150;
      }
    }
    var finished = game;
    var seconds = Math.floor(finished.elapsedMs / 1000);
    var before = C.GRADES[data.gradeIndex];
    var res, scoreBefore = data.totalScore;
    if (finished.daily) {
      // 오늘의 퍼즐은 등급에 영향을 주지 않습니다
      res = won ? Progress.recordDaily(data, finished.daily, seconds, finished.score) : {};
      if (won) {
        var up = Progress.recordStair(data, finished.daily); // 한 계단 오름 (5단계마다 힌트, 달력 보상)
        res.stairs = up.stairs;
        res.bonus = up.bonus;
        res.month = up.month;
        S.Ranking.addStairs(data, finished.daily, up.stairs); // 오늘의 계단왕
      }
      data.dailyGame = null;
    } else {
      res = won ? Progress.recordWin(data, seconds, finished.score, finished) : Progress.recordLoss(data, finished.score);
      data.game = null;
    }
    S.Ranking.addScore(data, data.totalScore - scoreBefore); // 이번 주 부지런냥 · 이달의 왕냥이
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
      if (won && res.promoted && !res.replay) showPromo(res.grade);
      else {
        $('btn-again').focus();
      }
    }, wait);
  }

  /* 결과 창의 점수 내역 : 칸 점수(기본 · 콤보 · 빠른 손 …) + 판 완성 보너스 */
  function renderScoreRows(g) {
    var box = $('result-rows');
    box.innerHTML = '';
    box.hidden = !g;
    if (!g) return;
    var t = g.tally || {};
    var rows = [
      ['칸 점수', t.cell], ['연속 콤보', t.combo], ['빠른 손', t.speed], ['줄·상자 완성', t.unit],
      ['숫자 완성', t.number], ['콤보 고비', t.milestone]
    ];
    if (!g.tally) rows = [['칸 점수', g.score - (g.clearBonus || 0)]]; // 예전에 시작한 판
    (g.clearParts || []).forEach(function (p) { rows.push(p); });
    rows.forEach(function (r) {
      if (!r[1]) return;
      var li = document.createElement('li');
      var a = document.createElement('span');
      a.textContent = r[0];
      var b = document.createElement('b');
      b.textContent = '+' + formatScore(r[1]);
      li.appendChild(a);
      li.appendChild(b);
      box.appendChild(li);
    });
    if (g.double) {
      var d = document.createElement('li');
      d.className = 'x2';
      d.textContent = '점수 2배권 적용';
      box.appendChild(d);
    }
  }

  function renderResult(won, finished, before, res) {
    var grade = C.GRADES[data.gradeIndex];
    var next = C.GRADES[data.gradeIndex + 1];
    $('result-mark').textContent = won ? '○' : '×';
    $('result-mark').className = 'result-mark' + (won ? '' : ' fail');
    $('result-title').textContent = won ? '성공!' : '실패';
    $('result-sub').textContent = won
      ? (finished.daily ? '오늘의 퍼즐 ' + (finished.stage || 1) + '단계를 깼어요' : before.name + ' 한 판을 깼어요')
      : '틀린 숫자가 ' + C.MAX_MISTAKES + '번 나왔어요';
    $('result-time').textContent = formatTime(finished.elapsedMs);
    $('result-score').textContent = formatScore(finished.score);

    var detail = '틀린 횟수 ' + finished.mistakes + '번 · 힌트 ' + (C.MAX_HINTS - finished.hintsLeft + (finished.extraHints || 0)) + '번 사용';
    if (finished.itemsUsed) detail += '\n아이템 ' + finished.itemsUsed + '개 사용';
    if (won && res.newBestScore) detail += '\n최고 점수!';
    if (won && res.newBest) detail += (res.newBestScore ? ' · ' : '\n') + '가장 빠른 기록!';
    $('result-detail').textContent = detail;
    renderScoreRows(won ? finished : null);

    var msg;
    if (finished.daily) {
      var lines = [];
      if (won) {
        if (res.first) lines.push((res.guarded ? '🛡️ 보호권 ' + res.guarded + '장으로 연속 기록을 지켰어요\n' : '') + '오늘의 퍼즐 연속 ' + res.streak + '일째!');
        if (res.month) lines.push('👑 이번 달 ' + res.month.days + '일 달성!\n' + res.month.goal.name + '왕관과 💡 힌트 ' + res.month.hints + '개를 받았어요');
        if (res.bonus) lines.push('🎁 ' + res.stairs + '단계 돌파! 💡 힌트 ' + res.bonus + '개를 받았어요');
        else lines.push('다음 선물까지 ' + Progress.stairsToBonus(res.stairs) + '단계');
        if (res.bonus || res.month) S.Sound.play('hint');
      } else {
        lines.push('등급에는 영향이 없어요\n같은 단계를 다시 도전할 수 있어요');
      }
      $('result-progress').textContent = lines.join('\n');
      // 선물까지의 계단 동그라미
      var dots = $('result-dots');
      dots.innerHTML = '';
      var every = Math.max(1, C.DAILY.bonusEvery || 5);
      var n = Progress.stairs(data, finished.daily);
      var on = n && n % every === 0 ? every : n % every;
      for (var di = 0; di < every; di++) {
        var dot = document.createElement('span');
        dot.className = 'dot' + (di < on ? ' on' : '');
        dots.appendChild(dot);
      }
      $('btn-again').textContent = won ? (n + 1) + '단계 도전' : '다시 도전';
      return;
    }
    $('btn-again').textContent = '다시 하기';
    if (won) {
      if (res.promoted && res.replay) msg = '미션 완료! ' + grade.name + '(으)로 돌아왔어요';
      else if (res.promoted) msg = '축! ' + grade.name + ' 승급!';
      else msg = progressText();
    } else if (res.demoted) {
      msg = '연속 ' + C.FAILS_TO_DEMOTE + '번 실패해서\n' + grade.name + '(으)로 내려왔어요.\n다시 올라가 봐요!';
    } else if (data.gradeIndex === 0) {
      msg = '괜찮아요, ' + grade.name + ' 밑으로는 내려가지 않아요';
    } else if (data.gradeIndex < data.reach) {
      msg = '골라서 하는 낮은 등급이라 내려가지 않아요';
    } else {
      msg = '연속 실패 ' + data.failStreak + '번\n' + C.FAILS_TO_DEMOTE + '번이면 한 단계 내려가요';
      if (Progress.missions(data).some(function (m) { return m.type === 'streak' && !m.done; })) msg += '\n연달아 깨기 미션은 처음부터 다시 세요';
    }
    $('result-progress').textContent = msg;
    if (next) renderDots($('result-dots'));
    else $('result-dots').innerHTML = '';
  }

  /* 따라 하기 (js/tutorial.js) : 끝나면 하던 판으로 돌아옵니다 */
  function openTutorial() {
    if (paused) setPaused(false);
    S.Tutorial.open(function () {
      lastTick = Date.now();
      window.setTimeout(maybeAttend, 300); // 처음 온 사람은 따라 하기를 마친 뒤 출석 창
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
    list.forEach(function (b, i) {
      var row = document.createElement('p');
      row.className = 'new-badge';
      row.style.setProperty('--i', i);
      // 배지가 빙글 돌며 날아와 자리를 잡으면 반짝 (css 의 badge-spin : 0.35초 + 하나에 0.3초씩 늦게, 0.8초 동안)
      window.setTimeout(function () {
        if ($('result').hidden || !row.parentNode) return;
        S.Effects.cellSparkle(box, row.querySelector('.badge-icon'), 'box');
        S.Sound.play('line');
      }, 350 + i * 300 + 700);
      var icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.textContent = b.icon;
      var name = document.createElement('b');
      name.textContent = b.name;
      var t = S.Badges.tierOf(b);
      var tag = document.createElement('span');
      tag.className = 'tier-tag';
      tag.style.setProperty('--tier', t.color);
      tag.textContent = t.name;
      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(tag);
      box.appendChild(row);
    });
  }

  /* 승급 축하 창 : 맨 위 감탄 한마디(그때그때 하나), 동그라미에는 올라간 등급의 고양이 */
  var CHEERS = ['대단해요!', '멋져요!', '최고예요!', '해냈어요!', '와아, 굉장해요!', '훌륭해요!', '브라보!', '놀라워요!'];
  function showPromo(grade) {
    $('promo-cheer').textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    var col = typeof grade.char === 'number' ? grade.char : C.GRADES.indexOf(grade);
    var face = $('promo-face');
    face.style.backgroundPosition = (col / 13) * 100 + '% 20%'; // 14칸 중 col 번째, 6줄 중 2번째(기쁨)
    face.setAttribute('aria-label', grade.name + ' 고양이');
    $('promo-badge').style.setProperty('--grade', grade.color);
    $('promo-text').textContent = grade.name + ' 승급!';
    $('promo').hidden = false;
    S.Sound.play('promo');
    S.Effects.confetti(3500);
    // 등급 이름이 도장처럼 쾅 찍히는 순간(css 의 promo-text) 화면이 번쩍이고 반짝이가 터집니다
    window.setTimeout(function () {
      if ($('promo').hidden) return;
      S.Effects.screenFlash();
      var stage = $('promo-stage'), r = stage.getBoundingClientRect();
      S.Effects.sparks(stage, r.width / 2, r.height / 2, 26, Math.min(r.width, 320) * 0.5, 'box');
    }, 600);
    $('btn-promo-ok').focus();
  }

  /* ---------------- 아이템 ---------------- */
  function itemInfo(id) {
    for (var i = 0; i < C.ITEMS.length; i++) if (C.ITEMS[i].id === id) return C.ITEMS[i];
    return null;
  }

  /* 지금 이 아이템을 쓸 수 없는 까닭 (쓸 수 있으면 빈 글자) */
  function itemBlock(id) {
    if (screen !== 'game' || !game || game.status !== 'playing') return '게임 중에 쓸 수 있어요';
    if (id === 'hint' && game.hintsLeft > 0) return '기본 힌트 ' + game.hintsLeft + '번을 먼저 써요';
    if (id === 'time' && game.elapsedMs < 1000) return '아직 줄일 시간이 없어요';
    if (id === 'shield' && game.mistakes <= 0) return '틀린 횟수가 없어요';
    if (id === 'double' && game.double) return '이번 판에 이미 쓰고 있어요';
    if (id === 'magnify' && magnifyPick) return '찾을 숫자를 누르세요';
    return '';
  }

  function renderItems() {
    var box = $('items-body');
    box.innerHTML = '';
    var inGame = screen === 'game' && game && game.status === 'playing';
    C.ITEMS.forEach(function (it) {
      var n = Progress.itemCount(data, it.id);
      var row = document.createElement('div');
      row.className = 'item-row' + (n ? '' : ' empty');
      var icon = document.createElement('span');
      icon.className = 'item-icon';
      icon.textContent = it.icon;
      icon.setAttribute('aria-hidden', 'true');
      var text = document.createElement('span');
      text.className = 'item-text';
      var name = document.createElement('b');
      name.textContent = it.name;
      var cnt = document.createElement('em');
      cnt.className = 'item-count';
      cnt.textContent = '× ' + n; // 줄이 바뀌어도 × 와 숫자가 떨어지지 않게
      name.appendChild(cnt);
      var desc = document.createElement('span');
      desc.textContent = it.id === 'time' ? '걸린 시간을 ' + C.TIME_ITEM_SEC + '초 줄여요' : it.desc;
      text.appendChild(name);
      text.appendChild(desc);
      row.appendChild(icon);
      row.appendChild(text);
      if (it.auto) {
        var tag = document.createElement('span');
        tag.className = 'item-auto';
        tag.textContent = it.autoText || '저절로';
        row.appendChild(tag);
      }
      // 별로 사기 (값이 정해진 아이템만)
      var cost = C.SHOP_ENABLED ? S.Shop.price(it.id) : 0;
      if (cost) {
        var buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'item-buy';
        buy.setAttribute('data-buy', it.id);
        buy.setAttribute('aria-label', it.name + ' 사기, 별 ' + cost + '개');
        buy.innerHTML = '<small>사기</small>⭐' + cost;
        row.appendChild(buy);
      }
      if (!it.auto && inGame) {
        var why = n <= 0 ? '' : itemBlock(it.id);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item-use';
        btn.setAttribute('data-item', it.id);
        btn.disabled = n <= 0 || !!why;
        btn.textContent = '쓰기';
        row.appendChild(btn);
        if (why) {
          var w = document.createElement('small');
          w.className = 'item-why';
          w.textContent = why;
          text.appendChild(w);
        }
      }
      box.appendChild(row);
    });
    $('items-stars').textContent = formatScore(Progress.stars(data));
    $('items-starbar').hidden = !C.SHOP_ENABLED;
    $('items-title').textContent = C.SHOP_ENABLED ? '아이템 · 상점' : '내 아이템';
    var shop = C.SHOP_ENABLED;
    $('items-note').textContent = inGame
      ? (shop ? '별로 아이템을 살 수 있어요. ' : '') + '출석 체크로 매일 아이템을 받을 수 있어요.'
      : '아이템은 게임 화면의 🎒 단추를 눌러 쓸 수 있어요. ' + (shop ? '별로 사거나, ' : '') + '출석 체크로 매일 받을 수 있어요.';
  }

  /* 별로 아이템 한 개 사기 */
  function buyItemPress(id) {
    if (!C.SHOP_ENABLED) return;
    var it = itemInfo(id);
    var res = S.Shop.buyItem(data, id);
    if (!res.ok) {
      if (res.reason === 'stars') {
        showModal('별이 ' + res.need + '개 모자라요.\n별을 충전할까요?', '별 충전', '아니요', function () {
          openSheet('stars');
        });
      }
      return;
    }
    persist();
    S.Sound.play('memoOn');
    var from = document.querySelector('#items-body [data-buy="' + id + '"]');
    S.Effects.fly(from, visibleBag(), it.icon, 1);
    renderItems();
    renderHome();
    appToast(it.icon + ' ' + it.name + ' 1개를 샀어요 (⭐' + res.price + ')');
  }

  /* 별 충전 창 */
  function renderStars() {
    $('stars-have').textContent = formatScore(Progress.stars(data));
    var box = $('stars-body');
    box.innerHTML = '';
    (C.STAR_PACKS || []).forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pack';
      b.setAttribute('data-pack', p.id);
      var amt = document.createElement('span');
      amt.className = 'pack-stars';
      amt.textContent = '⭐ ' + formatScore(p.stars);
      if (p.tag) {
        var tag = document.createElement('em');
        tag.className = 'pack-tag';
        tag.textContent = p.tag;
        amt.appendChild(tag);
      }
      var price = document.createElement('span');
      price.className = 'pack-price';
      price.textContent = p.price;
      b.appendChild(amt);
      b.appendChild(price);
      box.appendChild(b);
    });
  }
  function buyStarsPress(id) {
    if (!S.Shop.billingReady()) {
      showModal('별 충전은 준비 중이에요.\n곧 플레이스토어 결제로 살 수 있게 할게요!', '확인', '');
      return;
    }
    S.Shop.buyStars(id).then(function () {
      persist();
      S.Effects.fly(document.querySelector('#stars-body [data-pack="' + id + '"]'), $('stars-have'), '⭐', 6);
      renderStars();
      renderHome();
    }).catch(function () {
      appToast('결제를 마치지 못했어요');
    });
  }

  function useItemPress(id) {
    if (!game || game.status !== 'playing' || ending || itemBlock(id) || Progress.itemCount(data, id) <= 0) return;
    closeSheets();
    if (paused) setPaused(false);
    if (id === 'hint') return pressHint();
    if (id === 'magnify') {
      // 숫자 단추를 눌러 둔 상태면 그 숫자를, 아니면 다음에 누르는 숫자를 찾습니다
      if (hl > 0 && Game.placedCount(game, hl) < game.size) return applyMagnify(hl);
      magnifyPick = true;
      return toast('🔍 찾을 숫자 단추를 누르세요', 2200);
    }
    var ok = false;
    if (id === 'time') {
      var cut = Game.cutTime(game, C.TIME_ITEM_SEC * 1000);
      ok = cut > 0;
      if (ok) toast('⏱️ ' + Math.round(cut / 1000) + '초 줄었어요!');
    } else if (id === 'shield') {
      ok = Game.forgive(game);
      if (ok) toast('🩹 틀린 횟수 1번을 지웠어요');
    } else if (id === 'memo') {
      var cnt = Game.autoMemo(game);
      ok = cnt > 0;
      toast(ok ? '✏️ 빈칸 ' + cnt + '곳에 메모했어요' : '이미 메모가 다 되어 있어요');
    } else if (id === 'double') {
      ok = Game.useDouble(game);
      if (ok) toast('✨ 이번 판 점수 2배!');
    }
    if (!ok) return;
    Progress.useItem(data, id);
    S.Sound.play('hint');
    S.Hero.react('item', 1400);
    persist();
    renderGame();
    if (id === 'time') S.Effects.restart($('game-timer'), 'fx-timecut');
    if (id === 'shield') S.Effects.restart($('game-marks'), 'fx-heal');
    if (id === 'double') S.Effects.restart($('game-score-wrap'), 'fx-timecut');
    if (id === 'memo') {
      var all = [];
      for (var i = 0; i < game.cells.length; i++) if (game.cells[i] === 0) all.push(i);
      if (all.length) wave(all, sel >= 0 ? sel : all[0]);
    }
  }

  /* 돋보기 : 숫자 d가 들어갈 수 있는 칸을 몇 초 동안 보여 줍니다 */
  function applyMagnify(d) {
    if (!playing() || Progress.itemCount(data, 'magnify') <= 0) return;
    if (Game.placedCount(game, d) >= game.size) return toast(d + '은(는) 이미 다 채웠어요');
    var list = Game.spots(game, d);
    if (!list.length) return toast('들어갈 자리를 찾지 못했어요');
    Progress.useItem(data, 'magnify');
    game.itemsUsed++;
    persist();
    clearSpots();
    for (var i = 0; i < list.length; i++) spotSet[list[i]] = true;
    hl = d;
    renderGame();
    S.Sound.play('hint');
    S.Hero.react('item', 1400);
    toast('🔍 ' + d + '이(가) 들어갈 수 있는 곳 ' + list.length + '군데');
    spotTimer = window.setTimeout(function () {
      clearSpots();
      renderGame();
    }, 6000);
  }
  function clearSpots() {
    window.clearTimeout(spotTimer);
    spotSet = {};
  }

  /* ---------------- 출석 체크 ---------------- */
  function rewardText(reward, sep) {
    var parts = [];
    for (var id in reward) {
      var it = itemInfo(id);
      if (it) parts.push(it.icon + ' ' + it.name + (reward[id] > 1 ? ' ' + reward[id] + '개' : ''));
    }
    return parts.join(sep || ' · ');
  }
  function rewardIcons(reward) {
    var out = '';
    for (var id in reward) {
      var it = itemInfo(id);
      if (it) out += it.icon;
    }
    return out;
  }

  /* 홈 위쪽 출석 줄 */
  function renderAttendBar(today) {
    var done = Progress.attendDone(data, today);
    var streak = Progress.attendStreak(data, today);
    var slot = Progress.attendSlot(streak);
    $('home-attend').classList.toggle('done', done);
    $('home-attend-sub').textContent = done ? '연속 ' + streak + '일째' : streak + '일째 선물 받기';
    $('home-attend-go').textContent = done ? '완료 ✓' : '받기';
    var days = $('home-attend-days');
    days.innerHTML = '';
    for (var i = 0; i < C.ATTEND_REWARDS.length; i++) {
      var dot = document.createElement('i');
      var got = i < slot || (i === slot && done);
      dot.className = (got ? 'on' : '') + (i === slot && !done ? ' now' : '');
      days.appendChild(dot);
    }
  }

  /* 출석 창을 엽니다. 오늘 출석 전이면 "출석하고 선물 받기" 단추가 나옵니다 */
  function openAttend() {
    renderAttend(false);
    $('attend').hidden = false;
    $('attend-ok').focus();
  }
  function closeAttend() {
    $('attend').hidden = true;
    lastTick = Date.now();
    if (screen === 'home') renderHome();
    if (screen === 'game') renderGame();
  }

  function renderAttend(justGot) {
    var today = Progress.dateKey();
    var done = Progress.attendDone(data, today);
    var streak = Progress.attendStreak(data, today);
    var slot = Progress.attendSlot(streak);
    var last = C.ATTEND_REWARDS.length - 1;
    $('attend-kicker').textContent = done ? (justGot ? '출석 완료!' : '오늘은 출석했어요') : '오늘도 와 주셨네요!';
    var guard = done ? 0 : Progress.attendGuardNeed(data, today);
    $('attend-sub').textContent = done
      ? '연속 ' + streak + '일째 출석 · 내일 또 만나요'
      : guard
        ? '🛡️ 보호권 ' + guard + '장으로 연속 ' + streak + '일째가 이어져요!'
        : (streak > 1 ? '오늘 출석하면 연속 ' + streak + '일째!' : '매일 출석하고 아이템을 받아요');
    var list = $('attend-days');
    list.innerHTML = '';
    C.ATTEND_REWARDS.forEach(function (rw, i) {
      var li = document.createElement('li');
      var got = i < slot || (i === slot && done);
      li.className = 'attend-day' + (got ? ' got' : '') + (i === slot ? ' today' : '') +
        (i === last ? ' big' : '') + (i === slot && justGot ? ' stamp' : '');
      var d = document.createElement('span');
      d.className = 'attend-day-n';
      d.textContent = i === slot ? '오늘' : (i + 1) + '일';
      var ic = document.createElement('span');
      ic.className = 'attend-day-i';
      ic.textContent = i === last ? '🎁' : rewardIcons(rw);
      li.title = rewardText(rw);
      li.setAttribute('aria-label', (i + 1) + '일째 ' + rewardText(rw) + (got ? ', 받음' : ''));
      li.appendChild(d);
      li.appendChild(ic);
      if (got) {
        var ck = document.createElement('span');
        ck.className = 'attend-check';
        ck.textContent = '✓';
        ck.setAttribute('aria-hidden', 'true');
        li.appendChild(ck);
      }
      list.appendChild(li);
    });
    var gotEl = $('attend-got');
    gotEl.hidden = false;
    gotEl.classList.toggle('fresh', !!justGot);
    gotEl.textContent = (done ? '받은 선물 : ' : '오늘 선물 : ') + rewardText(C.ATTEND_REWARDS[slot]);
    $('attend-ok').textContent = done ? (justGot ? '좋아요!' : '확인') : '출석하고 선물 받기';
  }

  function pressAttendOk() {
    var today = Progress.dateKey();
    if (Progress.attendDone(data, today)) return closeAttend();
    var res = Progress.attend(data, today);
    Progress.save(data);
    renderAttend(true);
    if (res && res.guarded) $('attend-kicker').textContent = '🛡️ 보호권 ' + res.guarded + '장으로 연속 출석을 지켰어요!';
    S.Sound.play('line');
    var box = document.querySelector('.attend-box');
    var stamp = document.querySelector('.attend-day.today');
    if (box && stamp) {
      var b = box.getBoundingClientRect(), r = stamp.getBoundingClientRect();
      S.Effects.sparks(box, r.left - b.left + r.width / 2, r.top - b.top + r.height / 2, 16, 70, 'box');
    }
    // 받은 선물이 가방(🎒)으로 날아갑니다
    if (stamp && res && res.reward) {
      var icons = [];
      for (var rid in res.reward) {
        var info = itemInfo(rid);
        for (var k = 0; k < Math.min(res.reward[rid], 3); k++) if (info) icons.push(info.icon);
      }
      if (icons.length) window.setTimeout(function () { S.Effects.fly(stamp, visibleBag(), icons, icons.length); }, 350);
    }
    // 7일을 다 채운 날은 색종이
    if (res && res.streak % C.ATTEND_REWARDS.length === 0) S.Effects.confetti(1500);
    $('attend-ok').focus();
  }

  /* 지금 화면에 보이는 가방 단추 (게임 화면이면 🎒 단추, 아니면 홈 위쪽 가방) */
  function visibleBag() {
    return screen === 'game' ? $('btn-bag') : $('home-bag');
  }

  /* 그날 처음 열었으면 출석 창을 띄웁니다 (다른 창이 떠 있거나 게임 중이면 다음에) */
  function maybeAttend() {
    if (!splashDone || Progress.attendDone(data) || overlayOpen() || screen === 'game') return;
    openAttend();
  }

  /* ---------------- 버튼 연결 ---------------- */
  // 단추를 누르면 누른 자리에서 물결이 퍼지고, 숫자·도구 단추는 아주 짧게 떨립니다
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest ? e.target.closest('.num, .tool, .btn') : null;
    if (!b || b.disabled) return;
    S.Effects.ripple(b, e.clientX, e.clientY);
    if (Settings.get('tapVibrate') && navigator.vibrate && (b.classList.contains('num') || b.classList.contains('tool'))) {
      try { navigator.vibrate(12); } catch (err) { /* 진동이 막힌 기기 */ }
    }
  }, { passive: true });

  $('btn-new').addEventListener('click', pressNew);
  $('btn-again').addEventListener('click', pressAgain);
  $('btn-daily').addEventListener('click', pressDaily);
  $('grade-chip').addEventListener('click', function () {
    if (!isDaily()) openSheet('grades');
  });
  $('btn-result-close').addEventListener('click', function () {
    $('result').hidden = true;
    S.Effects.stop();
    showScreen('home');
  });
  $('btn-home').addEventListener('click', function () {
    showScreen('home');
  });
  $('home-continue').addEventListener('click', homeContinue);
  $('home-new').addEventListener('click', homeNew);
  $('home-daily').addEventListener('click', homeDaily);
  $('home-grade').addEventListener('click', function () {
    openSheet('grades');
  });
  $('btn-pause').addEventListener('click', pressPause);
  $('btn-resume').addEventListener('click', pressPause);
  $('btn-undo').addEventListener('click', pressUndo);
  $('btn-erase').addEventListener('click', pressErase);
  $('btn-memo').addEventListener('click', pressMemo);
  $('btn-hint').addEventListener('click', pressHint);
  $('home-attend').addEventListener('click', openAttend);

  /* 게임 화면 Aa 단추 : 글씨 크기 · 화면 밝기 · 판 색 */
  function renderView() {
    var sk = $('view-skins');
    sk.innerHTML = '';
    var now = S.Skins.current().id;
    S.Skins.LIST.forEach(function (skin) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'view-skin';
      b.setAttribute('data-view-skin', skin.id);
      b.setAttribute('aria-label', skin.name);
      b.setAttribute('aria-pressed', skin.id === now ? 'true' : 'false');
      var sw = skin.swatch || {};
      if (sw.image) b.style.backgroundImage = 'url(' + sw.image + ')';
      else if (sw.cells) b.style.setProperty('--sw', 'linear-gradient(135deg, ' + sw.cells[0] + ' 0 50%, ' + sw.cells[4] + ' 50% 100%)');
      sk.appendChild(b);
    });
    var marks = [['view-theme', 'data-view-theme', Settings.get('theme')], ['view-font', 'data-view-font', Settings.get('fontSize')]];
    marks.forEach(function (m) {
      var bs = $(m[0]).querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute(m[1]) === m[2] ? 'true' : 'false');
    });
  }
  function toggleView(open) {
    var pop = $('view-pop');
    if (open == null) open = pop.hidden;
    if (open) renderView();
    pop.hidden = !open;
    $('btn-view').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  $('btn-view').addEventListener('click', function (e) {
    e.stopPropagation();
    toggleView();
  });
  $('view-pop').addEventListener('click', function (e) {
    e.stopPropagation();
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-view-font')) Settings.setFont(t.getAttribute('data-view-font'));
    else if (t.hasAttribute('data-view-theme')) S.Theme.apply(t.getAttribute('data-view-theme'));
    else if (t.hasAttribute('data-view-skin')) S.Skins.apply(t.getAttribute('data-view-skin'));
    else return;
    S.Sound.play('memoOn');
    renderView();
  });
  document.addEventListener('click', function (e) {
    if (!$('view-pop').hidden && !e.target.closest('#view-pop')) toggleView(false);
  });
  $('stairs-go').addEventListener('click', pressStairsGo);
  $('stairs-close').addEventListener('click', closeStairs);
  $('stairs').addEventListener('click', function (e) {
    if (e.target === $('stairs')) closeStairs();
  });
  $('crown-prev').addEventListener('click', function () {
    crownYear--;
    renderCrowns();
  });
  $('crown-next').addEventListener('click', function () {
    crownYear++;
    renderCrowns();
  });
  $('cal-prev').addEventListener('click', function () {
    calMonth = monthStep(calMonth, -1);
    renderCalendar(Progress.dateKey());
  });
  $('cal-next').addEventListener('click', function () {
    calMonth = monthStep(calMonth, 1);
    renderCalendar(Progress.dateKey());
  });
  $('attend-ok').addEventListener('click', pressAttendOk);
  $('attend').addEventListener('click', function (e) {
    if (e.target === $('attend')) closeAttend();
  });
  $('items-body').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-item]') : null;
    if (b && !b.disabled) useItemPress(b.getAttribute('data-item'));
    var buy = e.target.closest ? e.target.closest('[data-buy]') : null;
    if (buy) buyItemPress(buy.getAttribute('data-buy'));
  });
  $('btn-promo-ok').addEventListener('click', function () {
    $('promo').hidden = true;
    S.Effects.stop();
    $('btn-again').focus();
    maybeAskLogin(C.GRADES[data.gradeIndex]);
  });
  $('login-ask-later').addEventListener('click', closeLoginAsk);
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
      stopTimer();
      data = Progress.reset();
      game = null;
      recordGrade = -1;
      closeSheets();
      Progress.save(data);
      showScreen(screen);
    });
  });

  /* 메뉴의 규칙·내 기록·설정 버튼, 창 닫기, 설정 켜고 끄기 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('[data-music]')) return toggleMusic();
    var jump = t.closest('[data-jump]');
    if (jump) {
      // 규칙 창의 바로 가기 : 그 묶음까지 창 안에서 부드럽게 내려갑니다
      var target = $(jump.getAttribute('data-jump'));
      var body = target && target.closest('.sheet-body');
      if (body) body.scrollTo({ top: target.offsetTop - body.offsetTop - 8, behavior: 'smooth' });
      return;
    }
    var tab = t.closest('[data-tab]');
    if (tab) return showScreen(tab.getAttribute('data-tab'));
    var mode = t.closest('.mode-tab');
    if (mode) {
      recordMode = mode.getAttribute('data-mode');
      return renderRecord();
    }
    var chip = t.closest('[data-rec-grade]');
    if (chip) {
      recordGrade = Number(chip.getAttribute('data-rec-grade'));
      return renderRecord();
    }
    var login = t.closest('[data-login]');
    if (login) return pressLogin(login.getAttribute('data-login'));
    var pack = t.closest('[data-pack]');
    if (pack) return buyStarsPress(pack.getAttribute('data-pack'));
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
    if (!$('attend').hidden) {
      if (e.key === 'Escape') closeAttend();
      return;
    }
    if (!$('stairs').hidden && !sheetOpen()) {
      if (e.key === 'Escape') closeStairs();
      return;
    }
    if (sheetOpen()) {
      if (e.key === 'Escape') closeSheets();
      return;
    }
    if (overlayOpen() || e.ctrlKey || e.metaKey || e.altKey || screen !== 'game') return;
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
   * 앱으로 설치했을 때와 휴대폰 크롬 같은 인터넷 창에서 열었을 때 모두 똑같이 동작합니다.
   *   창이 떠 있으면              → 그 창을 닫습니다
   *   게임 · 배지 · 내 기록 화면  → 홈으로 (하던 판은 저장되고 시간이 멈춤)
   *   홈이면                      → "한 번 더 누르면 나가요"를 알려 주고, 한 번 더 누르면 앱이 닫힙니다
   *
   * 방법 : 브라우저 기록에 "가짜 페이지"를 지금 화면의 깊이만큼 쌓아 둡니다.
   *   홈 = 1칸, 다른 화면 = 2칸, 그 위에 창이 떠 있으면 +1칸
   *   뒤로 가기를 누르면 한 칸씩 빠지면서 popstate 가 오고, 0칸에서 누르면 앱이 닫힙니다.
   *
   * 주의 (크롬 규칙) : 사용자가 화면을 "만진 것으로 인정되기" 전에 쌓은 칸이 있으면,
   *   크롬은 뒤로 가기를 누를 때 그 아래까지 건너뛰어 앱을 닫아 버립니다.
   *   휴대폰 터치는 손가락을 뗄 때(pointerup · touchend · click)부터 인정되므로, 그 직후에만 칸을 쌓습니다.
   *   (popstate 안에서는 쌓지 않음. 그래서 칸은 미리, 화면 깊이만큼 넉넉히 쌓아 둡니다)
   */
  var backDepth = 0; // 지금 서 있는 칸 (0 = 맨 아래, 쌓인 것 없음)
  var backTimer = 0;

  function isAppMode() {
    if (/[?&]app=1/.test(location.search)) return true; // 시험용 : 주소 뒤에 ?app=1
    if (document.referrer.indexOf('android-app://') === 0) return true; // 플레이스토어 앱
    var mq = window.matchMedia;
    return !!(mq && (mq('(display-mode: standalone)').matches || mq('(display-mode: fullscreen)').matches)) ||
      navigator.standalone === true;
  }

  /* 지금 화면에 필요한 칸 수 */
  function wantDepth() {
    if (!splashDone) return 0;
    return 1 + (screen !== 'home' ? 1 : 0) + (overlayOpen() ? 1 : 0);
  }

  /* 모자란 칸을 쌓습니다 (화면을 만진 직후에만 부름) */
  function fillBack() {
    var want = wantDepth();
    try {
      while (backDepth < want) {
        backDepth++;
        history.pushState({ sudokuBack: true, depth: backDepth }, '');
      }
    } catch (e) {
      /* 막혀 있으면 보통의 뒤로 가기 */
    }
  }
  /* 누른 단추가 화면을 바꾼 뒤에 칸 수를 맞추도록 잠깐 뒤에 (만진 것으로 인정되는 시간은 몇 초 이어짐) */
  function armBack() {
    window.clearTimeout(backTimer);
    backTimer = window.setTimeout(fillBack, 30);
  }

  /* 가장 위에 떠 있는 창 하나를 닫습니다. 닫은 게 있으면 true */
  function closeTopOverlay() {
    if (S.Tutorial && S.Tutorial.isOpen()) { S.Tutorial.close(); return true; }
    if (!$('modal').hidden) { closeModal(false); return true; }
    if (!$('attend').hidden) { closeAttend(); return true; }
    if (!$('promo').hidden) { $('btn-promo-ok').click(); return true; }
    if (!$('login-ask').hidden) { closeLoginAsk(); return true; }
    if (!$('nick').hidden) { S.Ranking.closeNick(); return true; }
    if (sheetOpen()) { closeSheets(); return true; }
    if (!$('stairs').hidden) { closeStairs(); return true; }
    if (!$('result').hidden) { $('btn-result-close').click(); return true; }
    return false;
  }

  function onBack(e) {
    var st = e && e.state;
    backDepth = st && st.sudokuBack ? st.depth || 0 : 0;
    if (!splashDone) return;
    if (closeTopOverlay()) return; // 창만 닫음
    if (screen !== 'home') {
      // 게임 · 배지 · 내 기록 화면 → 홈 (하던 판은 저장되고 시간이 멈춤)
      if (!ending) showScreen('home');
      return;
    }
    // 홈인데 칸이 남아 있으면 (창을 ✕ 로 닫는 등) 맨 아래 칸으로 내려가서 거기서 안내
    if (backDepth > 0) {
      history.go(-backDepth);
      return;
    }
    if (game && game.status === 'playing') persist();
    // 0칸 : 한 번 더 누르면 앱이 닫힙니다
    appToast('한 번 더 누르면 나가요');
  }

  window.addEventListener('popstate', onBack);

  /* 두 손가락으로 화면이 확대되지 않게 : 아이폰 사파리는 화면 설정(viewport)을 무시해서 따로 막습니다
     (안드로이드 크롬 · 앱은 index.html 의 viewport 와 css 의 touch-action 으로 막힘) */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // 화면을 만지면 다시 뒤로 가기를 받을 준비를 합니다
  //   (손가락을 뗄 때 · 마우스를 누를 때 · 키를 누를 때 : 크롬이 "사용자가 만졌다"고 인정하는 때)
  ['pointerup', 'touchend', 'mousedown', 'click', 'keydown'].forEach(function (type) {
    document.addEventListener(type, armBack, true);
  });

  /* 화면을 떠날 때 하던 판을 저장합니다 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game && game.status === 'playing') persist();
    lastTick = Date.now();
    // 밤을 넘겨 다시 열었으면 출석 창을 띄웁니다
    if (!document.hidden) {
      if (screen === 'home') renderHome();
      maybeAttend();
    }
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

  /* 오른쪽 위 버전 표시 */
  $('app-ver').textContent = C.VERSION || '';

  /* 저장해 둔 스킨을 입힙니다 */
  S.Skins.apply(Settings.get('skin'));
  S.Theme.apply();
  Settings.setFont();
  renderMusicBtns();

  /* 앱으로 열었는지 표시 (화면 꾸밈에서 앱만 다르게 할 때 씀) */
  if (isAppMode()) document.documentElement.classList.add('is-app');
  // 새로 고침해도 늘 맨 위에서 시작 (브라우저가 예전 스크롤 위치로 옮기지 않게)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* 로그인 : 계정 기록과 합친 결과를 받으면 화면을 새로 그립니다 */
  S.Account.start(
    function () {
      if (game && game.status === 'playing') {
        if (isDaily()) data.dailyGame = game;
        else data.game = game;
      }
      return data;
    },
    function (merged) {
      data = merged;
      Progress.save(data);
      showScreen(screen);
    }
  );

  /* 랭킹 (js/ranking.js) : 지금 기록 · 저장 · 알림 창을 이어 줍니다 */
  S.Ranking.start({
    data: function () { return data; },
    save: function () { Progress.save(data); },
    modal: function (text) {
      if (overlayOpen() || screen === 'game') return appToast(text.split('\n')[0]);
      showModal(text, '좋아요', '', function () { if (screen === 'ranking') S.Ranking.render(); });
      S.Sound.play('hint');
    },
    toast: appToast,
    loginButton: function (p) { return loginButton(p, loginText(p)); },
    playDaily: homeDaily,
    refresh: function () { if (screen === 'ranking') S.Ranking.render(); }
  });

  /* 시작 : 하던 판이 있으면 준비만 해 두고(시간은 멈춤) 홈 화면을 보여 줍니다 */
  if (Game.isValidSaved(data.game)) beginGame(data.game);
  else data.game = null;
  showScreen('home');

  /* 시작 그림 : "터치해서 시작하기"(깜박이는 단추)나 화면 아무 곳을 누르면 홈 화면으로 */
  var splashDone = false;
  function leaveSplash(e) {
    if (splashDone) return;
    if (e && e.target && e.target.closest && e.target.closest('[data-music]')) return; // 음악 단추는 켜고 끄기만
    splashDone = true;
    var sp = $('splash');
    sp.classList.add('out');
    window.setTimeout(function () {
      sp.hidden = true;
    }, 400);
    S.Sound.play('memoOn'); // 누를 때 짧은 소리 (설정에서 효과음을 끄면 안 남)
    playMusic(); // 대문 음악
    /* 처음 켠 사람에게는 따라 하기를 먼저 보여 줍니다 (한 판이라도 해 본 사람은 건너뜀) */
    if (!Settings.get('tutorialDone') && data.totalGames === 0 && !data.daily.total) openTutorial();
    else window.setTimeout(maybeAttend, 450);
  }
  $('splash').addEventListener('click', leaveSplash);
  $('splash-start').focus();
})();
