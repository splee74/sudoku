/*
 * 한 판의 규칙 : 숫자 넣기, 메모, 지우기, 되돌리기, 힌트, 성공/실패 판정.
 * 화면과는 상관없이 "판의 상태"만 다룹니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;
  var E = S.Engine;
  var HISTORY_LIMIT = 300;

  /* 새 판을 만듭니다. */
  function create(gradeIndex) {
    var grade = C.GRADES[gradeIndex];
    var gen = E.generatePuzzle(grade, grade.givens, grade.level);
    return build(grade, gen, gradeIndex, grade.id, '');
  }

  /*
   * 오늘의 퍼즐 stage 단계를 만듭니다. dateKey 는 '2026-11-13' 같은 날짜.
   * 날짜와 단계가 같으면 누가 만들어도 똑같은 판이 나옵니다.
   */
  function createDaily(dateKey, stage) {
    var spec = C.DAILY;
    stage = Math.max(1, Math.floor(stage || 1));
    var seed = Number(dateKey.replace(/-/g, '')) * 31 + spec.seed + stage * 7919;
    var gen = E.generatePuzzle(spec, spec.givens, spec.level, E.seeded(seed));
    var st = build(spec, gen, -1, 'daily', dateKey);
    st.stage = stage;
    return st;
  }

  function build(grade, gen, gradeIndex, gradeId, dateKey) {
    var total = grade.size * grade.size;
    var fixed = [], hinted = [], notes = [], scored = [];
    for (var i = 0; i < total; i++) {
      fixed.push(gen.puzzle[i] !== 0);
      hinted.push(false);
      notes.push(0);
      scored.push(false);
    }
    return {
      gradeIndex: gradeIndex, // 등급 순서 (오늘의 퍼즐은 -1)
      gradeId: gradeId,
      daily: dateKey, // 오늘의 퍼즐이면 날짜, 아니면 빈 글자
      stage: 0, // 오늘의 퍼즐 몇 단계인지 (승급전은 0)
      size: grade.size,
      boxRows: grade.boxRows,
      boxCols: grade.boxCols,
      solution: gen.solution,
      cells: gen.puzzle.slice(), // 지금 판에 적힌 숫자 (빈칸 0)
      fixed: fixed, // 처음부터 있던 숫자나 힌트로 채운 칸 (못 바꿈)
      hinted: hinted, // 힌트로 채운 칸
      notes: notes, // 메모 (숫자별 비트)
      mistakes: 0,
      hintsLeft: C.MAX_HINTS,
      extraHints: 0, // 힌트권(아이템)으로 쓴 힌트 수
      itemsUsed: 0, // 이번 판에서 쓴 아이템 수
      double: false, // 점수 2배권을 썼는지
      elapsedMs: 0,
      history: [],
      score: 0, // 이번 판 점수
      streak: 0, // 틀리지 않고 연속으로 맞힌 횟수
      scored: scored, // 이미 점수를 받은 칸 (되돌렸다 다시 넣어도 두 번 받지 못하게)
      lastGain: 0, // 방금 받은 점수
      clearBonus: 0, // 판을 깨고 받은 보너스
      clearParts: [], // 판을 깨고 받은 보너스 내역 [[이름, 점수], …]
      tally: freshTally(), // 이번 판 칸 점수 내역
      bestStreak: 0, // 이번 판 최고 콤보
      lastHitMs: -1, // 바로 전 정답을 넣은 시각 (걸린 시간 기준, 빠른 손에 씀)
      status: 'playing' // 'playing' | 'won' | 'lost'
    };
  }

  /* 칸 점수 내역 : 기본 · 연속 콤보 · 빠른 손 · 줄·상자 완성 · 숫자 완성 · 콤보 고비 */
  function freshTally() {
    return { cell: 0, combo: 0, speed: 0, unit: 0, number: 0, milestone: 0 };
  }

  /* 점수제가 생기기 전에 저장된 판을 불러왔을 때 빠진 값을 채웁니다. */
  function upgrade(st) {
    if (!Array.isArray(st.clearParts)) st.clearParts = [];
    if (!st.tally || typeof st.tally !== 'object') st.tally = freshTally();
    var ft = freshTally();
    for (var tk in ft) if (typeof st.tally[tk] !== 'number') st.tally[tk] = 0;
    if (typeof st.bestStreak !== 'number') st.bestStreak = 0;
    if (typeof st.lastHitMs !== 'number') st.lastHitMs = -1;
    if (typeof st.score !== 'number') st.score = 0;
    if (typeof st.streak !== 'number') st.streak = 0;
    if (typeof st.lastGain !== 'number') st.lastGain = 0;
    if (typeof st.clearBonus !== 'number') st.clearBonus = 0;
    if (typeof st.daily !== 'string') st.daily = '';
    if (typeof st.stage !== 'number') st.stage = 0;
    if (typeof st.extraHints !== 'number') st.extraHints = 0;
    if (typeof st.itemsUsed !== 'number') st.itemsUsed = 0;
    st.double = st.double === true;
    if (!Array.isArray(st.scored) || st.scored.length !== st.cells.length) {
      st.scored = [];
      for (var i = 0; i < st.cells.length; i++) {
        st.scored.push(!st.fixed[i] && st.cells[i] === st.solution[i]);
      }
    }
    return st;
  }

  function basePoints(st) {
    return C.SCORE.BASE * (st.daily ? C.DAILY.points : st.gradeIndex + 1);
  }

  /* idx 칸이 들어 있는 가로줄·세로줄·상자 중 다 채워진 것의 개수 */
  function unitsDone(st, idx) {
    var n = st.size;
    var r = Math.floor(idx / n), c = idx % n, b = E.boxOf(st, r, c);
    var rowOk = true, colOk = true, boxOk = true;
    for (var i = 0; i < n * n; i++) {
      if (st.cells[i] === st.solution[i]) continue;
      var ir = Math.floor(i / n), ic = i % n;
      if (ir === r) rowOk = false;
      if (ic === c) colOk = false;
      if (E.boxOf(st, ir, ic) === b) boxOk = false;
    }
    return (rowOk ? 1 : 0) + (colOk ? 1 : 0) + (boxOk ? 1 : 0);
  }

  /*
   * 맞힌 칸의 점수를 더합니다. 반환 : 이번에 받은 점수
   * st.lastParts 에 이번 칸의 덤 내역을 남깁니다 (화면에 "콤보 · 빠른 손" 처럼 보여 줄 때 씀)
   */
  function award(st, idx) {
    st.lastParts = [];
    if (st.scored[idx]) return 0;
    st.scored[idx] = true;
    st.streak++;
    if (st.streak > st.bestStreak) st.bestStreak = st.streak;
    var K = C.SCORE, base = basePoints(st), mul = st.double ? 2 : 1;
    var parts = { cell: base };
    parts.combo = Math.round(base * K.COMBO_STEP * Math.min(st.streak - 1, K.COMBO_MAX));
    parts.speed = st.lastHitMs >= 0 && st.elapsedMs - st.lastHitMs <= K.SPEED_SEC * 1000 ? base * K.SPEED_BONUS : 0;
    parts.unit = base * K.UNIT_BONUS * unitsDone(st, idx);
    parts.number = placedCount(st, st.solution[idx]) === st.size ? base * K.NUMBER_BONUS : 0;
    parts.milestone = st.streak % 10 === 0 ? base * K.COMBO_MILESTONE * (st.streak / 10) : 0;
    st.lastHitMs = st.elapsedMs;
    var gain = 0;
    for (var k in parts) {
      parts[k] *= mul; // 점수 2배권
      st.tally[k] += parts[k];
      gain += parts[k];
    }
    if (parts.combo && st.streak >= 3) st.lastParts.push(st.streak + '콤보');
    if (parts.speed) st.lastParts.push('빠른 손');
    if (parts.number) st.lastParts.push('숫자 완성');
    if (parts.milestone) st.lastParts.push(st.streak + '연속!');
    st.score += gain;
    return gain;
  }

  /* 판을 다 채웠을 때 : 성공 처리와 완성 보너스 (내역은 st.clearParts) */
  function finishWin(st) {
    st.status = 'won';
    var K = C.SCORE, base = basePoints(st), mul = st.double ? 2 : 1;
    var blanks = 0;
    for (var i = 0; i < st.cells.length; i++) if (!st.fixed[i] || st.hinted[i]) blanks++;
    var sec = Math.floor(st.elapsedMs / 1000);
    var hints = C.MAX_HINTS - st.hintsLeft + (st.extraHints || 0);
    var timeSteps = Math.floor(Math.max(0, blanks * K.TIME_PER_CELL - sec) / K.TIME_STEP);
    var list = [
      ['완성 보너스', base * K.CLEAR_BONUS],
      ['무결점', st.mistakes === 0 ? base * K.PERFECT_BONUS : 0],
      ['힌트 없이', hints === 0 ? base * K.NOHINT_BONUS : 0],
      ['시간 보너스', base * Math.min(K.TIME_MAX, timeSteps)],
      ['최고 ' + st.bestStreak + '콤보', st.bestStreak >= 5 ? base * K.BEST_COMBO * st.bestStreak : 0],
      [st.stage + '단계 보너스', st.daily && st.stage > 1 ? base * K.STAGE_BONUS * (st.stage - 1) : 0]
    ];
    st.clearParts = [];
    st.clearBonus = 0;
    for (var j = 0; j < list.length; j++) {
      if (!list[j][1]) continue;
      var v = list[j][1] * mul;
      st.clearParts.push([list[j][0], v]);
      st.clearBonus += v;
    }
    st.score += st.clearBonus;
  }

  /* 저장해 둔 판이 지금 설정과 맞는지 확인합니다. */
  function isValidSaved(st) {
    if (!st || st.status !== 'playing') return false;
    var grade = st.daily ? C.DAILY : C.GRADES[st.gradeIndex];
    if (!grade || grade.size !== st.size) return false;
    if (st.daily ? st.gradeId !== 'daily' : grade.id !== st.gradeId) return false;
    var total = st.size * st.size;
    var keys = ['solution', 'cells', 'fixed', 'hinted', 'notes'];
    for (var i = 0; i < keys.length; i++) {
      if (!Array.isArray(st[keys[i]]) || st[keys[i]].length !== total) return false;
    }
    return Array.isArray(st.history);
  }

  /* 사용자가 바꿀 수 있는 칸인가? (고정 칸과 이미 맞힌 칸은 못 바꿈) */
  function isEditable(st, idx) {
    return idx >= 0 && !st.fixed[idx] && st.cells[idx] !== st.solution[idx];
  }

  function isComplete(st) {
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] !== st.solution[i]) return false;
    }
    return true;
  }

  function snapshot(st, list) {
    var entry = [];
    for (var i = 0; i < list.length; i++) {
      entry.push([list[i], st.cells[list[i]], st.notes[list[i]]]);
    }
    st.history.push(entry);
    if (st.history.length > HISTORY_LIMIT) st.history.shift();
  }

  /* 주변 칸 메모에서 숫자 d를 지울 대상 목록 */
  function peersWithNote(st, idx, d) {
    var bit = 1 << (d - 1);
    var p = E.peers(st, idx);
    var out = [];
    for (var i = 0; i < p.length; i++) if (st.notes[p[i]] & bit) out.push(p[i]);
    return out;
  }

  /*
   * 숫자 넣기.
   * 반환 : 'correct'(맞음) | 'wrong'(틀림) | 'ignored'(아무 일 없음)
   */
  function enter(st, idx, d, autoNotes) {
    if (st.status !== 'playing' || !isEditable(st, idx)) return 'ignored';
    if (d < 1 || d > st.size || st.cells[idx] === d) return 'ignored';
    if (d === st.solution[idx]) {
      // autoNotes가 꺼져 있으면 주변 메모는 건드리지 않습니다
      var affected = autoNotes === false ? [] : peersWithNote(st, idx, d);
      snapshot(st, [idx].concat(affected));
      st.cells[idx] = d;
      st.notes[idx] = 0;
      for (var i = 0; i < affected.length; i++) st.notes[affected[i]] &= ~(1 << (d - 1));
      st.lastGain = award(st, idx);
      if (isComplete(st)) finishWin(st);
      return 'correct';
    }
    snapshot(st, [idx]);
    st.cells[idx] = d;
    st.mistakes++;
    st.streak = 0; // 틀리면 연속 보너스가 끊깁니다
    st.lastGain = 0;
    if (st.mistakes >= C.MAX_MISTAKES) st.status = 'lost';
    return 'wrong';
  }

  /* 메모 숫자를 적거나 지웁니다 (빈칸에서만). */
  function toggleNote(st, idx, d) {
    if (st.status !== 'playing' || !isEditable(st, idx)) return false;
    if (st.cells[idx] !== 0 || d < 1 || d > st.size) return false;
    snapshot(st, [idx]);
    st.notes[idx] ^= 1 << (d - 1);
    return true;
  }

  /* 지우개 : 틀린 숫자나 메모를 지웁니다. */
  function erase(st, idx) {
    if (st.status !== 'playing' || !isEditable(st, idx)) return false;
    if (st.cells[idx] === 0 && st.notes[idx] === 0) return false;
    snapshot(st, [idx]);
    if (st.cells[idx] !== 0) st.cells[idx] = 0;
    else st.notes[idx] = 0;
    return true;
  }

  /* 되돌리기 : 바로 전 동작을 취소합니다. (틀린 횟수와 힌트는 되돌아가지 않음) */
  function undo(st) {
    if (st.status !== 'playing' || st.history.length === 0) return false;
    var entry = st.history.pop();
    for (var i = 0; i < entry.length; i++) {
      var idx = entry[i][0];
      if (st.fixed[idx]) continue;
      st.cells[idx] = entry[i][1];
      st.notes[idx] = entry[i][2];
    }
    return true;
  }

  /*
   * 힌트 : 한 칸을 정답으로 채웁니다.
   * 고른 칸이 비어 있으면 그 칸을, 아니면 아무 빈칸 하나를 채웁니다.
   * ticket 이 true 면 힌트권(아이템)으로 씁니다 (남은 힌트 수는 그대로)
   * 반환 : 채운 칸 번호 (못 채웠으면 -1)
   */
  function hint(st, idx, autoNotes, ticket) {
    if (st.status !== 'playing' || (!ticket && st.hintsLeft <= 0)) return -1;
    var target = -1;
    if (idx >= 0 && isEditable(st, idx)) {
      target = idx;
    } else {
      var open = [];
      for (var i = 0; i < st.cells.length; i++) if (isEditable(st, i)) open.push(i);
      if (open.length === 0) return -1;
      target = open[Math.floor(Math.random() * open.length)];
    }
    var d = st.solution[target];
    st.cells[target] = d;
    st.notes[target] = 0;
    st.fixed[target] = true;
    st.hinted[target] = true;
    var affected = autoNotes === false ? [] : peersWithNote(st, target, d);
    for (var k = 0; k < affected.length; k++) st.notes[affected[k]] &= ~(1 << (d - 1));
    if (ticket) {
      st.extraHints++;
      st.itemsUsed++;
    } else {
      st.hintsLeft--;
    }
    st.scored[target] = true; // 힌트로 채운 칸은 점수가 없습니다
    st.streak = 0;
    st.lastGain = 0;
    if (isComplete(st)) finishWin(st);
    return target;
  }

  /* ---------- 아이템 ---------- */
  /* 시간 단축권 : 걸린 시간을 ms 만큼 줄입니다. 반환 : 실제로 줄어든 시간(ms) */
  function cutTime(st, ms) {
    if (st.status !== 'playing') return 0;
    var cut = Math.min(st.elapsedMs, ms);
    st.elapsedMs -= cut;
    if (cut > 0) st.itemsUsed++;
    return cut;
  }

  /* 실수 지우개 : 틀린 횟수 1번을 없애고, 판에 남은 틀린 숫자도 지웁니다. */
  function forgive(st) {
    if (st.status !== 'playing' || st.mistakes <= 0) return false;
    st.mistakes--;
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] !== 0 && st.cells[i] !== st.solution[i]) st.cells[i] = 0;
    }
    st.itemsUsed++;
    return true;
  }

  /*
   * 자동 메모 : 빈칸마다 들어갈 수 있는 숫자(같은 줄·상자에 아직 없는 숫자)를 메모합니다.
   * 되돌리기 한 번으로 모두 되돌릴 수 있습니다. 반환 : 메모가 바뀐 칸 수
   */
  function autoMemo(st) {
    if (st.status !== 'playing') return 0;
    var changed = [], masks = [];
    var full = (1 << st.size) - 1;
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] !== 0 || !isEditable(st, i)) continue;
      var mask = full;
      var p = E.peers(st, i);
      for (var k = 0; k < p.length; k++) {
        var v = st.cells[p[k]];
        if (v && v === st.solution[p[k]]) mask &= ~(1 << (v - 1));
      }
      if (mask !== st.notes[i]) {
        changed.push(i);
        masks.push(mask);
      }
    }
    if (!changed.length) return 0;
    snapshot(st, changed);
    for (var j = 0; j < changed.length; j++) st.notes[changed[j]] = masks[j];
    st.itemsUsed++;
    return changed.length;
  }

  /* 점수 2배권 : 이번 판의 점수가 모두 2배 (이미 받은 점수는 그대로) */
  function useDouble(st) {
    if (st.status !== 'playing' || st.double) return false;
    st.double = true;
    st.itemsUsed++;
    return true;
  }

  /* 되살리기권 : 3번 틀려 끝난 판을 틀림 1번 줄이고 이어서 합니다 */
  function revive(st) {
    if (st.status !== 'lost') return false;
    st.status = 'playing';
    st.mistakes = Math.max(0, st.mistakes - 1);
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] !== 0 && st.cells[i] !== st.solution[i]) st.cells[i] = 0;
    }
    st.itemsUsed++;
    return true;
  }

  /* 돋보기 : 숫자 d가 들어갈 수 있는 빈칸 목록 (같은 줄·상자에 d가 아직 없는 칸) */
  function spots(st, d) {
    var out = [];
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] !== 0 || !isEditable(st, i)) continue;
      var p = E.peers(st, i), ok = true;
      for (var k = 0; k < p.length; k++) {
        if (st.cells[p[k]] === d && st.solution[p[k]] === d) { ok = false; break; }
      }
      if (ok) out.push(i);
    }
    return out;
  }

  /* 숫자 d가 판에 올바르게 몇 개 놓였는지 */
  function placedCount(st, d) {
    var c = 0;
    for (var i = 0; i < st.cells.length; i++) {
      if (st.cells[i] === d && st.solution[i] === d) c++;
    }
    return c;
  }

  S.Game = {
    create: create,
    createDaily: createDaily,
    upgrade: upgrade,
    isValidSaved: isValidSaved,
    isEditable: isEditable,
    isComplete: isComplete,
    enter: enter,
    toggleNote: toggleNote,
    erase: erase,
    undo: undo,
    hint: hint,
    cutTime: cutTime,
    forgive: forgive,
    autoMemo: autoMemo,
    useDouble: useDouble,
    revive: revive,
    spots: spots,
    placedCount: placedCount
  };
})(typeof window !== 'undefined' ? window : globalThis);
