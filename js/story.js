/*
 * 이야기 : 숫자 도장의 전설 (도입부 + 1~10장)
 *
 * 언제 나오는지 (js/ui.js 가 부름)
 *   도입부(0)   처음 켰을 때, 따라 하기 앞에서 한 번
 *   1~9장       그 등급에 처음 올랐을 때 (평민 = 1장 … 신 = 9장), 승급 축하 창 다음
 *   10장 엔딩   신 등급에서 처음 판을 깼을 때
 *   홈 화면의 📜 이야기 단추로 본 장은 언제든 다시 볼 수 있습니다.
 *
 * 대사를 바꾸려면 아래 CHAPTERS 만 고치면 됩니다.
 *   who   : 말하는 인물 (CAST 의 이름). 없으면 해설(가운데 어두운 창)
 *   face  : 표정 (CAST 의 faces 이름)
 *   text  : 대사. {name} 은 닉네임으로 바뀝니다.
 *           {name:은} {name:이} {name:을} {name:과} 처럼 쓰면 받침에 맞춰 은/는, 이/가, 을/를, 과/와 가 붙습니다.
 *   speaker : 이름표를 인물 이름 대신 다른 글로 (쥐 삼형제의 찍이 · 쪽이 · 짹이)
 *
 * 그림 : img/story/c/*.webp (인물), img/story/bg-*.webp · img/home-dojo.webp (배경)
 *        tools/make_story.py 가 원본 그림에서 만듭니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  // ---------- 인물 ----------
  var CAST = {
    hero: { name: '{name}', color: '#3f6fb5', faces: { base: 'hero_base', joy: 'hero_joy', surprise: 'hero_surprise', determined: 'hero_determined', sad: 'hero_sad' } },
    master: { name: '백운 사부', color: '#8a7a3a', faces: { base: 'master_base', joy: 'master_joy', calm: 'master_calm', stern: 'master_stern', smile: 'master_smile' } },
    kkam: { name: '깜냥', color: '#5b3f8c', faces: { base: 'kkam_base', sulky: 'kkam_sulky', shout: 'kkam_shout', think: 'kkam_think', side: 'kkam_side' } },
    king: { name: '혼돈쥐 대왕', color: '#a33a2f', faces: { base: 'king_base', angry: 'king_angry', smile: 'king_smile', confused: 'king_confused', surprise: 'king_surprise' } },
    trio: { name: '쥐 삼형제', color: '#b0476f', faces: { base: 'trio_base', laugh: 'trio_laugh', mixed: 'trio_mixed' } },
    aunt: { name: '생선가게 아주머니', color: '#c0713a', faces: {} }
  };

  // ---------- 장면 : 배경 그림 + 분위기 (색 막, 달, 비 · 별 · 불티 · 반짝이 · 바람) ----------
  var BG = {
    dojo: 'img/home-dojo.webp',
    village: 'img/story/bg-village.webp',
    forest: 'img/story/bg-forest.webp',
    summit: 'img/story/bg-summit.webp'
  };
  var SCENES = {
    rainNight: { bg: 'dojo', filter: 'brightness(.5) saturate(.55)', tint: 'linear-gradient(rgba(16,30,70,.55), rgba(10,16,40,.55))', fx: 'rain' },
    dojo: { bg: 'dojo' },
    village: { bg: 'village' },
    roofNight: { bg: 'dojo', filter: 'brightness(.55) saturate(.6)', tint: 'linear-gradient(rgba(20,30,80,.55), rgba(20,20,50,.35))', moon: true, fx: 'stars' },
    villageNight: { bg: 'village', filter: 'brightness(.5) saturate(.65)', tint: 'linear-gradient(rgba(25,25,80,.5), rgba(15,15,45,.45))', moon: true },
    fire: { bg: 'dojo', filter: 'brightness(.42) saturate(.8) sepia(.35)', tint: 'radial-gradient(ellipse at 50% 85%, rgba(255,140,40,.55), rgba(40,10,0,.55) 70%)', fx: 'embers' },
    forest: { bg: 'forest', fx: 'sparkle' },
    forestDusk: { bg: 'forest', filter: 'saturate(.85)', tint: 'linear-gradient(rgba(255,140,80,.28), rgba(120,40,60,.3))' },
    storm: { bg: 'summit', filter: 'brightness(.55) saturate(.45)', tint: 'linear-gradient(rgba(40,40,70,.55), rgba(20,20,30,.35))', fx: 'wind' },
    summit: { bg: 'summit', fx: 'sparkle' }
  };

  // ---------- 대사 ----------
  var CHAPTERS = [
    { k: '도입부', t: '비 오는 날의 길냥이', scene: 'rainNight', next: '하수부터 시작! · 4×4 판', lines: [
      { text: '옛날 고양이 마을에는 「숫자 도장」이 있었다.' },
      { text: '아홉 칸 판에 숫자를 겹치지 않게 놓는 무공, 「구궁술」을 익힌 고양이들이 마을의 질서를 지켰다.' },
      { text: '그러던 어느 날, 혼돈쥐 대왕이 나타나 도장의 비급을 찢었다. 숫자들은 사방으로 흩어지고, 제자들도 하나둘 도장을 떠났다…' },
      { who: 'master', face: 'calm', text: '허허, 이 빗속에 웬 꼬맹이냐.' },
      { who: 'hero', face: 'sad', text: '배… 배고프다냥…' },
      { who: 'master', face: 'smile', text: '밥은 주마. 대신 이 흩어진 숫자들을 하나씩 제자리에 돌려놓거라. 그게 네 수련이다.' },
      { who: 'hero', face: 'surprise', text: '할 수 있을까냥…?' },
      { who: 'master', face: 'joy', text: '작은 판부터 시작하면 된다. 네 칸짜리부터 해 보거라.' }
    ] },
    { k: '1장 · 하수', t: '첫 번째 수련', scene: 'dojo', next: '평민 승급 · 6×6 판', lines: [
      { who: 'master', face: 'joy', text: '허허, 네 칸 판을 다 채웠구나. 손이 제법 빠르다.' },
      { who: 'hero', face: 'joy', text: '생각보다 재밌다냥!' },
      { who: 'master', face: 'base', text: '구궁술의 첫 번째 가르침이다. 「한 줄에 같은 숫자는 하나뿐」. 잊지 말거라.' },
      { who: 'hero', face: 'determined', text: '명심하겠다냥!' }
    ] },
    { k: '2장 · 평민', t: '마을의 일원', scene: 'village', next: '중수 승급 · 9×9 판', lines: [
      { text: '{name:은} 마을을 돌며 흩어진 숫자들을 하나씩 주워 모았다.' },
      { text: '어지럽던 생선가게 간판이 다시 바로 서자, 마을 고양이들이 하나둘 말을 걸어오기 시작했다.' },
      { who: 'aunt', text: '네가 도장에 새로 온 아이구나! 이거 먹고 힘내렴.' },
      { who: 'hero', face: 'joy', text: '츄르다냥!! 고맙다냥!' },
      { who: 'master', face: 'smile', text: '이제 너도 마을의 일원이다. 그럼 진짜 판을 보여 주마. 아홉 칸이다.' },
      { who: 'hero', face: 'surprise', text: '아, 아홉 칸이나…?!' }
    ] },
    { k: '3장 · 중수', t: '검은 라이벌', scene: 'roofNight', next: '고수 승급', lines: [
      { who: 'kkam', face: 'base', text: '흥, 네가 사부님이 주워 왔다는 길냥이야?' },
      { who: 'hero', face: 'surprise', text: '누구냥?!' },
      { who: 'kkam', face: 'side', text: '나는 깜냥. 이 도장의 진짜 제자거든? 아홉 칸 판도 겨우 푸는 주제에.' },
      { who: 'master', face: 'joy', text: '허허, 깜냥이 돌아왔구나. 둘이 서로 겨뤄 보거라. 혼자 하는 수련보다 빨리 는단다.' },
      { who: 'hero', face: 'determined', text: '지지 않겠다냥!' }
    ] },
    { k: '4장 · 고수', t: '상자 안의 비밀', scene: 'dojo', next: '영웅 승급', lines: [
      { who: 'master', face: 'base', text: '두 번째 가르침이다. 「작은 상자 안에도 같은 숫자는 하나뿐」.' },
      { who: 'hero', face: 'surprise', text: '줄만 보면 되는 게 아니었다냥…!' },
      { who: 'kkam', face: 'sulky', text: '흥, 이제 알았어? …뭐, 그래도 꽤 하네.' },
      { who: 'hero', face: 'joy', text: '방금 칭찬한 거냥?' },
      { who: 'kkam', face: 'shout', text: '아, 아니거든?!' }
    ] },
    { k: '5장 · 영웅', t: '혼돈쥐의 습격', scene: 'villageNight', next: '지존 승급', lines: [
      { who: 'trio', face: 'base', speaker: '찍이', text: '찍찍! 숫자 도장에 새 제자가 생겼다며?' },
      { who: 'trio', face: 'mixed', speaker: '쪽이', text: '대왕님께서 가만두지 말라셨다!' },
      { who: 'trio', face: 'laugh', speaker: '짹이', text: '마을 판을 몽땅 어지럽혀 주마! 찍찍찍!' },
      { who: 'hero', face: 'determined', text: '마을을 건드리지 마라냥!!' },
      { who: 'kkam', face: 'think', text: '…같이 하자. 이번만이야.' },
      { text: '둘은 밤새 어지러워진 판을 되돌려 놓았고, 쥐 삼형제는 꼬리를 말고 달아났다.' }
    ] },
    { k: '6장 · 지존', t: '사부의 옛이야기', scene: 'fire', next: '초인 승급 · 여기부터 어려워져요', lines: [
      { who: 'master', face: 'calm', text: '이제 말해 줄 때가 되었구나. 혼돈쥐 대왕은… 원래 이 도장의 제자였다.' },
      { who: 'hero', face: 'surprise', text: '쥐가 도장 제자였다냥?!' },
      { who: 'master', face: 'calm', text: '누구보다 판을 좋아했지. 그런데 끝내 마지막 판을 풀지 못하자, 「풀 수 없는 판 따위 없어져 버려라」 하고 비급을 찢어 버렸단다.' },
      { who: 'kkam', face: 'think', text: '…그래서 숫자가 흩어진 거였군요.' },
      { who: 'master', face: 'stern', text: '흩어진 비급 조각 세 개를 찾아오거라. 그래야 마지막 가르침을 전할 수 있다.' }
    ] },
    { k: '7장 · 초인', t: '첫 번째 비급 조각 『인내』', scene: 'forest', next: '패왕 승급', lines: [
      { text: '숲속의 판은 몇 번을 들여다봐도 빈칸이 줄지 않았다.' },
      { who: 'hero', face: 'sad', text: '모르겠다냥… 아무 데도 못 넣겠다냥…' },
      { who: 'kkam', face: 'base', text: '서두르지 마. 사부님이 늘 말씀하셨잖아. 보이는 데부터 하나씩.' },
      { text: '한 칸, 또 한 칸. 마지막 숫자를 놓자 비급 조각이 빛났다.' },
      { text: '『첫째 조각 – 인내 : 막히면 쉬어 가고, 쉬었으면 다시 본다』' }
    ] },
    { k: '8장 · 패왕', t: '두 번째 비급 조각 『정직』', scene: 'forestDusk', next: '대왕 승급', lines: [
      { who: 'trio', face: 'laugh', speaker: '찍이', text: '찍찍, 조각은 여기 있다! 대신 이 숫자 하나만 슬쩍 바꿔 놓으면 줄게~' },
      { who: 'hero', face: 'determined', text: '…틀린 숫자를 놓으면 판 전체가 무너진다냥. 사부님한테 배웠다냥!' },
      { who: 'trio', face: 'mixed', speaker: '쪽이 · 짹이', text: '에잇, 안 넘어오네!' },
      { text: '{name:이} 정직하게 판을 풀자 가짜 조각이 부서지고, 진짜가 나타났다.' },
      { text: '『둘째 조각 – 정직 : 판은 거짓말을 받아 주지 않는다』' }
    ] },
    { k: '9장 · 대왕', t: '세 번째 비급 조각 『동료』', scene: 'storm', next: '신 승급 · 신에서 한 판을 깨면 마지막 이야기', lines: [
      { who: 'kkam', face: 'base', text: '이 판은 혼자서는 못 풀어. 네가 왼쪽, 내가 오른쪽.' },
      { who: 'hero', face: 'determined', text: '알겠다냥! 믿는다냥!' },
      { text: '두 판이 동시에 맞아떨어지는 순간, 마지막 조각이 내려왔다.' },
      { text: '『셋째 조각 – 동료 : 혼자 막힌 판도 함께 보면 길이 보인다』' },
      { who: 'kkam', face: 'sulky', text: '…야, 너 처음 왔을 때보다 진짜 많이 컸다.' },
      { who: 'hero', face: 'joy', text: '깜냥 덕분이다냥.' }
    ] },
    { k: '10장 · 신', t: '구궁의 신', scene: 'summit', next: '— 숫자 도장의 전설, 끝 —', lines: [
      { who: 'king', face: 'base', text: '찍… 네가 세 조각을 다 모았느니라. 그래도 이 마지막 판은 못 풀 것이다. 나도 끝내 못 풀었으니.' },
      { who: 'hero', face: 'base', text: '같이 풀자냥.' },
      { who: 'king', face: 'surprise', text: '…뭐라?' },
      { who: 'hero', face: 'determined', text: '인내, 정직, 동료. 혼자 못 풀면 같이 풀면 된다냥.' },
      { text: '둘은 해가 질 때까지 판 앞에 앉아 있었다.' },
      { text: '그리고 마지막 숫자가 놓이는 순간, 흩어졌던 숫자들이 하늘에서 마을로 쏟아져 내려 모두 제자리를 찾았다.' },
      { who: 'master', face: 'joy', text: '허허… 이제 네가 이 도장의 새 사부로구나.' },
      { who: 'king', face: 'smile', text: '찍… 다시 처음부터 배워도 되겠느냐.' },
      { who: 'hero', face: 'joy', text: '물론이다냥! 하수부터다냥!' },
      { text: '그 뒤로도 숫자 도장의 등불은 꺼지지 않았다. 오늘도 누군가 작은 판 앞에 앉아 있다.' }
    ] }
  ];

  /* ---------- 받침에 맞는 조사 ---------- */
  var JOSA = { '은': ['은', '는'], '이': ['이', '가'], '을': ['을', '를'], '과': ['과', '와'] };
  function josa(word, j) {
    var pair = JOSA[j];
    if (!pair) return word;
    var c = word.charCodeAt(word.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return word + ((c - 0xac00) % 28 ? pair[0] : pair[1]);
    return word + pair[0] + '(' + pair[1] + ')';
  }

  /* ---------- 화면 (처음 열 때 만듭니다) ---------- */
  var el = {}, built = false;
  function build() {
    if (built) return;
    built = true;
    var wrap = document.createElement('div');
    wrap.className = 'story';
    wrap.id = 'story';
    wrap.hidden = true;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', '이야기');
    wrap.innerHTML =
      '<div class="story-stage">' +
      '<img class="story-bg" alt="">' +
      '<div class="story-tint"></div>' +
      '<div class="story-moon"></div>' +
      '<canvas class="story-fx"></canvas>' +
      '<img class="story-actor left" alt="">' +
      '<img class="story-actor right" alt="">' +
      '<div class="story-box"><div class="story-name"></div><div class="story-text" aria-live="polite"></div><div class="story-next" aria-hidden="true">▼</div></div>' +
      '<div class="story-card"><div class="k"></div><div class="t"></div><div class="b"></div><div class="tap">화면을 누르세요</div></div>' +
      '<button type="button" class="story-skip">건너뛰기 ▸▸</button>' +
      '</div>';
    document.body.appendChild(wrap);
    el.wrap = wrap;
    el.bg = wrap.querySelector('.story-bg');
    el.tint = wrap.querySelector('.story-tint');
    el.moon = wrap.querySelector('.story-moon');
    el.fx = wrap.querySelector('.story-fx');
    el.L = wrap.querySelector('.story-actor.left');
    el.R = wrap.querySelector('.story-actor.right');
    el.box = wrap.querySelector('.story-box');
    el.name = wrap.querySelector('.story-name');
    el.text = wrap.querySelector('.story-text');
    el.card = wrap.querySelector('.story-card');
    el.skip = wrap.querySelector('.story-skip');
    wrap.querySelector('.story-stage').addEventListener('click', function (e) {
      if (e.target === el.skip) return;
      next();
    });
    el.skip.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
    });
  }

  /* ---------- 진행 ---------- */
  var ch = 0, li = -1, cur = null, state = 'off', typing = null, full = '', nick = '냥이', onDone = null, leftOn = false;

  function fill(s) {
    return s.replace(/\{name(?::(은|이|을|과))?\}/g, function (m, j) { return j ? josa(nick, j) : nick; });
  }
  function src(who, face) {
    var c = CAST[who];
    var f = c && (c.faces[face] || c.faces.base);
    return f ? 'img/story/c/' + f + '.webp' : '';
  }
  function preload(i) {
    var c = CHAPTERS[i];
    new Image().src = BG[SCENES[c.scene].bg];
    new Image().src = src('hero', 'base');
    c.lines.forEach(function (L) { if (L.who && src(L.who, L.face)) new Image().src = src(L.who, L.face); });
  }

  function setScene(key) {
    var s = SCENES[key];
    el.bg.src = BG[s.bg];
    el.bg.style.filter = s.filter || 'none';
    el.tint.style.background = s.tint || 'none';
    el.moon.style.opacity = s.moon ? 1 : 0;
    startFx(s.fx || null);
  }

  function showCard(kind) {
    var c = CHAPTERS[ch];
    state = kind;
    el.box.style.visibility = 'hidden';
    el.card.querySelector('.k').textContent = kind === 'card' ? c.k : (ch === CHAPTERS.length - 1 ? '엔딩' : c.k);
    el.card.querySelector('.t').textContent = kind === 'card' ? c.t : (ch === CHAPTERS.length - 1 ? '숫자 도장의 전설' : '다음 수련으로');
    var b = el.card.querySelector('.b');
    b.hidden = kind === 'card';
    b.textContent = c.next;
    el.card.classList.add('show');
  }

  function render() {
    var L = cur;
    var narr = !L.who;
    el.box.className = 'story-box' + (narr ? ' narr' : '');
    el.box.style.visibility = 'visible';
    if (!narr) {
      var c = CAST[L.who];
      el.name.textContent = fill(L.speaker || c.name);
      el.name.style.background = c.color;
    }
    // 주인공은 오른쪽, 다른 인물은 왼쪽. 말하는 인물만 밝게
    if (L.who === 'hero') {
      el.R.src = src('hero', L.face);
      el.R.className = 'story-actor right show talk';
      if (leftOn) el.L.className = 'story-actor left show idle';
    } else if (L.who && src(L.who, L.face)) {
      leftOn = true;
      el.L.src = src(L.who, L.face);
      el.L.className = 'story-actor left show talk';
      if (el.R.classList.contains('show')) el.R.className = 'story-actor right show idle';
    } else {
      if (leftOn) el.L.className = 'story-actor left show idle';
      if (el.R.classList.contains('show')) el.R.className = 'story-actor right show idle';
    }
    // 장 첫머리부터 주인공은 오른쪽에 서 있음 (도입부는 사부를 만난 뒤에 나옴)
    if (!el.R.classList.contains('show') && L.who !== 'hero' && ch !== 0) {
      el.R.src = src('hero', 'base');
      el.R.className = 'story-actor right show idle';
    }
    full = fill(L.text);
    type();
  }

  function type() {
    clearInterval(typing);
    el.box.classList.remove('done');
    // 문장 전체를 미리 깔아 두고(안 보이게) 왼쪽부터 한 글자씩 드러냄 → 가운데 정렬이어도 글씨가 출렁이지 않음
    var n = 0;
    var shown = document.createElement('span');
    var hidden = document.createElement('span');
    hidden.style.visibility = 'hidden';
    hidden.textContent = full;
    el.text.textContent = '';
    el.text.appendChild(shown);
    el.text.appendChild(hidden);
    typing = setInterval(function () {
      n += 1;
      shown.textContent = full.slice(0, n);
      hidden.textContent = full.slice(n);
      if (n >= full.length) finishType();
    }, 32);
  }
  function finishType() {
    clearInterval(typing);
    typing = null;
    el.text.textContent = full;
    el.box.classList.add('done');
  }

  function next() {
    if (state === 'off') return;
    if (state === 'card') {
      el.card.classList.remove('show');
      state = 'lines';
    } else if (state === 'end') {
      close();
      return;
    } else if (typing) {
      finishType();
      return;
    }
    li += 1;
    var lines = CHAPTERS[ch].lines;
    if (li >= lines.length) {
      showCard('end');
      return;
    }
    cur = lines[li];
    render();
  }

  /*
   * 한 장을 엽니다.
   *   i    : 0 = 도입부, 1~10 = 장
   *   opts : { name: 주인공 이름, onClose: 닫힌 뒤 부를 함수 }
   */
  function open(i, opts) {
    if (i < 0 || i >= CHAPTERS.length) return;
    build();
    opts = opts || {};
    nick = (opts.name || '').trim() || '냥이';
    onDone = opts.onClose || null;
    ch = i;
    li = -1;
    leftOn = false;
    el.L.className = 'story-actor left';
    el.R.className = 'story-actor right';
    preload(i);
    setScene(CHAPTERS[i].scene);
    el.wrap.hidden = false;
    showCard('card');
    window.requestAnimationFrame(function () { el.wrap.classList.add('on'); });
    el.skip.focus({ preventScroll: true });
  }

  function close() {
    if (state === 'off') return;
    state = 'off';
    clearInterval(typing);
    typing = null;
    stopFx();
    el.wrap.classList.remove('on');
    el.card.classList.remove('show');
    window.setTimeout(function () {
      if (state === 'off') el.wrap.hidden = true;
    }, 300);
    var cb = onDone;
    onDone = null;
    if (cb) cb();
  }

  /* 키보드 : 스페이스 · 엔터 · → 로 넘기고, Esc 로 건너뛰기 (js/ui.js 가 넘겨줌) */
  function key(k) {
    if (k === 'Escape') close();
    else if (k === ' ' || k === 'Enter' || k === 'ArrowRight') next();
  }

  /* ---------- 비 · 별 · 불티 · 반짝이 · 바람 ---------- */
  var ctx = null, parts = [], fxKind = null, raf = 0, dpr = 1;
  function startFx(kind) {
    stopFx();
    fxKind = kind;
    if (!kind) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.fx.width = el.fx.clientWidth * dpr || 400;
    el.fx.height = el.fx.clientHeight * dpr || 800;
    ctx = el.fx.getContext('2d');
    var W = el.fx.width, H = el.fx.height;
    var n = { rain: 120, stars: 45, embers: 36, sparkle: 24, wind: 50 }[kind];
    parts = [];
    for (var i = 0; i < n; i++) parts.push(spawn(kind, W, H, true));
    loop();
  }
  function stopFx() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (ctx) ctx.clearRect(0, 0, el.fx.width, el.fx.height);
  }
  function spawn(kind, W, H, first) {
    var r = Math.random;
    if (kind === 'rain') return { x: r() * W * 1.2, y: first ? r() * H : -20, v: (9 + r() * 6) * dpr, l: (12 + r() * 14) * dpr };
    if (kind === 'stars') return { x: r() * W, y: r() * H * 0.45, a: r(), s: 0.01 + r() * 0.03, z: (1 + r() * 1.5) * dpr };
    if (kind === 'embers') return { x: W * (0.25 + r() * 0.5), y: first ? H * (0.4 + r() * 0.6) : H, v: (0.6 + r() * 1.4) * dpr, w: r() * 6, z: (1.5 + r() * 2.5) * dpr, life: 1 };
    if (kind === 'sparkle') return { x: r() * W, y: first ? r() * H * 0.8 : H * 0.8, a: r(), s: 0.008 + r() * 0.02, z: (1.5 + r() * 2.5) * dpr, d: 0.2 + r() * 0.4 };
    return { x: first ? r() * W : -60, y: r() * H, v: (6 + r() * 8) * dpr, l: (30 + r() * 60) * dpr }; // wind
  }
  function loop() {
    var W = el.fx.width, H = el.fx.height;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (fxKind === 'rain') {
        ctx.strokeStyle = 'rgba(190,210,255,.45)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * 0.25, p.y + p.l); ctx.stroke();
        p.y += p.v; p.x -= p.v * 0.25;
        if (p.y > H) parts[i] = spawn('rain', W, H, false);
      } else if (fxKind === 'stars' || fxKind === 'sparkle') {
        p.a += p.s;
        var al = (Math.sin(p.a * 6) + 1) / 2;
        ctx.fillStyle = fxKind === 'stars' ? 'rgba(255,250,220,' + al * 0.9 + ')' : 'rgba(255,240,170,' + al * 0.8 + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.z, 0, 7); ctx.fill();
        if (fxKind === 'sparkle') { p.y -= p.d; if (p.y < 0) parts[i] = spawn('sparkle', W, H, false); }
      } else if (fxKind === 'embers') {
        p.y -= p.v; p.w += 0.05; p.x += Math.sin(p.w) * 0.6 * dpr; p.life -= 0.004;
        ctx.fillStyle = 'rgba(255,' + (140 + ((p.life * 80) | 0)) + ',60,' + Math.max(0, p.life) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.z, 0, 7); ctx.fill();
        if (p.y < H * 0.2 || p.life <= 0) parts[i] = spawn('embers', W, H, false);
      } else {
        ctx.strokeStyle = 'rgba(230,230,255,.22)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.l, p.y + p.l * 0.08); ctx.stroke();
        p.x += p.v;
        if (p.x > W) parts[i] = spawn('wind', W, H, false);
      }
    }
    raf = window.requestAnimationFrame(loop);
  }

  /* ---------- 다시 보기 목록 (홈의 📜 이야기 단추) ----------
   *   opts.open(i)   : 열린 장인지
   *   opts.lock(i)   : 잠긴 장 아래에 보일 글 (예: '평민이 되면 열려요')
   *   opts.name      : 주인공 이름
   */
  var list = null;
  function buildList() {
    if (list) return;
    list = document.createElement('div');
    list.className = 'story-list';
    list.hidden = true;
    list.setAttribute('role', 'dialog');
    list.setAttribute('aria-modal', 'true');
    list.setAttribute('aria-label', '이야기 다시 보기');
    list.innerHTML =
      '<div class="story-list-box">' +
      '<div class="story-list-head"><b>📜 숫자 도장의 전설</b><button type="button" class="story-list-x" aria-label="닫기">✕</button></div>' +
      '<div class="story-list-rows"></div>' +
      '</div>';
    document.body.appendChild(list);
    list.addEventListener('click', function (e) {
      if (e.target === list || (e.target.closest && e.target.closest('.story-list-x'))) closeList();
    });
  }
  var listOpts = null;
  function openList(opts) {
    buildList();
    listOpts = opts || {};
    var rows = list.querySelector('.story-list-rows');
    rows.innerHTML = '';
    CHAPTERS.forEach(function (c, i) {
      var ok = !listOpts.open || listOpts.open(i);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'story-row' + (ok ? '' : ' locked');
      b.disabled = !ok;
      var k = document.createElement('span');
      k.className = 'story-row-k';
      k.textContent = c.k;
      var t = document.createElement('span');
      t.className = 'story-row-t';
      t.textContent = ok ? c.t : '🔒 ' + (listOpts.lock ? listOpts.lock(i) : '아직 잠겨 있어요');
      b.appendChild(k);
      b.appendChild(t);
      if (ok) b.addEventListener('click', function () {
        list.hidden = true;
        open(i, { name: listOpts.name, onClose: function () { openList(listOpts); } });
      });
      rows.appendChild(b);
    });
    list.hidden = false;
    var first = rows.querySelector('.story-row:not(.locked)');
    if (first) first.focus({ preventScroll: true });
  }
  function closeList() {
    if (list) list.hidden = true;
  }

  S.Story = {
    CHAPTERS: CHAPTERS,
    count: CHAPTERS.length,
    open: open,
    close: close,
    key: key,
    isOpen: function () { return state !== 'off'; },
    openList: openList,
    closeList: closeList,
    listOpen: function () { return !!list && !list.hidden; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
