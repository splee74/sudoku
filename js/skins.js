/*
 * 스킨 목록 : 설정 창에서 고를 수 있는 판 모양.
 * 색과 모양은 css/skins.css 에 있고, 여기에는 이름과 미리보기 색만 있습니다.
 *
 *   id     : 프로그램 안에서 쓰는 이름 (바꾸지 마세요. css/skins.css 와 짝입니다)
 *   name   : 설정 창에 보이는 이름
 *   tile   : true 이면 칸이 하나하나 떨어진 "타일" 모양
 *   swatch : 설정 창의 작은 미리보기 (바탕색 + 3×3 아홉 칸의 색)
 *            색 대신 image: '그림 파일 위치' 를 적으면 그 그림을 보여 줍니다
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});

  /* 파스텔 스킨 미리보기 : 모서리와 가운데 상자만 색칠 */
  function pastel(tint) {
    var w = '#ffffff';
    return [tint, w, tint, w, tint, w, tint, w, tint];
  }

  var LIST = [
    { id: 'default', name: '기본', tile: false, swatch: { bg: '#4a463d', cells: ['#fffdf8', '#ece5d3', '#fffdf8', '#ece5d3', '#ffd35c', '#ece5d3', '#fffdf8', '#ece5d3', '#ffe9a6'] } },
    { id: 'pastel-green', name: '파스텔 초록', tile: false, swatch: { bg: '#8a9a88', cells: pastel('#c9e8c4') } },
    { id: 'pastel-yellow', name: '파스텔 노랑', tile: false, swatch: { bg: '#9a947a', cells: pastel('#f5e793') } },
    { id: 'pastel-purple', name: '파스텔 보라', tile: false, swatch: { bg: '#8c88a6', cells: pastel('#c5bdef') } },
    { id: 'pastel-pink', name: '파스텔 분홍', tile: false, swatch: { bg: '#a68a8a', cells: pastel('#f9c5c5') } },
    { id: 'pastel-sky', name: '파스텔 하늘', tile: false, swatch: { bg: '#7f9a9e', cells: pastel('#b4e5ea') } },
    { id: 'pastel-orange', name: '파스텔 주황', tile: false, swatch: { bg: '#a3907a', cells: pastel('#f7c58d') } },
    { id: 'ivory', name: '아이보리 타일', tile: true, swatch: { bg: '#cfc5b2', cells: ['#f4efe4', '#f4efe4', '#f4efe4', '#f4efe4', '#efc463', '#f4efe4', '#f4efe4', '#f4efe4', '#f4efe4'] } },
    // 나무판 미리보기는 사진을 씁니다 (img/sudoku_img01.png 을 작게 줄인 그림)
    { id: 'wood', name: '나무판', tile: true, swatch: { image: 'img/skin-wood.jpg' } },
    { id: 'colorful', name: '알록달록', tile: true, swatch: { bg: '#b89b7a', cells: ['#2fa84f', '#ff6fae', '#6b2a86', '#22b8dc', '#e3173e', '#f0b90b', '#1456c8', '#ff8a2a', '#7fbf2a'] } }
  ];

  function find(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return LIST[0];
  }

  /* 지금 고른 스킨 */
  function current() {
    return find(S.Settings.get('skin'));
  }

  /* 스킨을 화면에 입히고 저장합니다 */
  function apply(id) {
    var skin = find(id);
    var el = document.documentElement;
    el.setAttribute('data-skin', skin.id);
    if (skin.tile) el.setAttribute('data-tile', '');
    else el.removeAttribute('data-tile');
    if (S.Settings.get('skin') !== skin.id) S.Settings.setSkin(skin.id);
    return skin;
  }

  S.Skins = { LIST: LIST, current: current, apply: apply };
})(typeof window !== 'undefined' ? window : globalThis);
