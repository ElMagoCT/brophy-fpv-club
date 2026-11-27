/* config.js - the one place the site's fixed addresses live (2026-11-26).
   Load it before roster.js, auth.js and site.js. site.js adds it by itself on
   a page that forgot, and groundschool/gs-web.js does the same in the course
   frame, so no page has to repeat the API address.

   Local testing only: on localhost / 127.0.0.1, localStorage['fpv.dev.api']
   points the site at another API (a mock, or `netlify dev`). It is ignored on
   the published site.

   Login (2026-11-26, follows GET /api/auth/config at run time):
   - FPV.authCfg() reads the config once per page, only when something asks
     (Join, the profile panel, or a POST from a signed-in device). With mode
     off nothing else happens: no script, no header, no UI.
   - The token is in localStorage fpv.auth.v1 (sessionStorage on a shared
     computer): {token, exp, pilot:{slug,name}}. FPV.post adds X-Pilot-Token
     only when there is a token AND the mode is on.
   - A 401 login / 403 not-you on a pilot write keeps the write in the outbox
     (localStorage fpv.outbox.v1), opens the sign-in sheet (auth.js, injected
     then), and the caller's promise waits: after sign-in the write is sent
     again and the caller gets that answer. Closing the sheet hands the caller
     the refusal; the write stays in the outbox for the next sign-in. */
(function () {
  var API = 'https://brophy-fpv-club-api.netlify.app';
  var BASE = ((document.currentScript && document.currentScript.src) || '').replace(/config\.js(\?.*)?$/, '');
  try {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      var dev = localStorage.getItem('fpv.dev.api');
      if (dev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(dev)) API = dev;
    }
  } catch (e) {}
  var AKEY = 'fpv.auth.v1', OKEY = 'fpv.outbox.v1';
  var cfgP = null, cfgNow = null, waiting = {};

  window.FPV = {
    API: API,
    BASE: BASE,
    SITE: 'https://elmagoct.github.io/brophy-fpv-club/',
    /* this exact address is in the QR on the sims */
    JOIN_URL: 'https://elmagoct.github.io/brophy-fpv-club/join/',
    post: post,
    authCfg: authCfg,
    auth: auth, setAuth: setAuth, signedOut: signedOut,
    ui: ui, flush: flush, cancelled: cancelled,
    outbox: function () { return box(); }
  };

  /* GET /api/auth/config, once. Any failure counts as mode off. */
  function authCfg() {
    if (!cfgP) cfgP = fetch(API + '/api/auth/config', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return j && (j.mode === 'optional' || j.mode === 'required') ? j : { mode: 'off', google: null, pin: false }; })
      .catch(function () { return { mode: 'off', google: null, pin: false }; })
      .then(function (c) { cfgNow = c; return c; });
    return cfgP;
  }

  function read(st) { try { var v = JSON.parse(st.getItem(AKEY) || 'null'); return v && v.token && (!v.exp || v.exp > Date.now()) ? v : null; } catch (e) { return null; } }
  /* the saved sign-in, or null */
  function auth() { var s = null, l = null; try { s = read(sessionStorage); } catch (e) {} try { l = read(localStorage); } catch (e) {} return s || l; }
  function setAuth(res, shared) {
    try { sessionStorage.removeItem(AKEY); } catch (e) {}
    try { localStorage.removeItem(AKEY); } catch (e) {}
    if (!res || !res.token) return;
    var v = JSON.stringify({ token: res.token, exp: res.exp || 0, pilot: res.pilot || null });
    try { (shared ? sessionStorage : localStorage).setItem(AKEY, v); } catch (e) {}
  }
  function signedOut() { setAuth(null); }

  /* auth.js (the sign-in UI) is loaded only when it is needed */
  var uiP = null;
  function ui() {
    if (window.FPVAuth) return Promise.resolve(window.FPVAuth);
    if (!uiP) uiP = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = BASE + 'auth.js';
      s.onload = function () { window.FPVAuth ? ok(window.FPVAuth) : no(new Error('auth.js')); };
      s.onerror = function () { uiP = null; no(new Error('auth.js')); };
      document.head.appendChild(s);
    });
    return uiP;
  }

  /* a kept write waits at most a week */
  function box() {
    try { return (JSON.parse(localStorage.getItem(OKEY) || '[]') || []).filter(function (x) { return x && x.at > Date.now() - 7 * 864e5; }); } catch (e) { return []; }
  }
  function saveBox(b) { try { if (b.length) localStorage.setItem(OKEY, JSON.stringify(b)); else localStorage.removeItem(OKEY); } catch (e) {} }
  function keep(path, body) {
    var b = box(), s = JSON.stringify(body);
    for (var i = 0; i < b.length; i++) if (b[i].path === path && JSON.stringify(b[i].body) === s) return b[i].id;
    var id = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    b.push({ id: id, path: path, body: body, at: Date.now() });
    /* a photo can be big; if it does not fit, the caller's promise still waits */
    saveBox(b); if (!box().some(function (x) { return x.id === id; })) mem[id] = { id: id, path: path, body: body };
    return id;
  }
  var mem = {};

  function send(path, body, keepalive, withToken) {
    var headers = { 'Content-Type': 'application/json' };
    var a = withToken ? auth() : null;
    if (a) headers['X-Pilot-Token'] = a.token;
    var o = { method: 'POST', headers: headers, body: JSON.stringify(body) };
    if (keepalive) o.keepalive = true;
    return fetch(API + path, o);
  }
  /* the gate said no: 401 login or 403 not-you (never anything else) */
  function refused(r) {
    if (r.status !== 401 && r.status !== 403) return Promise.resolve(false);
    return r.clone().json().then(function (j) { return !!j && (j.code === 'login' || j.code === 'not-you') ? j.code : false; }, function () { return false; });
  }

  /* Every pilot-side POST goes through here (progress, submissions, join).
     `path` is an API path such as '/api/progress'. Returns the fetch promise;
     callers keep their own error handling. */
  function post(path, body, opts) {
    var ka = !!(opts && opts.keepalive);
    var a = auth();
    /* no token: exactly the old request; with one, the header only when the mode is on */
    var go = !a ? send(path, body, ka, false)
      : cfgNow ? send(path, body, ka, cfgNow.mode !== 'off')
      : authCfg().then(function (c) { return send(path, body, ka, c.mode !== 'off'); });
    return go.then(function (r) {
      return refused(r).then(function (code) {
        if (!code) return r;
        var id = keep(path, body);
        return new Promise(function (ok) {
          (waiting[id] = waiting[id] || []).push({ ok: ok, r: r });
          ui().then(function (A) { A.sheet({ why: code }); }, function () { cancelled(); });
        });
      });
    });
  }
  /* after a sign-in: send what was kept; callers that are still waiting get the new answer */
  function flush() {
    var items = box(); for (var k in mem) items.push(mem[k]);
    return items.reduce(function (p, it) {
      return p.then(function () {
        return send(it.path, it.body, false, true).then(function (r) {
          return refused(r).then(function (code) {
            if (code) return;
            saveBox(box().filter(function (x) { return x.id !== it.id; })); delete mem[it.id];
            (waiting[it.id] || []).forEach(function (w) { w.ok(r.clone()); }); delete waiting[it.id];
          });
        }, function () {});
      });
    }, Promise.resolve());
  }
  /* the sheet was closed without signing in: callers get the refusal, the outbox keeps the writes */
  function cancelled() {
    for (var id in waiting) waiting[id].forEach(function (w) { w.ok(w.r); });
    waiting = {};
  }

  /* a signed-in device reads the config early, so a write sends the header right away */
  if (auth()) authCfg();
})();
