/* Site bar (2026-10-10): the same top bar on every page - Home / Pilot Path /
   Flight Clearance (2026-10-20: the Brophy Drone Certification and Mr.
   Burr's permission form on one page at clearance/; fly/ redirects there) /
   Resources, and the profile button top right.

   The profile is the pilot NAME, saved in localStorage under fs.pilot.v1 -
   the key Flight School has always used, so picking a name on any page is
   picking it everywhere (same origin). No password: progress only goes
   forward (Micah's call, "club, not a bank").

   A page that cares listens for `site:pilot` (detail = {name, slug} or null)
   and can open the menu with SiteNav.open(). Load it with `defer` after the
   page's own <nav class="crumbs">, which it replaces.

   2026-11-26: the names come from the club roster (roster.js, GET
   /api/roster, falling back to data.json names). You tap your name; nobody
   types a new one here any more. New pilots add themselves on /join/, which
   puts them on the sims too. fs.pilot.v1 = {name, slug} with slug = the
   roster key. config.js and roster.js are added here when a page did not
   load them itself. */
(function () {
  var KEY = 'fs.pilot.v1';
  var src = (document.currentScript && document.currentScript.src) || '';
  var BASE = src.replace(/site\.js(\?.*)?$/, '');
  var DATA = null, RAW = null, panelOpen = false, picking = false;
  /* login (2026-11-26): the panel asks GET /api/auth/config the first time it
     opens; Sign in / Sign out show only when the mode is not off */
  var AUTH = null;
  function authOn() { return !!(AUTH && AUTH.mode !== 'off'); }
  function token() { return window.FPV && FPV.auth ? FPV.auth() : null; }

  /* config.js + roster.js, for pages that only load site.js */
  function need(file, ok) {
    if (ok()) return;
    var s = document.createElement('script'); s.src = BASE + file; s.async = false;
    s.onload = function () { if (file === 'roster.js') { remerge(); if (!follow()) draw(); Roster.load(); } };
    document.head.appendChild(s);
  }
  need('config.js', function () { return !!window.FPV; });
  need('roster.js', function () { return !!window.Roster; });

  function slug(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hm(ms) {
    var m = Math.round((ms || 0) / 60000), h = Math.floor(m / 60);
    return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  }
  function get() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); return v && v.name ? v : null; } catch (e) { return null; }
  }
  /* set('Name'), set({name, slug}) or set(null) */
  function set(who) {
    var p = null;
    if (who) {
      p = window.Roster ? Roster.canon(who) : (typeof who === 'string' ? { name: who.trim(), slug: slug(who) } : { name: who.name, slug: who.slug || slug(who.name) });
      if (p && window.Roster) try { Roster.adopt(p); } catch (e) {}
    }
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    picking = false;
    close();
    draw();
    document.dispatchEvent(new CustomEvent('site:pilot', { detail: p }));
  }
  /* the pilot's row in the kiosk snapshot, if the kiosk knows them */
  function row(p) {
    p = p || get();
    if (!p || !DATA || !DATA.pilots) return null;
    if (window.Roster) return Roster.row(DATA, p);
    for (var i = 0; i < DATA.pilots.length; i++) if (slug(DATA.pilots[i].name) === p.slug) return DATA.pilots[i];
    return null;
  }

  var page = /\/(pilot-path|progression|flightschool)\//.test(location.pathname) ? 'prog'
           : /\/(fly|clearance)\//.test(location.pathname) ? 'fly'
           : /\/posters\//.test(location.pathname) ? 'res'
           : /\/join\//.test(location.pathname) ? 'join' : 'home';

  var bar = document.createElement('header');
  bar.className = 'sitebar';
  bar.innerHTML =
    '<nav class="sitenav" aria-label="Site">' +
      '<a href="' + BASE + '"' + (page === 'home' ? ' aria-current="page"' : '') + '>Home</a>' +
      '<a href="' + BASE + 'pilot-path/"' + (page === 'prog' ? ' aria-current="page"' : '') + '>Pilot Path</a>' +
      '<a href="' + BASE + 'clearance/"' + (page === 'fly' ? ' aria-current="page"' : '') + '>Flight Clearance</a>' +
      '<a href="' + BASE + 'posters/"' + (page === 'res' ? ' aria-current="page"' : '') + '>Resources</a>' +
    '</nav>' +
    '<div class="sitme">' +
      '<button type="button" class="mebtn" id="siteMeBtn" aria-haspopup="dialog" aria-expanded="false"></button>' +
      '<div class="mepanel" id="siteMePanel" role="dialog" aria-label="Profile" hidden></div>' +
    '</div>';

  var old = document.querySelector('nav.crumbs');
  if (old) old.parentNode.replaceChild(bar, old);
  else (document.querySelector('.wrap') || document.body).insertAdjacentElement('afterbegin', bar);

  var btn = bar.querySelector('#siteMeBtn'), panel = bar.querySelector('#siteMePanel');

  function draw() {
    var p = get(), r = row(p);
    btn.classList.toggle('on', !!p);
    btn.innerHTML = p
      ? '<span class="av">' + esc(initials(p.name)) + '</span><span class="t"><b>My profile</b><small>' + esc(p.name) +
        (r && r.tier != null ? ' <em class="tier">Tier ' + r.tier + '</em>' : '') + '</small></span>'
      : '<span class="av none">?</span><span class="t"><b>Select profile</b></span>';
    if (panelOpen) drawPanel();
  }
  function initials(n) {
    var a = String(n).trim().split(/\s+/);
    return ((a[0] || '?').charAt(0) + (a.length > 1 ? a[a.length - 1].charAt(0) : '')).toUpperCase();
  }

  function drawPanel() {
    var p = get();
    if (!p || picking) {
      panel.innerHTML =
        '<div class="mh">Tap your name</div>' +
        '<input type="search" id="siteMeInput" placeholder="Find your name" aria-label="Find your name" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="28">' +
        '<div class="names" id="siteMeNames"></div>' +
        (authOn() && !token() ? '<button type="button" class="min" data-act="signin">Sign in</button>' : '') +
        '<a class="mjoin" href="' + BASE + 'join/">New here? <b>Join</b></a>' +
        (p ? '<button type="button" class="mlink" data-act="back">&larr; back to ' + esc(p.name) + '</button>' : '');
      var inp = panel.querySelector('#siteMeInput');
      inp.addEventListener('input', drawNames);
      inp.addEventListener('keydown', function (e) {
        /* Enter picks the name only when exactly one is left */
        if (e.key !== 'Enter') return;
        var only = panel.querySelectorAll('#siteMeNames button[data-s]');
        if (only.length === 1) only[0].click();
      });
      drawNames();
      if (window.Roster) Roster.load().then(drawNames);
      if (window.matchMedia && matchMedia('(pointer:fine)').matches) setTimeout(function () { inp.focus(); }, 0);
      return;
    }
    var r = row(p);
    var stats = r
      ? '<div class="mstats">' +
          '<div><b>' + (r.weekMs != null ? hm(r.weekMs) : '&ndash;') + '</b><span>last 7 days</span></div>' +
          '<div><b>' + (rank(r) ? '#' + rank(r) : '&ndash;') + '</b><span>rank</span></div>' +
          '<div><b>' + countBadges(r) + '</b><span>badges</span></div>' +
        '</div>'
      : '<div class="mhint">No sim time yet. Tap your name on a sim and fly.</div>';
    panel.innerHTML =
      '<div class="mh">My profile</div>' +
      '<div class="mname">' + esc(p.name) + (r && r.tier != null ? ' <span class="mtier">Tier ' + r.tier + '</span>' : '') + '</div>' + stats +
      '<a class="mgo" href="' + BASE + 'pilot-path/">My Pilot Path &rarr;</a>' +
      (authOn() && !token() ? '<button type="button" class="min" data-act="signin">Sign in</button>' : '') +
      '<div class="mrow">' + (authOn() && token() ? '<span class="msign">Signed in</span>' : '<button type="button" class="mlink" data-act="switch">Switch profile</button>') +
      '<button type="button" class="mlink" data-act="out">Sign out</button></div>';
  }
  /* rank over the last 7 days, 0 = did not fly in them */
  function rank(r) {
    if (!DATA || r.weekMs == null || !(r.weekMs > 30000)) return 0;
    return 1 + DATA.pilots.filter(function (x) { return (x.weekMs || 0) > r.weekMs; }).length;
  }
  function countBadges(r) {
    /* bonus badges and the Flight Clearance parts are never counted (2026-10-20) */
    var bonus = { editing: 1, tuning: 1, 'fleet-steward': 1, mentor: 1, 'faa-trust': 1, 'safe-flight': 1, 'pilot-agreement': 1, 'drone-portfolio': 1 };
    /* 2026-11-25: from the catalogue when the page loaded it (site.js doesn't load it itself) */
    if (window.FS && FS.BADGES && FS.counted) { bonus = {}; FS.BADGES.forEach(function (b) { if (!FS.counted(b)) bonus[b.id] = 1; }); }
    return (r.badges || []).filter(function (id) { return !bonus[id]; }).length;
  }
  function drawNames() {
    var box = panel.querySelector('#siteMeNames'), inp = panel.querySelector('#siteMeInput');
    if (!box) return;
    var q = slug(inp.value);
    var list = window.Roster ? Roster.list() : (DATA && DATA.pilots ? DATA.pilots.map(function (x) { return { name: x.name, slug: slug(x.name) }; }) : []);
    var hits = list.filter(function (x) { return !q || slug(x.name).indexOf(q) >= 0 || (x.aliases || []).some(function (a) { return a.indexOf(q) >= 0; }); }).slice(0, 60);
    var me = get();
    box.innerHTML = hits.map(function (x) {
      return '<button type="button" data-s="' + esc(x.slug) + '"' + (me && me.slug === x.slug ? ' class="cur"' : '') + '>' + esc(x.name) + '</button>';
    }).join('') +
      (!hits.length ? '<span class="mhint">' + (q ? 'No one by that name yet.' : (list.length ? '' : 'Loading names&hellip;')) + '</span>' : '');
  }

  function open() {
    panelOpen = true; panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); drawPanel();
    if (!AUTH && window.FPV && FPV.authCfg) FPV.authCfg().then(function (c) { AUTH = c; if (authOn() && panelOpen) drawPanel(); });
  }
  function close() { panelOpen = false; panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', function () { if (panelOpen) { close(); picking = false; } else open(); });
  panel.addEventListener('click', function (e) {
    /* Clicks inside the panel never reach the outside-click closer below:
       Switch / Back redraw the panel, which detaches the button that was
       clicked, and the closer then took it for a click outside (2026-10-10). */
    e.stopPropagation();
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-s')) {
      var s = t.getAttribute('data-s'), e = window.Roster && Roster.find(s);
      /* a page that reloads on site:pilot (Flight Clearance) asks after the reload */
      try { sessionStorage.setItem(ASK, (e && e.slug) || s); } catch (x) {}
      set(e ? { name: e.name, slug: e.slug } : { name: t.textContent, slug: s });
      return askConfirm(get(), true);
    }
    var act = t.getAttribute('data-act');
    if (act === 'switch') { picking = true; drawPanel(); }
    else if (act === 'back') { picking = false; drawPanel(); }
    else if (act === 'signin') { close(); FPV.ui().then(function (A) { A.sheet({}); }, function () {}); }
    else if (act === 'out') {
      if (token()) FPV.ui().then(function (A) { A.signOut(); }, function () { FPV.signedOut(); });
      set(null);
    }
  });
  document.addEventListener('click', function (e) { if (panelOpen && e.target.isConnected && !bar.querySelector('.sitme').contains(e.target)) { close(); picking = false; } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { close(); picking = false; btn.focus(); } });
  /* another tab picked a name */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    draw();
    document.dispatchEvent(new CustomEvent('site:pilot', { detail: get() }));
  });

  function remerge() {
    if (!RAW) return;
    var d = JSON.parse(JSON.stringify(RAW));
    DATA = window.mergePilots ? window.mergePilots(d) : d;
  }
  fetch(BASE + 'data.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    .then(function (d) { RAW = d; remerge(); draw(); }).catch(function () {});
  /* the roster changed (fresh from the API): fold rows again, keep the
     device's name in step with the roster's spelling */
  function follow() {
    var p = get(), c = p && window.Roster && Roster.entry(p);
    if (c && (c.name !== p.name || c.slug !== p.slug)) { set({ name: c.name, slug: c.slug }); return true; }
    return false;
  }
  document.addEventListener('auth:change', function () { draw(); });
  document.addEventListener('roster:change', function () {
    remerge();
    if (follow()) return;
    draw();
    if (panelOpen && (picking || !get())) drawNames();
  });
  if (window.Roster) { follow(); Roster.load(); }

  draw();
  /* 2026-10-20: every footer links the Pilot Agreement terms and Mr. Burr's
     request form, in front of the theme switch theme.js appends */
  function footLinks() {
    var foot = document.querySelector('footer');
    if (!foot || foot.querySelector('.sitelinks')) return;
    var sp = document.createElement('span'); sp.className = 'sitelinks';
    sp.innerHTML = '<a href="' + BASE + 'clearance/">Flight Clearance</a> · <a href="' + BASE + 'clearance/terms/">Pilot Agreement terms</a> · ' +
      '<a href="https://docs.google.com/forms/d/e/1FAIpQLSeIPraaBO1fHJE6GGEvQHs63saL9bmpDYng5O5Du4kSDWkegw/viewform" target="_blank" rel="noopener">Request form (Mr. Burr) &nearr;</a> · <a href="' + BASE + 'privacy/">Privacy</a>';
    foot.appendChild(sp);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', footLinks); else footLinks();
  /* 2026-11-27: "Is this you?" (auth.js FPVAuth.confirm) after somebody picks a
     profile here or on Join, and once per browser session on page load for a
     picked profile this device holds no token for. Only when login is on; the
     panel has already read the config by the time anyone picks, and the load
     check costs one GET /api/auth/config per session at most. Never from set()
     itself, so the roster spelling sync, a sign-in result and other tabs don't ask. */
  var ASK = 'fpv.confirm.ask.v1', SEEN = 'fpv.confirm.seen.v2', HOLD = 12 * 3600000;
  function unask() { try { sessionStorage.removeItem(ASK); } catch (e) {} }
  function askConfirm(p, pick) {
    if (!p || !p.slug || !window.FPV || !FPV.authCfg || !FPV.ui) { unask(); return; }
    FPV.authCfg().then(function (c) {
      if (!c || c.mode === 'off') { unask(); return; }
      FPV.ui().then(function (A) {
        if (!A || !A.confirm) { unask(); return; }
        A.confirm(p, { pick: !!pick }).then(unask, unask);
      }, unask);
    }, unask);
  }
  /* page load: a pick that a reload interrupted asks now; otherwise at most once
     every 12 hours per profile on this device (localStorage, so tabs agree) */
  function loadCheck() {
    var p = get();
    if (!p || !p.slug || page === 'join' || !window.FPV || !FPV.auth) return;
    var asked = ''; try { asked = sessionStorage.getItem(ASK) || ''; } catch (e) {}
    if (asked) { unask(); if (asked === p.slug) setTimeout(function () { askConfirm(get(), true); }, 600); return; }
    var a = FPV.auth(); if (a && a.pilot && a.pilot.slug === p.slug) return;
    try {
      var v = JSON.parse(localStorage.getItem(SEEN) || '{}') || {};
      if (Date.now() - (+v[p.slug] || 0) < HOLD) return;
      v[p.slug] = Date.now(); localStorage.setItem(SEEN, JSON.stringify(v));
    } catch (e) { return; }
    setTimeout(function () { askConfirm(get(), false); }, 1200);
  }
  if (document.readyState === 'complete') loadCheck(); else window.addEventListener('load', loadCheck);
  window.SiteNav = { pilot: get, set: set, confirm: askConfirm, open: function () { picking = false; open(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, row: row, slug: slug };
})();
