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
   * 오늘의 퍼즐을 만듭니다. dateKey 는 '2026-11-13' 같은 날짜.
   * 날짜가 같으면 누가 만들어도 똑같은 판이 나옵니다.
   */
  function createDaily(dateKey) {
    var spec = C.DAILY;
    var seed = Number(dateKey.replace(/-/g, '')) * 31 + spec.seed;
    var gen = E.generatePuzzle(spec, spec.givens, spec.level, E.seeded(seed));
    return build(spec, gen, -1, 'daily', dateKey);
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
      elapsedMs: 0,
      history: [],
      score: 0, // 이번 판 점수
      streak: 0, // 틀리지 않고 연속으로 맞힌 횟수
      scored: scored, // 이미 점수를 받은 칸 (되돌렸다 다시 넣어도 두 번 받지 못하게)
      lastGain: 0, // 방금 받은 점수
      clearBonus: 0, // 판을 깨고 받은 보너스
      status: 'playing' // 'playing' | 'won' | 'lost'
    };
  }

  /* 점수제가 생기기 전에 저장된 판을 불러왔을 때 빠진 값을 채웁니다. */
  function upgrade(st) {
    if (typeof st.score !== 'number') st.score = 0;
    if (typeof st.streak !== 'number') st.streak = 0;
    if (typeof st.lastGain !== 'number') st.lastGain = 0;
    if (typeof st.clearBonus !== 'number') st.clearBonus = 0;
    if (typeof st.daily !== 'string') st.daily = '';
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

  /* 맞힌 칸의 점수를 더합니다. 반환 : 이번에 받은 점수 */
  function award(st, idx) {
    if (st.scored[idx]) return 0;
    st.scored[idx] = true;
    st.streak++;
    var base = basePoints(st);
    var gain = base + Math.round(base * C.SCORE.COMBO_STEP * Math.min(st.streak - 1, C.SCORE.COMBO_MAX));
    gain += base * C.SCORE.UNIT_BONUS * unitsDone(st, idx);
    st.score += gain;
    return gain;
  }

  /* 판을 다 채웠을 때 : 성공 처리와 완성 보너스 */
  function finishWin(st) {
    st.status = 'won';
    var base = basePoints(st);
    st.clearBonus = base * C.SCORE.CLEAR_BONUS + (st.mistakes === 0 ? base * C.SCORE.PERFECT_BONUS : 0);
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
   * 반환 : 채운 칸 번호 (못 채웠으면 -1)
   */
  function hint(st, idx, autoNotes) {
    if (st.status !== 'playing' || st.hintsLeft <= 0) return -1;
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
    st.hintsLeft--;
    st.scored[target] = true; // 힌트로 채운 칸은 점수가 없습니다
    st.streak = 0;
    st.lastGain = 0;
    if (isComplete(st)) finishWin(st);
    return target;
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
    placedCount: placedCount
  };
})(typeof window !== 'undefined' ? window : globalThis);
