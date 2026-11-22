/*
 * 내 기록 : 등급, 승급/강등, 저장하기·불러오기.
 * 지금은 브라우저 안(localStorage)에 저장합니다.
 * 나중에 랭킹 서버나 앱 저장소로 바꾸려면 아래 Storage 부분만 바꾸면 됩니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;
  var SAVE_KEY = 'sudoku-save-v1';

  /* ---------- 저장소 (브라우저가 저장을 막아 놓아도 게임은 돌아가게) ---------- */
  var memory = {};
  var Storage = {
    get: function (key) {
      try {
        var v = root.localStorage.getItem(key);
        return v === null ? null : v;
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      }
    },
    set: function (key, value) {
      try {
        root.localStorage.setItem(key, value);
      } catch (e) {
        memory[key] = value;
      }
    },
    remove: function (key) {
      try {
        root.localStorage.removeItem(key);
      } catch (e) {
        delete memory[key];
      }
    }
  };

  function fresh() {
    return {
      version: 1,
      gradeIndex: 0, // 지금 등급 (0 = 하수)
      wins: 0, // 지금 등급에서 깬 판 수
      mission: freshMission(), // 지금 등급의 승급 미션 진행 (js/config.js 의 MISSIONS)
      failStreak: 0, // 연속 실패 횟수
      totalWins: 0,
      totalGames: 0,
      bestTimes: {}, // 등급별 최고 기록(초)
      bestScores: {}, // 등급별 최고 점수
      totalScore: 0, // 지금까지 모은 점수 (나중에 랭킹에 쓸 수 있음)
      game: null, // 하다가 멈춘 판
      dailyGame: null, // 하다가 멈춘 오늘의 퍼즐
      // 오늘의 퍼즐 기록
      daily: {
        last: '', // 마지막으로 푼 날짜 ('2026-11-13' 모양)
        streak: 0, // 하루도 안 빠지고 연속으로 푼 날 수
        bestStreak: 0,
        total: 0, // 지금까지 푼 횟수
        score: 0, // 마지막으로 푼 날의 점수
        seconds: 0 // 마지막으로 푼 날의 걸린 시간(초)
      },
      // 통계 (내 기록 창과 배지에 씁니다)
      stats: freshStats(),
      // 등급별 통계 (오늘의 퍼즐은 'daily')
      //   { 등급id: { played: 끝낸 판, won: 깬 판, sec: 깬 판의 시간 합(초), perfect: 무결점 성공,
      //              streak: 지금 연승, best: 최다 연승, bestSec: 가장 빠른 성공(초) } }
      gradeStats: {},
      // 받은 배지 : { 배지id: 받은 날짜 } (목록은 js/badges.js)
      badges: {},
      // 출석 체크 : 마지막 출석 날짜, 이어진 일수, 가장 길게 이어진 일수, 모두 출석한 날 수
      attend: { last: '', streak: 0, best: 0, total: 0 },
      // 가지고 있는 아이템 개수 : { 아이템id: 개수 } (목록은 js/config.js 의 ITEMS)
      items: freshItems(),
      starterGiven: false // 처음 시작 선물(START_ITEMS)을 받았는지
    };
  }

  /* 처음 시작 선물 : 아이템마다 C.START_ITEMS 개 (한 번만) */
  function giveStarter(data) {
    if (data.starterGiven) return;
    data.starterGiven = true;
    var n = num(C.START_ITEMS, 0);
    if (n > 0) for (var i = 0; i < C.ITEMS.length; i++) addItem(data, C.ITEMS[i].id, n);
  }

  /* 승급 미션 진행 : 지금 등급에서 무결점·힌트 없이·빨리 깬 판 수, 지금 연승, 가장 긴 연승 */
  function freshMission() {
    return { perfect: 0, nohint: 0, fast: 0, streak: 0, best: 0 };
  }

  function freshItems() {
    var out = {};
    for (var i = 0; i < C.ITEMS.length; i++) out[C.ITEMS[i].id] = 0;
    return out;
  }

  function freshStats() {
    return {
      perfectWins: 0, // 한 번도 안 틀리고 깬 판
      noHintWins: 0, // 힌트 없이 깬 판
      hintsUsed: 0, // 지금까지 쓴 힌트
      winStreak: 0, // 지금 이어지는 연승
      bestWinStreak: 0, // 가장 길었던 연승
      maxPromoted: 0, // 승급으로 올라가 본 가장 높은 등급 (등급 고르기로 고른 것은 안 침)
      wins9: 0, // 9×9 판을 깬 횟수
      best9: 0, // 9×9 판 가장 빠른 기록(초, 0 = 없음)
      playSec: 0 // 지금까지 게임한 시간(초)
    };
  }

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  }

  function load() {
    var data = fresh();
    try {
      var raw = Storage.get(SAVE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          data.gradeIndex = Math.min(num(saved.gradeIndex, 0), C.GRADES.length - 1);
          data.wins = num(saved.wins, 0);
          data.failStreak = num(saved.failStreak, 0);
          data.totalWins = num(saved.totalWins, 0);
          data.totalGames = num(saved.totalGames, 0);
          if (saved.bestTimes && typeof saved.bestTimes === 'object') data.bestTimes = saved.bestTimes;
          if (saved.bestScores && typeof saved.bestScores === 'object') data.bestScores = saved.bestScores;
          data.totalScore = num(saved.totalScore, 0);
          data.game = saved.game || null;
          data.dailyGame = saved.dailyGame || null;
          var sd = saved.daily;
          if (sd && typeof sd === 'object') {
            data.daily.last = typeof sd.last === 'string' ? sd.last : '';
            data.daily.streak = num(sd.streak, 0);
            data.daily.bestStreak = num(sd.bestStreak, 0);
            data.daily.total = num(sd.total, 0);
            data.daily.score = num(sd.score, 0);
            data.daily.seconds = num(sd.seconds, 0);
          }
          var st = saved.stats;
          if (st && typeof st === 'object') {
            for (var k in data.stats) data.stats[k] = num(st[k], 0);
          } else {
            // 통계가 생기기 전부터 하던 사람 : 지금 등급까지는 올라온 것으로 칩니다
            data.stats.maxPromoted = data.gradeIndex;
          }
          if (saved.mission && typeof saved.mission === 'object') {
            for (var mk in data.mission) data.mission[mk] = num(saved.mission[mk], 0);
          }
          // 등급 고르기를 잠근 뒤 : 고르기로 올라가 있던 등급은 승급으로 올라간 등급까지로 되돌립니다
          if (!C.FREE_GRADE_SELECT && data.gradeIndex > data.stats.maxPromoted) {
            data.gradeIndex = data.stats.maxPromoted;
            data.wins = 0;
            data.mission = freshMission();
          }
          if (saved.gradeStats && typeof saved.gradeStats === 'object') data.gradeStats = saved.gradeStats;
          if (saved.badges && typeof saved.badges === 'object') data.badges = saved.badges;
          var sa = saved.attend;
          if (sa && typeof sa === 'object') {
            data.attend.last = typeof sa.last === 'string' ? sa.last : '';
            data.attend.streak = num(sa.streak, 0);
            data.attend.best = num(sa.best, 0);
            data.attend.total = num(sa.total, 0);
          }
          if (saved.items && typeof saved.items === 'object') {
            for (var it in data.items) data.items[it] = num(saved.items[it], 0);
          }
          data.starterGiven = saved.starterGiven === true;
        }
      }
    } catch (e) {
      data = fresh();
    }
    giveStarter(data);
    return data;
  }

  function save(data) {
    try {
      Storage.set(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      /* 저장 실패는 조용히 넘어갑니다 */
    }
    // 로그인해 있으면 계정에도 저장합니다 (js/account.js 가 연결)
    if (S.Progress.onSave) S.Progress.onSave(data);
  }

  function reset() {
    Storage.remove(SAVE_KEY);
    var d = fresh();
    giveStarter(d);
    return d;
  }

  /*
   * 한 판 성공 처리.
   * 반환 : { promoted: 승급했는지, grade: 처리 후 등급, newBest: 최고 기록인지, newBestScore: 최고 점수인지 }
   */
  function recordWin(data, seconds, score, g) {
    var grade = C.GRADES[data.gradeIndex];
    data.totalGames++;
    data.totalWins++;
    data.wins++;
    data.failStreak = 0;

    var newBestScore = false;
    if (typeof score === 'number' && score > 0) {
      data.totalScore += score;
      var prevScore = data.bestScores[grade.id];
      if (typeof prevScore !== 'number' || score > prevScore) {
        data.bestScores[grade.id] = score;
        newBestScore = typeof prevScore === 'number';
      }
    }

    var newBest = false;
    var prev = data.bestTimes[grade.id];
    if (typeof seconds === 'number' && (typeof prev !== 'number' || seconds < prev)) {
      data.bestTimes[grade.id] = seconds;
      newBest = typeof prev === 'number';
    }

    // 승급 미션 진행
    var m = data.mission;
    var hints = g ? C.MAX_HINTS - g.hintsLeft + (g.extraHints || 0) : 1;
    if (g && g.mistakes === 0) m.perfect++;
    if (g && hints <= 0) m.nohint++;
    var fast = fastSec(grade);
    if (fast && typeof seconds === 'number' && seconds <= fast) m.fast++;
    m.streak++;
    if (m.streak > m.best) m.best = m.streak;

    var promoted = false;
    if (missionsDone(data) && data.gradeIndex < C.GRADES.length - 1) {
      data.gradeIndex++;
      data.wins = 0;
      data.mission = freshMission();
      promoted = true;
      if (data.gradeIndex > data.stats.maxPromoted) data.stats.maxPromoted = data.gradeIndex;
    }
    return { promoted: promoted, grade: C.GRADES[data.gradeIndex], newBest: newBest, newBestScore: newBestScore };
  }

  /*
   * 한 판 실패 처리.
   * 반환 : { demoted: 강등됐는지, grade: 처리 후 등급 }
   */
  function recordLoss(data, score) {
    data.totalGames++;
    if (typeof score === 'number' && score > 0) data.totalScore += score; // 실패한 판에서 모은 점수도 쌓입니다
    data.failStreak++;
    data.mission.streak = 0; // 연달아 깨기 미션은 처음부터
    var demoted = false;
    if (data.failStreak >= C.FAILS_TO_DEMOTE) {
      data.failStreak = 0;
      if (data.gradeIndex > 0) {
        data.gradeIndex--;
        data.wins = 0;
        data.mission = freshMission();
        demoted = true;
      }
    }
    return { demoted: demoted, grade: C.GRADES[data.gradeIndex] };
  }

  /* 등급을 직접 고릅니다. 승급까지 남은 판 수는 처음부터 다시 셉니다. */
  function setGrade(data, index) {
    if (index < 0 || index >= C.GRADES.length || index === data.gradeIndex) return false;
    data.gradeIndex = index;
    data.wins = 0;
    data.mission = freshMission();
    data.failStreak = 0;
    return true;
  }

  /* ---------- 오늘의 퍼즐 ---------- */
  function two(n) {
    return (n < 10 ? '0' : '') + n;
  }
  /* 날짜 → '2026-11-13' (이 기기의 날짜 기준) */
  function dateKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }
  /* 하루 전 날짜 */
  function dayBefore(key) {
    var p = key.split('-');
    return dateKey(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) - 1));
  }
  function dailyDone(data, key) {
    return data.daily.last === key;
  }
  /* '2026-11-13' → 날짜 */
  function keyDate(key) {
    var p = key.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  /* last 다음 날부터 today 전날까지 빠진 날 수 */
  function missedDays(last, today) {
    if (!last) return -1;
    return Math.round((keyDate(today) - keyDate(last)) / 86400000) - 1;
  }
  /*
   * 연속 기록 보호권으로 끊긴 연속 일수를 이을 수 있으면 필요한 장 수 (못 이으면 0)
   *   빠진 하루에 1장씩 필요합니다.
   */
  function guardNeed(data, last, streak, today) {
    var m = missedDays(last, today);
    return streak > 0 && m >= 1 && m <= itemCount(data, 'guard') ? m : 0;
  }

  /* 지금 이어지고 있는 연속 일수 (어제도 오늘도 안 풀었으면 0, 단 보호권으로 이을 수 있으면 그대로) */
  function dailyStreak(data, today) {
    var last = data.daily.last;
    if (last === today || last === dayBefore(today)) return data.daily.streak;
    return guardNeed(data, last, data.daily.streak, today) ? data.daily.streak : 0;
  }
  /* 오늘의 퍼즐 성공 처리. 반환 : { streak: 연속 일수, guarded: 쓴 보호권 장 수 } */
  function recordDaily(data, key, seconds, score) {
    var d = data.daily;
    if (d.last === key) return { streak: d.streak, guarded: 0 };
    var cont = d.last === dayBefore(key);
    var guarded = cont ? 0 : guardNeed(data, d.last, d.streak, key);
    if (guarded) data.items.guard -= guarded;
    d.streak = cont || guarded ? d.streak + 1 : 1;
    if (d.streak > d.bestStreak) d.bestStreak = d.streak;
    d.last = key;
    d.total++;
    d.score = score || 0;
    d.seconds = seconds || 0;
    if (typeof score === 'number' && score > 0) data.totalScore += score;
    return { streak: d.streak, guarded: guarded };
  }

  /*
   * 끝난 판 하나를 통계에 넣습니다. (승급전, 오늘의 퍼즐, 버린 판 모두)
   *   g   : 끝난 판 (game.js 의 판 상태)
   *   won : 깼는지
   */
  function recordStats(data, g, won) {
    var st = data.stats;
    var id = g.daily ? 'daily' : g.gradeId;
    var gs = data.gradeStats[id];
    if (!gs || typeof gs !== 'object') gs = data.gradeStats[id] = {};
    var seconds = Math.floor((g.elapsedMs || 0) / 1000);
    var hints = C.MAX_HINTS - g.hintsLeft + (g.extraHints || 0);
    gs.played = num(gs.played, 0) + 1;
    st.hintsUsed += Math.max(0, hints);
    st.playSec += seconds;
    gs.streak = won ? num(gs.streak, 0) + 1 : 0;
    gs.best = Math.max(num(gs.best, 0), gs.streak);
    if (won) {
      gs.won = num(gs.won, 0) + 1;
      gs.sec = num(gs.sec, 0) + seconds;
      if (g.mistakes === 0) gs.perfect = num(gs.perfect, 0) + 1;
      if (!gs.bestSec || seconds < gs.bestSec) gs.bestSec = seconds;
      if (g.mistakes === 0) st.perfectWins++;
      if (hints === 0) st.noHintWins++;
      st.winStreak++;
      if (st.winStreak > st.bestWinStreak) st.bestWinStreak = st.winStreak;
      if (g.size === 9) {
        st.wins9++;
        if (!st.best9 || seconds < st.best9) st.best9 = seconds;
      }
    } else {
      st.winStreak = 0;
    }
  }

  /*
   * 두 기록 합치기 (로그인했을 때 이 기기의 기록과 계정에 저장된 기록을 합칩니다)
   *   등급과 진행 상황 : 더 많이 한 쪽을 따릅니다
   *   최고 기록, 배지, 최다 연승 : 두 쪽에서 좋은 것을 모두 남깁니다
   */
  function amount(d) {
    return num(d.totalGames, 0) + num(d.daily && d.daily.total, 0);
  }
  function merge(a, b) {
    var base = amount(b) > amount(a) ? b : a;
    var other = base === a ? b : a;
    var out = JSON.parse(JSON.stringify(base));
    var k;
    for (k in other.bestTimes) {
      if (typeof other.bestTimes[k] === 'number' && !(out.bestTimes[k] <= other.bestTimes[k])) out.bestTimes[k] = other.bestTimes[k];
    }
    for (k in other.bestScores) {
      if (typeof other.bestScores[k] === 'number' && !(out.bestScores[k] >= other.bestScores[k])) out.bestScores[k] = other.bestScores[k];
    }
    for (k in other.badges) if (!out.badges[k]) out.badges[k] = other.badges[k];
    ['bestWinStreak', 'maxPromoted', 'perfectWins', 'noHintWins', 'wins9'].forEach(function (f) {
      out.stats[f] = Math.max(num(out.stats[f], 0), num(other.stats[f], 0));
    });
    if (other.stats.best9 && (!out.stats.best9 || other.stats.best9 < out.stats.best9)) out.stats.best9 = other.stats.best9;
    out.daily.bestStreak = Math.max(num(out.daily.bestStreak, 0), num(other.daily.bestStreak, 0));
    for (k in other.gradeStats) {
      var o = other.gradeStats[k], m = out.gradeStats[k];
      if (!m) { out.gradeStats[k] = o; continue; }
      m.best = Math.max(num(m.best, 0), num(o.best, 0));
      if (o.bestSec && (!m.bestSec || o.bestSec < m.bestSec)) m.bestSec = o.bestSec;
    }
    // 출석은 더 최근에 출석한 쪽, 아이템은 개수가 많은 쪽을 남깁니다
    var oa = other.attend || {};
    if (!out.attend) out.attend = { last: '', streak: 0, best: 0, total: 0 };
    if (typeof oa.last === 'string' && oa.last > (out.attend.last || '')) {
      out.attend.last = oa.last;
      out.attend.streak = num(oa.streak, 0);
    }
    out.attend.best = Math.max(num(out.attend.best, 0), num(oa.best, 0));
    out.attend.total = Math.max(num(out.attend.total, 0), num(oa.total, 0));
    if (!out.items) out.items = freshItems();
    for (k in other.items || {}) out.items[k] = Math.max(num(out.items[k], 0), num(other.items[k], 0));
    out.starterGiven = !!(out.starterGiven || other.starterGiven);
    // 하던 판은 이 기기 것을 남깁니다
    out.game = a.game || null;
    out.dailyGame = a.dailyGame || null;
    return out;
  }

  /* 저장된 글(JSON)을 기록으로 읽습니다 (계정에서 받아 온 기록에 씀) */
  function parse(raw) {
    var keep = Storage.get(SAVE_KEY);
    Storage.set(SAVE_KEY, raw);
    var d = load();
    if (keep === null) Storage.remove(SAVE_KEY);
    else Storage.set(SAVE_KEY, keep);
    return d;
  }

  /* ---------- 출석 체크 ---------- */
  /* 오늘 이미 출석했는가 */
  function attendDone(data, today) {
    return data.attend.last === (today || dateKey());
  }
  /*
   * 오늘이 출석 몇 일째인지 (출석 전이면 "출석하면 몇 일째가 되는지")
   *   반환 : 이어진 일수 (1부터). 7일 보상표의 자리는 (일수 - 1) % 7
   */
  function attendStreak(data, today) {
    var a = data.attend;
    today = today || dateKey();
    if (a.last === today) return Math.max(1, a.streak);
    if (a.last === dayBefore(today) || guardNeed(data, a.last, a.streak, today)) return a.streak + 1;
    return 1;
  }
  /* 오늘 출석할 때 보호권이 몇 장 쓰일지 (0 이면 안 쓰임) */
  function attendGuardNeed(data, today) {
    var a = data.attend;
    today = today || dateKey();
    if (a.last === today || a.last === dayBefore(today)) return 0;
    return guardNeed(data, a.last, a.streak, today);
  }
  /* 보상표에서 몇 번째 칸인지 (0 ~ 6) */
  function attendSlot(streak) {
    var n = C.ATTEND_REWARDS.length;
    return (Math.max(1, streak) - 1) % n;
  }
  /*
   * 출석하고 보상을 받습니다.
   * 반환 : { streak: 이어진 일수, reward: { 아이템id: 개수 } } (이미 했으면 null)
   */
  function attend(data, today) {
    today = today || dateKey();
    if (attendDone(data, today)) return null;
    var a = data.attend;
    var guarded = attendGuardNeed(data, today);
    a.streak = attendStreak(data, today);
    if (guarded) data.items.guard -= guarded;
    a.last = today;
    a.total++;
    if (a.streak > a.best) a.best = a.streak;
    var reward = C.ATTEND_REWARDS[attendSlot(a.streak)];
    for (var id in reward) addItem(data, id, reward[id]);
    return { streak: a.streak, reward: reward, guarded: guarded };
  }

  /* ---------- 아이템 ---------- */
  function itemCount(data, id) {
    return num(data.items && data.items[id], 0);
  }
  function addItem(data, id, n) {
    if (!data.items) data.items = freshItems();
    data.items[id] = itemCount(data, id) + (n || 1);
  }
  /* 아이템 한 개를 씁니다. 없으면 false */
  function useItem(data, id) {
    if (itemCount(data, id) <= 0) return false;
    data.items[id]--;
    return true;
  }
  function itemTotal(data) {
    var t = 0;
    for (var i = 0; i < C.ITEMS.length; i++) t += itemCount(data, C.ITEMS[i].id);
    return t;
  }

  /* ---------- 승급 미션 ---------- */
  function missionDefs(grade) {
    return (C.MISSIONS && C.MISSIONS[grade.id]) || [];
  }
  /* 이 등급의 '빨리 깨기' 기준 시간(초), 없으면 0 */
  function fastSec(grade) {
    var defs = missionDefs(grade);
    for (var i = 0; i < defs.length; i++) if (defs[i].type === 'fast') return defs[i].min * 60;
    return 0;
  }
  var MISSION_TEXT = {
    win: function (m) { return '이 등급에서 ' + m.n + '판 깨기'; },
    perfect: function (m) { return '한 번도 안 틀리고 ' + m.n + '판 깨기'; },
    nohint: function (m) { return '힌트 없이 ' + m.n + '판 깨기'; },
    fast: function (m) { return m.min + '분 안에 ' + m.n + '판 깨기'; },
    streak: function (m) { return '실패 없이 ' + m.n + '판 연달아 깨기'; }
  };
  /* 지금 등급의 미션 목록 : [{ type, text, have, need, done }] (가장 높은 등급이면 빈 목록) */
  function missions(data) {
    if (data.gradeIndex >= C.GRADES.length - 1) return [];
    var m = data.mission;
    return missionDefs(C.GRADES[data.gradeIndex]).map(function (d) {
      var have = d.type === 'win' ? data.wins : d.type === 'streak' ? m.best : num(m[d.type], 0);
      return { type: d.type, text: (MISSION_TEXT[d.type] || MISSION_TEXT.win)(d), have: Math.min(have, d.n), need: d.n, done: have >= d.n };
    });
  }
  function missionsDone(data) {
    var list = missions(data);
    for (var i = 0; i < list.length; i++) if (!list[i].done) return false;
    return true;
  }
  /* { done: 깬 미션 수, total: 전체 미션 수 } */
  function missionCount(data) {
    var list = missions(data), done = 0;
    for (var i = 0; i < list.length; i++) if (list[i].done) done++;
    return { done: done, total: list.length };
  }

  S.Storage = Storage;

  S.Progress = {
    load: load,
    save: save,
    reset: reset,
    recordWin: recordWin,
    recordLoss: recordLoss,
    missions: missions,
    missionCount: missionCount,
    setGrade: setGrade,
    dateKey: dateKey,
    dailyDone: dailyDone,
    dailyStreak: dailyStreak,
    recordDaily: recordDaily,
    recordStats: recordStats,
    merge: merge,
    parse: parse,
    amount: amount,
    attendDone: attendDone,
    attendStreak: attendStreak,
    attendSlot: attendSlot,
    attendGuardNeed: attendGuardNeed,
    attend: attend,
    itemCount: itemCount,
    addItem: addItem,
    useItem: useItem,
    itemTotal: itemTotal,
    onSave: null
  };
})(typeof window !== 'undefined' ? window : globalThis);
