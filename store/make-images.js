/*
 * 플레이스토어에 올릴 그림을 만드는 프로그램.
 *   - store/screenshots/*.png : 휴대폰 스크린샷 (1080×1920)
 *   - store/feature-graphic.png : 대표 그림 (1024×500)
 *
 * 쓰는 법 (게임 폴더에서)
 *   1) python -m http.server 8765     ← 게임을 내 컴퓨터에서 띄움 (창 하나 따로)
 *   2) npm i --no-save playwright-core
 *   3) node store/make-images.js
 * 컴퓨터에 설치된 크롬으로 화면을 찍습니다.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8765/';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

/* 스크린샷에 쓸 기록 : 고수 등급, 배지 몇 개 받은 상태 */
const SAVE = {
  version: 1, gradeIndex: 3, wins: 2, failStreak: 0, totalWins: 27, totalGames: 31,
  bestTimes: { hasu: 41, pyeongmin: 118, jungsu: 402, gosu: 515 },
  bestScores: { hasu: 980, pyeongmin: 2650, jungsu: 6120, gosu: 8840 },
  totalScore: 61230, game: null, dailyGame: null,
  daily: { last: '', streak: 0, bestStreak: 8, total: 12, score: 0, seconds: 0 },
  stats: { perfectWins: 11, noHintWins: 19, hintsUsed: 14, winStreak: 6, bestWinStreak: 9, maxPromoted: 3, wins9: 9, best9: 402 },
  gradeStats: { gosu: { played: 4, won: 2, sec: 1090 } },
  badges: {
    'first-win': '2026-11-01', 'first-promo': '2026-11-02', 'first-9': '2026-11-04', perfect: '2026-11-02',
    'perfect-10': '2026-11-12', 'no-hint-10': '2026-11-10', 'streak-5': '2026-11-06', 'wins-10': '2026-11-05',
    'daily-1': '2026-11-03', 'daily-7': '2026-11-10', 'grade-gosu': '2026-11-13'
  }
};

/* 새 창을 열고, 게임이 켜지기 전에 기록을 넣어 둡니다
   (켜진 뒤에 넣으면 게임이 닫히면서 원래 기록으로 덮어씁니다) */
async function open(browser, opts, settings, save) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(([sv, set]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('sudoku-save-v1', JSON.stringify(sv));
    localStorage.setItem('sudoku-settings-v1', JSON.stringify(set));
  }, [save || SAVE, Object.assign({ tutorialDone: true }, settings || {})]);
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html');
  await page.waitForTimeout(400);
  await page.click('#splash-start', { force: true }); // 시작 그림의 "지금 시작하기"
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* 판의 빈칸을 앞에서부터 ratio 만큼 정답으로 채우고, 칸 하나를 골라 둡니다 */
async function fillSome(page, ratio) {
  await page.click('#home-new'); // 홈 → 새 게임
  await page.waitForTimeout(300);
  const g = await page.evaluate(() => {
    const s = SUDOKU._debug.game();
    return { sol: s.solution, fixed: s.fixed };
  });
  const blanks = g.fixed.map((f, i) => (f ? -1 : i)).filter(i => i >= 0);
  const n = Math.floor(blanks.length * ratio);
  // 골고루 채워지게 섞어서 고릅니다 (늘 같은 순서)
  const order = blanks.slice().sort((a, b) => ((a * 37) % 101) - ((b * 37) % 101));
  for (const i of order.slice(0, n)) {
    await page.click(`#board .cell[data-idx="${i}"]`);
    await page.click(`#numpad .num[data-d="${g.sol[i]}"]`);
  }
  const left = order.slice(n);
  if (left.length) await page.click(`#board .cell[data-idx="${left[Math.floor(left.length / 2)]}"]`);
  await page.waitForTimeout(1800); // 응원 메시지가 사라질 때까지
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const phone = { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true };

  // 1. 홈 화면
  let { ctx, page } = await open(browser, phone);
  await page.screenshot({ path: path.join(SHOTS, '1-home.png') });
  await ctx.close();

  // 2. 게임 화면 (고수 9×9)
  ({ ctx, page } = await open(browser, phone));
  await fillSome(page, 0.45);
  await page.screenshot({ path: path.join(SHOTS, '2-game.png') });
  await ctx.close();

  // 3. 나무판 스킨
  ({ ctx, page } = await open(browser, phone, { skin: 'wood' }));
  await fillSome(page, 0.35);
  await page.screenshot({ path: path.join(SHOTS, '3-wood.png') });
  await ctx.close();

  // 4. 다크 모드
  ({ ctx, page } = await open(browser, phone, { theme: 'dark' }));
  await fillSome(page, 0.55);
  await page.screenshot({ path: path.join(SHOTS, '4-dark.png') });
  await ctx.close();

  // 5. 승급 축하
  ({ ctx, page } = await open(browser, phone, { skin: 'pastel-purple' }));
  await page.click('#home-new');
  await page.evaluate(() => {
    document.getElementById('promo-grade').textContent = '영웅';
    document.getElementById('promo-text').textContent = '영웅 승급!';
    document.getElementById('promo-badge').style.setProperty('--grade', '#a3477f');
    document.getElementById('promo').hidden = false;
    SUDOKU.Effects.confetti(4000);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, '5-promo.png') });
  await ctx.close();

  // 6. 내 기록
  ({ ctx, page } = await open(browser, phone));
  await page.click('.tab[data-tab="record"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '6-record.png') });
  await ctx.close();

  // 7. 배지
  ({ ctx, page } = await open(browser, phone));
  await page.click('.tab[data-tab="badges"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '7-badges.png') });
  await ctx.close();

  // 8. 따라 하기
  ({ ctx, page } = await open(browser, phone, { tutorialDone: false }, {}));
  await page.click('#tut-next');
  await page.click('#tut-next');
  await page.click('#tut-board .cell[data-idx="2"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, '8-tutorial.png') });
  await ctx.close();

  // 대표 그림 1024×500
  ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  await page.goto(BASE + 'store/feature-graphic.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'feature-graphic.png') });
  await ctx.close();

  await browser.close();
  console.log('완료 : store/screenshots/ 와 store/feature-graphic.png');
})();
