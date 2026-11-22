/*
 * 업적 배지 목록.
 * 한 판이 끝날 때마다 아래 조건을 살펴보고, 새로 조건을 채운 배지를 줍니다.
 * 받은 배지는 "내 기록" 창에서 볼 수 있습니다.
 *
 *   tier : 받기 어려운 정도 (bronze 쉬움, silver 보통, gold 어려움, diamond 아주 어려움, legend 최고) — 아래 TIERS
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

  /* 등급 이름 → 승급 배지 하나 만들기 */
  function gradeBadge(tier, gid, icon) {
    return {
      tier: tier, id: 'grade-' + gid, icon: icon, name: gradeName(gid) + ' 승급',
      desc: '승급전으로 ' + gradeName(gid) + ' 등급까지 올라가요',
      test: function (d) { return d.stats.maxPromoted >= gradeAt(gid); }
    };
  }
  /* 모든 등급에서 한 번도 안 틀리고 한 판씩 */
  function perfectEveryGrade(d) {
    for (var i = 0; i < C.GRADES.length; i++) {
      var gs = d.gradeStats[C.GRADES[i].id];
      if (!gs || !(gs.perfect >= 1)) return false;
    }
    return true;
  }
  function attendBest(d) {
    return (d.attend && d.attend.best) || 0;
  }
  function fast9(sec) {
    return function (d) { return d.stats.best9 > 0 && d.stats.best9 <= sec; };
  }

  /*
   * 받기 어려운 정도. 배지 화면에서 이 순서대로 묶어 보여 줍니다.
   *   id : 배지의 tier 에 쓰는 이름,  name : 화면 이름,  hint : 덧붙이는 말,  color : 묶음 색
   */
  var TIERS = [
    { id: 'bronze', name: '브론즈', hint: '쉬움', icon: '🥉', color: '#b8743a' },
    { id: 'silver', name: '실버', hint: '보통', icon: '🥈', color: '#8a96a3' },
    { id: 'gold', name: '골드', hint: '어려움', icon: '🥇', color: '#d4a017' },
    { id: 'diamond', name: '다이아', hint: '아주 어려움', icon: '💎', color: '#3fa7d6' },
    { id: 'legend', name: '전설', hint: '최고 난이도', icon: '🌈', color: '#a259d9' }
  ];

  var LIST = [
    // ---------- 브론즈 : 쉬움 ----------
    { tier: 'bronze', id: 'first-win', icon: '🌱', name: '첫걸음', desc: '처음으로 한 판을 깨요', test: function (d) { return d.totalWins >= 1; } },
    { tier: 'bronze', id: 'first-promo', icon: '⬆️', name: '첫 승급', desc: '승급전에서 처음으로 한 단계 올라가요', test: function (d) { return d.stats.maxPromoted >= 1; } },
    { tier: 'bronze', id: 'perfect', icon: '✨', name: '무결점', desc: '한 번도 안 틀리고 한 판을 깨요', test: function (d) { return d.stats.perfectWins >= 1; } },
    { tier: 'bronze', id: 'games-10', icon: '🎮', name: '단골손님', desc: '모두 10판을 해 봐요 (성공·실패 모두)', test: function (d) { return d.totalGames >= 10; } },
    { tier: 'bronze', id: 'wins-10', icon: '🎯', name: '10판 성공', desc: '모두 10판을 깨요', test: function (d) { return d.totalWins >= 10; } },
    { tier: 'bronze', id: 'hint-1', icon: '💡', name: '도움 받기', desc: '처음으로 힌트를 써 봐요', test: function (d) { return d.stats.hintsUsed >= 1; } },
    { tier: 'bronze', id: 'score-1k', icon: '🪙', name: '동전 모으기', desc: '모은 점수가 1천 점을 넘어요', test: function (d) { return d.totalScore >= 1000; } },
    { tier: 'bronze', id: 'daily-1', icon: '📅', name: '오늘의 도전', desc: '오늘의 퍼즐을 처음으로 풀어요', test: function (d) { return d.daily.total >= 1; } },
    { tier: 'bronze', id: 'attend-3', icon: '👋', name: '또 왔어요', desc: '3일 연속으로 출석해요', test: function (d) { return attendBest(d) >= 3; } },

    // ---------- 실버 : 보통 ----------
    { tier: 'silver', id: 'first-9', icon: '🧩', name: '큰 판 도전', desc: '9×9 판을 처음으로 깨요', test: function (d) { return d.stats.wins9 >= 1; } },
    gradeBadge('silver', 'gosu', '🥋'),
    { tier: 'silver', id: 'wins-50', icon: '🏅', name: '50판 성공', desc: '모두 50판을 깨요', test: function (d) { return d.totalWins >= 50; } },
    { tier: 'silver', id: 'streak-5', icon: '🔥', name: '5연승', desc: '실패 없이 5판을 연달아 깨요', test: function (d) { return d.stats.bestWinStreak >= 5; } },
    { tier: 'silver', id: 'no-hint-10', icon: '🧠', name: '혼자 힘으로', desc: '힌트 없이 10판을 깨요', test: function (d) { return d.stats.noHintWins >= 10; } },
    { tier: 'silver', id: 'perfect-5', icon: '🎖️', name: '꼼꼼이', desc: '한 번도 안 틀리고 5판을 깨요', test: function (d) { return d.stats.perfectWins >= 5; } },
    { tier: 'silver', id: 'wins9-10', icon: '🔟', name: '9×9 단골', desc: '9×9 판을 10번 깨요', test: function (d) { return d.stats.wins9 >= 10; } },
    { tier: 'silver', id: 'fast-9-10m', icon: '⏱️', name: '날쌘손', desc: '9×9 판을 10분 안에 깨요', test: fast9(600) },
    { tier: 'silver', id: 'score-10k', icon: '💵', name: '점수 모으기', desc: '모은 점수가 1만 점을 넘어요', test: function (d) { return d.totalScore >= 10000; } },
    { tier: 'silver', id: 'daily-7', icon: '🗓️', name: '일주일 개근', desc: '오늘의 퍼즐을 7일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 7; } },
    { tier: 'silver', id: 'attend-7', icon: '📌', name: '출석 일주일', desc: '7일 연속으로 출석해요', test: function (d) { return attendBest(d) >= 7; } },
    { tier: 'silver', id: 'play-1h', icon: '⌛', name: '푹 빠졌어요', desc: '게임한 시간이 모두 1시간을 넘어요', test: function (d) { return d.stats.playSec >= 3600; } },

    // ---------- 골드 : 어려움 ----------
    gradeBadge('gold', 'hero', '🦸'),
    gradeBadge('gold', 'jijon', '🐉'),
    { tier: 'gold', id: 'perfect-10', icon: '👑', name: '완벽주의자', desc: '한 번도 안 틀리고 10판을 깨요', test: function (d) { return d.stats.perfectWins >= 10; } },
    { tier: 'gold', id: 'streak-20', icon: '☄️', name: '20연승', desc: '실패 없이 20판을 연달아 깨요', test: function (d) { return d.stats.bestWinStreak >= 20; } },
    { tier: 'gold', id: 'no-hint-50', icon: '🦉', name: '척척박사', desc: '힌트 없이 50판을 깨요', test: function (d) { return d.stats.noHintWins >= 50; } },
    { tier: 'gold', id: 'wins-200', icon: '🏆', name: '200판 성공', desc: '모두 200판을 깨요', test: function (d) { return d.totalWins >= 200; } },
    { tier: 'gold', id: 'wins9-50', icon: '🗿', name: '9×9 장인', desc: '9×9 판을 50번 깨요', test: function (d) { return d.stats.wins9 >= 50; } },
    { tier: 'gold', id: 'fast-9', icon: '⚡', name: '번개손', desc: '9×9 판을 5분 안에 깨요', test: fast9(300) },
    { tier: 'gold', id: 'score-100k', icon: '💰', name: '점수 부자', desc: '모은 점수가 10만 점을 넘어요', test: function (d) { return d.totalScore >= 100000; } },
    { tier: 'gold', id: 'daily-30', icon: '📆', name: '한 달 개근', desc: '오늘의 퍼즐을 30일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 30; } },
    { tier: 'gold', id: 'attend-30', icon: '🏠', name: '출석 한 달', desc: '30일 연속으로 출석해요', test: function (d) { return attendBest(d) >= 30; } },
    { tier: 'gold', id: 'play-10h', icon: '🕰️', name: '스도쿠 사랑', desc: '게임한 시간이 모두 10시간을 넘어요', test: function (d) { return d.stats.playSec >= 36000; } },

    // ---------- 다이아 : 아주 어려움 ----------
    gradeBadge('diamond', 'choin', '🦾'),
    gradeBadge('diamond', 'daewang', '🏯'),
    { tier: 'diamond', id: 'perfect-50', icon: '💠', name: '실수 없는 손', desc: '한 번도 안 틀리고 50판을 깨요', test: function (d) { return d.stats.perfectWins >= 50; } },
    { tier: 'diamond', id: 'streak-50', icon: '🌋', name: '50연승', desc: '실패 없이 50판을 연달아 깨요', test: function (d) { return d.stats.bestWinStreak >= 50; } },
    { tier: 'diamond', id: 'wins-500', icon: '🎗️', name: '500판 성공', desc: '모두 500판을 깨요', test: function (d) { return d.totalWins >= 500; } },
    { tier: 'diamond', id: 'fast-9-3m', icon: '🚀', name: '로켓손', desc: '9×9 판을 3분 안에 깨요', test: fast9(180) },
    { tier: 'diamond', id: 'score-1m', icon: '🏦', name: '점수 재벌', desc: '모은 점수가 100만 점을 넘어요', test: function (d) { return d.totalScore >= 1000000; } },
    { tier: 'diamond', id: 'daily-100', icon: '🌙', name: '백일 개근', desc: '오늘의 퍼즐을 100일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 100; } },

    // ---------- 전설 : 최고 난이도 ----------
    { tier: 'legend', id: 'grade-top', icon: '🌟', name: C.GRADES[C.GRADES.length - 1].name + ' 승급', desc: '승급전으로 가장 높은 등급까지 올라가요', test: function (d) { return d.stats.maxPromoted >= C.GRADES.length - 1; } },
    { tier: 'legend', id: 'perfect-all', icon: '🌈', name: '모든 등급 정복', desc: '모든 등급에서 한 번도 안 틀리고 한 판씩 깨요', test: perfectEveryGrade },
    { tier: 'legend', id: 'wins-1000', icon: '🏛️', name: '천 판의 전설', desc: '모두 1000판을 깨요', test: function (d) { return d.totalWins >= 1000; } },
    { tier: 'legend', id: 'fast-9-2m', icon: '⚜️', name: '신의 손', desc: '9×9 판을 2분 안에 깨요', test: fast9(120) },
    { tier: 'legend', id: 'daily-365', icon: '☀️', name: '일 년 개근', desc: '오늘의 퍼즐을 365일 연속으로 풀어요', test: function (d) { return d.daily.bestStreak >= 365; } }
  ];

  /* 배지의 어려운 정도 정보 */
  function tierOf(b) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === b.tier) return TIERS[i];
    return TIERS[0];
  }

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

  S.Badges = { LIST: LIST, TIERS: TIERS, tierOf: tierOf, check: check, count: count };
})(typeof window !== 'undefined' ? window : globalThis);
