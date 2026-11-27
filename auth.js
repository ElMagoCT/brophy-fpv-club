/* auth.js - pilot sign-in UI (2026-11-26). Injected by config.js (FPV.ui())
   only when GET /api/auth/config says the mode is optional or required, so a
   page with login off never loads it. Request/response shapes: the API's
   netlify/functions/auth.mjs.

   window.FPVAuth:
     google(el, cfg, onCred)  Google Identity Services button in `el` (script
                              injected here, hd from the config, no One Tap).
                              Rejects when the script cannot load (school filter).
     call(route, body)        POST /api/auth/<route> -> {status, j}
     signedIn(res, shared)    keep the token, pick that pilot, send the outbox
     signOut()                forget the token (and tell the API)
     pin(el, onDone)          username + PIN form, "First time? I have a code"
     sheet({why})             the sign-in sheet any page can open
     say(code, j)             an answer code in plain words */
(function () {
  var F = window.FPV;
  if (!F || window.FPVAuth) return;
  var GSI = 'https://accounts.google.com/gsi/client';
  var gP = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function loadGoogle() {
    var G = window.google;
    if (G && G.accounts && G.accounts.id) return Promise.resolve(G.accounts.id);
    if (!gP) gP = new Promise(function (ok, no) {
      var s = document.createElement('script'), t;
      s.src = GSI; s.async = true;
      s.onload = function () { clearTimeout(t); var G = window.google; G && G.accounts && G.accounts.id ? ok(G.accounts.id) : no(new Error('blocked')); };
      s.onerror = function () { clearTimeout(t); no(new Error('blocked')); };
      t = setTimeout(function () { no(new Error('blocked')); }, 9000);
      document.head.appendChild(s);
    }).catch(function (e) { gP = null; throw e; });
    return gP;
  }
  function googleBtn(box, cfg, onCred) {
    return loadGoogle().then(function (id) {
      id.initialize({
        client_id: cfg.google.clientId, hd: cfg.google.hd,
        callback: function (r) { if (r && r.credential) onCred(r.credential); },
        auto_select: false, cancel_on_tap_outside: true, itp_support: true
      });
      box.innerHTML = '';
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      id.renderButton(box, { type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill',
        text: 'signin_with', logo_alignment: 'center', width: Math.min(400, Math.max(220, box.clientWidth || 300)) });
    });
  }

  function call(route, body) {
    var headers = { 'Content-Type': 'application/json' }, a = F.auth();
    if (route === 'signout' && a) headers['X-Pilot-Token'] = a.token;
    return fetch(F.API + '/api/auth/' + route, { method: 'POST', headers: headers, body: JSON.stringify(body || {}), keepalive: route === 'signout' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; }); });
  }

  var WORDS = {
    google: 'Google sign-in did not work. Try again.',
    mentor: 'Ask a mentor to sign you in.',
    'name-mismatch': 'The name has to match your school account. Or ask a mentor.',
    'login-off': 'Sign-in is off right now.',
    'no-entry': 'That pilot is not on the roster. Ask a mentor.',
    'bad-pin': 'Use your school username and a 4 to 8 digit PIN.',
    blocked: 'Google sign-in is blocked here. Use a PIN instead.',
    net: "Couldn't reach the club server. Try again in a minute."
  };
  function say(code, j) {
    if (code === 'google' && j && /school/i.test(j.error || '')) return 'Use your school Google account.';
    if (WORDS[code]) return WORDS[code];
    if (j && j.error && j.error.length < 90 && /[a-z] /.test(j.error)) return j.error;
    return WORDS.net;
  }

  function signedIn(res, shared) {
    F.setAuth(res, shared);
    var p = res.pilot;
    if (p && window.Roster) Roster.add({ slug: p.slug, name: p.name, aliases: [], at: 0 });
    if (p && window.SiteNav) SiteNav.set({ name: p.name, slug: p.slug });
    else if (p) try { localStorage.setItem('fs.pilot.v1', JSON.stringify({ name: p.name, slug: p.slug })); } catch (e) {}
    document.dispatchEvent(new CustomEvent('auth:change', { detail: F.auth() }));
    return F.flush();
  }
  function signOut() {
    if (F.auth()) call('signout', {}).catch(function () {});
    F.signedOut();
    document.dispatchEvent(new CustomEvent('auth:change', { detail: null }));
  }

  /* username + PIN; "First time?" adds the mentor's code (action setup) */
  function pin(box, onDone, shared) {
    box.innerHTML = '';
    var f = el('form', 'fa-pin'); f.noValidate = true; f.autocomplete = 'off';
    function field(id, label, attrs) {
      var w = el('label', 'fa-f'), s = el('span', null, label), i = document.createElement('input');
      i.id = id; for (var k in attrs) i.setAttribute(k, attrs[k]);
      w.appendChild(s); w.appendChild(i); f.appendChild(w); return { w: w, i: i };
    }
    var code = field('faCode', "Mentor's code", { type: 'text', inputmode: 'text', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', autocomplete: 'one-time-code', maxlength: '24' });
    var user = field('faUser', 'School username', { type: 'text', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', autocomplete: 'username', maxlength: '64', placeholder: 'jsmith27' });
    var pw = field('faPin', 'PIN', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'current-password', maxlength: '8', placeholder: '4 to 8 digits' });
    code.w.hidden = true;
    var go = el('button', 'fa-go', 'Sign in'); go.type = 'submit'; f.appendChild(go);
    var first = el('button', 'fa-link', 'First time? I have a code'); first.type = 'button'; f.appendChild(first);
    var msg = el('p', 'fa-msg'); msg.setAttribute('role', 'alert'); f.appendChild(msg);
    var setup = false;
    first.onclick = function () {
      setup = !setup; code.w.hidden = !setup;
      first.textContent = setup ? 'I already have a PIN' : 'First time? I have a code';
      pw.i.setAttribute('autocomplete', setup ? 'new-password' : 'current-password');
      pw.w.firstChild.textContent = setup ? 'Pick a PIN' : 'PIN';
      go.textContent = setup ? 'Set PIN' : 'Sign in';
      msg.textContent = setup ? 'A mentor gives you the code.' : '';
      (setup ? code.i : user.i).focus();
    };
    pw.i.addEventListener('input', function () { pw.i.value = pw.i.value.replace(/\D/g, '').slice(0, 8); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = user.i.value.trim().toLowerCase().replace(/@.*$/, ''), p = pw.i.value;
      if (setup && !code.i.value.trim()) { msg.textContent = "Type the mentor's code."; code.i.focus(); return; }
      if (!u || !/^\d{4,8}$/.test(p)) { msg.textContent = WORDS['bad-pin']; return; }
      go.disabled = true; msg.textContent = '';
      var body = setup ? { action: 'setup', code: code.i.value.trim(), username: u, pin: p } : { action: 'signin', username: u, pin: p };
      call('pin', body).then(function (res) {
        go.disabled = false;
        if (res.j.ok && res.j.token) { pw.i.value = ''; return signedIn(res.j, typeof shared === 'function' ? shared() : shared).then(function () { onDone(res.j); }); }
        if (res.status === 429 && !res.j.code) { msg.textContent = 'Too many tries. Wait a few minutes.'; return; }
        msg.textContent = res.j.code === 'bad-login'
          ? (setup ? 'That code does not work. Ask a mentor for a new one.' : 'That username and PIN do not match.')
          : say(res.j.code, res.j);
      }, function () { go.disabled = false; msg.textContent = WORDS.net; });
    });
    box.appendChild(f);
    setTimeout(function () { user.i.focus(); }, 0);
    return f;
  }

  /* the sheet: Google first, PIN on the side. needPilot (a Google account
     with no pilot yet) goes on to Join, which knows the roster checks. */
  var cur = null;
  function sheet(opt) {
    opt = opt || {};
    if (cur) cur.close(true);
    var wrap = el('div', 'fa-sheet'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'faH');
    var card = el('div', 'fa-card');
    var x = el('button', 'fa-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    var h = el('h2', null, 'Sign in'); h.id = 'faH';
    var lede = el('p', 'fa-lede', opt.why === 'not-you' ? "That's another pilot's profile. Sign in as you." : opt.why ? "Sign in to send it. It's saved." : 'Use your Brophy account.');
    var g = el('div', 'fa-g'), pinBox = el('div', 'fa-pinbox'), msg = el('p', 'fa-msg'); msg.setAttribute('role', 'alert');
    var shared = el('label', 'fa-shared'), cb = document.createElement('input'); cb.type = 'checkbox';
    shared.appendChild(cb); shared.appendChild(document.createTextNode(' Shared computer'));
    shared.hidden = !(window.matchMedia && matchMedia('(pointer:fine)').matches);
    var usePin = el('button', 'fa-link', 'Use a PIN instead'); usePin.type = 'button';
    [x, h, lede, g, msg, pinBox, usePin, shared].forEach(function (n) { card.appendChild(n); });
    wrap.appendChild(card); document.body.appendChild(wrap);
    var done = false;
    function close(quiet) {
      if (!wrap.isConnected) return;
      wrap.remove(); cur = null; document.removeEventListener('keydown', esc);
      if (!done && !quiet) F.cancelled();
    }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    x.onclick = function () { close(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    cur = { close: close };
    function finish() { done = true; close(true); }
    function showPin() { usePin.hidden = true; g.hidden = true; lede.textContent = 'Sign in with your PIN.'; pin(pinBox, finish, function () { return cb.checked; }); }
    usePin.onclick = function () { msg.textContent = ''; showPin(); };
    F.authCfg().then(function (cfg) {
      if (!cfg.google) { showPin(); return; }
      g.appendChild(el('div', 'fa-wait'));
      var busy = false;
      function back(text) { busy = false; g.hidden = false; usePin.hidden = false; msg.className = 'fa-msg'; msg.textContent = text; }
      googleBtn(g, cfg, function (cred) {
        if (busy) return;   /* one credential at a time */
        busy = true; g.hidden = true; usePin.hidden = true;
        msg.className = 'fa-msg fa-busy'; msg.textContent = 'Checking…';
        call('google', { credential: cred }).then(function (res) {
          var j = res.j;
          if (j.ok && j.token) return signedIn(j, cb.checked).then(finish, finish);
          if (j.ok && j.needPilot) {
            try { sessionStorage.setItem('fpv.auth.pending', JSON.stringify({ credential: cred, suggest: j.suggest || {}, shared: cb.checked })); } catch (e) {}
            done = true; location.href = F.BASE + 'join/?g=1'; return;
          }
          back(say(j.code, j));
        }, function () { back(WORDS.net); });
      }).catch(function () { g.innerHTML = ''; msg.textContent = WORDS.blocked; showPin(); });
    });
    return cur;
  }

  window.FPVAuth = { google: googleBtn, call: call, signedIn: signedIn, signOut: signOut, pin: pin, sheet: sheet, say: say, words: WORDS };
})();
