/*
 * 업적 배지 목록.
 * 한 판이 끝날 때마다 아래 조건을 살펴보고, 새로 조건을 채운 배지를 줍니다.
 * 받은 배지는 "내 기록" 창에서 볼 수 있습니다.
 *
 *   id   : 프로그램 안에서 쓰는 이름 (한 번 정하면 바꾸지 마세요. 받은 기록이 이 이름을 씁니다)
 *   icon : 배지 그림 (이모지 한 글자)
 *   name : 배지 이름
 *   desc : 받는 방법
 *   test : 받을 수 있으면 true (d 는 내 기록, js/progress.js 참고)
 *
 * 새 배지를 추가하려면 목록에 같은 모양으로 한 줄을 더 넣으면 됩니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;

  /* 등급 이름으로 등급 순서 찾기 (등급 목록이 바뀌어도 맞게) */
  function gradeAt(id) {
    for (var i = 0; i < C.GRADES.length; i++) if (C.GRADES[i].id === id) return i;
    return C.GRADES.length - 1;
  }
  function gradeName(id) {
    return C.GRADES[gradeAt(id)].name;
  }

  var LIST = [
    // 처음 해 보기
    { id: 'first-win', icon: '🌱', name: '첫걸음', desc: '처음으로 한 판을 깨요', test: function (d) { return d.totalWins >= 1; } },
    { id: 'first-promo', icon: '⬆️', name: '첫 승급', desc: '승급전에서 처음으로 한 단계 올라가요', test: function (d) { return d.stats.maxPromoted >= 1; } },
    { id: 'first-9', icon: '🧩', name: '큰 판 도전', desc: '9×9 판을 처음으로 깨요', test: function (d) { return d.stats.wins9 >= 1; } },

    // 실력
    { id: 'perfect', icon: '💎', name: '무결점', desc: '한 번도 안 틀리고 한 판을 깨요', test: function (d) { return d.stats.perfectWins >= 1; } },
    { id: 'perfect-10', icon: '👑', name: '완벽주의자', desc: '한 번도 안 틀리고 10판을 깨요', test: function (d) { return d.stats.perfectWins >= 10; } },
    { id: 'no-hint-10', icon: '🧠', name: '혼자 힘으로', desc: '힌트 없이 10판을 깨요', test: function (d) { return d.stats.noHintWins >= 10; } },
    { id: 'streak-5', icon: '🔥', name: '5연승', desc: '실패 없이 5판을 연달아 깨요', test: function (d) { return d.stats.bestWinStreak >= 5; } },
    { id: 'streak-20', icon: '☄️', name: '20연승', desc: '실패 없이 20판을 연달아 깨요', test: function (d) { return d.stats.bestWinStreak >= 20; } },
    { id: 'fast-9', icon: '⚡', name: '번개손', desc: '9×9 판을 5분 안에 깨요', test: function (d) { return d.stats.best9 > 0 && d.stats.best9 <= 300; } },

    // 꾸준함
    { id: 'wins-10', icon: '🥉', name: '10판 성공', desc: '모두 10판을 깨요', test: function (d) { return d.totalWins >= 10; } },
    { id: 'wins-50', icon: '🥈', name: '50판 성공', desc: '모두 50판을 깨요', test: function (d) { return d.totalWins >= 50; } },
    { id: 'wins-200', icon: '🥇', name: '200판 성공', desc: '모두 200판을 깨요', test: function (d) { return d.totalWins >= 200; } },
    { id: 'score-100k', icon: '💰', name: '점수 부자', desc: '모은 점수가 10만 점을 넘어요', test: function (d) { return d.totalScore >= 100000; } },

    // 오늘의 퍼즐
    { id: 'daily-1', icon: '📅', name: '오늘의 도전', desc: '오늘의 퍼즐을 처음으로 풀어요', test: function (d) { return d.daily.total >= 1; } },
    { id: 'daily-7', icon: '🗓️', name: '일주일 개근', desc: '오늘의 퍼즐을 7일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 7; } },
    { id: 'daily-30', icon: '🏆', name: '한 달 개근', desc: '오늘의 퍼즐을 30일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 30; } },

    // 등급 (승급으로 올라가야 받습니다)
    { id: 'grade-gosu', icon: '🥋', name: gradeName('gosu') + ' 승급', desc: '승급전으로 ' + gradeName('gosu') + ' 등급까지 올라가요', test: function (d) { return d.stats.maxPromoted >= gradeAt('gosu'); } },
    { id: 'grade-hero', icon: '🦸', name: gradeName('hero') + ' 승급', desc: '승급전으로 ' + gradeName('hero') + ' 등급까지 올라가요', test: function (d) { return d.stats.maxPromoted >= gradeAt('hero'); } },
    { id: 'grade-top', icon: '🌟', name: C.GRADES[C.GRADES.length - 1].name + ' 승급', desc: '승급전으로 가장 높은 등급까지 올라가요', test: function (d) { return d.stats.maxPromoted >= C.GRADES.length - 1; } }
  ];

  /*
   * 새로 받은 배지를 찾아 기록에 넣습니다.
   * 반환 : 이번에 새로 받은 배지 목록
   */
  function check(data, dateKey) {
    var got = [];
    for (var i = 0; i < LIST.length; i++) {
      var b = LIST[i];
      if (data.badges[b.id]) continue;
      var ok = false;
      try {
        ok = !!b.test(data);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        data.badges[b.id] = dateKey || S.Progress.dateKey();
        got.push(b);
      }
    }
    return got;
  }

  function count(data) {
    var n = 0;
    for (var i = 0; i < LIST.length; i++) if (data.badges[LIST[i].id]) n++;
    return n;
  }

  S.Badges = { LIST: LIST, check: check, count: count };
})(typeof window !== 'undefined' ? window : globalThis);
