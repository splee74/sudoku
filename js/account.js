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

  /* Firebase 를 필요할 때만 불러옵니다 (로그인을 안 쓰는 사람은 받지 않음) */
  function ready() {
    if (fb) return Promise.resolve(fb);
    if (!configured()) return Promise.reject(new Error('not-configured'));
    if (loading) return loading;
    loading = loadScript(SDK + 'firebase-app-compat.js')
      .then(function () {
        return Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
      })
      .then(function () {
        var firebase = root.firebase;
        var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(C.FIREBASE);
        fb = { auth: app.auth(), db: app.firestore(), firebase: firebase };
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
        emit('error', message(e));
      });
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
      updatedAt: fb.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /* 기록이 저장될 때마다 불림 : 잠깐 모았다가 한 번에 올립니다 */
  function schedule(d) {
    if (!user || syncing) return;
    window.clearTimeout(uploadTimer);
    uploadTimer = window.setTimeout(function () {
      push(d).then(function () {
        emit('synced');
      }).catch(function (e) {
        emit('error', message(e));
      });
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
