/*
 * 게임 설정 파일
 * ------------------------------------------------------------
 * 등급, 승급/강등 규칙 같은 "숫자"는 전부 여기에 모여 있습니다.
 * 게임 규칙을 바꾸고 싶으면 이 파일만 고치면 됩니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  S.Config = {
    // 화면 오른쪽 위에 작게 보이는 버전 (휴대폰에 새 파일이 들어왔는지 확인용)
    // 고칠 때마다  python tools/bump_version.py  로 올립니다 (sw.js 의 CACHE, index.html 의 ?v= 도 함께) : sudoku-files-v47 → 'v47'
    VERSION: 'v47',

    FAILS_TO_DEMOTE: 3, // 연속으로 이만큼 실패하면 강등
    MAX_MISTAKES: 3, // 한 판에서 틀릴 수 있는 횟수
    MAX_HINTS: 3, // 한 판에서 쓸 수 있는 힌트 수

    // true 이면 승급과 상관없이 등급을 눌러서 골라 할 수 있습니다.
    // false 이면 하수부터 시작해서, 승급 미션을 깨야만 다음 등급으로 올라갑니다.
    FREE_GRADE_SELECT: false,

    /*
     * 승급 미션 : 지금 등급에서 아래 미션을 모두 깨면 다음 등급으로 올라갑니다.
     *   등급 id → 미션 목록 (가장 높은 등급은 미션 없음)
     *   type : 'win'     이 등급에서 n판 깨기
     *          'perfect' 한 번도 안 틀리고 n판 깨기
     *          'nohint'  힌트 없이 n판 깨기
     *          'fast'    min분 안에 n판 깨기
     *          'streak'  실패 없이 n판 연달아 깨기 (한 번 실패하면 처음부터)
     * 미션 수는 진행 동그라미 개수가 됩니다. 등급이 바뀌면(승급·강등) 미션은 처음부터 다시 셉니다.
     */
    MISSIONS: {
      hasu: [{ type: 'win', n: 3 }, { type: 'perfect', n: 1 }],
      pyeongmin: [{ type: 'win', n: 3 }, { type: 'perfect', n: 1 }, { type: 'nohint', n: 1 }],
      jungsu: [{ type: 'win', n: 4 }, { type: 'perfect', n: 1 }, { type: 'fast', n: 1, min: 15 }],
      gosu: [{ type: 'win', n: 4 }, { type: 'perfect', n: 2 }, { type: 'nohint', n: 2 }],
      hero: [{ type: 'win', n: 5 }, { type: 'streak', n: 3 }, { type: 'fast', n: 1, min: 12 }],
      jijon: [{ type: 'win', n: 5 }, { type: 'perfect', n: 2 }, { type: 'nohint', n: 3 }],
      choin: [{ type: 'win', n: 5 }, { type: 'streak', n: 3 }, { type: 'fast', n: 1, min: 15 }],
      paewang: [{ type: 'win', n: 6 }, { type: 'perfect', n: 3 }, { type: 'nohint', n: 3 }],
      daewang: [{ type: 'win', n: 6 }, { type: 'streak', n: 4 }, { type: 'perfect', n: 3 }, { type: 'fast', n: 1, min: 15 }]
    },

    /*
     * 로그인 (Google · 페이스북) : 구글 Firebase 를 씁니다.
     *   Firebase 콘솔(console.firebase.google.com) → 프로젝트 설정 → "내 앱"의 웹 앱 설정 값을
     *   아래에 그대로 옮겨 적으면 로그인 단추가 켜집니다. (만드는 법은 store/README.md 의 "로그인 설정")
     *   apiKey 가 비어 있으면 로그인 단추가 "준비 중"으로 나옵니다.
     *   이 값들은 숨길 필요가 없는 공개 값입니다. (기록은 Firestore 보안 규칙으로 본인만 볼 수 있게 막습니다)
     */
    FIREBASE: {
      apiKey: 'AIzaSyC4_gBErdd5Sjl0cCVFl3jimFKkicFlOX0',
      authDomain: 'sudoku-seunggeupjeon.firebaseapp.com',
      projectId: 'sudoku-seunggeupjeon',
      storageBucket: 'sudoku-seunggeupjeon.firebasestorage.app',
      messagingSenderId: '45758241016',
      appId: '1:45758241016:web:4340f526b720273eb3830d'
    },
    // 보여 줄 로그인 단추 : 지금은 Google 만 씁니다.
    //   'kakao', 'facebook' 도 코드는 들어 있지만 쓰지 않습니다
    //   (카카오는 Firebase Identity Platform 업그레이드가 필요하고, 한 달 50명이 넘으면 요금이 붙어서 뺐습니다)
    LOGIN_PROVIDERS: ['google'],

    /*
     * 오늘의 퍼즐 (계단 오르기) : 한 판을 깨면 같은 난이도의 다음 단계가 이어서 나옵니다. 밤 12시에 1단계부터 다시.
     *   같은 날 같은 단계는 모든 사람에게 같은 퍼즐이 나옵니다.
     *   givens, level : 등급 목록과 같은 뜻 (채워진 숫자 개수, 어려운 정도)
     *   bonusEvery, bonusHints : bonusEvery 단계를 오를 때마다 힌트권 bonusHints 장
     *   points        : 점수 크기 (등급 순서와 같은 뜻. 5면 다섯 번째 등급 "영웅"과 같은 점수)
     *   seed          : 이 숫자를 바꾸면 날짜별 퍼즐이 전부 달라집니다 (보통은 건드리지 마세요)
     */
    DAILY: { name: '오늘의 퍼즐', size: 9, boxRows: 3, boxCols: 3, givens: 36, level: 1, points: 5, color: '#c2452d', seed: 7, bonusEvery: 5, bonusHints: 3 },
    /*
     * 오늘의 퍼즐 달력 보상 : 한 달 동안 오늘의 퍼즐(1단계 이상)을 한 날 수가 days 가 되면
     * 그 달의 왕관(동·은·금)과 힌트권 hints 장을 줍니다.
     */
    DAILY_MONTH_GOALS: [
      { days: 10, hints: 3, crown: 'bronze', name: '동' },
      { days: 20, hints: 5, crown: 'silver', name: '은' },
      { days: 30, hints: 10, crown: 'gold', name: '금' }
    ],

    /*
     * 개인 아이템 (출석 보상으로 받고, 게임 중에 🎒 가방 단추로 씁니다)
     *   id   : 프로그램 안에서 쓰는 이름 (한 번 정하면 바꾸지 마세요. 저장된 개수가 이 이름을 씁니다)
     *   icon : 그림 (이모지 한 글자)
     */
    //   auto : true 면 직접 쓰는 아이템이 아니라, 필요할 때 저절로 쓰이거나 물어봅니다
    ITEMS: [
      { id: 'hint', icon: '💡', name: '힌트권', desc: '힌트 3번을 다 쓴 뒤에도 한 칸을 더 알려 줘요' },
      { id: 'time', icon: '⏱️', name: '시간 단축권', desc: '걸린 시간을 30초 줄여요' },
      { id: 'shield', icon: '🩹', name: '실수 지우개', desc: '틀린 횟수 1번을 없던 일로 해요' },
      { id: 'memo', icon: '✏️', name: '자동 메모권', desc: '빈칸마다 들어갈 수 있는 숫자를 모두 메모해 줘요' },
      { id: 'double', icon: '✨', name: '점수 2배권', desc: '이번 판에서 받는 점수가 모두 2배가 돼요' },
      { id: 'magnify', icon: '🔍', name: '돋보기', desc: '고른 숫자가 들어갈 수 있는 자리를 판에 모두 보여 줘요' },
      { id: 'revive', icon: '💖', name: '되살리기권', desc: '3번 틀려 실패하면, 그 판을 이어서 할 수 있어요', auto: true, autoText: '실패하면 물어봐요' },
      { id: 'guard', icon: '🛡️', name: '연속 보호권', desc: '하루 빠져도 출석과 오늘의 퍼즐 연속 일수가 끊기지 않아요 (빠진 하루에 1장)', auto: true, autoText: '저절로 쓰여요' }
    ],
    TIME_ITEM_SEC: 30, // 시간 단축권 한 장이 줄여 주는 시간(초)

    // 처음 시작할 때 주는 아이템 : { 아이템id: 개수 } (빈 {} 로 바꾸면 아이템 없이 시작)
    START_ITEMS: { hint: 3, time: 3, shield: 3 },
    // 이 숫자를 1 올리면, 이미 하던 사람도 가진 아이템이 한 번 START_ITEMS 로 되돌아갑니다 (모은 별은 그대로)
    ITEM_RESET: 1,
    /*
     * 모두에게 한 번씩 주는 선물 (가진 아이템에 더해 줌. 받은 사람은 다시 받지 않음)
     *   id    : 선물 이름 (한 번 정하면 바꾸지 마세요. 새 선물은 새 id 로 한 줄 더)
     *   items : { 아이템id: 개수 }  ('*' 는 모든 아이템)
     *   text  : 받을 때 보이는 글
     */
    ITEM_GIFTS: [
      { id: 'test-2026-11-24', items: { '*': 3 }, text: '🎁 시험 기간 선물!\n모든 아이템을 3개씩 드려요' }
    ],

    /*
     * 상점 (js/shop.js) : 별(⭐)로 아이템을 삽니다.
     *   ITEM_PRICES : 아이템 한 개 값 (별 개수). 목록에 없거나 0 이면 팔지 않습니다.
     *   STAR_PACKS  : 별 충전 묶음 (진짜 돈 결제). id 는 나중에 Play Console 에 만들 인앱 상품 ID 와 같게.
     *                 price 는 화면에 보여 줄 값입니다. (실제 결제 금액은 Play Console 에서 정함)
     *   START_STARS : 처음 시작할 때 주는 별
     */
    // 상점 켜기 : false 면 별(⭐) 칸, 아이템 "사기" 단추, 별 충전 창을 모두 숨깁니다.
    //   (별 판매 = 인앱 결제를 붙인 뒤에 true 로. 아이템은 시작 선물과 출석 선물로만 얻음)
    SHOP_ENABLED: false,
    ITEM_PRICES: { hint: 30, time: 20, shield: 30, memo: 50, double: 40, magnify: 30, revive: 80, guard: 60 },
    STAR_PACKS: [
      { id: 'stars_100', stars: 100, price: '₩1,200' },
      { id: 'stars_550', stars: 550, price: '₩5,900', tag: '10% 더' },
      { id: 'stars_1200', stars: 1200, price: '₩11,000', tag: '20% 더' },
      { id: 'stars_3300', stars: 3300, price: '₩25,000', tag: '30% 더' }
    ],
    START_STARS: 0,

    /*
     * 출석 체크 : 하루에 한 번, 7일을 한 바퀴로 보상을 받습니다.
     *   하루라도 빠지면 다시 1일째부터 시작합니다.
     *   보상 모양 : { 아이템id: 개수 }
     */
    ATTEND_REWARDS: [
      { hint: 1 },
      { time: 1 },
      { shield: 1 },
      { magnify: 1 },
      { memo: 1 },
      { double: 1, guard: 1 },
      { hint: 2, revive: 1, shield: 1 } // 7일째 : 큰 상자
    ],

    /*
     * 점수 규칙
     *   "기본 점수" = BASE × 등급 순서 (하수 10점, 평민 20점, 중수 30점 …)
     *   숫자를 맞히면 기본 점수를 받고, 틀리지 않고 연속으로 맞히면 점점 커집니다.
     *   힌트로 채운 칸은 점수가 없고, 한 칸은 한 번만 점수를 받습니다.
     */
    /*
     * 점수 (모두 "기본 점수 × 숫자" 로 셉니다. 기본 점수 = BASE × 등급 순서, 오늘의 퍼즐은 DAILY.points)
     *   칸마다     : 기본 점수 + 연속 콤보 + 빠른 손 + 줄·상자 완성 + 숫자 완성 + 콤보 고비
     *   판을 깨면  : 완성 + 무결점 + 힌트 없이 + 시간 + 최고 콤보 + 오늘의 퍼즐 단계
     */
    SCORE: {
      BASE: 10, // 등급 한 단계마다 늘어나는 기본 점수
      COMBO_STEP: 0.5, // 연속으로 맞힐 때마다 기본 점수의 이만큼씩 더 받음
      COMBO_MAX: 8, // 연속 보너스가 쌓이는 최대 횟수 (8이면 최대 5배)
      COMBO_MILESTONE: 10, // 10연속 · 20연속 … 마다 기본 점수 × 이만큼 × (10의 몇 배인지)
      SPEED_SEC: 8, // 바로 전 정답에서 이 시간(초) 안에 또 맞히면 "빠른 손"
      SPEED_BONUS: 1, // 빠른 손 : 기본 점수 × 이만큼
      UNIT_BONUS: 3, // 줄·상자 하나를 완성하면 기본 점수 × 이만큼 보너스
      NUMBER_BONUS: 5, // 한 숫자(예: 7)를 판에 다 채우면 기본 점수 × 이만큼
      CLEAR_BONUS: 10, // 판을 깨면 기본 점수 × 이만큼 보너스
      PERFECT_BONUS: 10, // 한 번도 안 틀리고 깨면 기본 점수 × 이만큼 추가 보너스
      NOHINT_BONUS: 8, // 힌트 없이 깨면 기본 점수 × 이만큼
      TIME_PER_CELL: 15, // 시간 보너스 기준 : 빈칸 하나에 이 시간(초)
      TIME_STEP: 10, // 기준보다 이 시간(초)만큼 빠를 때마다 기본 점수 × 1
      TIME_MAX: 40, // 시간 보너스 최대 (기본 점수 × 이만큼)
      BEST_COMBO: 1, // 이번 판 최고 콤보 × 기본 점수 × 이만큼 (5연속 이상일 때)
      STAGE_BONUS: 2 // 오늘의 퍼즐 : (단계 - 1) × 기본 점수 × 이만큼
    },

    /*
     * 등급 목록 (위에서 아래로 갈수록 높은 등급)
     *
     *   name    : 화면에 보이는 등급 이름
     *   size    : 판 크기 (4 → 4×4, 6 → 6×6, 9 → 9×9)
     *   boxRows : 굵은 선으로 묶인 상자 하나의 세로 칸 수
     *   boxCols : 굵은 선으로 묶인 상자 하나의 가로 칸 수
     *   givens  : 처음부터 채워져 있는 숫자 개수 (적을수록 어려움)
     *   level   : 어려운 정도 (1 기본 요령만으로 풀림, 2 중급 요령 필요, 3 고급 요령 필요)
     *   color   : 등급 배지 색
     *   char    : 판 위 캐릭터 그림(img/chars.webp)의 몇 번째 칸인지 (0 = grade01 가장 낮음 … 13 = grade14 가장 높음)
     *
     * 새 등급을 추가하려면 목록에 같은 모양으로 한 줄을 더 넣으면 됩니다.
     * (id는 한 번 정하면 바꾸지 마세요. 저장된 기록이 이 이름을 씁니다.)
     * 9×9 판에서 givens는 24 밑으로 내리면 퍼즐 만드는 데 시간이 오래 걸립니다.
     */
    GRADES: [
      { id: 'hasu', name: '하수', size: 4, boxRows: 2, boxCols: 2, givens: 10, level: 1, color: '#6f7f8c', char: 0 },
      { id: 'pyeongmin', name: '평민', size: 6, boxRows: 2, boxCols: 3, givens: 20, level: 1, color: '#4d8558', char: 1 },
      { id: 'jungsu', name: '중수', size: 9, boxRows: 3, boxCols: 3, givens: 45, level: 1, color: '#2f6aa8', char: 3 },
      { id: 'gosu', name: '고수', size: 9, boxRows: 3, boxCols: 3, givens: 40, level: 1, color: '#6a4fa3', char: 4 },
      { id: 'hero', name: '영웅', size: 9, boxRows: 3, boxCols: 3, givens: 36, level: 1, color: '#a3477f', char: 6 },
      { id: 'jijon', name: '지존', size: 9, boxRows: 3, boxCols: 3, givens: 33, level: 1, color: '#b0562f', char: 7 },
      { id: 'choin', name: '초인', size: 9, boxRows: 3, boxCols: 3, givens: 30, level: 2, color: '#a07a1f', char: 9 },
      { id: 'paewang', name: '패왕', size: 9, boxRows: 3, boxCols: 3, givens: 28, level: 2, color: '#8c2f2f', char: 10 },
      { id: 'daewang', name: '대왕', size: 9, boxRows: 3, boxCols: 3, givens: 26, level: 2, color: '#3d3a6b', char: 12 },
      { id: 'sin', name: '신', size: 9, boxRows: 3, boxCols: 3, givens: 24, level: 3, color: '#1f1f1f', char: 13 }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
