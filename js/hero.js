/*
 * 판 위의 캐릭터 : 내 등급의 캐릭터가 맞히거나 틀릴 때마다 표정이 바뀝니다.
 *
 * 그림 : img/chars.webp (tools/make_chars.py 가 img/ch002.png 에서 잘라 만듭니다)
 *   가로 9칸 = 등급 캐릭터 (어느 등급이 몇 번째 칸인지는 js/config.js 의 GRADES 의 char)
 *   세로 6줄 = 표정 (아래 MOODS 순서)
 *
 * 말풍선 대사를 바꾸고 싶으면 아래 LINES 만 고치면 됩니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;
  var COLS = 9;

  // 표정 → 그림의 몇 번째 줄인지
  var MOODS = { base: 0, angry: 1, smug: 2, surprise: 3, cry: 4, joy: 5 };
  var ROWS = 6;

  // 상황별 말풍선 대사 (여러 개면 그때그때 하나를 고릅니다)
  var LINES = {
    start: ['잘 부탁해!', '한 판 해 볼까?', '오늘도 힘내자!'],
    correct: ['좋았어!', '바로 그거야!', '나이스!', '정답!'],
    combo: ['식은 죽 먹기지~', '이 정도쯤이야', '후훗, 쉽군', '멈출 수 없어!'],
    unit: ['한 줄 끝!', '깔끔해!', '착착 채워진다!'],
    box: ['상자 완성!', '멋지다!', '이 기세로 가자!'],
    wrong1: ['앗!', '어라?', '잠깐, 아닌가?'],
    wrong2: ['으윽!', '집중하자!', '한 번 남았어…'],
    hint: ['오호!', '그렇구나!', '고마워!'],
    item: ['아이템 효과!', '좋은 걸 썼네!', '이걸로 유리해졌어!'],
    revive: ['다시 일어섰다!', '아직 안 끝났어!'],
    win: ['해냈다!', '최고야!', '완벽해!'],
    lose: ['흑흑…', '다음엔 꼭…', '분하다…']
  };

  var wrap, face, bubble;
  var col = 0;
  var mood = 'base';
  var idleMood = 'base';
  var moodTimer = 0, bubbleTimer = 0;

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function els() {
    if (!wrap) {
      wrap = document.getElementById('hero');
      face = document.getElementById('hero-face');
      bubble = document.getElementById('hero-bubble');
    }
    return !!wrap;
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // 움직임을 처음부터 다시 틀기 위한 한 줄
    el.classList.add(cls);
  }

  function draw(m, animate) {
    if (!els()) return;
    var row = MOODS[m] || 0;
    face.style.backgroundPosition = (col / (COLS - 1)) * 100 + '% ' + (row / (ROWS - 1)) * 100 + '%';
    wrap.setAttribute('data-mood', m);
    if (animate && m !== mood) restart(face, 'hero-change');
    mood = m;
  }

  /* 말풍선 : ms 동안 보였다가 사라집니다 (0 이면 계속) */
  function say(text, ms) {
    if (!els()) return;
    root.clearTimeout(bubbleTimer);
    if (!text) {
      bubble.hidden = true;
      return;
    }
    bubble.textContent = text;
    bubble.hidden = false;
    restart(bubble, 'hero-pop');
    if (ms !== 0) {
      bubbleTimer = root.setTimeout(function () {
        bubble.hidden = true;
      }, ms || 2000);
    }
  }

  /* 등급을 바꿉니다 (판을 시작할 때) */
  function setGrade(gradeIndex) {
    var g = C.GRADES[gradeIndex] || C.GRADES[0];
    col = Math.max(0, Math.min(COLS - 1, typeof g.char === 'number' ? g.char : gradeIndex));
    if (els()) face.setAttribute('aria-label', g.name + ' 캐릭터');
    draw(mood, false);
  }

  /* 판을 새로 시작하거나 이어서 할 때 : 기본 표정과 인사 */
  function reset(text) {
    root.clearTimeout(moodTimer);
    idleMood = 'base';
    draw('base', false);
    say(text || pick(LINES.start), 2200);
  }

  /*
   * 상황에 맞게 표정을 바꿉니다.
   *   kind : LINES 의 이름 (correct, combo, wrong1 …)
   *   ms   : 이만큼 지나면 기본 표정으로 돌아옴 (0 이면 그대로 둠)
   */
  var KIND_MOOD = {
    correct: 'joy', combo: 'smug', unit: 'joy', box: 'joy',
    wrong1: 'surprise', wrong2: 'angry', hint: 'surprise', item: 'surprise',
    revive: 'joy', win: 'joy', lose: 'cry'
  };
  function react(kind, ms) {
    var m = KIND_MOOD[kind] || 'base';
    root.clearTimeout(moodTimer);
    draw(m, true);
    if (els()) {
      // 표정에 맞는 몸짓 (틀리면 흔들, 기쁘면 폴짝, 울면 들썩)
      var move = m === 'angry' || m === 'surprise' ? 'hero-shake' : m === 'cry' ? 'hero-sob' : 'hero-hop';
      restart(face, move);
    }
    say(pick(LINES[kind] || ['']), ms === 0 ? 0 : Math.max(1400, (ms || 1400) + 400));
    if (ms === 0) return;
    moodTimer = root.setTimeout(function () {
      draw(idleMood, true);
    }, ms || 1400);
  }

  S.Hero = { setGrade: setGrade, reset: reset, react: react, say: say, LINES: LINES };
})(typeof window !== 'undefined' ? window : globalThis);
