/*
 * 게임 설정 파일
 * ------------------------------------------------------------
 * 등급, 승급/강등 규칙 같은 "숫자"는 전부 여기에 모여 있습니다.
 * 게임 규칙을 바꾸고 싶으면 이 파일만 고치면 됩니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  S.Config = {
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
     *
     * 새 등급을 추가하려면 목록에 같은 모양으로 한 줄을 더 넣으면 됩니다.
     * (id는 한 번 정하면 바꾸지 마세요. 저장된 기록이 이 이름을 씁니다.)
     * 9×9 판에서 givens는 24 밑으로 내리면 퍼즐 만드는 데 시간이 오래 걸립니다.
     */
    GRADES: [
      { id: 'hasu', name: '하수', size: 4, boxRows: 2, boxCols: 2, givens: 10, level: 1, color: '#6f7f8c' },
      { id: 'pyeongmin', name: '평민', size: 6, boxRows: 2, boxCols: 3, givens: 20, level: 1, color: '#4d8558' },
      { id: 'jungsu', name: '중수', size: 9, boxRows: 3, boxCols: 3, givens: 45, level: 1, color: '#2f6aa8' },
      { id: 'gosu', name: '고수', size: 9, boxRows: 3, boxCols: 3, givens: 40, level: 1, color: '#6a4fa3' },
      { id: 'hero', name: '영웅', size: 9, boxRows: 3, boxCols: 3, givens: 36, level: 1, color: '#a3477f' },
      { id: 'jijon', name: '지존', size: 9, boxRows: 3, boxCols: 3, givens: 33, level: 1, color: '#b0562f' },
      { id: 'choin', name: '초인', size: 9, boxRows: 3, boxCols: 3, givens: 30, level: 2, color: '#a07a1f' },
      { id: 'paewang', name: '패왕', size: 9, boxRows: 3, boxCols: 3, givens: 28, level: 2, color: '#8c2f2f' },
      { id: 'daewang', name: '대왕', size: 9, boxRows: 3, boxCols: 3, givens: 26, level: 2, color: '#3d3a6b' },
      { id: 'sin', name: '신', size: 9, boxRows: 3, boxCols: 3, givens: 24, level: 3, color: '#1f1f1f' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
