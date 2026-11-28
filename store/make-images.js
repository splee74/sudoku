/*
 * 플레이스토어에 올릴 그림을 만드는 프로그램.
 *   - store/screenshots/*.png : 휴대폰 스크린샷 10장 (1080×1920)
 *   - store/feature-graphic.png : 대표 그림 (1024×500)
 *
 * 쓰는 법 (게임 폴더에서)
 *   1) npm i --no-save playwright-core
 *   2) node store/make-images.js
 * 게임 파일을 바로 열어서(file://) 컴퓨터에 설치된 크롬으로 화면을 찍습니다. (서버를 띄울 필요 없음)
 * 랭킹 화면의 이름 · 점수는 실제 사용자가 아닌 예시입니다.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + '/';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f)); // 예전 그림 지움

const today = new Date().toLocaleDateString('sv-SE');
const NICK = '날쌘고양이';

/* 스크린샷에 쓸 기록 : 고수 등급, 승급 미션 일부 완료, 배지 몇 개 받은 상태, 로그인 + 닉네임 완료 */
const SAVE = {
  version: 1, gradeIndex: 3, wins: 3, failStreak: 0, totalWins: 27, totalGames: 31, reach: 3,
  mission: { perfect: 2, nohint: 1, fast: 0, streak: 3, best: 3 },
  bestTimes: { hasu: 41, pyeongmin: 118, jungsu: 402, gosu: 515 },
  bestScores: { hasu: 980, pyeongmin: 2650, jungsu: 6120, gosu: 8840 },
  totalScore: 61230, game: null, dailyGame: null,
  daily: { last: today, streak: 5, bestStreak: 8, total: 12, score: 0, seconds: 0, bestStairs: 9 },
  items: { hint: 3, time: 2, shield: 3, memo: 1, double: 1, combo: 2, revive: 1 },
  stats: { perfectWins: 11, noHintWins: 19, hintsUsed: 14, winStreak: 6, bestWinStreak: 9, maxPromoted: 3, wins9: 9, best9: 402, playSec: 9800 },
  gradeStats: { gosu: { played: 4, won: 3, sec: 1600, perfect: 2 } },
  // 오늘 이미 출석한 것으로 (출석 창이 화면을 가리지 않게)
  attend: { last: today, streak: 3, best: 8, total: 15 },
  starterGiven: true, itemsReset: 99, gifts: { 'test-2026-11-24': 1 },
  story: { seen: { 0: 1, 1: 1, 2: 1, 3: 1 }, asked: true },
  rank: { wk: '', ws: 0, mk: '', ms: 0, dk: '', dv: 0, sk: '', sv: 0, nick: NICK, g: 3, checked: {}, crowns: 1, tops: 0, hall: false },
  badges: {
    'first-win': '2026-11-01', 'first-promo': '2026-11-02', perfect: '2026-11-02', 'games-10': '2026-11-04',
    'wins-10': '2026-11-05', 'hint-1': '2026-11-02', 'score-1k': '2026-11-02', 'daily-1': '2026-11-03', 'attend-3': '2026-11-04',
    'first-9': '2026-11-04', 'grade-gosu': '2026-11-13', 'streak-5': '2026-11-06', 'no-hint-10': '2026-11-10',
    'perfect-5': '2026-11-09', 'fast-9-10m': '2026-11-11', 'score-10k': '2026-11-08', 'daily-7': '2026-11-10',
    'attend-7': '2026-11-10', 'play-1h': '2026-11-07', 'perfect-10': '2026-11-12'
  }
};

/* 새 창을 열고, 게임이 켜지기 전에 기록을 넣어 둡니다
   (켜진 뒤에 넣으면 게임이 닫히면서 원래 기록으로 덮어씁니다) */
async function open(browser, opts, settings, o) {
  o = o || {};
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([sv, set, nick]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('sudoku-save-v1', JSON.stringify(sv));
    localStorage.setItem('sudoku-settings-v1', JSON.stringify(set));
    localStorage.setItem('sudoku-welcome-login', '2');
    // 로그인했던 기기처럼 (시작 관문을 지나가게)
    localStorage.setItem('sudoku-account-v1', JSON.stringify({ name: nick, provider: 'google' }));
  }, [SAVE, Object.assign({ tutorialDone: true, music: false }, settings || {}), NICK]);
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html');
  await page.waitForTimeout(900);
  if (o.splash) return { ctx, page };
  await page.click('#splash-start', { force: true }); // 시작 그림의 "터치해서 시작하기"
  await page.waitForTimeout(900);
  // 혹시 떠 있는 창(로그인 관문 · 알림)은 치움
  // (파일로 열면 로그인 서버에 못 붙어서 뜨는 "로그인하지 못했어요" 알림도 치움)
  await page.evaluate(theme => {
    ['gate', 'modal', 'login-ask', 'attend', 'app-toast'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
    if (theme) SUDOKU.Theme.apply(theme);
  }, (settings && settings.theme) || '');
  await page.addStyleTag({ content: '#app-toast{display:none!important}' });
  return { ctx, page };
}

/* 판의 빈칸을 앞에서부터 ratio 만큼 정답으로 채우고, 칸 하나를 골라 둡니다 */
async function fillSome(page, ratio) {
  await page.click('#home-new'); // 홈 → 새 게임
  await page.waitForTimeout(1500); // 등급 소개가 지나갈 때까지
  const g = await page.evaluate(() => {
    const s = SUDOKU._debug.game();
    return { sol: s.solution, fixed: s.fixed };
  });
  const blanks = g.fixed.map((f, i) => (f ? -1 : i)).filter(i => i >= 0);
  const n = Math.floor(blanks.length * ratio);
  // 골고루 채워지게 섞어서 고릅니다 (늘 같은 순서)
  const order = blanks.slice().sort((a, b) => ((a * 37) % 101) - ((b * 37) % 101));
  for (const i of order.slice(0, n)) {
    await page.click(`#board .cell[data-idx="${i}"]`, { force: true });
    await page.click(`#numpad .num[data-d="${g.sol[i]}"]`, { force: true });
  }
  const left = order.slice(n);
  if (left.length) await page.click(`#board .cell[data-idx="${left[Math.floor(left.length / 2)]}"]`, { force: true });
  await page.waitForTimeout(1800); // 응원 메시지가 사라질 때까지
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

/* 랭킹 예시 (실제 사용자 아님) */
const PEOPLE = [
  ['별빛냥', 8, 98420, true], ['두부도사', 7, 87150, false], ['치즈대장', 7, 81300, false],
  ['구름발바닥', 6, 74980, false], ['새벽고등어', 6, 70210, false], ['몽실몽실', 5, 66540, false],
  [NICK, 3, 61230, true], ['호박씨', 5, 58870, false], ['찹쌀떡냥', 4, 52010, false], ['솜뭉치', 4, 47760, false]
];
async function fakeRanking(page) {
  await page.click('.tab[data-tab="ranking"]');
  await page.waitForTimeout(2500);
  await page.evaluate(([people, nick]) => {
    const C = SUDOKU.Config;
    const tab = document.querySelector('[data-rank-tab="week"]');
    document.querySelectorAll('[data-rank-tab]').forEach(t => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
    document.getElementById('rank-title').textContent = '🐾 이번 주 부지런냥';
    document.getElementById('rank-note').textContent = '이번 주(월~일)에 모은 점수예요. 월요일 0시에 새로 시작해요.\n상위 10%에 들면 다음 주에 힌트 1장을 받아요.';
    const me = document.getElementById('rank-me');
    me.innerHTML = '<div class="rk-me"><div class="rk-me-head"><b class="rk-me-nick">' + nick + ' 👑</b><button type="button" class="link rk-me-edit">닉네임 바꾸기</button></div>' +
      '<p class="rk-me-t">내 순위 <b>7위</b><span class="rk-pct">상위 3%</span></p><p class="rk-me-s">61,230점 · 모두 248명</p></div>';
    const list = document.getElementById('rank-list');
    list.innerHTML = '';
    const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '');
    people.forEach((p, i) => {
      const g = C.GRADES[p[1]];
      const li = document.createElement('li');
      li.className = 'rk-row tap' + (p[0] === nick ? ' me' : '');
      li.innerHTML = '<span class="rk-no' + (medal(i + 1) ? ' medal' : '') + '">' + (medal(i + 1) || i + 1) + '</span>' +
        '<span class="rk-who"><b class="rk-nick">' + p[0] + '</b>' + (p[3] ? '<span class="rk-crown">👑</span>' : '') +
        (p[0] === nick ? '<span class="rk-mine">나</span>' : '') +
        '<span class="rk-grade" style="--c:' + g.color + '">' + g.name + '</span></span>' +
        '<span class="rk-val">' + p[2].toLocaleString('ko-KR') + '점</span>';
      list.appendChild(li);
    });
  }, [PEOPLE, NICK]);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const phone = { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true };
  const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });
  let ctx, page;

  // 1. 시작 그림 (대문)
  ({ ctx, page } = await open(browser, phone, null, { splash: true }));
  await page.waitForTimeout(1200);
  await shot(page, '01-start.png');
  await ctx.close();

  // 2. 홈 화면
  ({ ctx, page } = await open(browser, phone));
  await shot(page, '02-home.png');
  await ctx.close();

  // 3. 게임 화면 (고수 9×9)
  ({ ctx, page } = await open(browser, phone));
  await fillSome(page, 0.45);
  await shot(page, '03-game.png');
  await ctx.close();

  // 4. 이야기 (숫자 도장의 전설)
  ({ ctx, page } = await open(browser, phone));
  await page.evaluate(nick => SUDOKU.Story.open(1, { name: nick }), NICK);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => SUDOKU.Story.key('Enter'));
    await page.waitForTimeout(1400);
  }
  await shot(page, '04-story.png');
  await ctx.close();

  // 5. 판을 깬 결과 창
  ({ ctx, page } = await open(browser, phone, { skin: 'wood' }));
  await fillSome(page, 1);
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const p = document.getElementById('promo'); if (p) p.hidden = true; });
  await shot(page, '05-clear.png');
  await ctx.close();

  // 6. 승급 축하
  ({ ctx, page } = await open(browser, phone, { skin: 'pastel-purple' }));
  await page.click('#home-new');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.getElementById('promo-cheer').textContent = '대단해요!';
    document.getElementById('promo-face').style.backgroundPosition = (6 / 13) * 100 + '% 20%';
    document.getElementById('promo-text').textContent = '영웅 승급!';
    document.getElementById('promo-badge').style.setProperty('--grade', '#a3477f');
    document.getElementById('promo').hidden = false;
    SUDOKU.Effects.confetti(4000);
  });
  await page.waitForTimeout(900);
  await shot(page, '06-promo.png');
  await ctx.close();

  // 7. 랭킹
  ({ ctx, page } = await open(browser, phone));
  await fakeRanking(page);
  await shot(page, '07-ranking.png');

  // 8. 랭킹에서 이름을 누르면 보이는 기록
  await page.evaluate(() => {
    const C = SUDOKU.Config;
    const set = (id, t) => { document.getElementById(id).textContent = t; };
    set('pp-nick', '별빛냥');
    document.getElementById('pp-crown').hidden = false;
    document.getElementById('pp-mine').hidden = true;
    const g = C.GRADES[8];
    const chip = document.getElementById('pp-grade');
    chip.textContent = g.name;
    chip.style.setProperty('--c', g.color);
    set('pp-now', '🐾 이번 주 부지런냥 · 98,420점');
    const L = document.getElementById('pp-stats');
    L.innerHTML = '';
    [['🏅', '최고 등급', g.name], ['🎯', '지금 도전 중', g.name], ['🧩', '승급전', '412판 · 351승'], ['📈', '성공률', '85%'],
      ['⭐', '모은 점수', '1,284,560점'], ['🔥', '최다 연승', '27연승'], ['💎', '무결점 성공', '163판'],
      ['📅', '오늘의 퍼즐', '58번 · 최고 21단계'], ['🎖️', '배지', '39개'], ['🗓️', '출석', '61일'], ['⏱️', '게임한 시간', '74시간 12분']
    ].forEach(x => {
      const li = document.createElement('li');
      li.className = 'pp-stat';
      li.innerHTML = '<span class="pp-ico">' + x[0] + '</span><span class="pp-label">' + x[1] + '</span><b class="pp-val">' + x[2] + '</b>';
      L.appendChild(li);
    });
    document.getElementById('pp').hidden = false;
  });
  await page.waitForTimeout(500);
  await shot(page, '08-profile.png');
  await ctx.close();

  // 9. 다크 모드
  ({ ctx, page } = await open(browser, phone, { theme: 'dark' }));
  await fillSome(page, 0.55);
  await shot(page, '09-dark.png');
  await ctx.close();

  // 10. 배지
  ({ ctx, page } = await open(browser, phone));
  await page.click('.tab[data-tab="badges"]');
  await page.waitForTimeout(500);
  await shot(page, '10-badges.png');
  await ctx.close();

  // 대표 그림 1024×500
  ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  await page.goto(BASE + 'store/feature-graphic.html');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'feature-graphic.png') });
  await ctx.close();

  await browser.close();
  console.log('완료 : store/screenshots/ 와 store/feature-graphic.png');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
