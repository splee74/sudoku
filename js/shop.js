/*
 * 상점 : 별(⭐)로 아이템을 사고, 별을 충전합니다.
 *
 *   아이템 값      : js/config.js 의 ITEM_PRICES (별 몇 개)
 *   별 충전 묶음   : js/config.js 의 STAR_PACKS
 *
 * 별 충전(진짜 돈 결제)은 아직 준비 중입니다. 나중에 붙일 때는 buyStars 만 고치면 됩니다.
 *   - 플레이스토어 앱(TWA)에서는 크롬의 Digital Goods API 와 Payment Request 로 Google Play 결제를 부릅니다.
 *   - STAR_PACKS 의 id 는 Play Console 에 만든 인앱 상품 ID 와 같아야 합니다.
 *   - 결제가 끝나면 S.Progress.addStars(data, 별 수) 로 별을 넣고 저장합니다.
 *   - 결제가 진짜인지 서버에서 확인하는 단계도 함께 만드는 것이 안전합니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;

  /* 아이템 한 개 값 (별). 팔지 않는 아이템이면 0 */
  function price(id) {
    var p = C.ITEM_PRICES && C.ITEM_PRICES[id];
    return typeof p === 'number' && p > 0 ? p : 0;
  }

  /*
   * 별로 아이템 한 개 사기
   * 반환 : { ok: true, price } 또는 { ok: false, reason: 'stars' (별 부족) | 'not-for-sale', need: 모자란 별 }
   */
  function buyItem(data, id) {
    var p = price(id);
    if (!p) return { ok: false, reason: 'not-for-sale' };
    var have = S.Progress.stars(data);
    if (have < p) return { ok: false, reason: 'stars', need: p - have };
    S.Progress.addStars(data, -p);
    S.Progress.addItem(data, id, 1);
    return { ok: true, price: p };
  }

  /* 별 충전(결제)을 쓸 수 있는지 */
  function billingReady() {
    return false;
  }

  /* 별 충전 : 지금은 준비 중 (위 설명 참고) */
  function buyStars(packId) {
    return Promise.reject(new Error('not-ready'));
  }

  S.Shop = { price: price, buyItem: buyItem, billingReady: billingReady, buyStars: buyStars };
})(typeof window !== 'undefined' ? window : globalThis);
