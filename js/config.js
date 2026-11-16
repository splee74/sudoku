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
    // 고칠 때마다  python tools/bump_version.py  로 올립니다 (sw.js 의 CACHE, index.html 의 ?v= 도 함께) : sudoku-files-v15 → 'v15'
    VERSION: 'v15',

    WINS_TO_PROMOTE: 5, // 같은 등급에서 이만큼 깨면 승급
    FAILS_TO_DEMOTE: 3, // 연속으로 이만큼 실패하면 강등
    MAX_MISTAKES: 3, // 한 판에서 틀릴 수 있는 횟수
    MAX_HINTS: 3, // 한 판에서 쓸 수 있는 힌트 수

    // true 이면 승급과 상관없이 등급을 눌러서 골라 할 수 있습니다.
    // false 로 바꾸면 승급해야만 다음 등급을 할 수 있습니다.
    FREE_GRADE_SELECT: true,

    /*
     * 로그인 (Google · 페이스북) : 구글 Firebase 를 씁니다.
     *   Firebase 콘솔(console.firebase.google.com) → 프로젝트 설정 → "내 앱"의 웹 앱 설정 값을
     *   아래에 그대로 옮겨 적으면 로그인 단추가 켜집니다. (만드는 법은 store/README.md 의 "로그인 설정")
     *   apiKey 가 비어 있으면 로그인 단추가 "준비 중"으로 나옵니다.
     *   이 값들은 숨길 필요가 없는 공개 값입니다. (기록은 Firestore 보안 규칙으로 본인만 볼 수 있게 막습니다)
     */
    FIREBASE: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      appId: ''
    },
    // 보여 줄 로그인 단추 : 'google', 'facebook' (페이스북은 Meta 개발자 앱을 만든 뒤에 넣으세요)
    LOGIN_PROVIDERS: ['google', 'facebook'],

    /*
     * 오늘의 퍼즐 : 하루에 한 판, 같은 날에는 모든 사람에게 같은 퍼즐이 나옵니다.
     *   givens, level : 등급 목록과 같은 뜻 (채워진 숫자 개수, 어려운 정도)
     *   points        : 점수 크기 (등급 순서와 같은 뜻. 5면 다섯 번째 등급 "영웅"과 같은 점수)
     *   seed          : 이 숫자를 바꾸면 날짜별 퍼즐이 전부 달라집니다 (보통은 건드리지 마세요)
     */
    DAILY: { name: '오늘의 퍼즐', size: 9, boxRows: 3, boxCols: 3, givens: 36, level: 1, points: 5, color: '#c2452d', seed: 7 },

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

    // 처음 시작할 때 아이템마다 이만큼씩 줍니다 (0 으로 바꾸면 아이템 없이 시작)
    //   이미 하던 사람도 이 선물을 아직 안 받았으면 한 번 받습니다.
    START_ITEMS: 3,

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
    SCORE: {
      BASE: 10, // 등급 한 단계마다 늘어나는 기본 점수
      COMBO_STEP: 0.5, // 연속으로 맞힐 때마다 기본 점수의 이만큼씩 더 받음
      COMBO_MAX: 4, // 연속 보너스가 쌓이는 최대 횟수 (4면 최대 3배)
      UNIT_BONUS: 2, // 줄·상자 하나를 완성하면 기본 점수 × 이만큼 보너스
      CLEAR_BONUS: 10, // 판을 깨면 기본 점수 × 이만큼 보너스
      PERFECT_BONUS: 5 // 한 번도 안 틀리고 깨면 기본 점수 × 이만큼 추가 보너스
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
     *   char    : 판 위 캐릭터 그림(img/chars.webp)의 몇 번째 칸인지 (0 = 맨 왼쪽 하수 … 8 = 신)
     *
     * 새 등급을 추가하려면 목록에 같은 모양으로 한 줄을 더 넣으면 됩니다.
     * (id는 한 번 정하면 바꾸지 마세요. 저장된 기록이 이 이름을 씁니다.)
     * 9×9 판에서 givens는 24 밑으로 내리면 퍼즐 만드는 데 시간이 오래 걸립니다.
     */
    GRADES: [
      { id: 'hasu', name: '하수', size: 4, boxRows: 2, boxCols: 2, givens: 10, level: 1, color: '#6f7f8c', char: 0 },
      { id: 'pyeongmin', name: '평민', size: 6, boxRows: 2, boxCols: 3, givens: 20, level: 1, color: '#4d8558', char: 0 },
      { id: 'jungsu', name: '중수', size: 9, boxRows: 3, boxCols: 3, givens: 45, level: 1, color: '#2f6aa8', char: 1 },
      { id: 'gosu', name: '고수', size: 9, boxRows: 3, boxCols: 3, givens: 40, level: 1, color: '#6a4fa3', char: 2 },
      { id: 'hero', name: '영웅', size: 9, boxRows: 3, boxCols: 3, givens: 36, level: 1, color: '#a3477f', char: 3 },
      { id: 'jijon', name: '지존', size: 9, boxRows: 3, boxCols: 3, givens: 33, level: 1, color: '#b0562f', char: 4 },
      { id: 'choin', name: '초인', size: 9, boxRows: 3, boxCols: 3, givens: 30, level: 2, color: '#a07a1f', char: 5 },
      { id: 'paewang', name: '패왕', size: 9, boxRows: 3, boxCols: 3, givens: 28, level: 2, color: '#8c2f2f', char: 6 },
      { id: 'daewang', name: '대왕', size: 9, boxRows: 3, boxCols: 3, givens: 26, level: 2, color: '#3d3a6b', char: 7 },
      { id: 'sin', name: '신', size: 9, boxRows: 3, boxCols: 3, givens: 24, level: 3, color: '#1f1f1f', char: 8 }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
