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
     confirm(p, {pick})       2026-11-27: "Is this you?" for the picked profile p {slug, name}:
                              Google (claims exactly p) or a 6-digit code mailed to the school
                              address a mentor put on p; "Not now" in optional mode. Shown only
                              when login is on, this device has no token for p, no other dialog
                              is open, and (unless pick) p was not dismissed this session.
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
    net: "Couldn't reach the club server. Try again in a minute.",
    'no-email': 'No school email on file for this profile. Sign in with Google or ask a mentor.',
    claimed: 'This profile is already confirmed by another account. Ask a mentor.',
    'bad-code': 'That code does not work. Check it, or send a new one.',
    locked: 'Too many tries. Send a new code.',
    'too-many': 'Too many codes for this profile today. Sign in with Google or ask a mentor.',
    'mail-failed': "The email didn't go out. Try again in a minute.",
    'email-off': 'Email codes are off right now. Sign in with Google.',
    wait: 'Wait a minute before asking for another code.'
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

  /* 2026-11-27: a 6-digit code mailed to the profile's school address (the API
     never says the address). "Send again" waits out the minute the API asks for. */
  function emailCode(box, slug, shared, onDone) {
    box.innerHTML = '';
    var f = el('form', 'fa-pin'); f.noValidate = true; f.autocomplete = 'off';
    var send = el('button', 'fa-go', 'Email me a code'); send.type = 'button';
    var w = el('label', 'fa-f'), i = document.createElement('input');
    w.appendChild(el('span', null, 'Code from your school email'));
    i.id = 'faEcode'; i.type = 'text'; i.maxLength = 6; i.placeholder = '6 digits';
    i.setAttribute('inputmode', 'numeric'); i.setAttribute('pattern', '[0-9]*'); i.setAttribute('autocomplete', 'one-time-code');
    w.appendChild(i); w.hidden = true;
    var go = el('button', 'fa-go', 'Confirm'); go.type = 'submit'; go.hidden = true;
    var again = el('button', 'fa-link', 'Send again'); again.type = 'button'; again.hidden = true;
    var msg = el('p', 'fa-msg'); msg.setAttribute('role', 'alert');
    [send, w, go, again, msg].forEach(function (n) { f.appendChild(n); });
    var tick = 0, lastOk = false;
    function cool(sec) {
      clearInterval(tick);
      var left = Math.max(1, Math.min(120, Math.round(sec) || 60));
      function show() { again.textContent = 'Send again in ' + left + ' s'; }
      again.disabled = true; show();
      tick = setInterval(function () {
        left--;
        if (left > 0 && f.isConnected) return show();
        clearInterval(tick); again.disabled = false; again.textContent = 'Send again';
      }, 1000);
    }
    function asking() { send.hidden = true; w.hidden = false; go.hidden = false; again.hidden = false; setTimeout(function () { i.focus(); }, 0); }
    function doSend() {
      send.disabled = true; again.disabled = true;
      msg.className = 'fa-msg fa-busy'; msg.textContent = 'Sending…';
      call('email', { action: 'send', slug: slug }).then(function (res) {
        var j = res.j; send.disabled = false; msg.className = 'fa-msg';
        if (j.ok && j.sent) { lastOk = true; asking(); cool(60); msg.className = 'fa-msg fa-note'; msg.textContent = 'Check your school email for a 6-digit code. It works for 10 minutes.'; return; }
        if (j.code === 'wait') { asking(); cool(j.retryAfter || 60); msg.textContent = WORDS.wait + (lastOk ? ' The last code still works.' : ''); return; }
        lastOk = false; again.disabled = false;
        msg.textContent = res.status === 429 && !j.code ? 'Too many tries. Wait a few minutes.' : say(j.code, j);
      }, function () { send.disabled = false; again.disabled = false; msg.className = 'fa-msg'; msg.textContent = WORDS.net; });
    }
    send.onclick = doSend; again.onclick = doSend;
    i.addEventListener('input', function () { i.value = i.value.replace(/\D/g, '').slice(0, 6); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!/^\d{6}$/.test(i.value)) { msg.className = 'fa-msg'; msg.textContent = 'Type the 6-digit code.'; i.focus(); return; }
      go.disabled = true; msg.className = 'fa-msg fa-busy'; msg.textContent = 'Checking…';
      call('email', { action: 'verify', slug: slug, code: i.value }).then(function (res) {
        var j = res.j; go.disabled = false; msg.className = 'fa-msg';
        if (j.ok && j.token) { i.value = ''; clearInterval(tick); return signedIn(j, typeof shared === 'function' ? shared() : shared).then(function () { onDone(j); }); }
        if (j.code === 'locked') i.value = '';
        msg.textContent = res.status === 429 && !j.code ? 'Too many tries. Wait a few minutes.' : say(j.code, j);
      }, function () { go.disabled = false; msg.className = 'fa-msg'; msg.textContent = WORDS.net; });
    });
    box.appendChild(f);
    return f;
  }

  /* the sheet: Google first, PIN on the side. needPilot (a Google account
     with no pilot yet) goes on to Join, which knows the roster checks.
     opt.slug (2026-11-27, confirm()): "Is this you?" for that profile - Google
     claims exactly it, the email code is offered when the API can send, and
     closing it never settles writes waiting on a sign-in (that is not why it opened). */
  var cur = null;
  function sheet(opt) {
    opt = opt || {};
    if (cur) cur.close(true);
    /* a <dialog> opened with showModal(), so it sits in the top layer above a
       page sheet that is itself a modal <dialog> (Pilot Path / Clearance #dlg:
       a write from inside it can be the one that asks for sign-in) */
    var wrap = el('dialog', 'fa-sheet'); wrap.setAttribute('aria-labelledby', 'faH');
    var card = el('div', 'fa-card');
    var x = el('button', 'fa-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    var who = opt.slug ? { slug: String(opt.slug), name: String(opt.name || '') } : null;
    var h = el('h2', null, who ? 'Is this you?' : 'Sign in'); h.id = 'faH';
    var lede = el('p', 'fa-lede', opt.why === 'not-you' ? "That's another pilot's profile. Sign in as you." : opt.why ? "Sign in to send it. It's saved." : 'Use your Brophy account.');
    if (who) { lede.textContent = 'Confirm you are '; lede.appendChild(el('b', null, who.name || 'this pilot')); lede.appendChild(document.createTextNode((/\.$/.test(who.name) ? '' : '.') + ' Sign in with your school Google account, or get a code at your school email.')); }
    var g = el('div', 'fa-g'), pinBox = el('div', 'fa-pinbox'), msg = el('p', 'fa-msg'); msg.setAttribute('role', 'alert');
    var mailBox = el('div', 'fa-mailbox'); mailBox.hidden = true;
    var notNow = el('button', 'fa-link', 'Not now'); notNow.type = 'button'; notNow.hidden = true;
    var shared = el('label', 'fa-shared'), cb = document.createElement('input'); cb.type = 'checkbox';
    shared.appendChild(cb); shared.appendChild(document.createTextNode(' Shared computer'));
    shared.hidden = !(window.matchMedia && matchMedia('(pointer:fine)').matches);
    var usePin = el('button', 'fa-link', 'Use a PIN instead'); usePin.type = 'button';
    [x, h, lede, g, mailBox, msg, pinBox, usePin, notNow, shared].forEach(function (n) { card.appendChild(n); });
    wrap.appendChild(card); document.body.appendChild(wrap);
    /* Escape: a modal <dialog> gets it as 'cancel' (only the top one does, so a
       card sheet under this one stays open); esc() covers the no-dialog fallback */
    wrap.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    wrap.addEventListener('close', function () { close(); });   /* closed by the browser itself (no cancel without a user gesture) */
    try { wrap.showModal(); } catch (e) { wrap.setAttribute('open', ''); }
    var done = false;
    function close(quiet) {
      if (!wrap.isConnected) return;
      wrap.remove(); cur = null; document.removeEventListener('keydown', esc);
      if (who) { if (!done) skip(who.slug); return; }      /* a confirm: remember the "not now" for this session */
      if (!done && !quiet) F.cancelled();
    }
    function modal() { try { return wrap.matches(':modal'); } catch (e) { return false; } }
    function esc(e) { if (e.key === 'Escape' && !modal()) close(); }
    document.addEventListener('keydown', esc);
    x.onclick = function () { close(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    cur = { close: close };
    function finish() { done = true; close(true); }
    function showPin() { usePin.hidden = true; g.hidden = true; mailBox.hidden = true; lede.textContent = 'Sign in with your PIN.'; pin(pinBox, finish, function () { return cb.checked; }); }
    usePin.onclick = function () { msg.textContent = ''; showPin(); };
    notNow.onclick = function () { close(); };
    F.authCfg().then(function (cfg) {
      if (who) {
        notNow.hidden = cfg.mode === 'required';
        if (cfg.email) { mailBox.hidden = false; emailCode(mailBox, who.slug, function () { return cb.checked; }, finish); }
        if (!cfg.google && !cfg.email) { showPin(); return; }
        if (!cfg.google) return;
      }
      if (!cfg.google) { showPin(); return; }
      g.appendChild(el('div', 'fa-wait'));
      var busy = false;
      function back(text) { busy = false; g.hidden = false; usePin.hidden = false; msg.className = 'fa-msg'; msg.textContent = text; }
      googleBtn(g, cfg, function (cred) {
        if (busy) return;   /* one credential at a time */
        busy = true; g.hidden = true; usePin.hidden = true;
        msg.className = 'fa-msg fa-busy'; msg.textContent = 'Checking…';
        call('google', who ? { credential: cred, slug: who.slug } : { credential: cred }).then(function (res) {
          var j = res.j;
          if (j.ok && j.token) return signedIn(j, cb.checked).then(finish, finish);
          if (j.ok && j.needPilot) {
            try { sessionStorage.setItem('fpv.auth.pending', JSON.stringify({ credential: cred, suggest: j.suggest || {}, shared: cb.checked })); } catch (e) {}
            done = true; location.href = F.BASE + 'join/?g=1'; return;
          }
          back(say(j.code, j));
        }, function () { back(WORDS.net); });
      }).catch(function () {
        g.innerHTML = '';
        if (who && cfg.email) { g.hidden = true; msg.textContent = 'Google sign-in is blocked here. Use the email code.'; return; }
        msg.textContent = WORDS.blocked; showPin();
      });
    });
    return cur;
  }

  /* ---- confirm-on-pick (2026-11-27) ---- */
  /* "Not now" holds for 12 hours on this device (localStorage, so every tab agrees) */
  var SKIP = 'fpv.confirm.skip.v2', HOLD = 12 * 3600000;
  function skips() { try { var v = JSON.parse(localStorage.getItem(SKIP) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function skipped() { var v = skips(), out = []; for (var k in v) if (Date.now() - (+v[k] || 0) < HOLD) out.push(k); return out; }
  function skip(slug) {
    try { var v = skips(), keep = {}; skipped().forEach(function (k) { keep[k] = v[k]; }); keep[slug] = Date.now(); localStorage.setItem(SKIP, JSON.stringify(keep)); } catch (e) {}
  }
  /* this device holds a token for p (its slug or one of its aliases) */
  function mine(p) {
    var a = F.auth(); if (!a || !a.pilot || !a.pilot.slug) return false;
    var ks = window.Roster && Roster.keys ? Roster.keys(p) : [p.slug];
    return ks.indexOf(a.pilot.slug) >= 0 || (window.Roster && Roster.keys ? Roster.keys(a.pilot).indexOf(p.slug) >= 0 : false);
  }
  function confirm(p, o) {
    o = o || {};
    if (!p || !p.slug || /\/admin\//.test(location.pathname)) return Promise.resolve(null);
    return F.authCfg().then(function (cfg) {
      if (!cfg || cfg.mode === 'off' || !(cfg.google || cfg.email)) return null;
      if (mine(p) || cur || document.querySelector('dialog[open]')) return null;
      if (!o.pick && skipped().indexOf(p.slug) >= 0) return null;
      return sheet({ slug: p.slug, name: p.name });
    }, function () { return null; });
  }

  window.FPVAuth = { google: googleBtn, call: call, signedIn: signedIn, signOut: signOut, pin: pin, sheet: sheet, confirm: confirm, say: say, words: WORDS };
})();
