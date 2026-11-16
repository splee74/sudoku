/*
 * 환경설정 : 켜고 끄는 항목들.
 * 설정 화면은 아래 ITEMS 목록을 보고 자동으로 만들어집니다.
 * 항목을 추가하려면 ITEMS에 한 줄을 넣으면 됩니다.
 * (설정은 "기록 지우기"를 해도 지워지지 않게 따로 저장합니다.)
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var KEY = 'sudoku-settings-v1';

  /*
   *   key   : 프로그램 안에서 쓰는 이름 (바꾸지 마세요)
   *   group : 설정 화면에서 묶이는 제목
   *   title : 항목 이름
   *   desc  : 항목 설명
   *   on    : 처음 상태 (true = 켜짐)
   */
  var ITEMS = [
    { key: 'highlightSame', group: '강조 표시', title: '같은 숫자 강조', desc: '숫자를 누르면 판에 있는 같은 숫자를 모두 표시합니다', on: true },
    { key: 'highlightArea', group: '강조 표시', title: '줄·상자 강조', desc: '고른 칸과 같은 가로줄, 세로줄, 상자를 연하게 표시합니다', on: true },
    { key: 'highlightDup', group: '강조 표시', title: '겹치는 숫자 표시', desc: '틀린 숫자와 겹치는 숫자가 어디 있는지 빨갛게 알려 줍니다', on: true },

    { key: 'unitEffect', group: '효과', title: '줄·상자 완성 효과', desc: '한 줄이나 상자 하나를 다 채우면 둘레가 빛나고 반짝이가 튑니다', on: true },
    { key: 'wrongEffect', group: '효과', title: '틀림·실패 효과', desc: '틀리면 판이 흔들리고 겹치는 숫자가 깜박입니다', on: true },
    { key: 'winEffect', group: '효과', title: '판 완성 효과', desc: '한 판을 깨면 판 전체가 반짝이고 색종이가 떨어집니다', on: true },
    { key: 'hero', group: '효과', title: '캐릭터 표시', desc: '판 위에 내 등급 캐릭터가 나와 맞히고 틀릴 때마다 표정이 바뀝니다 (끄면 판이 조금 커집니다)', on: true },
    { key: 'cheer', group: '효과', title: '응원 메시지', desc: '절반을 채웠을 때, 줄을 완성했을 때 짧은 응원을 보여 줍니다', on: true },

    { key: 'sound', group: '소리와 진동', title: '효과음', desc: '숫자를 넣거나 버튼을 누를 때 소리가 납니다', on: true },
    { key: 'vibrate', group: '소리와 진동', title: '틀렸을 때 진동', desc: '틀린 숫자를 넣으면 휴대폰이 짧게 떨립니다', on: true },

    { key: 'showScore', group: '편의 기능', title: '점수 표시', desc: '게임 중에 점수와, 맞힐 때 올라가는 점수를 보여 줍니다', on: true },
    { key: 'showTimer', group: '편의 기능', title: '시간 표시', desc: '게임 중에 걸린 시간을 보여 줍니다', on: true },
    { key: 'autoNotes', group: '편의 기능', title: '메모 자동 정리', desc: '숫자를 넣으면 같은 줄·상자의 메모에서 그 숫자를 지웁니다', on: true }
  ];

  var values = {};

  function load() {
    var saved = {};
    try {
      var raw = S.Storage.get(KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (e) {
      saved = {};
    }
    for (var i = 0; i < ITEMS.length; i++) {
      var k = ITEMS[i].key;
      values[k] = typeof saved[k] === 'boolean' ? saved[k] : ITEMS[i].on;
    }
    // 고른 스킨 (목록은 skins.js)
    values.skin = typeof saved.skin === 'string' ? saved.skin : 'default';
    // 화면 밝기 : 'auto' 휴대폰 따라가기 · 'light' 밝게 · 'dark' 어둡게
    values.theme = THEMES.indexOf(saved.theme) >= 0 ? saved.theme : 'auto';
    // 처음 하는 사람을 위한 따라 하기를 끝냈거나 건너뛰었는지
    values.tutorialDone = saved.tutorialDone === true;
  }

  var THEMES = ['auto', 'light', 'dark'];

  function setTheme(id) {
    if (THEMES.indexOf(id) < 0) return;
    values.theme = id;
    store();
  }

  function store() {
    try {
      S.Storage.set(KEY, JSON.stringify(values));
    } catch (e) {
      /* 저장 실패는 조용히 넘어갑니다 */
    }
  }

  function setSkin(id) {
    values.skin = String(id);
    store();
  }

  function get(key) {
    return values[key];
  }

  function set(key, value) {
    values[key] = !!value;
    store();
  }

  load();

  S.Settings = { ITEMS: ITEMS, get: get, set: set, setSkin: setSkin, setTheme: setTheme, load: load };
})(typeof window !== 'undefined' ? window : globalThis);
