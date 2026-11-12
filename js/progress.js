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
      }
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
        }
      }
    } catch (e) {
      data = fresh();
    }
    return data;
  }

  function save(data) {
    try {
      Storage.set(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      /* 저장 실패는 조용히 넘어갑니다 */
    }
  }

  function reset() {
    Storage.remove(SAVE_KEY);
    return fresh();
  }

  /*
   * 한 판 성공 처리.
   * 반환 : { promoted: 승급했는지, grade: 처리 후 등급, newBest: 최고 기록인지, newBestScore: 최고 점수인지 }
   */
  function recordWin(data, seconds, score) {
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

    var promoted = false;
    if (data.wins >= C.WINS_TO_PROMOTE && data.gradeIndex < C.GRADES.length - 1) {
      data.gradeIndex++;
      data.wins = 0;
      promoted = true;
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
    var demoted = false;
    if (data.failStreak >= C.FAILS_TO_DEMOTE) {
      data.failStreak = 0;
      if (data.gradeIndex > 0) {
        data.gradeIndex--;
        data.wins = 0;
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
  /* 지금 이어지고 있는 연속 일수 (어제도 오늘도 안 풀었으면 0) */
  function dailyStreak(data, today) {
    var last = data.daily.last;
    return last === today || last === dayBefore(today) ? data.daily.streak : 0;
  }
  /* 오늘의 퍼즐 성공 처리. 반환 : { streak: 연속 일수 } */
  function recordDaily(data, key, seconds, score) {
    var d = data.daily;
    if (d.last === key) return { streak: d.streak };
    d.streak = d.last === dayBefore(key) ? d.streak + 1 : 1;
    if (d.streak > d.bestStreak) d.bestStreak = d.streak;
    d.last = key;
    d.total++;
    d.score = score || 0;
    d.seconds = seconds || 0;
    if (typeof score === 'number' && score > 0) data.totalScore += score;
    return { streak: d.streak };
  }

  /* 승급까지 남은 판 수 (가장 높은 등급이면 -1) */
  function winsLeft(data) {
    if (data.gradeIndex >= C.GRADES.length - 1) return -1;
    return Math.max(1, C.WINS_TO_PROMOTE - data.wins);
  }

  S.Storage = Storage;

  S.Progress = {
    load: load,
    save: save,
    reset: reset,
    recordWin: recordWin,
    recordLoss: recordLoss,
    winsLeft: winsLeft,
    setGrade: setGrade,
    dateKey: dateKey,
    dailyDone: dailyDone,
    dailyStreak: dailyStreak,
    recordDaily: recordDaily
  };
})(typeof window !== 'undefined' ? window : globalThis);
