/* Brophy FPV Club instructor console - see C:\BrophyUAV\remote\REMOTE.md.

   Talks ONLY to api.github.com, to the private repo below. It holds no secret
   of its own: the admin brings a GitHub token (kept in sessionStorage, this tab
   only) and the instructor password (hashed on the spot, kept in memory only,
   never sent anywhere). Every command is signed with
     HMAC-SHA256(key = hex SHA-256(password), "v1\n"+machine+"\n"+id+"\n"+action+"\n"+args+"\n"+issuedAt)
   and the kiosk agent refuses anything that does not verify. Results and
   status come back signed the same way, so a forged reply shows as unverified. */
(function () {
  'use strict';
  if (window.top !== window.self) { document.body.textContent = ''; return; }   // no framing / clickjacking

  // The club API (brophy-fpv-club-api, Netlify Functions) holds the GitHub token for
  // the private control repo. This page only ever sends signed commands to it
  // and reads signed answers back; the instructor password never leaves here.
  var API = 'https://brophy-fpv-club-api.netlify.app';
  var MACHINES = ['KIOSK-A', 'KIOSK-B'];

  var ACTIONS = [
    { a: 'status',            t: 'Status' },
    { a: 'pilots',            t: 'Pilots & hours' },
    { a: 'kiosk.start',       t: 'Start kiosk' },
    { a: 'kiosk.home',        t: 'Send pilot home', confirm: 'Close the running sim and go back to the hangar?' },
    { a: 'kiosk.signout',     t: 'Sign pilot out',  confirm: 'Close any sim and sign the current pilot out?' },
    { a: 'kiosk.restart',     t: 'Restart kiosk',   confirm: 'Restart the kiosk? A running sim is closed (time is banked first).' },
    { a: 'kiosk.stop',        t: 'Stop kiosk',      confirm: 'Stop the kiosk like an instructor exit? Students will see the desktop until it is started again.', danger: true },
    { a: 'lab.open',          t: 'Open lab now',    args: function () { return { minutes: +el('openMins').value || 60 }; } },
    { a: 'lab.close',         t: 'Cancel open-now' },
    { a: 'remoteadmin',       t: 'Remote admin ON', args: function () { return { on: true }; }, danger: true,
      confirm: 'Remote admin mode unlocks the desktop AND lets the Windows key through for students. It expires by itself after 4 h. Turn it on?' },
    { a: 'remoteadmin',       t: 'Remote admin OFF', args: function () { return { on: false }; } },
    { a: 'sync.now',          t: 'Sync now' },
    { a: 'schedule.refresh',  t: 'Refresh schedule' },
    { a: 'dashboard.publish', t: 'Publish website' },
    { a: 'logs',              t: 'Show log', args: function () { return { name: el('logName').value, lines: 80 }; } }
  ];

  var S = { key: null, machine: MACHINES[0], pending: {} };
  function el(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------- crypto
  var enc = new TextEncoder(), dec = new TextDecoder();
  function hex(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2); return s; }
  function sha256Hex(text) { return crypto.subtle.digest('SHA-256', enc.encode(text)).then(hex); }
  function importKey(keyHex) { return crypto.subtle.importKey('raw', enc.encode(keyHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); }
  function hmac(text) { return crypto.subtle.sign('HMAC', S.key, enc.encode(text)).then(hex); }
  function randId() { var b = new Uint8Array(8); crypto.getRandomValues(b); return hex(b.buffer); }
  function b64utf8(s) { var bytes = enc.encode(s), bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
  function unb64utf8(b) { var bin = atob(b.replace(/\n/g, '')), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return dec.decode(u); }

  // ---------------------------------------------------------------- GitHub
  function api(method, path, body, headers) {
    var opt = { method: method, cache: 'no-store', headers: headers || {} };
    if (body) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
    return fetch(API + path, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }).then(function (j) {
        if (!r.ok || j.ok === false) { var e = new Error(j.error || ('API ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function readStatus(m) { return api('GET', '/api/status?machine=' + encodeURIComponent(m)).then(function (j) { return j.status; }); }
  function readResult(m, id) { return api('GET', '/api/result?machine=' + encodeURIComponent(m) + '&id=' + encodeURIComponent(id)).then(function (j) { return j.result; }); }

  // ---------------------------------------------------------------- sign in
  // 2026-10-10: a wrong password used to get in (it only showed up later as
  // "NOT verified"). Now it is checked before the console opens, with the two
  // checks that already exist - nothing new is sent or stored:
  //   1. the review key (hex SHA-256 of the password, the same header photo
  //      review sends) against the API's REVIEW_KEY_HASH: 403 = wrong;
  //   2. if review is not set up (503) or unreachable, a kiosk's last signed
  //      heartbeat, verified locally with the HMAC key, like the status badge.
  // Resolves true (right), false (wrong) or null (nothing could tell).
  function verifyPassword(keyHex, key) {
    return api('GET', '/api/submission?review=1', null, { 'X-Review-Key': keyHex }).then(function () { return true; }, function (e) {
      if (e.status === 401 || e.status === 403) return false;
      var i = 0;
      function next() {
        if (i >= MACHINES.length) return null;
        var m = MACHINES[i++];
        return readStatus(m).then(function (st) {
          if (!st || !st.sig) return next();
          return crypto.subtle.sign('HMAC', key, enc.encode('v1s\n' + m + '\n' + st.data + '\n' + st.updated)).then(hex).then(function (sig) { return sig === st.sig; });
        }, next);
      }
      return next();
    });
  }
  function signIn() {
    var pw = el('pw').value, h0;
    el('signMsg').textContent = '';
    if (pw.length < 4) { el('signMsg').textContent = 'Enter the instructor password.'; return; }
    el('go').disabled = true; el('signMsg').textContent = 'Checking…';
    sha256Hex(pw).then(function (h) { h0 = h; return importKey(h); }).then(function (k) {
      return verifyPassword(h0, k).then(function (ok) {
        if (ok === false) { el('signMsg').textContent = 'Wrong password.'; el('pw').select(); return; }
        S.keyHex = h0; S.key = k; el('pw').value = ''; pw = null; el('signMsg').textContent = '';
        el('signin').hidden = true; el('console').hidden = false;
        el('who').textContent = ok ? 'Signed in · password checked · kept in this tab only'
                                   : 'Signed in · password NOT checked (photo review not set up and no signed kiosk status to check it against) · kept in this tab only';
        el('signout').hidden = false;
        drawTabs(); drawActions(); loadStatus(); showView(); loadReview(true);
      });
    }).catch(function (e) { el('signMsg').textContent = e.message; }).then(function () { el('go').disabled = false; });
  }
  function signOut() { S.key = null; location.reload(); }

  // ---------------------------------------------------------------- UI
  function drawTabs() {
    var t = el('tabs'); t.textContent = '';
    MACHINES.forEach(function (m) {
      var b = document.createElement('button'); b.textContent = m; b.className = m === S.machine ? 'on' : '';
      b.onclick = function () { S.machine = m; drawTabs(); loadStatus(); };
      t.appendChild(b);
    });
    el('mName').textContent = S.machine;
  }
  function drawActions() {
    var box = el('actions'); box.textContent = '';
    ACTIONS.forEach(function (x) {
      var b = document.createElement('button'); b.textContent = x.t; if (x.danger) b.className = 'danger';
      b.onclick = function () { if (x.confirm && !window.confirm(S.machine + ': ' + x.confirm)) return; send(x.a, x.args ? x.args() : {}, x.t); };
      box.appendChild(b);
    });
  }
  function kv(label, val) {
    var d = document.createElement('div'), b = document.createElement('b');
    b.textContent = label; d.appendChild(b); d.appendChild(document.createTextNode(val == null ? '-' : String(val))); return d;
  }
  function setBadge(cls, text) { var b = el('verify'); b.className = 'badge ' + cls; b.textContent = text; }

  function loadStatus() {
    var m = S.machine, box = el('status');
    box.textContent = ''; box.appendChild(kv('status', 'loading…')); setBadge('', '');
    readStatus(m).then(function (s) {
      if (m !== S.machine) return;
      box.textContent = '';
      if (!s) { box.appendChild(kv('status', 'This kiosk has never reported. Is the remote agent installed?')); setBadge('warn', 'no status'); return; }
      if (!s.sig) { box.appendChild(kv('status', JSON.stringify(s).slice(0, 200))); setBadge('warn', 'unsigned'); return; }
      return hmac('v1s\n' + m + '\n' + s.data + '\n' + s.updated).then(function (sig) {
        var okSig = sig === s.sig;
        setBadge(okSig ? 'ok' : 'bad', okSig ? 'verified · password OK' : 'NOT verified: wrong password, or forged');
        var d = JSON.parse(s.data);
        box.appendChild(kv('Kiosk', d.kioskUp ? 'running' : 'stopped'));
        box.appendChild(kv('Pilot', d.pilot || (d.kioskUp ? 'nobody signed in' : '-')));
        box.appendChild(kv('Sim', d.activeSim || '-'));
        box.appendChild(kv('Lab', d.labClosed == null ? '-' : (d.labClosed ? 'closed' : 'open')));
        box.appendChild(kv('Today', d.todayLine));
        box.appendChild(kv('Pilots on roster', d.pilots));
        box.appendChild(kv('Remote admin', d.remoteAdmin ? 'ON (Windows key NOT blocked)' : 'off'));
        box.appendChild(kv('Agents', 'sync ' + (d.agents.sync ? '✓' : '✗') + ' · radio ' + (d.agents.vremote ? '✓' : '✗') + ' · light ' + (d.agents.rgb ? '✓' : '✗')));
        box.appendChild(kv('Sleeps after', d.sleepAcSec === 0 ? 'never' : (d.sleepAcSec ? Math.round(d.sleepAcSec / 60) + ' min' : '-')));
        box.appendChild(kv('Timezone', d.timezone));
        box.appendChild(kv('Code version', d.codeVersion));
        box.appendChild(kv('Up for', d.uptimeHours + ' h'));
        var age = Math.round((Date.now() - s.updated) / 60000);
        el('statusAge').textContent = 'Reported ' + (age < 1 ? 'just now' : age + ' min ago') + ' (heartbeat every 30 min; press Status for a fresh one).';
      });
    }).catch(function (e) { box.textContent = ''; box.appendChild(kv('error', e.message)); });
  }

  // ---------------------------------------------------------------- commands
  function send(action, args, label) {
    var m = S.machine, id = randId(), issuedAt = Date.now(), argsJson = JSON.stringify(args || {});
    var row = addResult(id, m, label);
    hmac('v1\n' + m + '\n' + id + '\n' + action + '\n' + argsJson + '\n' + issuedAt).then(function (sig) {
      return api('POST', '/api/command', { id: id, machine: m, action: action, args: argsJson, issuedAt: issuedAt, sig: sig });
    }).then(function () {
      setRow(row, 'st-wait', 'sent - waiting for the kiosk (≈15 s)…');
      poll(row, m, id, Date.now());
    }).catch(function (e) { setRow(row, 'st-bad', 'could not send: ' + e.message); });
  }
  function poll(row, m, id, since) {
    if (Date.now() - since > 180000) { setRow(row, 'st-bad', 'no answer after 3 min - is that kiosk on and online?'); return; }
    setTimeout(function () {
      readResult(m, id).then(function (r) {
        if (!r) { poll(row, m, id, since); return; }
        return hmac('v1r\n' + m + '\n' + id + '\n' + (r.ok ? '1' : '0') + '\n' + r.output + '\n' + r.finishedAt).then(function (sig) {
          var v = r.sig && sig === r.sig;
          setRow(row, r.ok ? 'st-ok' : 'st-bad', (r.ok ? 'done' : 'failed') + (v ? ' · verified' : ' · NOT verified'), r.output);
          if (m === S.machine) loadStatus();
        });
      }).catch(function () { poll(row, m, id, since); });
    }, 4000);
  }
  function addResult(id, m, label) {
    var list = el('results'); if (list.firstChild && list.firstChild.className === 'muted') list.textContent = '';
    var d = document.createElement('div'); d.className = 'res';
    var h = document.createElement('div'); h.className = 'h';
    var l = document.createElement('span'); l.textContent = m + ' · ' + label + ' · ' + new Date().toLocaleTimeString();
    var st = document.createElement('span'); st.className = 'st-wait'; st.textContent = 'signing…';
    h.appendChild(l); h.appendChild(st); d.appendChild(h);
    list.insertBefore(d, list.firstChild);
    return d;
  }
  function setRow(row, cls, text, output) {
    var st = row.querySelector('.h span:last-child'); st.className = cls; st.textContent = text;
    if (output != null) { var p = document.createElement('pre'); p.textContent = output; row.appendChild(p); }   // textContent: never HTML
  }

  // ---------------------------------------------------------------- approvals
  var ROSTER = null;
  // Review photos is the first view (2026-10-10): no hash, or one we do not
  // know, opens it. #approvals and #kiosks still deep-link.
  function showView() {
    var ap = location.hash === '#approvals' || location.hash === '#pilots', ki = location.hash === '#kiosks', rv = !ap && !ki;
    el('approvals').hidden = !ap; el('review').hidden = !rv; el('kiosks').hidden = !ki;
    el('vKiosks').className = ki ? 'on' : ''; el('vApprovals').className = ap ? 'on' : ''; el('vReview').className = rv ? 'on' : '';
    if ((ap || rv) && !ROSTER) loadRoster();
    if (rv && S.key) loadReview();
  }
  window.addEventListener('hashchange', showView);
  function drawApprovals() {
    if (!window.FS) return;
    var bs = el('apBadge'); bs.textContent = '';
    FS.TIERS.forEach(function (t) {
      var g = document.createElement('optgroup'); g.label = (t.n >= 0 ? 'Tier ' + t.n + ' · ' : '') + t.name;
      FS.BADGES.filter(function (b) { return b.tier === t.id && b.type !== 'auto'; }).forEach(function (b) {
        var o = document.createElement('option'); o.value = b.id;
        o.textContent = b.name + '  (' + { knowledge: 'quiz', bench: 'bench', witnessed: 'witnessed' }[b.type] + ')';
        g.appendChild(o);
      });
      bs.appendChild(g);
    });
    bs.onchange = badgeInfo; badgeInfo();
    var t = null;
    el('apPilot').addEventListener('change', pickPilot);
    el('apPilot').addEventListener('input', function () {   // a roster name picked or typed in full loads at once
      clearTimeout(t); var v = el('apPilot').value.trim();
      if (rosterPilot(FS.slug(v))) t = setTimeout(pickPilot, 150);
    });
    el('ppRefresh').onclick = function () { PP.slug = null; pickPilot(); };
    el('apAward').onclick = function () { award('earned'); };
    el('apRevoke').onclick = function () { if (window.confirm('Revoke this badge from the pilot? Only do this for a mistake.')) award('revoked'); };
  }
  // What is already on file for the typed pilot.
  function showHas() {
    var pilot = el('apPilot').value.trim(); el('apHas').textContent = '';
    if (pilot.length < 2) return;
    api('GET', '/api/award?pilot=' + encodeURIComponent(pilot)).then(function (j) {
      var aw = j.awards && j.awards.badges ? j.awards.badges : {};
      var earned = Object.keys(aw).filter(function (k) { return aw[k].status === 'earned'; });
      el('apHas').textContent = earned.length ? 'On file: ' + earned.map(badgeName).join(', ') : 'No sign-offs on file yet.';
    }).catch(function (e) { el('apHas').textContent = e.message; });
  }
  function badgeName(id) { var b = FS.BADGES.filter(function (x) { return x.id === id; })[0]; return b ? b.name : id; }
  // The badge rules a sign-off must respect, from the kiosk snapshot
  // (data.json: tier, badges, totalMs). Returns null (fine), {stop: msg}
  // (refuse) or {ask: msg} (the snapshot cannot tell - ask the instructor).
  //   minTier  (2026-10-06): Mentor is for Tier 3 pilots (Event Pilots) since 2026-10-26
  //   MENTOR_CAP (2026-10-26): at most FS.MENTOR_CAP mentors at a time
  //   minHours (2026-10-07): Sim Flight is judged only after 5 sim hours
  //   checkpoint (2026-10-08): a tier's checkpoint needs the rest of the tier;
  //            asked rather than refused, because an approval filed a minute
  //            ago may not be in the snapshot yet - and the kiosks will not
  //            count it until the tier is done anyway
  function rosterPilot(s) { return (ROSTER && ROSTER.pilots || []).filter(function (p) { return FS.slug(p.name) === s; })[0]; }
  function checkRules(pilot, bd) {
    if (!bd) return null;
    var rp = rosterPilot(FS.slug(pilot));
    if (bd.id === 'mentor' && FS.MENTOR_CAP) {
      var mentors = ((ROSTER && ROSTER.pilots) || []).filter(function (p) { return (p.badges || []).indexOf('mentor') >= 0 && FS.slug(p.name) !== FS.slug(pilot); });
      if (mentors.length >= FS.MENTOR_CAP) return { ask: 'Warning: the club already has ' + mentors.length + ' mentors (' + mentors.map(function (p) { return p.name; }).join(', ') + ') and the limit is ' + FS.MENTOR_CAP +
        '. A new mentor must be noticeably more active and knowledgeable than an active mentor, and one steps down. Approve it anyway? It will count.' };
    }
    if (bd.minTier != null) {
      if (rp && rp.tier != null && rp.tier < bd.minTier) return { ask: 'Warning: ' + bd.name + ' is normally for Tier ' + bd.minTier + ' pilots - ' + pilot + ' is on Tier ' + rp.tier + '. Approve it anyway? It will count.' };
      if (!rp || rp.tier == null) return { ask: 'Warning: the kiosk has not published ' + pilot + '’s tier. ' + bd.name + ' is normally for Tier ' + bd.minTier + ' pilots. Approve it anyway? It will count.' };
    }
    if (bd.minHours) {
      var hrs = rp ? (rp.totalMs || 0) / 3600000 : 0;
      if (hrs < bd.minHours) return { ask: 'Warning: ' + bd.name + ' normally needs ' + bd.minHours + ' h in the sim - ' + pilot + ' has ' + hrs.toFixed(1) + ' h at the kiosk. Approve it anyway? It will count.' };
    }
    if (bd.checkpoint) {
      var held = (rp && rp.badges) || [];
      var missing = FS.mates(bd).filter(function (m) { return held.indexOf(m.id) < 0; });
      if (missing.length) return { ask: 'Warning: ' + bd.name + ' is the checkpoint for its tier. The kiosk snapshot shows ' + pilot + ' still needs: ' +
        missing.map(function (m) { return m.name; }).join(', ') + '. Approve it anyway? It will count.' };
    }
    return null;
  }
  // Sign the decision with the instructor password (same key as commands) and
  // file it. Signature: HMAC over "v1a\n<slug>\n<badge>\n<status>\n<at>".
  function fileAward(pilot, badge, status, note, evidence) {
    var at = Date.now(), s = FS.slug(pilot);
    return hmac('v1a\n' + s + '\n' + badge + '\n' + status + '\n' + at).then(function (sig) {
      return api('POST', '/api/award', { pilot: pilot, badge: badge, status: status, at: at, note: note, evidence: evidence, sig: sig });
    });
  }
  function award(status) {
    var pilot = el('apPilot').value.trim(), badge = el('apBadge').value;
    if (pilot.length < 2) { el('apPilot').focus(); return; }
    decideBadge(pilot, badge, status, el('apMsg'), ['dm']);
  }
  // One path for every console decision (the form above and the progress list):
  // the badge rules, then the signed award, then a refresh of what is on file.
  // A badge with a `quiz` that is also bench/witnessed (spotter, event-ops)
  // needs the quiz passed AND a mentor's approval. Approving before the quiz
  // is allowed but asked, like an unfinished checkpoint. Quiz best comes from
  // /api/progress (quizzes[badge].best, or the quiz lesson's score).
  function needsQuiz(bd) { return !!(bd && bd.quiz && (bd.type === 'witnessed' || bd.type === 'bench')); }
  function quizBest(prog, bd) {
    var q = prog && prog.quizzes && prog.quizzes[bd.id], l = prog && prog.lessons && prog.lessons[bd.quiz];
    return Math.max(q ? (+q.best || 0) : 0, l ? (+l.score || 0) : 0);
  }
  function quizAsk(pilot, bd) {
    if (!needsQuiz(bd)) return Promise.resolve(null);
    var got = PP.slug === FS.slug(pilot) && PP.loaded ? Promise.resolve(PP.prog)
      : api('GET', '/api/progress?pilot=' + encodeURIComponent(pilot)).then(function (j) { return j.progress || null; }, function () { return null; });
    return got.then(function (prog) {
      var best = quizBest(prog, bd);
      if (best >= FS.PASS) return null;
      return 'Warning: ' + bd.name + ' normally needs its quiz passed AND a mentor’s approval. ' + pilot + (best ? '’s best quiz is ' + best + ' %' : ' has not passed the quiz yet') +
        ' (needs ' + FS.PASS + ' %). Approve it anyway? It will count.';
    });
  }
  function decideBadge(pilot, badge, status, msg, evidence) {
    var bd = FS.BADGES.filter(function (x) { return x.id === badge; })[0], note = el('apNote').value.trim();
    var go = Promise.resolve(true);
    if (status === 'earned') {
      var rule = checkRules(pilot, bd);
      if (rule && rule.stop) { msg.textContent = rule.stop; return; }
      if (rule && rule.ask && !window.confirm(rule.ask)) { msg.textContent = 'Not filed.'; return; }
      go = quizAsk(pilot, bd).then(function (ask) { return !ask || window.confirm(ask); });
    }
    go.then(function (yes) {
      if (!yes) { msg.textContent = 'Not filed.'; return; }
      return fileDecision(pilot, badge, status, note, evidence, msg);
    });
  }
  function fileDecision(pilot, badge, status, note, evidence, msg) {
    msg.textContent = 'signing…';
    return fileAward(pilot, badge, status, note, evidence).then(function () {
      msg.textContent = (status === 'earned' ? 'Approved: ' : 'Revoked: ') + badgeName(badge) + ' for ' + pilot + ' · on file; the kiosks pick it up on their next sync.';
      /* update in place (2026-10-15): the old code reloaded the roster and the
         whole progress list, so the page jumped back to the top every time. */
      if (PP.slug === FS.slug(pilot)) {
        PP.awards = PP.awards || {}; PP.awards.badges = PP.awards.badges || {};
        PP.awards.badges[badge] = { status: status, at: Date.now(), note: note };
        var y = window.scrollY; drawProgress(); window.scrollTo(0, y);
        var row = el('ppList').querySelector('[data-badge="' + badge + '"] .pmsg');
        if (row) row.textContent = msg.textContent;
      }
      showHas();
    }).catch(function (e) { msg.textContent = 'Could not file it: ' + e.message; });
  }

  // ---------------------------------------------------------------- pilot progress (2026-10-10)
  // Pick a pilot on Approvals and their whole path loads: every badge in
  // flightschool/badges.js, earned or not, and where it came from - the kiosk
  // snapshot (data.json), decisions on file (/api/award), and website quiz /
  // lesson / step progress (/api/progress). Both API reads are public; only
  // Approve / Revoke sign, through decideBadge above. Grouped the way Flight
  // School shows it: "Building to Tier N" prerequisites, then that checkpoint,
  // and so on; bonus badges last. Fields are read defensively - a badge may
  // gain `quiz` on a witnessed/bench badge (= quiz AND a mentor's approval).
  var PP = { slug: null, name: '', awards: null, prog: null, subs: null };
  // 2026-10-20: every submission this pilot ever sent (photos, PDFs, drone videos),
  // from the review queue's `all` view - needs the instructor password like review.
  function loadPilotSubs(s) {
    if (!S.keyHex) return Promise.resolve(null);
    return api('GET', '/api/submission?review=all', null, reviewHeaders()).then(function (j) {
      return (j.items || []).filter(function (it) { return FS.slug(it.pilot) === s; }).sort(function (a, b) { return b.at - a.at; });
    }, function () { return null; });
  }
  var PHOTOS = {};   // photo path -> data URL, so opening a badge twice does not refetch
  function photoInto(box, it) {
    function show(src, type) {
      box.textContent = '';
      var img;
      if (type === 'application/pdf') { img = document.createElement('embed'); img.type = 'application/pdf'; img.className = 'pdf'; }
      else { img = document.createElement('img'); img.alt = 'submission from ' + it.pilot; }
      img.src = src; box.appendChild(img);
    }
    if (!it.photo) { box.textContent = it.video ? 'Drive link' : 'no file'; return; }
    if (PHOTOS[it.photo]) { show(PHOTOS[it.photo].src, PHOTOS[it.photo].type); return; }
    box.textContent = 'Loading…';
    api('GET', '/api/submission?photo=' + encodeURIComponent(it.photo), null, reviewHeaders()).then(function (j) {
      var src = 'data:' + (j.type || 'image/jpeg') + ';base64,' + j.base64;
      PHOTOS[it.photo] = { src: src, type: j.type || 'image/jpeg' }; show(src, j.type || 'image/jpeg');
    }).catch(function (e) { box.textContent = 'Could not load: ' + e.message; });
  }
  // one submission: the file, then status, date, note, and for a drone its name, specs and video
  function subEl(it, big) {
    var d = document.createElement('div'); d.className = 'psub ' + (it.status || 'pending') + (big ? ' big' : '');
    var ph = document.createElement('div'); ph.className = 'ph';
    ph.addEventListener('click', function () { ph.classList.toggle('full'); });
    var meta = document.createElement('div'); meta.className = 'pmeta';
    var st = document.createElement('b'); st.textContent = it.status === 'pass' ? 'Passed' : it.status === 'fail' ? 'Failed' : 'Pending review';
    meta.appendChild(st);
    var dt = document.createElement('span'); dt.textContent = ' · sent ' + new Date(it.at).toLocaleDateString() + (it.reviewedAt ? ' · reviewed ' + new Date(it.reviewedAt).toLocaleDateString() : '');
    meta.appendChild(dt);
    if (it.drone) {
      var dr = document.createElement('div'); dr.className = 'pdrone';
      var dn = document.createElement('b'); dn.textContent = it.drone.name || 'drone'; dr.appendChild(dn);
      if (it.drone.specs) dr.appendChild(document.createTextNode(' · ' + it.drone.specs));
      var vid = driveId(it.drone.video);
      if (vid) {
        var a = document.createElement('a'); a.href = 'https://drive.google.com/file/d/' + encodeURIComponent(vid) + '/view'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = ' · flight video ↗';
        dr.appendChild(a);
      }
      meta.appendChild(dr);
    } else if (it.note) { var n = document.createElement('div'); n.className = 'pnote'; n.textContent = '“' + it.note + '”'; meta.appendChild(n); }
    if (it.video && driveId(it.video)) {   // 2026-10-27: a Cinematography clip, sent as a Drive link
      var cl = document.createElement('a'); cl.href = 'https://drive.google.com/file/d/' + encodeURIComponent(driveId(it.video)) + '/view'; cl.target = '_blank'; cl.rel = 'noopener'; cl.textContent = 'the clip ↗';
      var cr = document.createElement('div'); cr.className = 'pdrone'; cr.appendChild(cl); meta.appendChild(cr);
    }
    if (it.reviewNote) { var rn = document.createElement('div'); rn.className = 'pnote'; rn.textContent = 'Mentor: ' + it.reviewNote; meta.appendChild(rn); }
    d.appendChild(ph); d.appendChild(meta);
    photoInto(ph, it);
    return d;
  }
  // the two documents at the top of a pilot's page: the latest TRUST certificate and signed agreement
  function drawDocs() {
    var box = el('ppDocs'); box.textContent = '';
    if (!S.keyHex) { box.className = 'ppdocs muted small'; box.textContent = 'Sign in with the instructor password to see this pilot\'s submissions (TRUST certificate, signed agreement, drone videos).'; return; }
    box.className = 'ppdocs';
    [['faa-trust', 'TRUST certificate'], ['pilot-agreement', 'Pilot Agreement (signed)']].forEach(function (pair) {
      var col = document.createElement('div'); col.className = 'pdoc';
      var h = document.createElement('h3'); h.textContent = pair[1]; col.appendChild(h);
      var it = (PP.subs || []).filter(function (x) { return x.badge === pair[0]; })[0];
      if (it) col.appendChild(subEl(it, true));
      else { var none = document.createElement('div'); none.className = 'muted small'; none.textContent = PP.subs ? 'Nothing submitted yet.' : 'Could not load submissions.'; col.appendChild(none); }
      box.appendChild(col);
    });
  }
  function pickPilot() {
    var name = el('apPilot').value.trim(), s = FS.slug(name);
    showHas();
    if (s.length < 2) { el('pp').hidden = true; PP.slug = null; return; }
    if (s === PP.slug) return;
    PP.slug = s; PP.name = name; PP.awards = PP.prog = PP.subs = null; PP.loaded = false; el('ppDocs').textContent = '';
    el('pp').hidden = false; el('ppName').textContent = name + ' · progress';
    el('ppMsg').textContent = 'Loading…'; el('ppList').textContent = ''; el('ppSum').textContent = '';
    var q = encodeURIComponent(name);
    Promise.all([
      api('GET', '/api/award?pilot=' + q).then(function (j) { return j.awards || null; }),
      api('GET', '/api/progress?pilot=' + q).then(function (j) { return j.progress || null; }),
      loadPilotSubs(s),
      ROSTER ? Promise.resolve() : fetch('../data.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { ROSTER = ROSTER || (window.mergePilots ? window.mergePilots(d) : d); })
    ]).then(function (r) {
      if (PP.slug !== s) return;
      PP.awards = r[0]; PP.prog = r[1]; PP.subs = r[2]; PP.loaded = true; el('ppMsg').textContent = ''; drawDocs(); drawProgress();
    }).catch(function (e) { if (PP.slug === s) { el('ppMsg').textContent = 'Could not load progress: ' + e.message; PP.slug = null; } });
  }
  // Everything known about one badge for the picked pilot. Mirrors the rules
  // Flight School uses (kiosk wins; an approval counts; a revoke clears; a quiz
  // at FS.PASS earns a quiz badge) so the console and the pilot see the same.
  function badgeState(b) {
    var rp = rosterPilot(PP.slug), pr = PP.prog || {}, aws = (PP.awards && PP.awards.badges) || {};
    var lessons = pr.lessons || {}, aw = aws[b.id] || null;
    var st = { kiosk: !!(rp && rp.badges && rp.badges.indexOf(b.id) >= 0), aw: aw,
               approved: !!(aw && aw.status === 'earned'), revoked: !!(aw && aw.status === 'revoked'),
               hours: rp ? (rp.totalMs || 0) / 3600000 : 0, bits: [] };
    // quiz: the best of the per-badge quiz record and the quiz lesson's score
    var best = 0;
    if (b.quiz) {
      var qq = pr.quizzes && pr.quizzes[b.id], ql = lessons[b.quiz];
      best = Math.max(qq ? (+qq.best || 0) : 0, ql ? (+ql.score || 0) : 0);
      st.quizPass = best >= FS.PASS;
      st.bits.push(best ? 'quiz best ' + best + ' %' + (st.quizPass ? ' ✓' : ' (needs ' + FS.PASS + ')') : 'quiz not taken');
    }
    var ls = (b.lessons || []).filter(function (l) { return l && l.id; });
    if (ls.length) st.bits.push('lessons ' + ls.filter(function (l) { return lessons[l.id] && lessons[l.id].status === 'complete'; }).length + '/' + ls.length);
    if (Array.isArray(b.steps) && b.steps.length) {
      var ticks = (pr.steps && pr.steps[b.id]) || {};
      st.bits.push('steps ' + b.steps.filter(function (x, i) { return ticks[i]; }).length + '/' + b.steps.length);
    }
    if (Array.isArray(b.reqs) && b.reqs.length) {   // 2026-10-11: requirement boxes (lessons, hours or the pilot's own tick)
      var rt = (pr.steps && pr.steps[b.id]) || {};
      var rd = b.reqs.filter(function (r, i) {
        if (r.hours) return st.hours >= r.hours;
        if (r.lessons && r.lessons.length) return r.lessons.every(function (id) { return lessons[id] && (lessons[id].status === 'complete' || (id === b.quiz && (+lessons[id].score || 0) >= FS.PASS)); });
        return !!rt[i];
      }).length;
      st.bits.push('requirements ' + rd + '/' + b.reqs.length);
    }
    if (Array.isArray(b.prep) && b.prep.length)
      st.bits.push('prep drills ' + b.prep.filter(function (id) { return lessons[id] && lessons[id].status === 'complete'; }).length + '/' + b.prep.length);
    if (b.minHours) st.bits.push(st.hours.toFixed(1) + ' of ' + b.minHours + ' h in the sim');
    if (b.minTier != null) st.bits.push('Tier ' + b.minTier + ' pilots · on Tier ' + (rp && rp.tier != null ? rp.tier : '?'));
    var mentorType = b.type === 'witnessed' || b.type === 'bench';
    st.both = !!(b.quiz && mentorType);              // quiz AND a mentor's approval
    if (st.kiosk) st.earned = true;
    else if (st.revoked) st.earned = false;
    else if (st.approved) st.earned = true;            // 2026-10-15: an approval always counts
    else st.earned = b.type === 'knowledge' && !!st.quizPass;
    return st;
  }
  function chip(cls, text) { var c = document.createElement('span'); c.className = 'pchip ' + cls; c.textContent = text; return c; }
  function when(at) { return at ? new Date(at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : ''; }
  function progressRow(b, st, extra) {
    var row = document.createElement('div'); row.className = 'prow' + (st.earned ? ' done' : '') + (b.checkpoint ? ' cp' : ''); row.setAttribute('data-badge', b.id);
    var main = document.createElement('div'); main.className = 'pmain';
    var nm = document.createElement('b'); nm.textContent = b.name;
    var subs = (PP.subs || []).filter(function (x) { return x.badge === b.id; });
    if (subs.length) {   // 2026-10-20: + opens this badge's submissions for the pilot
      var plus = document.createElement('button'); plus.type = 'button'; plus.className = 'pplus'; plus.textContent = '+ ' + subs.length; plus.title = 'Show ' + subs.length + ' submission' + (subs.length === 1 ? '' : 's');
      plus.onclick = function () {
        var open = row.querySelector('.psubs');
        if (open) { open.remove(); plus.textContent = '+ ' + subs.length; return; }
        var list = document.createElement('div'); list.className = 'psubs';
        subs.forEach(function (it) { list.appendChild(subEl(it, false)); });
        row.appendChild(list); plus.textContent = '− ' + subs.length;
      };
      nm.appendChild(plus);
    }
    var ty = document.createElement('span'); ty.className = 'ptype';
    ty.textContent = (b.checkpoint ? 'checkpoint · ' : '') + ({ knowledge: 'quiz', bench: 'bench', witnessed: 'witnessed', auto: 'auto' }[b.type] || b.type || '') + (st.both ? ' + quiz' : '');
    main.appendChild(nm); main.appendChild(ty);
    var chips = document.createElement('div'); chips.className = 'pchips';
    if (st.earned) chips.appendChild(chip('ok', 'earned'));
    else if (st.held) chips.appendChild(chip('warn', st.held));
    else if (st.revoked) chips.appendChild(chip('bad', 'revoked ' + when(st.aw.at)));
    else chips.appendChild(chip('', 'not yet'));
    if (st.kiosk) chips.appendChild(chip('src', 'kiosk'));
    if (st.approved) chips.appendChild(chip('src', 'approved ' + when(st.aw.at)));
    if (st.both) chips.appendChild(chip(st.quizPass ? 'src' : '', st.quizPass ? 'quiz ✓' : 'quiz ✗'));
    else if (b.type === 'knowledge' && st.quizPass) chips.appendChild(chip('src', 'quiz ✓'));
    if (st.revoked && st.earned) chips.appendChild(chip('bad', 'revoked ' + when(st.aw.at) + ' · ' + (ROSTER && st.aw.at > (ROSTER.generated || 0) ? 'kiosk not synced yet' : 'kiosk still shows it')));
    main.appendChild(chips);
    var det = document.createElement('div'); det.className = 'pdet';
    det.textContent = st.bits.concat(extra || []).concat(st.aw && st.aw.note ? ['note: “' + st.aw.note + '”'] : []).join(' · ');
    var acts = document.createElement('div'); acts.className = 'pacts';
    var msg = document.createElement('div'); msg.className = 'pmsg muted small';
    if (b.type !== 'auto') {
      var ok = document.createElement('button'); ok.textContent = st.approved ? 'Re-approve' : 'Approve'; ok.className = st.approved ? '' : 'primary flush';
      ok.onclick = function () { decideBadge(PP.name, b.id, 'earned', msg, ['console']); };
      acts.appendChild(ok);
    }
    if (st.kiosk || st.approved || st.earned) {
      var rv = document.createElement('button'); rv.textContent = 'Revoke'; rv.className = 'danger';
      rv.onclick = function () { if (window.confirm('Revoke ' + b.name + ' from ' + PP.name + '? Only do this for a mistake.')) decideBadge(PP.name, b.id, 'revoked', msg, ['console']); };
      acts.appendChild(rv);
    }
    row.appendChild(main); row.appendChild(acts);
    if (st.both && !st.quizPass && !st.kiosk) {
      var w = document.createElement('div'); w.className = 'pwarn';
      w.textContent = 'Quiz AND mentor approval: the quiz is not passed yet. You can still approve it (you will be asked to confirm) and it will count.';
      row.appendChild(w);
    }
    row.appendChild(det); row.appendChild(msg);
    return row;
  }
  function drawProgress() {
    var list = el('ppList'); list.textContent = '';
    var rp = rosterPilot(PP.slug), states = {};
    FS.BADGES.forEach(function (b) { states[b.id] = badgeState(b); });
    function head(text, sub) {
      var h = document.createElement('h3'); h.className = 'phead'; h.textContent = text;
      if (sub) { var s = document.createElement('span'); s.textContent = sub; h.appendChild(s); }
      list.appendChild(h);
    }
    var shown = {}, counted = 0, earnedN = 0;
    var tiers = FS.TIERS.filter(function (t) { return t.n >= 0; }).sort(function (a, b) { return a.n - b.n; });
    tiers.forEach(function (t, i) {
      var pre = FS.BADGES.filter(function (b) { return b.tier === t.id && !b.checkpoint; });
      var cps = FS.BADGES.filter(function (b) { return b.tier === t.id && b.checkpoint; });
      if (!pre.length && !cps.length) return;
      var nextN = t.n + 1, done = pre.filter(function (b) { return states[b.id].earned; }).length;
      if (pre.length) {
        head('Building to Tier ' + nextN, done + ' of ' + pre.length + ' · ' + (t.gear || t.name));
        pre.forEach(function (b) { shown[b.id] = 1; list.appendChild(progressRow(b, states[b.id])); });
      }
      cps.forEach(function (b) {
        shown[b.id] = 1;
        var left = pre.filter(function (m) { return !states[m.id].earned; });
        head('Tier ' + nextN + ' checkpoint', left.length ? left.length + ' prerequisite' + (left.length === 1 ? '' : 's') + ' still open' : 'every prerequisite done ✓');
        var row = progressRow(b, states[b.id], left.length ? ['still needs: ' + left.map(function (m) { return m.name; }).join(', ')] : []);
        if (left.length && !states[b.id].earned) {
          var w = document.createElement('div'); w.className = 'pwarn';
          w.textContent = 'Prerequisites not done - you can still file an approval (you will be asked to confirm), but it will not count until they are.';
          row.insertBefore(w, row.querySelector('.pdet'));
        }
        list.appendChild(row);
      });
    });
    FS.BADGES.forEach(function (b) { if (FS.counted(b) && shown[b.id]) { counted++; if (states[b.id].earned) earnedN++; } });
    // 2026-10-20: the Brophy Drone Certification (tier 'cl') - its own section, not bonus badges
    var cl = FS.BADGES.filter(function (b) { return b.tier === 'cl'; });
    if (cl.length) {
      var clDone = cl.filter(function (b) { return states[b.id].earned; }).length;
      head('Brophy Drone Certification', clDone + ' of ' + cl.length + ' · Flight Clearance on the website · not counted toward the tier');
      cl.forEach(function (b) { shown[b.id] = 1; list.appendChild(progressRow(b, states[b.id])); });
    }
    var bonus = FS.BADGES.filter(function (b) { return !shown[b.id]; });
    if (bonus.length) {
      head('Bonus badges', 'any order · not counted');
      bonus.forEach(function (b) { list.appendChild(progressRow(b, states[b.id])); });
    }
    el('ppSum').textContent = earnedN + ' of ' + counted + ' counted badges' +
      ' · ' + bonus.filter(function (b) { return states[b.id].earned; }).length + ' bonus' +
      (rp ? ' · Tier ' + (rp.tier != null ? rp.tier : '?') + ' at the kiosk · ' + (Math.round((rp.totalMs || 0) / 360000) / 10) + ' h in the sim'
          : ' · not on the kiosk roster (no snapshot badges or hours)') +
      (PP.prog && PP.prog.updated ? ' · website activity ' + when(PP.prog.updated) : '');
  }

  // ---------------------------------------------------------------- photo review (2026-10-08)
  // Pilots submit photos from flightschool/; the club API keeps them in the
  // private control repo. Reading the queue and deciding needs the review key
  // = hex SHA-256 of the instructor password (S.keyHex), sent as a header and
  // checked by the API against REVIEW_KEY_HASH (its SHA-256). Pass = the signed
  // award above plus the review record; Fail = the review record only.
  function reviewHeaders() { return { 'X-Review-Key': S.keyHex || '' }; }
  function loadReview(countOnly) {
    if (!S.keyHex) return;
    if (!countOnly) el('rvMsg').textContent = 'Loading…';
    api('GET', '/api/submission?review=1', null, reviewHeaders()).then(function (j) {
      var items = j.items || [];
      el('rvCount').textContent = items.length ? String(items.length) : '';
      el('rvSetup').hidden = true;
      if (countOnly) return;
      el('rvMsg').textContent = items.length ? items.length + ' submission' + (items.length === 1 ? '' : 's') + ' waiting, oldest first.' : 'Nothing waiting for review.';
      drawReview(items);
    }).catch(function (e) {
      if (e.status === 503) {
        sha256Hex(S.keyHex).then(function (h) {
          var box = el('rvSetup'); box.hidden = false; box.textContent = '';
          var p1 = document.createElement('div');
          p1.textContent = 'Photo review is not set up yet. On the brophy-fpv-club-api Netlify site, add the environment variable REVIEW_KEY_HASH with this value, then redeploy (it is a hash of a hash of the instructor password - safe to paste):';
          var c = document.createElement('code'); c.textContent = h;
          box.appendChild(p1); box.appendChild(c);
        });
        if (!countOnly) el('rvMsg').textContent = '';
        return;
      }
      if (!countOnly) el('rvMsg').textContent = 'Could not load the queue: ' + e.message;
    });
  }
  // 2026-10-10: ONE submission on stage (big photo, + / − zoom, pannable when
  // zoomed, Pass / Fail + note), the rest in a grid below; clicking a grid card
  // brings it up. After a decision the next waiting one comes up by itself.
  var RV = { cards: [], stage: null };
  function rvFocus(card) {
    if (!card || card === RV.stage) return;
    RV.stage = card; el('rvStage').textContent = ''; el('rvStage').appendChild(card);
    var list = el('rvList'); list.textContent = '';
    RV.cards.forEach(function (c) { c.classList.toggle('on', c === card); if (c !== card) list.appendChild(c); c.rvZoom(1); });   // every switch resets zoom
  }
  function rvNext(after) {
    var i = RV.cards.indexOf(after), rest = RV.cards.slice(i + 1).concat(RV.cards.slice(0, i));
    var nx = rest.filter(function (c) { return !c.classList.contains('decided'); })[0];
    if (nx) rvFocus(nx);
  }
  function zoomBox(ph, card) {
    var z = 1, zb = document.createElement('div'); zb.className = 'zoom';
    var minus = document.createElement('button'); minus.textContent = '−'; minus.title = 'Zoom out'; minus.setAttribute('aria-label', 'Zoom out');
    var plus = document.createElement('button'); plus.textContent = '+'; plus.title = 'Zoom in'; plus.setAttribute('aria-label', 'Zoom in');
    var lvl = document.createElement('span');
    zb.appendChild(minus); zb.appendChild(lvl); zb.appendChild(plus);
    card.rvZoom = function (to) {
      var img = ph.querySelector('img'), cx = 0.5, cy = 0.5;
      if (ph.scrollWidth > ph.clientWidth) cx = (ph.scrollLeft + ph.clientWidth / 2) / ph.scrollWidth;
      if (ph.scrollHeight > ph.clientHeight) cy = (ph.scrollTop + ph.clientHeight / 2) / ph.scrollHeight;
      z = Math.max(1, Math.min(6, to)); lvl.textContent = Math.round(z * 100) + '%';
      ph.classList.toggle('zoomed', z > 1); minus.disabled = z <= 1; plus.disabled = z >= 6;
      if (!img) return;
      img.style.width = z > 1 ? (z * 100) + '%' : ''; img.style.height = z > 1 ? 'auto' : '';
      if (z > 1) { ph.scrollLeft = cx * ph.scrollWidth - ph.clientWidth / 2; ph.scrollTop = cy * ph.scrollHeight - ph.clientHeight / 2; }
      else { ph.scrollLeft = ph.scrollTop = 0; }
    };
    minus.onclick = function (e) { e.stopPropagation(); card.rvZoom(z / 1.5); };
    plus.onclick = function (e) { e.stopPropagation(); card.rvZoom(z * 1.5); };
    // drag to pan when zoomed (scrollbars and the trackpad work too)
    var drag = null;
    ph.addEventListener('pointerdown', function (e) {
      if (z <= 1 || e.target.closest('.zoom')) return;
      drag = { x: e.clientX, y: e.clientY, l: ph.scrollLeft, t: ph.scrollTop }; ph.setPointerCapture(e.pointerId); ph.classList.add('drag');
    });
    ph.addEventListener('pointermove', function (e) { if (drag) { ph.scrollLeft = drag.l - (e.clientX - drag.x); ph.scrollTop = drag.t - (e.clientY - drag.y); } });
    function end() { drag = null; ph.classList.remove('drag'); }
    ph.addEventListener('pointerup', end); ph.addEventListener('pointercancel', end);
    return zb;
  }
  function drawReview(items) {
    var list = el('rvList'); list.textContent = ''; el('rvStage').textContent = '';
    RV.cards = []; RV.stage = null;
    items.forEach(function (it) {
      var bd = FS.BADGES.filter(function (x) { return x.id === it.badge; })[0];
      var card = document.createElement('div'); card.className = 'rv';
      var ph = document.createElement('div'); ph.className = 'ph';
      var phMsg = document.createElement('span'); phMsg.textContent = 'Loading photo…'; ph.appendChild(phMsg);
      var frame = document.createElement('div'); frame.className = 'frame';   // zoom buttons sit outside the scroller
      frame.appendChild(ph); frame.appendChild(zoomBox(ph, card));
      card.addEventListener('click', function () { if (card !== RV.stage) rvFocus(card); });
      RV.cards.push(card);
      var who = document.createElement('div'); who.innerHTML = '<b></b> · <span></span>';
      who.querySelector('b').textContent = it.pilot; who.querySelector('span').textContent = bd ? bd.name : it.badge;
      var meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = new Date(it.at).toLocaleString() + (it.note ? ' · “' + it.note + '”' : '');
      // 2026-10-20: a Drone Portfolio submission carries the drone (name, specs)
      // and a Google Drive flight video. Shown with the link, whether Drive
      // serves it publicly (its thumbnail loads only for a shareable file) and
      // an embedded player. A pass records the review and files the
      // Drone Portfolio badge (one drone approved = the badge).
      var extra = null;
      if (it.video && !it.drone) {   // 2026-10-27: Cinematography - the clip is a Drive link, there is no photo
        extra = document.createElement('div'); extra.className = 'drone';
        driveRow(extra, it.video, 'Open the clip ↗', 'clip');
      }
      if (it.drone) {
        extra = document.createElement('div'); extra.className = 'drone';
        var dn = document.createElement('b'); dn.textContent = it.drone.name || 'drone';
        var ds = document.createElement('span'); ds.textContent = it.drone.specs ? ' · ' + it.drone.specs : '';
        extra.appendChild(dn); extra.appendChild(ds);
        driveRow(extra, it.drone.video, 'Open the flight video ↗', 'flight video');
      }
      var isDrone = !!(bd && bd.kind === 'drone');
      var rule = checkRules(it.pilot, bd), warn = null;
      if (rule) { warn = document.createElement('div'); warn.className = 'warn'; warn.textContent = rule.stop || rule.ask.replace(/ Approve it anyway\? It will count\.$/, ''); }
      var note = document.createElement('input'); note.placeholder = 'Note to the pilot (say why, if it fails)'; note.maxLength = 300;
      var row = document.createElement('div'); row.className = 'row';
      var pass = document.createElement('button'); pass.className = 'primary'; pass.textContent = 'Pass';
      var fail = document.createElement('button'); fail.className = 'danger'; fail.textContent = 'Fail';
      row.appendChild(pass); row.appendChild(fail);
      [frame, who, meta].concat(extra ? [extra] : []).concat(warn ? [warn] : []).concat([note, row]).forEach(function (n) { card.appendChild(n); });
      if (!it.photo) { frame.hidden = true; } else
      api('GET', '/api/submission?photo=' + encodeURIComponent(it.photo), null, reviewHeaders()).then(function (j) {
        var img;
        if (j.type === 'application/pdf') {   // 2026-10-20: a TRUST certificate sent as a PDF
          img = document.createElement('embed'); img.type = 'application/pdf'; img.className = 'pdf';
        } else { img = document.createElement('img'); img.alt = 'photo from ' + it.pilot; img.draggable = false; }
        img.src = 'data:' + (j.type || 'image/jpeg') + ';base64,' + j.base64;
        phMsg.remove(); ph.insertBefore(img, ph.firstChild);
        if (card === RV.stage) card.rvZoom(1);
      }).catch(function (e) { phMsg.textContent = 'Could not load the photo: ' + e.message; });
      function decide(result) {
        pass.disabled = fail.disabled = true;
        var first = Promise.resolve();
        if (result === 'pass' && isDrone) {   // 2026-10-20: an approved drone = the Drone Portfolio badge on file (the kiosk catalogue has it)
          first = fileAward(it.pilot, 'drone-portfolio', 'earned', 'drone approved: ' + ((it.drone && it.drone.name) || 'drone') + (note.value.trim() ? ' - ' + note.value.trim() : ''), ['photo:' + it.id]);
        } else if (result === 'pass') {
          var r = checkRules(it.pilot, bd);
          if (r && r.stop) { window.alert(r.stop.replace(/ Not filed\.$/, ' Fail it with a note, or wait.')); pass.disabled = fail.disabled = false; return; }
          if (r && r.ask && !window.confirm(r.ask)) { pass.disabled = fail.disabled = false; return; }
          first = quizAsk(it.pilot, bd).then(function (ask) {
            if (ask && !window.confirm(ask)) throw Object.assign(new Error('not filed'), { quiet: true });
          }).then(function () { return fileAward(it.pilot, it.badge, 'earned', 'photo review' + (note.value.trim() ? ': ' + note.value.trim() : ''), ['photo:' + it.id]); });
        }
        first.then(function () {
          return api('POST', '/api/submission', { action: 'review', pilot: it.pilot, id: it.id, result: result, note: note.value.trim() }, reviewHeaders());
        }).then(function () {
          var d = document.createElement('div'); d.className = 'done ' + result;
          d.textContent = result === 'pass' ? (isDrone ? 'Approved - the drone is in the pilot\'s portfolio and the Drone Portfolio badge is on file.' : 'Passed - the badge is on file; the kiosks pick it up on their next sync.')
                                           : (isDrone ? 'Not approved - the pilot sees your note and can add the drone again.' : (it.video ? 'Failed - the pilot sees your note and can send a new link.' : 'Failed - the pilot sees your note and can send a new photo.'));
          row.replaceWith(d); note.disabled = true; card.classList.add('decided');
          setTimeout(function () { if (RV.stage === card) rvNext(card); }, 1500);
          var n = +(el('rvCount').textContent || 0) - 1; el('rvCount').textContent = n > 0 ? String(n) : '';
          if (result === 'pass') { ROSTER = null; loadRoster(); }
        }).catch(function (e) {
          pass.disabled = fail.disabled = false;
          if (!e.quiet) window.alert('Could not record it: ' + e.message);
        });
      }
      pass.onclick = function () { decide('pass'); };
      fail.onclick = function () { decide('fail'); };
    });
    rvFocus(RV.cards[0]);
  }
  // a Drive link, whether Drive serves it publicly (its thumbnail loads only
  // for a shareable file) and an embedded player
  function driveRow(box, url, label, title) {
    var vid = driveId(url), vrow = document.createElement('div'); vrow.className = 'video';
    if (!vid) { vrow.textContent = 'No usable Google Drive link: ' + (url || '(none)'); box.appendChild(vrow); return; }
    var va = document.createElement('a'); va.href = 'https://drive.google.com/file/d/' + encodeURIComponent(vid) + '/view'; va.target = '_blank'; va.rel = 'noopener'; va.textContent = label;
    var pub = document.createElement('span'); pub.className = 'pub'; pub.textContent = 'checking the link…';
    var probe = new Image(); probe.referrerPolicy = 'no-referrer';
    probe.onload = function () { pub.textContent = 'public ✓'; pub.className = 'pub ok'; };
    probe.onerror = function () { pub.textContent = 'NOT public - fail it and ask for "Anyone with the link"'; pub.className = 'pub bad'; };
    probe.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(vid) + '&sz=w200';
    var fr = document.createElement('iframe'); fr.src = 'https://drive.google.com/file/d/' + encodeURIComponent(vid) + '/preview'; fr.title = title; fr.loading = 'lazy'; fr.allow = 'autoplay; fullscreen';
    vrow.appendChild(va); vrow.appendChild(pub); box.appendChild(vrow); box.appendChild(fr);
  }
  function driveId(u) { var m = /\/file\/d\/([\w-]{15,})/.exec(String(u || '')) || /[?&]id=([\w-]{15,})/.exec(String(u || '')); return m ? m[1] : null; }
  function badgeInfo() {
    var b = FS.BADGES.filter(function (x) { return x.id === el('apBadge').value; })[0];
    el('apBadgeInfo').textContent = b ? ((b.minTier != null ? 'Tier ' + b.minTier + ' pilots only. ' : '') + (b.minHours ? 'Only after ' + b.minHours + ' h in the sim. ' : '') + (b.tier === 'el' ? 'Bonus badge. ' : '') + b.do + (b.standard ? ' — Standard: ' + b.standard : '')) : '';
  }
  function loadRoster() {
    fetch('../data.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      ROSTER = window.mergePilots ? window.mergePilots(d) : d;
      var dl = el('apPilots'); dl.textContent = '';
      (d.pilots || []).forEach(function (p) { var o = document.createElement('option'); o.value = p.name; dl.appendChild(o); });
      var box = el('apRoster'); box.textContent = '';
      var any = false;
      (d.pilots || []).forEach(function (p) {
        var div = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
        b.textContent = p.name;
        // 2026-10-10: sim hours always shown (they used to appear only for pilots with no badges)
        var t = document.createElement('i'); t.className = 'tier';
        t.textContent = (p.tier != null ? 'T' + p.tier + ' · ' : '') + ((p.totalMs || 0) / 3600000).toFixed(1) + ' h';
        b.appendChild(t);
        var badges = p.badges || [];
        if (badges.length) any = true;
        s.textContent = badges.length ? badges.map(badgeName).join(' · ') : 'no badges published by the kiosk';
        div.appendChild(b); div.appendChild(s); box.appendChild(div);
        div.title = 'Show ' + p.name + '’s progress';
        div.onclick = function () { el('apPilot').value = p.name; pickPilot(); el('pp').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      });
      el('apRosterNote').textContent = (any ? 'From the kiosk\'s last published snapshot (' + (d.generatedIso || '').slice(0, 16).replace('T', ' ') + ').'
        : 'The kiosk is not publishing badges yet (Flight School v2, Phase 3).') + ' Pick a name above (or click one here) to see their whole path and edit it.';
    }).catch(function (e) { el('apRosterNote').textContent = 'Could not load data.json: ' + e.message; });
  }

  // ---------------------------------------------------------------- boot
  el('app').hidden = false;
  drawApprovals();   // no key needed to build it; filing a decision still signs with the password
  el('go').onclick = signIn;
  el('pwShow').addEventListener('change', function () { el('pw').type = el('pwShow').checked ? 'text' : 'password'; });
  el('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
  el('refresh').onclick = loadStatus;
  el('rvRefresh').onclick = function () { loadReview(); };
  el('signout').onclick = signOut;
})();
