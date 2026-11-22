/*
 * 랭킹 : 오늘 · 주간 · 월간 · 명예의 전당.
 *
 *   오늘의 날쌘냥    오늘의 퍼즐을 푼 시간 (빠를수록 위)      밤 12시에 새로 시작
 *   이번 주 부지런냥  이번 주(월~일)에 모은 점수               월요일 0시(한국 시간)에 새로 시작
 *   이달의 왕냥이    이번 달에 모은 점수                       1일 0시(한국 시간)에 새로 시작
 *   냥이 명예의 전당 지난 달들의 1~3위 + 가장 높은 등급을 처음 찍은 사람들
 *
 * 각 랭킹은 "전체"와 "내 등급"(열린 가장 높은 등급이 같은 사람끼리) 두 가지로 볼 수 있습니다.
 * 상 : 지난주 상위 10% → 힌트 1장,  지난달 1~3위 → 👑 왕냥이 배지 + 힌트 3장 (다음에 들어올 때 받음)
 *
 * 로그인하고 닉네임을 정한 사람만 랭킹에 오릅니다. (구글 계정의 실제 이름은 보이지 않음)
 * 점수는 로그인하지 않아도 이 기기에 모아 두었다가, 로그인하면 이번 주 · 이번 달 것을 올립니다.
 *
 * Firestore 에 저장하는 곳 (보안 규칙은 firestore.rules)
 *   players/{uid}                 { nick, at }                닉네임
 *   boards/{판}/rows/{uid}         { nick, grade, v, crown, at } 랭킹 한 줄
 *      판 이름 : d_2026-11-23 (오늘) · w_2026-11-23 (그 주 월요일) · m_2026-11 (달)
 *               뒤에 _g3 이 붙으면 그 등급 묶음만 (3 = 등급 순서)
 *   hall/{등급id}/rows/{uid}       { nick, at }                가장 높은 등급을 처음 찍은 사람
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;

  var TOP = 50; // 한 번에 보여 주는 순위 수
  var CACHE_MS = 60 * 1000; // 같은 랭킹을 다시 열 때 이 시간 안이면 다시 받지 않음 (무료 사용량 아끼기)
  var CREATE_MAX = 300000; // 처음 올릴 때 한 번에 올릴 수 있는 점수 (보안 규칙과 같게)
  var STEP_MAX = 60000; // 그 뒤로 한 번에 더할 수 있는 점수 (보안 규칙과 같게)
  var GAP_MS = 11000; // 같은 줄을 다시 올리려면 기다리는 시간 (보안 규칙은 10초)
  var DAILY_MIN = 60; // 오늘의 퍼즐 최소 시간(초) (보안 규칙과 같게)
  var MONTHS_IN_HALL = 6; // 명예의 전당에 보여 줄 지난 달 수

  var BOARD = {
    day: { title: '오늘의 날쌘냥', icon: '⚡', note: '오늘의 퍼즐을 가장 빨리 푼 순서예요. 밤 12시에 새로 시작해요.', low: true },
    week: { title: '이번 주 부지런냥', icon: '🐾', note: '이번 주(월~일)에 모은 점수예요. 월요일 0시에 새로 시작해요.\n상위 10%에 들면 다음 주에 힌트 1장을 받아요.' },
    month: { title: '이달의 왕냥이', icon: '👑', note: '이번 달에 모은 점수예요. 1일 0시에 새로 시작해요.\n1~3위는 👑 왕냥이 배지와 힌트 3장을 받아요.' },
    hall: { title: '냥이 명예의 전당', icon: '🏛️', note: '한 번 이름이 오르면 사라지지 않아요.' }
  };

  /* ---------------- 날짜 (한국 시간) ---------------- */
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function kst(ms) { return new Date((ms == null ? Date.now() : ms) + 9 * 3600 * 1000); }
  function ymd(d) { return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate()); }
  function weekKey(ms) {
    var d = kst(ms), back = (d.getUTCDay() + 6) % 7; // 월요일까지 며칠 전인지
    return ymd(new Date(d.getTime() - back * 86400000));
  }
  function monthKey(ms) {
    var d = kst(ms);
    return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1);
  }
  function monthBefore(key, n) {
    var p = key.split('-'), y = +p[0], m = +p[1] - (n || 1);
    while (m < 1) { m += 12; y--; }
    return y + '-' + two(m);
  }
  function dayKey() { return S.Progress.dateKey(); } // 오늘의 퍼즐과 같은 날짜 (이 기기 기준)
  function boardId(kind, key, g) {
    return (kind === 'day' ? 'd_' : kind === 'week' ? 'w_' : 'm_') + key + (g == null ? '' : '_g' + g);
  }

  /* ---------------- 보여 주기 도우미 ---------------- */
  function fmtScore(n) { return Math.floor(n || 0).toLocaleString('ko-KR'); }
  function fmtTime(sec) {
    sec = Math.floor(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + two(m) : m) + ':' + two(s);
  }
  function fmtValue(kind, v) { return kind === 'day' ? fmtTime(v) : fmtScore(v) + '점'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function gradeOf(i) { return C.GRADES[Math.max(0, Math.min(C.GRADES.length - 1, i || 0))]; }
  function topGrade() { return C.GRADES[C.GRADES.length - 1]; }

  /* ---------------- 닉네임 ---------------- */
  // 쓰면 안 되는 말 (띄어쓰기 · 숫자 · 기호를 뺀 뒤에 찾음)
  var BAD = ['시발', '씨발', '씨빨', '시바', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '개새', '새끼', '색기', '좆', '존나', '졸라', 'ㅈㄴ',
    '지랄', 'ㅈㄹ', '미친', '미쳤', '썅', '닥쳐', '꺼져', '엠창', '느금', '니미', '애미', '애비', '섹스', '야동', '보지', '자지', '틀딱', '한남', '김치녀',
    'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'pussy', 'nigger', 'nigga',
    '운영자', '관리자', '개발자', 'admin', 'gm'];
  function nickError(n) {
    n = String(n || '').trim();
    if (n.length < 2) return '2글자 이상으로 정해 주세요';
    if (n.length > 10) return '10글자까지 쓸 수 있어요';
    if (!/^[가-힣a-zA-Z0-9_ ]+$/.test(n)) return '한글 · 영어 · 숫자만 쓸 수 있어요';
    if (/\s{2,}/.test(n)) return '띄어쓰기는 한 칸만 쓸 수 있어요';
    var flat = n.toLowerCase().replace(/[\s0-9_]/g, '');
    for (var i = 0; i < BAD.length; i++) {
      if (BAD[i] === 'gm' ? flat === 'gm' : flat.indexOf(BAD[i]) >= 0) return '쓸 수 없는 말이 들어 있어요';
    }
    return '';
  }

  /* ---------------- 바깥과 연결 (ui.js 의 start 로 받음) ---------------- */
  var hooks = { data: null, save: null, modal: null, toast: null, playDaily: null, refresh: null, loginButton: null };
  function D() { return hooks.data(); }
  function R() {
    var d = D();
    if (!d.rank) d.rank = { wk: '', ws: 0, mk: '', ms: 0, dk: '', dv: 0, nick: '', g: -1, checked: {}, crowns: 0, tops: 0, hall: false };
    return d.rank;
  }
  function user() { return S.Account && S.Account.user(); }

  /* 기간이 바뀌었으면 새로 셉니다 */
  function roll(r) {
    var wk = weekKey(), mk = monthKey();
    if (r.wk !== wk) { r.wk = wk; r.ws = 0; }
    if (r.mk !== mk) { r.mk = mk; r.ms = 0; }
  }

  /* 한 판이 끝나면 (ui.js) : 이번 판 점수를 이번 주 · 이번 달에 더합니다 */
  function addScore(d, score) {
    var r = d.rank;
    roll(r);
    if (typeof score === 'number' && score > 0) {
      r.ws += Math.floor(score);
      r.ms += Math.floor(score);
    }
    later();
  }
  /* 오늘의 퍼즐을 풀면 (ui.js) */
  function addDaily(d, key, seconds) {
    var r = d.rank;
    if (r.dk !== key || !r.dv || seconds < r.dv) {
      r.dk = key;
      r.dv = Math.max(DAILY_MIN, Math.floor(seconds));
    }
    later();
  }

  /* ---------------- Firestore ---------------- */
  var fb = null;
  function db() {
    if (fb) return Promise.resolve(fb);
    if (!S.Account || !S.Account.configured()) return Promise.reject(new Error('not-configured'));
    return S.Account.open().then(function (x) { fb = x; return x; });
  }
  function rows(id) { return fb.db.collection('boards').doc(id).collection('rows'); }
  function stamp() { return fb.firebase.firestore.FieldValue.serverTimestamp(); }

  /*
   * 개수 세기 : Firebase 앱용 묶음(compat)에는 개수 세기가 없어서 Firestore 웹 주소로 직접 묻습니다.
   * (읽기 권한은 같은 보안 규칙을 따름. 1,000줄마다 읽기 1번으로 쳐서 아주 쌈)
   *   op : 'GREATER_THAN' · 'LESS_THAN' (없으면 전체 개수)
   */
  function count(id, op, v) {
    var q = { from: [{ collectionId: 'rows' }] };
    if (op) q.where = { fieldFilter: { field: { fieldPath: 'v' }, op: op, value: { integerValue: String(Math.floor(v)) } } };
    var url = 'https://firestore.googleapis.com/v1/projects/' + C.FIREBASE.projectId +
      '/databases/(default)/documents/boards/' + encodeURIComponent(id) + ':runAggregationQuery?key=' + C.FIREBASE.apiKey;
    var u = fb && fb.auth.currentUser;
    return (u ? u.getIdToken() : Promise.resolve(''))
      .then(function (token) {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = 'Bearer ' + token;
        return fetch(url, {
          method: 'POST', headers: headers,
          body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: 'n', count: {} }] } })
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error('count ' + res.status);
        return res.json();
      })
      .then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var f = list[i].result && list[i].result.aggregateFields;
          if (f && f.n) return Number(f.n.integerValue || 0);
        }
        return 0;
      });
  }
  function better(kind) { return BOARD[kind].low ? 'LESS_THAN' : 'GREATER_THAN'; }

  /* ---------------- 내 기록 올리기 ---------------- */
  var server = {}; // 판 이름 → 서버에 있는 내 줄 { v, nick, crown, t(올린 시각) } (null = 없음)
  var bad = {}; // 올리다가 거절된 판 (이번에 켠 동안은 다시 안 함)
  var chain = Promise.resolve();
  var laterTimer = 0;
  var nickLoaded = '';

  function later(ms) {
    window.clearTimeout(laterTimer);
    laterTimer = window.setTimeout(sync, ms || 2500);
  }

  function mine(id) {
    if (Object.prototype.hasOwnProperty.call(server, id)) return Promise.resolve(server[id]);
    return rows(id).doc(user().uid).get().then(function (snap) {
      server[id] = snap.exists ? { v: snap.get('v'), nick: snap.get('nick'), crown: snap.get('crown'), t: 0 } : null;
      return server[id];
    });
  }

  /* 판 하나에 내 값을 올립니다. 반환 : 더 올려야 할 것이 남았는지 */
  function push(id, kind, value, g) {
    if (bad[id]) return Promise.resolve(false);
    var r = R(), u = user();
    return mine(id).then(function (cur) {
      var crown = r.crowns > 0;
      var same = cur && cur.nick === r.nick && cur.crown === crown;
      var next;
      if (kind === 'day') {
        if (cur && cur.v <= value && same) return false;
        next = cur ? Math.min(cur.v, value) : value;
      } else {
        if (cur && cur.v >= value && same) return false;
        next = cur ? Math.min(value, cur.v + STEP_MAX) : Math.min(value, CREATE_MAX);
        if (cur) next = Math.max(next, cur.v);
      }
      if (cur && Date.now() - cur.t < GAP_MS) return true; // 조금 뒤에 다시
      return rows(id).doc(u.uid).set({ nick: r.nick, grade: g, v: Math.floor(next), crown: crown, at: stamp() }).then(function () {
        server[id] = { v: Math.floor(next), nick: r.nick, crown: crown, t: Date.now() };
        delete cache[id];
        return kind !== 'day' && next < value;
      });
    }).catch(function (e) {
      if (e && e.code === 'permission-denied') bad[id] = true;
      return false;
    });
  }

  /* 지금 기록을 모두 서버에 맞춥니다 (로그인 + 닉네임이 있을 때만) */
  function sync() {
    chain = chain.then(function () {
      var u = user(), r = R(), d = D();
      if (!u || !r.nick) return;
      return db().then(function () {
        roll(r);
        var g = Math.max(0, d.reach || 0), jobs = [];
        // 등급 묶음이 바뀌었으면 예전 묶음의 이번 기간 줄은 지웁니다
        if (r.g >= 0 && r.g !== g) {
          var old = r.g;
          [['week', r.wk], ['month', r.mk], ['day', r.dk]].forEach(function (b) {
            if (!b[1]) return;
            var id = boardId(b[0], b[1], old);
            delete server[id];
            delete cache[id];
            jobs.push(rows(id).doc(u.uid).delete().catch(function () {}));
          });
        }
        if (r.g !== g) {
          r.g = g;
          hooks.save();
        }
        var more = false;
        function go(id, kind, v) {
          jobs.push(push(id, kind, v, g).then(function (m) { if (m) more = true; }));
        }
        if (r.ws > 0) { go(boardId('week', r.wk), 'week', r.ws); go(boardId('week', r.wk, g), 'week', r.ws); }
        if (r.ms > 0) { go(boardId('month', r.mk), 'month', r.ms); go(boardId('month', r.mk, g), 'month', r.ms); }
        if (r.dk === dayKey() && r.dv > 0) { go(boardId('day', r.dk), 'day', r.dv); go(boardId('day', r.dk, g), 'day', r.dv); }
        jobs.push(claimHall());
        return Promise.all(jobs).then(function () {
          if (more) later(GAP_MS);
        });
      });
    }).catch(function () { /* 인터넷이 없으면 다음에 */ });
    return chain;
  }

  /* 가장 높은 등급을 처음 찍었으면 명예의 전당에 이름을 올립니다 (한 번만) */
  function claimHall() {
    var d = D(), r = R(), u = user();
    if (r.hall || !u || !r.nick || !(d.stats && d.stats.maxPromoted >= C.GRADES.length - 1)) return Promise.resolve();
    var ref = fb.db.collection('hall').doc(topGrade().id).collection('rows').doc(u.uid);
    return ref.set({ nick: r.nick, at: stamp() }).catch(function (e) {
      if (!(e && e.code === 'permission-denied')) throw e; // 이미 올라가 있으면 거절됨 → 올린 것으로 침
    }).then(function () {
      r.hall = true;
      hallCache = null;
      hooks.save();
    }).catch(function () {});
  }

  /* 로그인하면 서버의 닉네임을 받아 옵니다 */
  function loadNick() {
    var u = user();
    if (!u || nickLoaded === u.uid) return Promise.resolve();
    return db().then(function () {
      return fb.db.collection('players').doc(u.uid).get();
    }).then(function (snap) {
      nickLoaded = u.uid;
      var r = R();
      var nick = snap.exists ? snap.get('nick') : '';
      if (nick && nick !== r.nick) {
        r.nick = nick;
        hooks.save();
      } else if (!nick && r.nick) {
        // 이 기기에만 있던 닉네임 (예전에 정했는데 서버에 없음) : 다시 올림
        return fb.db.collection('players').doc(u.uid).set({ nick: r.nick, at: stamp() }).catch(function () {});
      }
    }).catch(function () {});
  }

  function setNick(nick) {
    nick = String(nick || '').trim().replace(/\s+/g, ' ');
    var err = nickError(nick);
    if (err) return Promise.reject(new Error(err));
    var u = user();
    if (!u) return Promise.reject(new Error('먼저 로그인해 주세요'));
    return db().then(function () {
      return fb.db.collection('players').doc(u.uid).set({ nick: nick, at: stamp() });
    }).then(function () {
      R().nick = nick;
      nickLoaded = u.uid;
      hooks.save();
      for (var id in cache) delete cache[id];
      return sync();
    }, function (e) {
      throw new Error(e && e.code === 'permission-denied' ? '랭킹이 아직 준비 중이에요' : '인터넷 연결을 확인해 주세요');
    });
  }

  /* 계정을 지울 때 (account.js) : 닉네임과 이번 기간 랭킹 줄, 명예의 전당 이름을 지웁니다 */
  function forget(uid) {
    return db().then(function () {
      var r = R(), g = r.g >= 0 ? r.g : null, jobs = [];
      jobs.push(fb.db.collection('players').doc(uid).delete());
      jobs.push(fb.db.collection('hall').doc(topGrade().id).collection('rows').doc(uid).delete());
      [['week', r.wk], ['month', r.mk], ['day', r.dk]].forEach(function (b) {
        if (!b[1]) return;
        jobs.push(rows(boardId(b[0], b[1])).doc(uid).delete());
        if (g != null) jobs.push(rows(boardId(b[0], b[1], g)).doc(uid).delete());
      });
      return Promise.all(jobs.map(function (p) { return p.catch(function () {}); }));
    }).then(function () {
      var r = R();
      r.nick = '';
      r.hall = false;
      server = {};
      nickLoaded = '';
      hooks.save();
    });
  }

  /* ---------------- 지난 기간 상 받기 ---------------- */
  var checking = null;
  function checkRewards() {
    if (checking) return checking;
    var u = user();
    if (!u) return Promise.resolve([]);
    var r = R(), got = [], changed = false;
    var lastWeek = boardId('week', weekKey(Date.now() - 7 * 86400000));
    var lastMonth = boardId('month', monthBefore(monthKey(), 1));
    function check(id, kind) {
      if (r.checked[id]) return Promise.resolve();
      return rows(id).doc(u.uid).get().then(function (snap) {
        changed = true;
        if (!snap.exists) { r.checked[id] = 1; return; }
        var v = snap.get('v');
        return Promise.all([count(id, better(kind), v), count(id)]).then(function (n) {
          var rank = n[0] + 1, total = Math.max(1, n[1]);
          r.checked[id] = 1;
          if (kind === 'week' && rank <= Math.ceil(total * 0.1)) {
            r.tops++;
            S.Progress.addItem(D(), 'hint', 1);
            var pct = total >= 10 ? ' (상위 ' + Math.max(1, Math.ceil(rank / total * 100)) + '%)' : '';
            got.push('🐾 지난주 부지런냥 ' + rank + '위!' + pct + '\n힌트 1장을 드려요');
          }
          if (kind === 'month' && rank <= 3) {
            r.crowns++;
            S.Progress.addItem(D(), 'hint', 3);
            got.push('👑 지난달 왕냥이 ' + rank + '위!\n왕냥이 배지와 힌트 3장을 드려요');
          }
        });
      });
    }
    checking = db().then(function () {
      return check(lastWeek, 'week').then(function () { return check(lastMonth, 'month'); });
    }).then(function () {
      if (!changed) return got; // 바뀐 것이 없으면 저장하지 않음 (저장 → 계정에 올림 → 다시 확인… 이 되풀이되지 않게)
      if (S.Badges) S.Badges.check(D());
      hooks.save();
      if (got.length) {
        later(500); // 👑 표시를 랭킹 줄에도 반영
        if (hooks.modal) hooks.modal(got.join('\n\n'));
      }
      return got;
    }).catch(function () { return got; }).then(function (x) {
      checking = null;
      return x;
    });
    return checking;
  }

  /* ---------------- 랭킹 받아 오기 ---------------- */
  var cache = {}; // 판 이름 → { t, data }
  var hallCache = null;

  function snapRows(snap) {
    var out = [];
    snap.forEach(function (doc) {
      var x = doc.data();
      out.push({ uid: doc.id, nick: x.nick, grade: x.grade, v: x.v, crown: !!x.crown });
    });
    return out;
  }

  /* 판 하나 → { list: [...], me: { v, rank, total, above, below } | null } */
  function fetchBoard(kind, id) {
    var hit = cache[id];
    if (hit && Date.now() - hit.t < CACHE_MS) return Promise.resolve(hit.data);
    return db().then(function () {
      var low = BOARD[kind].low, u = user();
      var top = rows(id).orderBy('v', low ? 'asc' : 'desc').limit(TOP).get().then(snapRows);
      var me = u ? rows(id).doc(u.uid).get() : Promise.resolve(null);
      var total = count(id).catch(function () { return null; });
      return Promise.all([top, me, total]).then(function (res) {
        var list = res[0], snap = res[1], out = { list: list, total: res[2], me: null };
        if (!snap || !snap.exists) return out;
        var v = snap.get('v');
        var at = -1;
        for (var i = 0; i < list.length; i++) if (list[i].uid === u.uid) at = i;
        if (at >= 0) {
          out.me = { v: v, rank: at + 1, above: [], below: [] };
          return out;
        }
        // 50위 밖 : 나보다 앞선 사람 수를 세고, 바로 위아래 두 명씩
        var ahead = count(id, better(kind), v).catch(function () { return null; });
        var above = rows(id).where('v', low ? '<' : '>', v).orderBy('v', low ? 'desc' : 'asc').limit(2).get().then(snapRows);
        var below = rows(id).where('v', low ? '>' : '<', v).orderBy('v', low ? 'asc' : 'desc').limit(2).get().then(snapRows);
        return Promise.all([ahead, above, below]).then(function (x) {
          out.me = { v: v, rank: x[0] == null ? null : x[0] + 1, above: x[1].reverse(), below: x[2] };
          return out;
        });
      });
    }).then(function (data) {
      cache[id] = { t: Date.now(), data: data };
      return data;
    });
  }

  function fetchHall() {
    if (hallCache && Date.now() - hallCache.t < CACHE_MS * 5) return Promise.resolve(hallCache.data);
    return db().then(function () {
      var months = [];
      for (var i = 1; i <= MONTHS_IN_HALL; i++) months.push(monthBefore(monthKey(), i));
      var tops = months.map(function (m) {
        return rows(boardId('month', m)).orderBy('v', 'desc').limit(3).get().then(snapRows).then(function (list) {
          return { month: m, list: list };
        }).catch(function () { return { month: m, list: [] }; });
      });
      var first = fb.db.collection('hall').doc(topGrade().id).collection('rows').orderBy('at', 'asc').limit(30).get().then(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          var x = doc.data();
          out.push({ uid: doc.id, nick: x.nick, at: x.at && x.at.toDate ? x.at.toDate() : null });
        });
        return out;
      });
      return Promise.all([Promise.all(tops), first]);
    }).then(function (res) {
      var data = { months: res[0].filter(function (m) { return m.list.length; }), first: res[1] };
      hallCache = { t: Date.now(), data: data };
      return data;
    });
  }

  /* ---------------- 화면 ---------------- */
  var tab = 'day', scope = 'all', drawn = 0;

  function $(id) { return document.getElementById(id); }

  function medal(rank) { return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''; }

  function rowEl(kind, x, rank, me) {
    var li = el('li', 'rk-row' + (me ? ' me' : ''));
    var no = el('span', 'rk-no', medal(rank) || (rank == null ? '-' : String(rank)));
    if (medal(rank)) no.classList.add('medal');
    li.appendChild(no);
    var who = el('span', 'rk-who');
    var name = el('b', 'rk-nick', x.nick || '이름 없음');
    who.appendChild(name);
    if (x.crown) who.appendChild(el('span', 'rk-crown', '👑'));
    if (me) who.appendChild(el('span', 'rk-mine', '나'));
    var g = gradeOf(x.grade);
    var chip = el('span', 'rk-grade', g.name);
    chip.style.setProperty('--c', g.color);
    who.appendChild(chip);
    li.appendChild(who);
    li.appendChild(el('span', 'rk-val', fmtValue(kind, x.v)));
    return li;
  }

  /* 로그인 · 닉네임 · 아직 기록 없음 안내와 내 순위 카드 */
  function meCard(kind, data) {
    var box = $('rank-me');
    box.innerHTML = '';
    var u = user(), r = R();
    var card = el('div', 'rk-me');
    if (!S.Account.configured()) {
      card.appendChild(el('p', 'rk-me-t', '랭킹은 준비 중이에요'));
      box.appendChild(card);
      return;
    }
    if (!u) {
      card.appendChild(el('p', 'rk-me-t', '로그인하면 랭킹에 올라가요'));
      card.appendChild(el('p', 'rk-me-s', '이번 주 · 이번 달에 모은 점수는 이 기기에 모아 두었다가 로그인하면 바로 올라가요.'));
      S.Account.providers().forEach(function (p) {
        if (hooks.loginButton) card.appendChild(hooks.loginButton(p));
      });
      box.appendChild(card);
      return;
    }
    if (!r.nick) {
      card.appendChild(el('p', 'rk-me-t', '닉네임을 정하면 랭킹에 올라가요'));
      card.appendChild(el('p', 'rk-me-s', '구글 계정의 실제 이름은 보이지 않아요.'));
      var nb = el('button', 'btn btn-primary', '닉네임 정하기');
      nb.type = 'button';
      nb.setAttribute('data-rank-nick', '1');
      card.appendChild(nb);
      box.appendChild(card);
      return;
    }
    var head = el('div', 'rk-me-head');
    head.appendChild(el('b', 'rk-me-nick', r.nick + (r.crowns ? ' 👑' : '')));
    var edit = el('button', 'link rk-me-edit', '닉네임 바꾸기');
    edit.type = 'button';
    edit.setAttribute('data-rank-nick', '1');
    head.appendChild(edit);
    card.appendChild(head);
    var me = data && data.me;
    if (!me) {
      var why = kind === 'day'
        ? (S.Progress.dailyDone(D(), dayKey()) ? '기록을 올리는 중이에요…' : '오늘의 퍼즐을 풀면 순위가 생겨요')
        : '이번 ' + (kind === 'week' ? '주' : '달') + '에 한 판을 끝내면 순위가 생겨요';
      card.appendChild(el('p', 'rk-me-t', why));
      if (kind === 'day' && !S.Progress.dailyDone(D(), dayKey())) {
        var pb = el('button', 'btn btn-primary', '오늘의 퍼즐 풀기');
        pb.type = 'button';
        pb.setAttribute('data-rank-daily', '1');
        card.appendChild(pb);
      }
      box.appendChild(card);
      return;
    }
    var line = el('p', 'rk-me-t');
    line.appendChild(document.createTextNode('내 순위 '));
    line.appendChild(el('b', '', me.rank == null ? '?' : fmtScore(me.rank) + '위'));
    if (data.total && me.rank != null) {
      var pct = Math.max(1, Math.ceil(me.rank / data.total * 100));
      line.appendChild(el('span', 'rk-pct', '상위 ' + pct + '%'));
    }
    card.appendChild(line);
    card.appendChild(el('p', 'rk-me-s', fmtValue(kind, me.v) + (data.total ? ' · 모두 ' + fmtScore(data.total) + '명' : '')));
    // 50위 밖이면 바로 위아래 사람
    if (me.rank != null && me.rank > TOP && (me.above.length || me.below.length)) {
      var ol = el('ol', 'rk-list rk-near');
      me.above.forEach(function (x, i) { ol.appendChild(rowEl(kind, x, me.rank - me.above.length + i, false)); });
      ol.appendChild(rowEl(kind, { nick: r.nick, grade: D().reach, v: me.v, crown: r.crowns > 0 }, me.rank, true));
      me.below.forEach(function (x, i) { ol.appendChild(rowEl(kind, x, me.rank + 1 + i, false)); });
      card.appendChild(ol);
    }
    box.appendChild(card);
  }

  function drawTabs() {
    var tabs = document.querySelectorAll('[data-rank-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-rank-tab') === tab ? 'true' : 'false');
    var g = gradeOf(D().reach);
    var chips = $('rank-scope');
    chips.hidden = tab === 'hall';
    chips.innerHTML = '';
    [['all', '전체'], ['grade', g.name + ' 등급끼리']].forEach(function (c) {
      var b = el('button', 'gchip' + (scope === c[0] ? ' on' : ''), c[1]);
      b.type = 'button';
      b.setAttribute('data-rank-scope', c[0]);
      b.style.setProperty('--c', c[0] === 'grade' ? g.color : 'var(--accent)');
      chips.appendChild(b);
    });
    var info = BOARD[tab];
    $('rank-title').textContent = info.icon + ' ' + info.title;
    $('rank-note').textContent = info.note;
  }

  function status(text) {
    var list = $('rank-list');
    list.innerHTML = '';
    if (text) list.appendChild(el('li', 'rk-empty', text));
  }

  function failText(e) {
    if (e && e.message === 'not-configured') return '랭킹은 준비 중이에요';
    if (e && e.code === 'permission-denied') return '랭킹은 준비 중이에요 (곧 열려요)';
    return '랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요';
  }

  function render() {
    if (!hooks.data) return;
    var my = ++drawn;
    drawTabs();
    $('rank-me').innerHTML = '';
    if (tab === 'hall') return renderHall(my);
    var kind = tab, r = R();
    roll(r);
    var key = kind === 'day' ? dayKey() : kind === 'week' ? r.wk : r.mk;
    var id = boardId(kind, key, scope === 'grade' ? Math.max(0, D().reach || 0) : null);
    status('불러오는 중…');
    meCard(kind, null);
    // 먼저 내 기록을 올린 뒤에 받아 옵니다 (방금 끝낸 판이 바로 보이게)
    var first = user() && r.nick ? sync() : Promise.resolve();
    first.then(function () {
      return fetchBoard(kind, id);
    }).then(function (data) {
      if (my !== drawn) return;
      meCard(kind, data);
      var list = $('rank-list');
      list.innerHTML = '';
      if (!data.list.length) return status(kind === 'day' ? '아직 오늘의 퍼즐을 푼 사람이 없어요. 첫 번째가 되어 보세요!' : '아직 아무도 없어요. 첫 번째가 되어 보세요!');
      var u = user();
      data.list.forEach(function (x, i) { list.appendChild(rowEl(kind, x, i + 1, u && x.uid === u.uid)); });
    }).catch(function (e) {
      if (my !== drawn) return;
      meCard(kind, null);
      status(failText(e));
    });
  }

  function renderHall(my) {
    status('불러오는 중…');
    fetchHall().then(function (data) {
      if (my !== drawn) return;
      var list = $('rank-list');
      list.innerHTML = '';
      var u = user();
      // 가장 높은 등급을 처음 찍은 사람들
      var top = topGrade();
      var h1 = el('li', 'rk-sec');
      h1.appendChild(el('b', '', '🌟 ' + top.name + ' 등급에 처음 오른 냥이들'));
      list.appendChild(h1);
      if (!data.first.length) list.appendChild(el('li', 'rk-empty', '아직 아무도 ' + top.name + ' 등급에 오르지 못했어요. 첫 번째 주인공이 되어 보세요!'));
      data.first.forEach(function (x, i) {
        var li = el('li', 'rk-row' + (u && x.uid === u.uid ? ' me' : ''));
        li.appendChild(el('span', 'rk-no' + (i < 3 ? ' medal' : ''), medal(i + 1) || String(i + 1)));
        var who = el('span', 'rk-who');
        who.appendChild(el('b', 'rk-nick', x.nick));
        li.appendChild(who);
        var d = x.at;
        li.appendChild(el('span', 'rk-val rk-date', d ? d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() : ''));
        list.appendChild(li);
      });
      // 지난 달 1~3위
      var h2 = el('li', 'rk-sec');
      h2.appendChild(el('b', '', '👑 역대 이달의 왕냥이'));
      list.appendChild(h2);
      if (!data.months.length) list.appendChild(el('li', 'rk-empty', '이번 달이 끝나면 1~3위가 여기에 남아요.'));
      data.months.forEach(function (m) {
        var p = m.month.split('-');
        list.appendChild(el('li', 'rk-month', p[0] + '년 ' + Number(p[1]) + '월'));
        m.list.forEach(function (x, i) { list.appendChild(rowEl('month', x, i + 1, u && x.uid === u.uid)); });
      });
    }).catch(function (e) {
      if (my !== drawn) return;
      status(failText(e));
    });
  }

  /* ---------------- 닉네임 창 ---------------- */
  function openNick() {
    var box = $('nick');
    $('nick-input').value = R().nick || '';
    $('nick-err').textContent = '';
    $('nick-title').textContent = R().nick ? '닉네임 바꾸기' : '닉네임 정하기';
    box.hidden = false;
    window.setTimeout(function () { $('nick-input').focus(); }, 50);
  }
  function closeNick() {
    $('nick').hidden = true;
  }
  function submitNick() {
    var v = $('nick-input').value;
    var err = nickError(v);
    if (err) {
      $('nick-err').textContent = err;
      return;
    }
    var ok = $('nick-ok');
    ok.disabled = true;
    $('nick-err').textContent = '저장하는 중…';
    setNick(v).then(function () {
      ok.disabled = false;
      closeNick();
      if (hooks.toast) hooks.toast('이제 랭킹에 ' + R().nick + '(으)로 올라가요');
      render();
    }, function (e) {
      ok.disabled = false;
      $('nick-err').textContent = e.message;
    });
  }

  /* ---------------- 시작 (ui.js 가 부름) ---------------- */
  function start(h) {
    for (var k in h) hooks[k] = h[k];
    var screen = $('screen-ranking');
    screen.addEventListener('click', function (e) {
      var t = e.target;
      var tb = t.closest('[data-rank-tab]');
      if (tb) { tab = tb.getAttribute('data-rank-tab'); return render(); }
      var sc = t.closest('[data-rank-scope]');
      if (sc) { scope = sc.getAttribute('data-rank-scope'); return render(); }
      if (t.closest('[data-rank-nick]')) return openNick();
      if (t.closest('[data-rank-daily]') && hooks.playDaily) return hooks.playDaily();
    });
    $('nick-ok').addEventListener('click', submitNick);
    $('nick-cancel').addEventListener('click', closeNick);
    $('nick-input').addEventListener('keydown', function (e) {
      e.stopPropagation(); // 게임의 숫자 단축키로 가지 않게
      if (e.key === 'Enter') submitNick();
      if (e.key === 'Escape') closeNick();
    });
    if (S.Account) {
      S.Account.onChange(function (st, u) {
        if (st === 'in' && u) loadNick().then(function () { if (hooks.refresh) hooks.refresh(); });
        if (st === 'out' || st === 'deleted') { server = {}; bad = {}; nickLoaded = ''; for (var id in cache) delete cache[id]; }
        if (st === 'synced') {
          sync();
          checkRewards();
        }
      });
    }
  }

  S.Ranking = {
    start: start,
    render: render,
    addScore: addScore,
    addDaily: addDaily,
    sync: sync,
    checkRewards: checkRewards,
    forget: forget,
    nickError: nickError,
    isNickOpen: function () { return !$('nick').hidden; },
    closeNick: closeNick,
    keys: { week: weekKey, month: monthKey, monthBefore: monthBefore }
  };
})(typeof window !== 'undefined' ? window : globalThis);
