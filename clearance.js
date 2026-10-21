/* Flight Clearance - shared by ../clearance/ (the four parts) and ../fly/
   (Flight Clearance: the certification, the drones and Mr. Burr's form). 2026-10-20.

   The Brophy Drone Certification is four parts (tier 'cl' in
   flightschool/badges.js): FAA TRUST, Safe Flight, Pilot Agreement, Drone
   Portfolio. A pilot is CLEARED when all four are done. Cleared is still not
   permission: every campus flight is requested from Mr. Burr 24 h ahead.

   Sources, merged per part - the same three the Pilot Path uses, nothing new:
     1. the kiosk snapshot (../data.json): earned badges per pilot;
     2. signed instructor decisions (/api/award) - a photo passed in the
        console files one of these;
     3. website progress: the Safe Flight quiz (localStorage gsWeb.profiles.v2
        + /api/progress), and photo / drone submissions (/api/submission).
   Earned always wins; nothing here can take a part away.

   The Drone Portfolio is per aircraft: the club's drones (FS.CLUB_DRONES)
   unlock with their checkpoint badge; a pilot's own drone is a submission
   with badge 'drone-portfolio' (picture + name + specs + a Google Drive
   video link) that a mentor passes in the console's Review tab.

   Load after flightschool/badges.js, pilots.js and site.js. */
(function () {
  var FS = window.FS, API = FS.API;
  var LS = { gs: 'gsWeb.profiles.v2', progress: 'fs.progress.v1' };
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var C = { pilot: null, data: null, awards: null, subs: null, server: null, loaded: {}, listeners: [] };

  function kioskRow() {
    if (!C.pilot || !C.data || !C.data.pilots) return null;
    for (var i = 0; i < C.data.pilots.length; i++) if (FS.slug(C.data.pilots[i].name) === C.pilot.slug) return C.data.pilots[i];
    return null;
  }
  function gsProfile() { var all = lsGet(LS.gs, {}); return C.pilot ? (all[C.pilot.slug] || null) : null; }
  function progress() { var all = lsGet(LS.progress, {}); return C.pilot ? (all[C.pilot.slug] || {}) : {}; }
  function saveProgress(p) { var all = lsGet(LS.progress, {}); if (C.pilot) { all[C.pilot.slug] = p; lsSet(LS.progress, all); } }
  function quizBest(b) {
    var gp = gsProfile(), q = gp && gp.groundSchool && b.quiz && gp.groundSchool.lessons[b.quiz];
    return Math.max(q ? (q.score || 0) : 0, (C.server && C.server.quizzes && C.server.quizzes[b.id]) ? (C.server.quizzes[b.id].best || 0) : 0);
  }
  function lessonDone(id) { var gp = gsProfile(), r = gp && gp.groundSchool && gp.groundSchool.lessons[id]; return !!(r && r.status === 'complete'); }
  /* a badge on file: kiosk snapshot or a signed decision (never 'revoked') */
  function onFile(id) {
    var kp = kioskRow();
    if (kp && kp.badges && kp.badges.indexOf(id) >= 0) return 'kiosk';
    var aw = C.awards && C.awards.badges && C.awards.badges[id];
    if (aw && aw.status === 'earned') return 'instructor';
    return '';
  }
  function subsFor(id) { return (C.subs || []).filter(function (x) { return x.badge === id; }); }
  function mySubs(id) { return subsFor(id).slice().sort(function (a, b) { return b.at - a.at; }); }

  /* status of one part: { earned, source, detail, pending, failed, pct } */
  function partStatus(b) {
    var s = { earned: false, source: '', detail: '', pending: null, failed: null, pct: 0 };
    var src = onFile(b.id);
    if (src) { s.earned = true; s.source = src; s.pct = 100; s.detail = 'done'; return s; }
    if (b.type === 'knowledge') {
      var ids = (b.lessons || []).map(function (l) { return l.id; }), done = 0, best = quizBest(b);
      ids.forEach(function (id) { if (lessonDone(id)) done++; });
      if (best >= FS.PASS) { s.earned = true; s.source = 'quiz'; s.pct = 100; s.detail = 'quiz ' + best; return s; }
      s.pct = Math.round((done + (best > 0 ? 0.5 : 0)) / (ids.length + 1) * 100);
      s.detail = done + ' of ' + (ids.length + 1) + ' parts' + (best > 0 ? ' · best quiz ' + best : '');
      return s;
    }
    if (b.kind === 'drone') {
      var pf = portfolio(), ok = pf.club.filter(function (d) { return d.unlocked; }).length + pf.mine.filter(function (d) { return d.status === 'pass'; }).length;
      var waiting = pf.mine.filter(function (d) { return d.status === 'pending'; }).length;
      if (ok) { s.earned = true; s.source = 'portfolio'; s.pct = 100; s.detail = ok + (ok === 1 ? ' drone' : ' drones') + ' approved' + (waiting ? ' · ' + waiting + ' waiting' : ''); return s; }
      if (waiting) { s.pending = pf.mine.filter(function (d) { return d.status === 'pending'; })[0]; s.pct = 80; s.detail = waiting + (waiting === 1 ? ' drone' : ' drones') + ' waiting for review'; return s; }
      var last = pf.mine[0];
      if (last && last.status === 'fail') { s.failed = last; s.detail = 'not approved' + (last.reviewNote ? ': ' + last.reviewNote : ''); return s; }
      s.detail = 'no drone yet'; return s;
    }
    /* bench: steps ticked here, then a photo a mentor reviews */
    var subs = mySubs(b.id), last = subs[0], pr = progress()[b.id] || {}, steps = b.steps || [], ticked = 0;
    steps.forEach(function (st, i) { if (pr.steps && pr.steps[i]) ticked++; });
    if (last && last.status === 'pending') { s.pending = last; s.pct = 90; s.detail = 'photo sent ' + new Date(last.at).toLocaleDateString() + ' · waiting for review'; return s; }
    if (last && last.status === 'fail') { s.failed = last; s.pct = Math.round(ticked / Math.max(1, steps.length) * 80); s.detail = 'not passed' + (last.reviewNote ? ': ' + last.reviewNote : '') + ' · send a new photo'; return s; }
    s.pct = Math.round(ticked / Math.max(1, steps.length) * 80);
    s.detail = ticked + ' of ' + steps.length + ' steps ticked';
    return s;
  }
  function portfolio() {
    var club = FS.CLUB_DRONES.map(function (d) {
      var o = {}; for (var k in d) o[k] = d[k];
      o.club = true; o.unlocked = !!onFile(d.badge); return o;
    });
    var mine = mySubs('drone-portfolio').map(function (x) {
      var d = x.drone || {};
      return { id: x.id, club: false, name: d.name || 'My drone', specs: d.specs || '', video: d.video || '', status: x.status, at: x.at, reviewNote: x.reviewNote || '', note: x.note || '' };
    });
    return { club: club, mine: mine };
  }
  function status() {
    var parts = FS.clearance().map(function (b) { return { badge: b, s: partStatus(b) }; });
    var done = parts.filter(function (p) { return p.s.earned; }).length;
    var next = parts.filter(function (p) { return !p.s.earned; })[0] || null;
    return { parts: parts, done: done, of: parts.length, cleared: !!C.pilot && done === parts.length, next: next,
             pending: !C.pilot ? false : !(C.loaded.data && C.loaded.awards && C.loaded.subs) };
  }

  /* ---------- loading ---------- */
  function emit() { C.listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function setPilot(p) {
    C.pilot = p && p.name ? { name: p.name, slug: FS.slug(p.name) } : null;
    C.awards = null; C.subs = null; C.server = null; C.loaded.awards = C.loaded.subs = C.loaded.server = false;
    if (C.pilot) pullMine(); else { C.loaded.awards = C.loaded.subs = C.loaded.server = true; }
    emit();
  }
  function pullData() {
    fetch(API_BASE() + 'data.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { C.data = window.mergePilots ? window.mergePilots(d) : d; C.loaded.data = true; emit(); })
      .catch(function () { C.data = C.data || { pilots: [] }; C.loaded.data = true; emit(); });
  }
  function API_BASE() {
    var s = document.querySelector('script[src$="clearance.js"]'); var src = (s && s.getAttribute('src')) || '../clearance.js';
    return src.replace(/clearance\.js(\?.*)?$/, '');
  }
  function pullMine() {
    if (!C.pilot) return;
    var me = C.pilot, q = encodeURIComponent(me.name);
    function mine() { return C.pilot && C.pilot.slug === me.slug; }
    fetch(API + '/api/award?pilot=' + q, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { if (!mine()) return; C.awards = (j && j.awards) || null; C.loaded.awards = true; emit(); })
      .catch(function () { if (mine()) { C.loaded.awards = true; emit(); } });
    fetch(API + '/api/submission?pilot=' + q, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { if (!mine()) return; C.subs = (j && j.items) || []; C.loaded.subs = true; emit(); })
      .catch(function () { if (mine()) { C.subs = C.subs || []; C.loaded.subs = true; emit(); } });
    fetch(API + '/api/progress?pilot=' + q, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!mine()) return;
        C.server = (j && j.progress) || null; C.loaded.server = true;
        if (C.server) {   // forward-only merge of lessons done elsewhere into this device's profile (as the Pilot Path does)
          var all = lsGet(LS.gs, {}), p = all[me.slug] || { groundSchool: { lessons: {}, progressPct: 0, updated: 0 } }, RANK = { 'not-started': 0, 'in-progress': 1, complete: 2 };
          Object.keys(C.server.lessons || {}).forEach(function (id) {
            var S = C.server.lessons[id], L = p.groundSchool.lessons[id] || { status: 'not-started', score: 0, attempts: 0, firstStarted: 0, completed: 0, timeMs: 0 };
            if ((RANK[S.status] || 0) > (RANK[L.status] || 0)) { L.status = S.status; if (S.status === 'complete' && !L.completed) L.completed = S.at || Date.now(); }
            if ((S.score || 0) > (L.score || 0)) L.score = S.score;
            p.groundSchool.lessons[id] = L;
          });
          all[me.slug] = p; lsSet(LS.gs, all);
          var pr = progress();
          Object.keys(C.server.steps || {}).forEach(function (b) { pr[b] = pr[b] || { steps: {} }; pr[b].steps = pr[b].steps || {}; Object.keys(C.server.steps[b]).forEach(function (i) { pr[b].steps[i] = true; }); });
          saveProgress(pr);
        }
        emit();
      }).catch(function () { if (mine()) { C.loaded.server = true; emit(); } });
  }
  function refresh() { pullData(); pullMine(); }

  /* a bench step ticked on the page: saved here, mirrored up (forward-only) */
  function tickStep(badgeId, i) {
    if (!C.pilot) return;
    var p = progress(); p[badgeId] = p[badgeId] || { steps: {} }; p[badgeId].steps = p[badgeId].steps || {};
    p[badgeId].steps[i] = !p[badgeId].steps[i]; p[badgeId].updated = Date.now(); saveProgress(p);
    if (p[badgeId].steps[i]) {
      var steps = {}; steps[badgeId] = {}; steps[badgeId][i] = true;
      fetch(API + '/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ name: C.pilot.name, steps: steps }) }).catch(function () {});
    }
    emit();
  }

  /* ---------- submissions ---------- */
  /* shrink a picture to 1600 px JPEG (what the API expects, ~200-400 KB) */
  function shrink(src, w, h) {
    var max = 1600, k = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }
  /* a certificate may be a PDF (2026-10-20): sent as-is, base64, if small enough */
  function fileToData(file, cb) {
    if (file && /pdf$/i.test(file.type || '') || /\.pdf$/i.test(file.name || '')) {
      if (file.size > 1400000) return cb(null, 'That PDF is too big (over 1.4 MB) - a photo of it works too.');
      var fr = new FileReader();
      fr.onload = function () { cb(String(fr.result).replace(/^data:[^;]*;/, 'data:application/pdf;')); };
      fr.onerror = function () { cb(null, 'Could not read that PDF.'); };
      fr.readAsDataURL(file); return;
    }
    fileToJpeg(file, function (d) { cb(d, d ? '' : 'That file is not a photo this browser can read.'); });
  }
  function fileToJpeg(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () { var d = shrink(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); cb(d, img); };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }
  /* POST a submission; `extra` = { drone: {name, specs, video} } for the portfolio */
  function submit(badgeId, photo, note, extra) {
    var body = { pilot: C.pilot.name, badge: badgeId, note: note || '', photo: photo };
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch(API + '/api/submission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'try again');
        C.subs = (C.subs || []).concat([j.item]); emit(); return j.item;
      });
  }

  /* ---------- Google Drive links ----------
     The video is a Drive link the pilot shares as "Anyone with the link".
     Public is checked with the file's thumbnail: Drive serves it as an image
     only for a file the viewer may open; a private one errors. No token, no
     API key, and it works from the console as well. */
  function driveId(u) {
    var m = /\/file\/d\/([\w-]{15,})/.exec(String(u || '')) || /[?&]id=([\w-]{15,})/.exec(String(u || ''));
    return m ? m[1] : null;
  }
  function driveCheck(id, cb) {
    var img = new Image(), done = false;
    var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 9000);
    img.onload = function () { if (!done) { done = true; clearTimeout(t); cb(true); } };
    img.onerror = function () { if (!done) { done = true; clearTimeout(t); cb(false); } };
    img.referrerPolicy = 'no-referrer';
    img.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w320';
  }
  function driveThumb(id) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w640'; }
  function drivePreview(id) { return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'; }
  function driveOpen(id) { return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; }

  window.Clearance = {
    state: C, setPilot: setPilot, refresh: refresh, pullData: pullData, pullMine: pullMine,
    on: function (f) { C.listeners.push(f); },
    status: status, partStatus: partStatus, portfolio: portfolio, onFile: onFile, kioskRow: kioskRow,
    quizBest: quizBest, lessonDone: lessonDone, progress: progress, tickStep: tickStep,
    shrink: shrink, fileToJpeg: fileToJpeg, fileToData: fileToData, submit: submit, mySubs: mySubs,
    driveId: driveId, driveCheck: driveCheck, driveThumb: driveThumb, drivePreview: drivePreview, driveOpen: driveOpen
  };

  /* boot: the site bar's profile (fs.pilot.v1) is the pilot everywhere */
  var p = null; try { p = JSON.parse(localStorage.getItem('fs.pilot.v1')); } catch (e) {}
  setPilot(p);
  pullData();
  document.addEventListener('site:pilot', function (e) { setPilot(e.detail); });
  setInterval(function () { if (!document.hidden) refresh(); }, 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
