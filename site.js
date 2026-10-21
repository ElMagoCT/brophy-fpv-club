/* Site bar (2026-10-10): the same top bar on every page - Home / Pilot Path /
   Flight Clearance (2026-10-20) / Brophy Flight (was Request to fly,
   2026-10-15) / Resources, and the profile button top right.

   The profile is the pilot NAME, saved in localStorage under fs.pilot.v1 -
   the key Flight School has always used, so picking a name on any page is
   picking it everywhere (same origin). No password: progress only goes
   forward (Micah's call, "club, not a bank").

   A page that cares listens for `site:pilot` (detail = {name, slug} or null)
   and can open the menu with SiteNav.open(). Load it with `defer` after the
   page's own <nav class="crumbs">, which it replaces. */
(function () {
  var KEY = 'fs.pilot.v1';
  var src = (document.currentScript && document.currentScript.src) || '';
  var BASE = src.replace(/site\.js(\?.*)?$/, '');
  var DATA = null, panelOpen = false, picking = false;

  function slug(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function hm(ms) {
    var m = Math.round((ms || 0) / 60000), h = Math.floor(m / 60);
    return h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
  }
  function get() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); return v && v.name ? v : null; } catch (e) { return null; }
  }
  function set(name) {
    var p = name ? { name: String(name).trim(), slug: slug(name) } : null;
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
    for (var i = 0; i < DATA.pilots.length; i++) if (slug(DATA.pilots[i].name) === p.slug) return DATA.pilots[i];
    return null;
  }

  var page = /\/(pilot-path|progression|flightschool)\//.test(location.pathname) ? 'prog'
           : /\/clearance\//.test(location.pathname) ? 'clear'
           : /\/fly\//.test(location.pathname) ? 'fly'
           : /\/posters\//.test(location.pathname) ? 'res' : 'home';

  var bar = document.createElement('header');
  bar.className = 'sitebar';
  bar.innerHTML =
    '<nav class="sitenav" aria-label="Site">' +
      '<a href="' + BASE + '"' + (page === 'home' ? ' aria-current="page"' : '') + '>Home</a>' +
      '<a href="' + BASE + 'pilot-path/"' + (page === 'prog' ? ' aria-current="page"' : '') + '>Pilot Path</a>' +
      '<a href="' + BASE + 'clearance/"' + (page === 'clear' ? ' aria-current="page"' : '') + '>Flight Clearance</a>' +
      '<a href="' + BASE + 'fly/"' + (page === 'fly' ? ' aria-current="page"' : '') + '>Brophy Flight</a>' +
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
        '<div class="mh">' + (p ? 'Switch profile' : 'Select your profile') + '</div>' +
        '<input type="text" id="siteMeInput" placeholder="First name and last initial, e.g. Micah T." autocomplete="off" spellcheck="false" maxlength="28">' +
        '<div class="names" id="siteMeNames"></div>' +
        '<div class="mhint">Same name you use at the kiosk. No password: progress only ever goes forward.</div>' +
        (p ? '<button type="button" class="mlink" data-act="back">&larr; back to ' + esc(p.name) + '</button>' : '');
      var inp = panel.querySelector('#siteMeInput');
      inp.addEventListener('input', drawNames);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && this.value.trim().length >= 2) set(this.value); });
      drawNames();
      setTimeout(function () { inp.focus(); }, 0);
      return;
    }
    var r = row(p);
    var stats = r
      ? '<div class="mstats">' +
          '<div><b>' + (r.weekMs != null ? hm(r.weekMs) : '&ndash;') + '</b><span>last 7 days</span></div>' +
          '<div><b>' + (rank(r) ? '#' + rank(r) : '&ndash;') + '</b><span>rank</span></div>' +
          '<div><b>' + countBadges(r) + '</b><span>badges</span></div>' +
        '</div>'
      : '<div class="mhint">No kiosk time under this name yet. Fly at the kiosk with the same name and it shows up here.</div>';
    panel.innerHTML =
      '<div class="mh">My profile</div>' +
      '<div class="mname">' + esc(p.name) + (r && r.tier != null ? ' <span class="mtier">Tier ' + r.tier + '</span>' : '') + '</div>' + stats +
      '<a class="mgo" href="' + BASE + 'pilot-path/">My Pilot Path &rarr;</a>' +
      '<div class="mrow"><button type="button" class="mlink" data-act="switch">Switch profile</button>' +
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
    return (r.badges || []).filter(function (id) { return !bonus[id]; }).length;
  }
  function drawNames() {
    var box = panel.querySelector('#siteMeNames'), inp = panel.querySelector('#siteMeInput');
    if (!box) return;
    var raw = inp.value.trim(), q = slug(raw);
    var names = DATA && DATA.pilots ? DATA.pilots.map(function (x) { return x.name; }) : [];
    var hits = names.filter(function (n) { return !q || slug(n).indexOf(q) >= 0; }).sort().slice(0, 40);
    var exact = hits.some(function (n) { return slug(n) === q; });
    box.innerHTML = hits.map(function (n) { return '<button type="button" data-n="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') +
      (raw.length >= 2 && !exact ? '<button type="button" class="new" data-n="' + esc(raw) + '">+ new: ' + esc(raw) + '</button>' : '') +
      (!hits.length && raw.length < 2 ? '<span class="mhint">' + (DATA ? 'Type your name.' : 'Loading names&hellip;') + '</span>' : '');
  }

  function open() { panelOpen = true; panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); drawPanel(); }
  function close() { panelOpen = false; panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', function () { if (panelOpen) { close(); picking = false; } else open(); });
  panel.addEventListener('click', function (e) {
    /* Clicks inside the panel never reach the outside-click closer below:
       Switch / Back redraw the panel, which detaches the button that was
       clicked, and the closer then took it for a click outside (2026-10-10). */
    e.stopPropagation();
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-n')) return set(t.getAttribute('data-n'));
    var act = t.getAttribute('data-act');
    if (act === 'switch') { picking = true; drawPanel(); }
    else if (act === 'back') { picking = false; drawPanel(); }
    else if (act === 'out') set(null);
  });
  document.addEventListener('click', function (e) { if (panelOpen && e.target.isConnected && !bar.querySelector('.sitme').contains(e.target)) { close(); picking = false; } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panelOpen) { close(); picking = false; btn.focus(); } });
  /* another tab picked a name */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    draw();
    document.dispatchEvent(new CustomEvent('site:pilot', { detail: get() }));
  });

  fetch(BASE + 'data.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    .then(function (d) { DATA = window.mergePilots ? window.mergePilots(d) : d; draw(); }).catch(function () {});

  draw();
  window.SiteNav = { pilot: get, set: set, open: function () { picking = false; open(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, row: row, slug: slug };
})();
