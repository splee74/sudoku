/*
 * 계정 : Google · 카카오로 로그인하고, 내 기록을 계정에 저장합니다.
 *   카카오는 Firebase 의 OpenID Connect 제공업체 'oidc.kakao' 로 로그인합니다.
 *   - 로그인하면 이 기기의 기록과 계정에 저장된 기록을 합칩니다. (js/progress.js 의 merge)
 *   - 그 뒤로는 기록이 바뀔 때마다 몇 초 뒤에 계정에도 저장합니다.
 *   - 다른 휴대폰에서 같은 계정으로 로그인하면 기록이 그대로 이어집니다.
 *
 * Firebase(구글의 무료 로그인·저장 서비스)를 씁니다. 설정 값은 js/config.js 의 FIREBASE.
 * 하다가 멈춘 판은 계정에 올리지 않고 기기에만 둡니다.
 */
(function (root) {
  var S = (root.SUDOKU = root.SUDOKU || {});
  var C = S.Config;
  var SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var HINT_KEY = 'sudoku-account-v1'; // 로그인했던 적이 있는지 (다음에 켤 때 미리 준비하려고)
  var UPLOAD_DELAY = 3000;

  var fb = null; // { auth, db }
  var user = null; // { uid, name, photo, provider }
  var listeners = [];
  var getData = null; // 지금 기록을 돌려주는 함수 (ui.js 가 연결)
  var setData = null; // 합친 기록을 화면에 넣는 함수 (ui.js 가 연결)
  var uploadTimer = 0;
  var loading = null;
  var syncing = false;
  var known = false; // Firebase 가 로그인 상태를 한 번이라도 알려 줬는지
  var knownWait = [];

  function configured() {
    return !!(C.FIREBASE && C.FIREBASE.apiKey && C.FIREBASE.projectId);
  }

  function providers() {
    return (C.LOGIN_PROVIDERS || []).slice();
  }

  function emit(status, message) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](status, user, message);
      } catch (e) {
        /* 화면 쪽 오류가 로그인을 막지 않게 */
      }
    }
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('load ' + src));
      };
      document.head.appendChild(s);
    });
  }

  /*
   * 저장소(Firestore) 읽기 · 쓰기는 Firestore 웹 주소(REST)로 바로 보냅니다.
   *   Firebase 의 Firestore 묶음(SDK)은 서버와 따로 연결을 맺어 두고 쓰는데, 휴대폰에 따라 이 연결이
   *   맺어지지 않아 저장 · 랭킹이 끝없이 멈추는 일이 있었습니다. 웹 주소는 보통 인터넷 요청이라 그런 일이 없습니다.
   *   쓰는 모양은 SDK 와 같게 : db.collection('a').doc('b').get() / .set({...}) / .delete()
   *   STAMP 를 넣은 칸은 서버 시각으로 채웁니다 (보안 규칙의 request.time 과 같음).
   */
  var STAMP = { stamp: true };
  var REST_WAIT_MS = 20000; // 요청 하나를 기다리는 가장 긴 시간

  function restRoot() { return 'projects/' + C.FIREBASE.projectId + '/databases/(default)/documents'; }
  function restUrl(path) {
    return 'https://firestore.googleapis.com/v1/' + path.split('/').map(encodeURIComponent).join('/') + '?key=' + C.FIREBASE.apiKey;
  }
  function encodeValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
    var fields = {};
    for (var k in v) fields[k] = encodeValue(v[k]);
    return { mapValue: { fields: fields } };
  }
  function decodeValue(x) {
    if (!x) return undefined;
    if ('integerValue' in x) return Number(x.integerValue);
    if ('doubleValue' in x) return Number(x.doubleValue);
    if ('stringValue' in x) return x.stringValue;
    if ('booleanValue' in x) return x.booleanValue;
    if ('nullValue' in x) return null;
    if ('timestampValue' in x) {
      var d = new Date(x.timestampValue);
      return { toDate: function () { return d; }, toMillis: function () { return d.getTime(); } };
    }
    if ('arrayValue' in x) return (x.arrayValue.values || []).map(decodeValue);
    if ('mapValue' in x) return decodeFields(x.mapValue.fields || {});
    return undefined;
  }
  function decodeFields(f) {
    var out = {};
    for (var k in f) out[k] = decodeValue(f[k]);
    return out;
  }
  /* 로그인 표 (보안 규칙의 request.auth). 로그인 안 했으면 빈 글자 */
  function idToken() {
    var u = fb && fb.auth.currentUser;
    return u ? u.getIdToken() : Promise.resolve('');
  }
  function restFetch(url, opts) {
    return idToken().then(function (token) {
      opts = opts || {};
      opts.headers = { 'Content-Type': 'application/json' };
      if (token) opts.headers.Authorization = 'Bearer ' + token;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (ctrl) opts.signal = ctrl.signal;
      var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, REST_WAIT_MS);
      return fetch(url, opts).then(function (res) {
        window.clearTimeout(timer);
        return res;
      }, function (e) {
        window.clearTimeout(timer);
        var err = new Error('인터넷 연결을 확인해 주세요');
        err.code = 'unavailable';
        throw err;
      });
    }).then(function (res) {
      if (res.ok || res.status === 404) return res;
      return res.json().catch(function () { return {}; }).then(function (body) {
        var e = new Error((body.error && body.error.message) || 'firestore ' + res.status);
        e.code = res.status === 403 ? 'permission-denied' : res.status === 401 ? 'unauthenticated' : 'firestore-' + res.status;
        throw e;
      });
    });
  }
  function restCommit(write) {
    return restFetch(restUrl(restRoot()).replace('?key=', ':commit?key='), {
      method: 'POST', body: JSON.stringify({ writes: [write] })
    });
  }
  function restDocRef(path) {
    return {
      path: path,
      collection: function (name) { return restCollection(path + '/' + name); },
      get: function () {
        return restFetch(restUrl(restRoot() + '/' + path)).then(function (res) {
          if (res.status === 404) return { exists: false, data: function () { return null; }, get: function () { return undefined; } };
          return res.json().then(function (doc) {
            var data = decodeFields(doc.fields || {});
            return { exists: true, data: function () { return data; }, get: function (k) { return data[k]; } };
          });
        });
      },
      /* 문서를 통째로 바꿉니다 (SDK 의 set 과 같음) */
      set: function (data) {
        var fields = {}, transforms = [];
        for (var k in data) {
          if (data[k] === STAMP) transforms.push({ fieldPath: k, setToServerValue: 'REQUEST_TIME' });
          else fields[k] = encodeValue(data[k]);
        }
        var write = { update: { name: restRoot() + '/' + path, fields: fields } };
        if (transforms.length) write.updateTransforms = transforms;
        return restCommit(write).then(function () {});
      },
      delete: function () {
        return restCommit({ delete: restRoot() + '/' + path }).then(function () {});
      }
    };
  }
  function restCollection(path) {
    return { doc: function (id) { return restDocRef(path + '/' + id); } };
  }
  var restDb = { collection: function (name) { return restCollection(name); } };

  /* Firebase 를 필요할 때만 불러옵니다 (로그인을 안 쓰는 사람은 받지 않음) */
  function ready() {
    if (fb) return Promise.resolve(fb);
    if (!configured()) return Promise.reject(new Error('not-configured'));
    if (loading) return loading;
    loading = loadScript(SDK + 'firebase-app-compat.js')
      .then(function () {
        return loadScript(SDK + 'firebase-auth-compat.js'); // 저장소는 웹 주소로 쓰니 Firestore 묶음은 받지 않음
      })
      .then(function () {
        var firebase = root.firebase;
        var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(C.FIREBASE);
        fb = { auth: app.auth(), db: restDb, firebase: firebase, stamp: function () { return STAMP; } };
        fb.auth.languageCode = 'ko';
        fb.auth.onAuthStateChanged(handleUser);
        // 다른 창으로 로그인했다가 돌아온 경우 (redirect 방식)
        fb.auth.getRedirectResult().then(fillProfile).catch(function (e) {
          emit('error', message(e));
        });
        return fb;
      })
      .catch(function (e) {
        loading = null;
        throw e;
      });
    return loading;
  }

  function providerName(id) {
    if (id === 'google.com') return 'google';
    if (id === 'facebook.com') return 'facebook';
    if (id === KAKAO) return 'kakao';
    return id || '';
  }
  var KAKAO = 'oidc.kakao';

  /*
   * 카카오는 이름을 'nickname' 으로 보내 줘서 Firebase 가 이름을 못 채울 때가 있습니다.
   * 로그인 결과에 들어 있는 카카오 이름 · 사진으로 계정 이름을 채웁니다.
   */
  function fillProfile(result) {
    var u = result && result.user;
    var info = result && result.additionalUserInfo;
    var p = (info && info.profile) || {};
    if (!u || u.displayName) return;
    var nick = p.nickname || p.name || '';
    if (!nick) return;
    return u.updateProfile({ displayName: nick, photoURL: u.photoURL || p.picture || null }).then(function () {
      if (user && user.uid === u.uid) {
        user.name = nick;
        if (!user.photo && p.picture) user.photo = p.picture;
        S.Storage.set(HINT_KEY, JSON.stringify({ name: user.name, provider: user.provider }));
        emit('in');
      }
    });
  }

  function markKnown() {
    known = true;
    while (knownWait.length) knownWait.shift()();
  }
  function handleUser(u) {
    if (!u) {
      user = null;
      try {
        S.Storage.remove(HINT_KEY);
      } catch (e) { /* 무시 */ }
      emit('out');
      markKnown();
      return;
    }
    var p = u.providerData && u.providerData[0];
    user = {
      uid: u.uid,
      name: u.displayName || (p && p.displayName) || '이름 없음',
      photo: u.photoURL || (p && p.photoURL) || '',
      provider: providerName(p && p.providerId)
    };
    S.Storage.set(HINT_KEY, JSON.stringify({ name: user.name, provider: user.provider }));
    emit('in');
    markKnown();
    pull();
  }

  /* 계정의 기록을 받아 와서 이 기기 기록과 합칩니다 */
  function pull() {
    if (!fb || !user || !getData) return;
    syncing = true;
    emit('syncing');
    var ref = fb.db.collection('users').doc(user.uid);
    ref.get()
      .then(function (snap) {
        var local = getData();
        var merged = local;
        var saved = snap.exists ? snap.data() : null;
        if (saved && typeof saved.save === 'string') {
          merged = S.Progress.merge(local, S.Progress.parse(saved.save));
          if (setData) setData(merged);
        }
        syncing = false;
        return push(merged);
      })
      .then(function () {
        emit('synced');
      })
      .catch(function (e) {
        syncing = false;
        saveError(e);
      });
  }

  /*
   * 계정에 기록을 올리거나 받아 오지 못했을 때 : 로그인 실패가 아니니 그렇게 말하고,
   * 원인을 알 수 있게 오류 이름을 괄호에 붙입니다. 같은 오류는 켤 때마다 한 번만 알려 줍니다.
   */
  var saidErrors = {};
  function saveError(e) {
    var code = (e && e.code) || (e && e.message) || 'unknown';
    if (saidErrors[code]) return;
    saidErrors[code] = 1;
    var detail = e && e.message && e.message !== code ? ' ' + String(e.message).slice(0, 80) : '';
    emit('error', code === 'unavailable' ? '인터넷이 불안정해서 기록을 계정에 저장하지 못했어요' : '기록을 계정에 저장하지 못했어요 (' + code + detail + ')');
  }

  /* 계정에 올리기 (하다가 멈춘 판은 빼고) */
  function push(d) {
    if (!fb || !user) return Promise.resolve();
    var copy = JSON.parse(JSON.stringify(d));
    copy.game = null;
    copy.dailyGame = null;
    return fb.db.collection('users').doc(user.uid).set({
      save: JSON.stringify(copy),
      name: user.name,
      updatedAt: STAMP
    });
  }

  /* 기록이 저장될 때마다 불림 : 잠깐 모았다가 한 번에 올립니다 */
  function schedule(d) {
    if (!user || syncing) return;
    window.clearTimeout(uploadTimer);
    uploadTimer = window.setTimeout(function () {
      push(d).then(function () {
        emit('synced');
      }).catch(saveError);
    }, UPLOAD_DELAY);
  }

  function makeProvider(id) {
    var auth = fb.firebase.auth;
    if (id === 'facebook') return new auth.FacebookAuthProvider();
    if (id === 'kakao') {
      var k = new auth.OAuthProvider(KAKAO);
      k.addScope('openid');
      return k;
    }
    var g = new auth.GoogleAuthProvider();
    g.setCustomParameters({ prompt: 'select_account' });
    return g;
  }

  /*
   * 로그인. 새 창(popup) 방식을 먼저 쓰고, 창이 막히면 페이지를 옮겨 가는(redirect) 방식으로 다시 합니다.
   */
  function signIn(id) {
    if (!configured()) {
      emit('error', '로그인은 아직 준비 중이에요');
      return;
    }
    emit('busy');
    ready()
      .then(function () {
        var provider = makeProvider(id);
        return fb.auth.signInWithPopup(provider).then(fillProfile).catch(function (e) {
          var code = e && e.code;
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            return fb.auth.signInWithRedirect(provider);
          }
          throw e;
        });
      })
      .catch(function (e) {
        emit('error', message(e));
      });
  }

  /*
   * 로그아웃 : 나가기 전에 기록을 한 번 올리되, 2초만 기다립니다.
   * (Firestore 저장은 서버 답이 올 때까지 끝나지 않아서, 인터넷이 불안정하면 로그아웃이 영영 안 되던 문제)
   */
  function signOut() {
    window.clearTimeout(uploadTimer);
    return ready().then(function () {
      var d = getData ? getData() : null;
      var up = d && user ? push(d).catch(function () {}) : Promise.resolve();
      var wait = new Promise(function (resolve) { window.setTimeout(resolve, 2000); });
      return Promise.race([up, wait]);
    }).then(function () {
      return fb.auth.signOut();
    }).catch(function () {
      // Firebase 를 못 불러와도 이 기기에서는 로그아웃한 것으로
      handleUser(null);
    });
  }

  /*
   * 계정 지우기 : 계정에 저장된 기록과 로그인 정보를 지웁니다. (이 기기의 기록은 남음)
   * 구글 플레이 정책상 로그인이 있는 앱은 앱 안에서 계정을 지울 수 있어야 합니다.
   * 로그인한 지 오래되면 구글이 다시 로그인을 요구하므로, 그때는 한 번 더 로그인 창을 띄웁니다.
   */
  function deleteAccount() {
    if (!fb || !fb.auth.currentUser) return Promise.resolve();
    window.clearTimeout(uploadTimer);
    var u = fb.auth.currentUser;
    var provider = makeProvider(user && (user.provider === 'facebook' || user.provider === 'kakao') ? user.provider : 'google');
    emit('busy');
    // 랭킹에 올린 닉네임과 기록도 함께 지웁니다 (js/ranking.js)
    var forget = S.Ranking && S.Ranking.forget ? S.Ranking.forget(u.uid).catch(function () {}) : Promise.resolve();
    return forget
      .then(function () {
        return fb.db.collection('users').doc(u.uid).delete();
      })
      .then(function () {
        return u.delete().catch(function (e) {
          if (e && e.code === 'auth/requires-recent-login') {
            return u.reauthenticateWithPopup(provider).then(function () {
              return u.delete();
            });
          }
          throw e;
        });
      })
      .then(function () {
        emit('deleted');
      })
      .catch(function (e) {
        emit('error', '계정을 지우지 못했어요. ' + message(e));
      });
  }

  function message(e) {
    var code = (e && e.code) || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '로그인을 그만뒀어요';
    if (code === 'auth/network-request-failed' || /load /.test(e && e.message)) return '인터넷 연결을 확인해 주세요';
    if (code === 'auth/account-exists-with-different-credential') return '같은 이메일로 다른 방법(구글/카카오)으로 가입되어 있어요. 그 방법으로 로그인해 주세요';
    if (code === 'auth/operation-not-allowed' || code === 'auth/invalid-oauth-provider' || code === 'auth/configuration-not-found') return '이 로그인 방법은 아직 준비 중이에요';
    if (code === 'auth/unauthorized-domain') return '이 주소는 로그인이 허락되지 않았어요 (Firebase 설정 확인)';
    if (e && e.message === 'not-configured') return '로그인은 아직 준비 중이에요';
    return '로그인하지 못했어요. 잠시 뒤에 다시 해 보세요';
  }

  /*
   * 시작 : ui.js 가 부릅니다.
   *   get : 지금 기록을 돌려주는 함수, set : 합친 기록을 받는 함수
   */
  function start(get, set) {
    getData = get;
    setData = set;
    S.Progress.onSave = schedule;
    // 전에 로그인했던 기기면 Firebase 를 미리 불러와 로그인 상태를 되살립니다
    var hint = null;
    try {
      hint = JSON.parse(S.Storage.get(HINT_KEY) || 'null');
    } catch (e) {
      hint = null;
    }
    if (hint && configured()) {
      emit('restoring', null);
      ready().catch(function () {
        emit('out');
      });
    }
  }

  /* 전에 로그인했던 이름 (Firebase 를 불러오기 전에 화면에 먼저 보여 줄 때) */
  function lastName() {
    try {
      var h = JSON.parse(S.Storage.get(HINT_KEY) || 'null');
      return h && h.name;
    } catch (e) {
      return '';
    }
  }

  S.Account = {
    configured: configured,
    providers: providers,
    start: start,
    signIn: signIn,
    signOut: signOut,
    deleteAccount: deleteAccount,
    onChange: onChange,
    user: function () {
      return user;
    },
    /* 로그인해 있으면 Firebase 를 돌려줍니다 (랭킹에 씀) → Promise<{ auth, db, firebase }> */
    firebase: function () {
      if (!user) return Promise.reject(new Error('not-signed-in'));
      return ready();
    },
    /* 로그인하지 않아도 랭킹은 볼 수 있게 Firebase 를 불러옵니다 */
    open: ready,
    /* Firebase 를 불러오고 로그인 상태(되살린 로그인 포함)를 알게 될 때까지 기다립니다 */
    settled: function () {
      return ready().then(function () {
        if (known) return user;
        return new Promise(function (ok) { knownWait.push(function () { ok(user); }); });
      });
    },
    lastName: lastName
  };
})(typeof window !== 'undefined' ? window : globalThis);
