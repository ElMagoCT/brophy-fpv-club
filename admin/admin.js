/* Brophy FPV Club instructor console - see C:\BrophyUAV\remote\REMOTE.md.

   Talks ONLY to the club API (brophy-fpv-club-api.netlify.app). It holds no
   secret of its own: the instructor password is hashed on the spot, kept in
   memory only and never sent; its hex SHA-256 is the review key (X-Review-Key)
   for review, awards and the roster. Every command is signed with
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
        if (!r.ok || j.ok === false) { var e = new Error(j.error || ('API ' + r.status)); e.status = r.status; e.code = j.code || ''; e.body = j; throw e; }
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
  // 2026-11-25: BOTH checks run, every time. The API and the kiosks hold the
  // password separately (REVIEW_KEY_HASH on the API site, adminPasswordSha256 in
  // each kiosk's config.json). If they drift - the password changed on the
  // kiosks and not on the API, or the other way round - the API files approvals
  // that both kiosks throw away on every sync, the failure the four bad
  // approvals were. So:
  //   API right, a RUNNING kiosk (heartbeat under 6 h old) wrong -> signed in,
  //     approvals OFF, warning that the two keys differ;
  //   API wrong, a kiosk right -> signed in (kiosk commands work), approvals
  //     and review off, warning that REVIEW_KEY_HASH is out of date;
  //   API wrong, no kiosk right -> wrong password;
  //   API silent -> the kiosks decide, as before (an older heartbeat counts here).
  // A heartbeat over 6 h old that does not verify only warns: a kiosk switched
  // off before a password change would otherwise block approvals until it reports.
  // Resolves {ok: true|false|null (approvals on / off / nothing could tell),
  //           signIn: false only for a wrong password, warn: text or ''}.
  var FRESH_STATUS_MS = 6 * 3600000;
  function apiKeyCheck(keyHex) {   // true / false / null (review not set up, or no answer)
    return api('GET', '/api/submission?review=1', null, { 'X-Review-Key': keyHex }).then(function () { return true; },
      function (e) { return (e.status === 401 || e.status === 403) ? false : null; });
  }
  function kioskKeyCheck(key) {    // each kiosk's last signed heartbeat, verified with this password
    var out = { ok: [], bad: [], stale: [] };
    return Promise.all(MACHINES.map(function (m) {
      return readStatus(m).then(function (st) {
        if (!st || !st.sig) return;
        return crypto.subtle.sign('HMAC', key, enc.encode('v1s\n' + m + '\n' + st.data + '\n' + st.updated)).then(hex).then(function (sig) {
          if (sig === st.sig) out.ok.push(m);
          else (Date.now() - (Number(st.updated) || 0) < FRESH_STATUS_MS ? out.bad : out.stale).push(m);
        });
      }, function () {});
    })).then(function () { return out; });
  }
  function checkPassword(keyHex, key) {
    return Promise.all([apiKeyCheck(keyHex), kioskKeyCheck(key)]).then(function (r) {
      var a = r[0], k = r[1], both = function (l) { return l.join(' and '); };
      var setup = ' (club API README, "Setting the review key": REVIEW_KEY_HASH must be SHA-256 of the kiosks\' adminPasswordSha256; change both together)';
      if (a === true) {
        if (k.bad.length) return { ok: false, signIn: true, warn: 'the club API accepts this password but ' + both(k.bad) + ' does not, so the API\'s review key and the kiosks\' password differ. Approvals filed now would be thrown away by the kiosks; they are off until both match' + setup + '.' };
        return { ok: true, signIn: true, warn: k.stale.length ? both(k.stale) + '\'s last heartbeat (over 6 h old) does not verify with this password - if its password was changed on its own, it will reject approvals' + setup + '.' : '' };
      }
      if (a === false) {
        if (k.ok.length) return { ok: false, signIn: true, warn: 'this password is right for ' + both(k.ok) + ' but not for the club API: its REVIEW_KEY_HASH is out of date. Kiosk commands work; review and approvals are off until it matches' + setup + '.' };
        return { ok: false, signIn: false, warn: '' };
      }
      var badAny = k.bad.concat(k.stale);
      if (k.ok.length && badAny.length) return { ok: false, signIn: true, warn: both(k.ok) + ' accepts this password but ' + both(badAny) + ' does not: the kiosks\' passwords differ. Approvals are off until they match.' };
      if (k.ok.length) return { ok: true, signIn: true, warn: '' };
      if (badAny.length) return { ok: false, signIn: false, warn: '' };
      return { ok: null, signIn: true, warn: '' };
    });
  }
  function signIn() {
    var pw = el('pw').value, h0;
    el('signMsg').textContent = '';
    if (pw.length < 4) { el('signMsg').textContent = 'Enter the instructor password.'; return; }
    el('go').disabled = true; el('signMsg').textContent = 'Checking…';
    sha256Hex(pw).then(function (h) { h0 = h; return importKey(h); }).then(function (k) {
      return checkPassword(h0, k).then(function (c) {
        if (!c.signIn) { el('signMsg').textContent = 'Wrong password.'; el('pw').select(); return; }
        S.keyHex = h0; S.key = k; S.checked = c.ok === true; S.warn = c.warn; el('pw').value = ''; pw = null; el('signMsg').textContent = '';
        el('signin').hidden = true; el('console').hidden = false;
        showWho();
        el('signout').hidden = false;
        drawTabs(); drawActions(); loadStatus(); showView(); loadReview(true);
      });
    }).catch(function (e) { el('signMsg').textContent = e.message; }).then(function () { el('go').disabled = false; });
  }
  function signOut() { S.key = null; location.reload(); }
  function showWho() {
    el('who').textContent = S.checked ? 'Signed in · password checked · kept in this tab only' + (S.warn ? ' · Note: ' + S.warn : '')
      : S.warn ? 'Signed in · approvals are OFF: ' + S.warn + ' · kept in this tab only'
      : 'Signed in · password NOT checked (the club API\'s review check did not answer and no kiosk had a signed status to check it against) · approvals are off until it is checked · kept in this tab only';
  }
  // 2026-11-25: approvals are filed ONLY with a checked password. Four approvals
  // were signed with a password the console let in unchecked (the API's review
  // check did not answer); both kiosks reject them every sync while the website
  // showed them as earned. An unchecked sign-in can still send kiosk commands
  // (each kiosk verifies those itself), but an award is checked again here
  // first, and the API now verifies the key and the signature too.
  function passwordChecked() {
    if (!S.key || !S.keyHex) return Promise.reject(new Error('sign in first.'));
    if (S.checked) return Promise.resolve();
    return checkPassword(S.keyHex, S.key).then(function (c) {
      S.warn = c.warn;
      if (c.ok === true) { S.checked = true; showWho(); return; }
      showWho();
      throw new Error(!c.signIn ? 'the instructor password is wrong - sign out and sign in again. Nothing was filed.'
        : c.warn ? 'not filed - ' + c.warn
        : 'not filed - your password has not been checked yet (the club API\'s review check did not answer, and no kiosk had a signed status to check it against). A decision signed with an unchecked password is thrown away by both kiosks. Try again in a minute, or sign out and back in.');
    });
  }

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
  // The one signer for kiosk commands: files commands/<m>/<id>.json through the
  // API. Resolves {id, issuedAt, args} once the API has filed it.
  function postCommand(m, action, args, id) {
    var issuedAt = Date.now(), argsJson = JSON.stringify(args || {});
    id = id || randId();
    return hmac('v1\n' + m + '\n' + id + '\n' + action + '\n' + argsJson + '\n' + issuedAt).then(function (sig) {
      return api('POST', '/api/command', { id: id, machine: m, action: action, args: argsJson, issuedAt: issuedAt, sig: sig });
    }).then(function () { return { id: id, issuedAt: issuedAt, args: argsJson }; });
  }
  function send(action, args, label) {
    var m = S.machine, id = randId();
    var row = addResult(id, m, label);
    postCommand(m, action, args, id).then(function () {
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
  var KSNAP = null;   // the kiosks' data.json snapshot (hours, badges); the real roster is RS.list
  // Review photos is the first view (2026-10-10): no hash, or one we do not
  // know, opens it. #approvals and #kiosks still deep-link.
  function showView() {
    var ap = location.hash === '#approvals' || location.hash === '#pilots', ki = location.hash === '#kiosks', rv = !ap && !ki;
    el('approvals').hidden = !ap; el('review').hidden = !rv; el('kiosks').hidden = !ki;
    el('vKiosks').className = ki ? 'on' : ''; el('vApprovals').className = ap ? 'on' : ''; el('vReview').className = rv ? 'on' : '';
    if (rv && !KSNAP) loadSnap();
    if (ap) loadRoster();
    if (rv && S.key) loadReview();
    if (ap && S.key) loadAudit();
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
      if (kioskPilot(FS.slug(v)) || entryFor(FS.slug(v))) t = setTimeout(pickPilot, 150);
    });
    el('ppRefresh').onclick = function () { PP.slug = null; pickPilot(); };
    el('apAward').onclick = function () { award('earned'); };
    el('apRevoke').onclick = function () { if (window.confirm('Revoke this badge from the pilot? Only do this for a mistake.')) award('revoked'); };
  }
  // What is already on file for the typed pilot.
  function showHas() {
    var pilot = el('apPilot').value.trim(); el('apHas').textContent = '';
    if (pilot.length < 2) return;
    awardsAll(pilotKeys(pilot)).then(function (a) {
      var aw = a && a.badges ? a.badges : {};
      var earned = Object.keys(aw).filter(function (k) { return aw[k].status === 'earned' && trusted(aw[k]); });
      var bad = Object.keys(aw).filter(function (k) { return aw[k] && aw[k].verified === false; });
      el('apHas').textContent = (earned.length ? 'On file: ' + earned.map(badgeName).join(', ') : 'No sign-offs on file yet.') +
        (bad.length ? ' · NOT signed with the instructor password (the kiosks ignore it): ' + bad.map(function (k) { return badgeName(k) + ' ' + aw[k].status; }).join(', ') + ' - approve or revoke again' : '');
    }).catch(function (e) { el('apHas').textContent = e.message; });
  }
  function badgeName(id) { var b = FS.BADGES.filter(function (x) { return x.id === id; })[0]; return b ? b.name : id; }
  // 2026-11-25: decisions on file that do not verify with the instructor password
  // (GET /api/award?all=1 with the review key lists them as `untrusted`). Both
  // kiosks ignore them, but the public website still counts an untrusted
  // 'earned' one, so they are listed at the top of Pilots: open the pilot and
  // Approve or Revoke again, which files a properly signed decision over it.
  var AUDIT = { at: 0 };
  function loadAudit(force) {
    var box = el('apAudit');
    if (!S.checked || !S.keyHex) { box.hidden = true; return; }
    if (!force && Date.now() - AUDIT.at < 60000) return;
    AUDIT.at = Date.now();
    api('GET', '/api/award?all=1', null, reviewHeaders()).then(function (j) {
      var rows = [];
      Object.keys(j.pilots || {}).forEach(function (s) {
        var p = j.pilots[s];
        (p.untrusted || []).forEach(function (u) { rows.push({ name: p.name || s, badge: u.badge, status: u.status, at: u.at }); });
      });
      box.textContent = '';
      if (!rows.length) { box.hidden = true; return; }
      rows.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : a.at - b.at; });
      var h = document.createElement('h2'); h.textContent = rows.length + (rows.length === 1 ? ' decision on file is' : ' decisions on file are') + ' not signed with the instructor password';
      var p = document.createElement('p'); p.className = 'muted small';
      p.textContent = 'Both kiosks throw these away on every sync, but the website still shows an "earned" one. Open the pilot and Approve or Revoke the badge again: that files a properly signed decision over it.';
      var ul = document.createElement('ul');
      rows.forEach(function (r) {
        var li = document.createElement('li'), a = document.createElement('button');
        a.type = 'button'; a.className = 'linklike'; a.textContent = r.name;
        a.onclick = function () { el('apPilot').value = r.name; pickPilot(); el('pp').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        li.appendChild(a);
        li.appendChild(document.createTextNode(' · ' + badgeName(r.badge) + ' · ' + r.status + (r.at ? ' ' + new Date(r.at).toLocaleDateString() : '')));
        ul.appendChild(li);
      });
      box.appendChild(h); box.appendChild(p); box.appendChild(ul); box.hidden = false;
    }).catch(function () { box.hidden = true; AUDIT.at = 0; });
  }
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
  // The kiosk snapshot row(s) for a pilot key. With the roster loaded, every row
  // whose name matches the entry's slug or an alias is folded into one (hours
  // add up, badges are united), the same way the kiosk shows a merged pilot.
  function kioskPilot(s) {
    var e = entryFor(s), rows = e ? kioskRows(e) : snapRows().filter(function (r) { return FS.slug(r.name) === s; });
    return rows.length > 1 ? foldRows(rows) : rows[0];
  }
  function checkRules(pilot, bd) {
    if (!bd) return null;
    var rp = kioskPilot(FS.slug(pilot));
    if (bd.id === 'mentor' && FS.MENTOR_CAP) {
      var mentors = ((KSNAP && KSNAP.pilots) || []).filter(function (p) { return (p.badges || []).indexOf('mentor') >= 0 && FS.slug(p.name) !== FS.slug(pilot); });
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
  // 2026-11-25: only with a checked password (passwordChecked), and the POST
  // carries X-Review-Key: the API checks the key and the signature before filing.
  // The pilot name exactly as the API files it (2026-11-25): trimmed, at most 40
  // characters. The API checks the signature against the slug of THAT name, so
  // signing the slug of a longer name was refused as 'sig' (a password error for
  // a name problem). Kiosk names are at most 28, so recorded flights never hit it.
  function awardName(pilot) { return String(pilot || '').trim().slice(0, 40); }
  function fileAward(pilot, badge, status, note, evidence) {
    return passwordChecked().then(function () {
      var p = awardName(pilot), at = Date.now(), s = FS.slug(p);
      return hmac('v1a\n' + s + '\n' + badge + '\n' + status + '\n' + at).then(function (sig) {
        return api('POST', '/api/award', { pilot: p, badge: badge, status: status, at: at, note: note, evidence: evidence, sig: sig }, reviewHeaders());
      });
    });
  }
  // A pilot's decisions on file. Signed in with a checked password, the API
  // verifies each record (verified: true|false); a decision that does not
  // verify was not signed with the instructor password and both kiosks ignore
  // it. Falls back to the plain read if review is not set up (503).
  function awardsOf(pilot) {
    var path = '/api/award?pilot=' + encodeURIComponent(awardName(pilot));
    if (!S.checked || !S.keyHex) return api('GET', path);
    return api('GET', path, null, reviewHeaders()).catch(function (e) { if (e.status === 503) return api('GET', path); throw e; });
  }
  function trusted(r) { return !!r && r.verified !== false; }
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
      : progressAll(pilotKeys(pilot)).catch(function () { return null; });
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
        PP.awards.badges[badge] = { status: status, at: Date.now(), note: note, verified: true };
        var y = window.scrollY; drawProgress(); window.scrollTo(0, y);
        var row = el('ppList').querySelector('[data-badge="' + badge + '"] .pmsg');
        if (row) row.textContent = msg.textContent;
      }
      showHas(); loadAudit(true);
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
  function loadPilotSubs(keys) {
    if (!S.keyHex) return Promise.resolve(null);
    return api('GET', '/api/submission?review=all', null, reviewHeaders()).then(function (j) {
      return (j.items || []).filter(function (it) { return keys.indexOf(FS.slug(it.pilot)) >= 0; }).sort(function (a, b) { return b.at - a.at; });
    }, function () { return null; });
  }
  // 2026-11-26: a roster entry's record is spread over its slug AND every alias
  // (a merge folds a name in, but the award and progress files keep their old
  // slug). Read each key and merge: newest decision per badge; for progress the
  // union of finished lessons and ticks and the best quiz score.
  function pilotKeys(name) { var s = FS.slug(name), e = entryFor(s); return e ? keysOf(e) : [s]; }
  function mergeAwards(list) {
    var out = null;
    list.forEach(function (a) {
      if (!a || !a.badges) return;
      if (!out) out = { name: a.name, badges: {} };
      Object.keys(a.badges).forEach(function (id) {
        var r = a.badges[id], c = out.badges[id];
        if (r && (!c || (+r.at || 0) > (+c.at || 0))) out.badges[id] = r;
      });
    });
    return out;
  }
  function mergeProg(list) {
    var out = null;
    list.forEach(function (p) {
      if (!p) return;
      if (!out) out = { name: p.name, lessons: {}, steps: {}, quizzes: {}, updated: 0 };
      out.updated = Math.max(out.updated, +p.updated || 0);
      Object.keys(p.lessons || {}).forEach(function (id) {
        var l = p.lessons[id] || {}, c = out.lessons[id];
        if (!c) { out.lessons[id] = { status: l.status, score: +l.score || 0, at: l.at }; return; }
        if (l.status === 'complete') c.status = 'complete'; else if (c.status !== 'complete' && l.status) c.status = l.status;
        c.score = Math.max(+c.score || 0, +l.score || 0);
      });
      Object.keys(p.steps || {}).forEach(function (b) {
        var t = out.steps[b] = out.steps[b] || {};
        Object.keys(p.steps[b] || {}).forEach(function (i) { if (p.steps[b][i] && !t[i]) t[i] = p.steps[b][i]; });
      });
      Object.keys(p.quizzes || {}).forEach(function (b) {
        var q = p.quizzes[b] || {}, c = out.quizzes[b];
        if (!c || (+q.best || 0) > (+c.best || 0)) out.quizzes[b] = q;
      });
    });
    return out;
  }
  function awardsAll(keys) {
    return Promise.all(keys.map(function (k, i) {
      var got = awardsOf(k).then(function (j) { return j.awards || null; });
      return i ? got.catch(function () { return null; }) : got;   // an alias file that fails to load does not hide the rest
    })).then(mergeAwards);
  }
  function progressAll(keys) {
    return Promise.all(keys.map(function (k, i) {
      var got = api('GET', '/api/progress?pilot=' + encodeURIComponent(k)).then(function (j) { return j.progress || null; });
      return i ? got.catch(function () { return null; }) : got;
    })).then(mergeProg);
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
    if (!it.photo && it.flight) { flightInto(box, it); return; }   // 2026-11-25: a recorded kiosk flight
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
    revokeAll(PP_FLIGHT_URLS);
    PP.slug = s; PP.name = name; PP.awards = PP.prog = PP.subs = null; PP.loaded = false; el('ppDocs').textContent = '';
    el('pp').hidden = false; el('ppName').textContent = name + ' · progress';
    el('ppMsg').textContent = 'Loading…'; el('ppList').textContent = ''; el('ppSum').textContent = '';
    var keys = pilotKeys(name);
    Promise.all([
      awardsAll(keys),
      progressAll(keys),
      loadPilotSubs(keys),
      loadSnap()
    ]).then(function (r) {
      if (PP.slug !== s) return;
      PP.awards = r[0]; PP.prog = r[1]; PP.subs = r[2]; PP.loaded = true; el('ppMsg').textContent = ''; drawDocs(); drawProgress();
    }).catch(function (e) { if (PP.slug === s) { el('ppMsg').textContent = 'Could not load progress: ' + e.message; PP.slug = null; } });
  }
  // Everything known about one badge for the picked pilot. Mirrors the rules
  // Flight School uses (kiosk wins; an approval counts; a revoke clears; a quiz
  // at FS.PASS earns a quiz badge) so the console and the pilot see the same.
  function badgeState(b) {
    var rp = kioskPilot(PP.slug), pr = PP.prog || {}, aws = (PP.awards && PP.awards.badges) || {};
    var lessons = pr.lessons || {}, aw = aws[b.id] || null;
    // 2026-11-25: a decision that does not verify (verified:false) is not one: the kiosks ignore it
    var st = { kiosk: !!(rp && rp.badges && rp.badges.indexOf(b.id) >= 0), aw: aw, untrusted: !!(aw && aw.verified === false),
               approved: !!(aw && aw.status === 'earned' && trusted(aw)), revoked: !!(aw && aw.status === 'revoked' && trusted(aw)),
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
    if (!ls.length && FS.resLessons) ls = FS.resLessons(b);   // 2026-11-26: converted badges keep their lessons as resources
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
        return !!rt[FS.tickKey(r, i)];   // 2026-11-25: ticks are stored by the box's key, not its index
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
    if (st.untrusted) {
      var uc = chip('bad', st.aw.status + ' ' + when(st.aw.at) + ' · bad signature');
      uc.title = 'This decision on file was not signed with the instructor password, so both kiosks ignore it. Approve or Revoke again to file a properly signed one.';
      chips.appendChild(uc);
    }
    if (st.both) chips.appendChild(chip(st.quizPass ? 'src' : '', st.quizPass ? 'quiz ✓' : 'quiz ✗'));
    else if (b.type === 'knowledge' && st.quizPass) chips.appendChild(chip('src', 'quiz ✓'));
    if (st.revoked && st.earned) chips.appendChild(chip('bad', 'revoked ' + when(st.aw.at) + ' · ' + (KSNAP && st.aw.at > (KSNAP.generated || 0) ? 'kiosk not synced yet' : 'kiosk still shows it')));
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
    var rp = kioskPilot(PP.slug), states = {};
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

  // ---------------------------------------------------------------- recorded flights (2026-11-25)
  // A kiosk's 60 s Sim Flight recording. GET /api/flight?id= streams it (review
  // key, like the photos); it plays from a blob: URL (CSP media-src blob:). The
  // URLs are revoked when the review list is redrawn, or another pilot is picked.
  var FLIGHT_URLS = [], PP_FLIGHT_URLS = [];
  function revokeAll(list) { while (list.length) { try { URL.revokeObjectURL(list.pop()); } catch (e) { /* already gone */ } } }
  function mb(bytes) { return (Math.round((+bytes || 0) / 100000) / 10) + ' MB'; }
  // MediaRecorder files can report an Infinity duration (no index at the end):
  // seek far past the end once, which makes the browser find it, then back to 0.
  function fixDuration(video) {
    if (video.durFix) return;
    video.durFix = true;
    video.addEventListener('loadedmetadata', function () {
      if (isFinite(video.duration)) return;
      video.addEventListener('timeupdate', function back() { video.removeEventListener('timeupdate', back); video.currentTime = 0; });
      video.currentTime = 1e101;
    });
  }
  function loadFlightInto(video, msg, it, bucket) {
    msg.className = 'msg'; msg.textContent = 'Loading the flight (' + mb(it.flight && it.flight.bytes) + ')…';
    return fetch(API + '/api/flight?id=' + encodeURIComponent(it.id), { headers: reviewHeaders(), cache: 'no-store' }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; });
      return r.blob();
    }).then(function (b) {
      // The API streams without a Content-Length, so a body cut short mid-stream
      // is caught here: the size the kiosk uploaded is in flight.bytes.
      var want = +(it.flight && it.flight.bytes) || 0;
      if (want && b.size !== want) throw new Error('only ' + mb(b.size) + ' of ' + mb(want) + ' arrived');
      var u = URL.createObjectURL(b);
      (bucket || FLIGHT_URLS).push(u);
      fixDuration(video);
      // The whole file is in memory already, so preload costs nothing - and it
      // makes the browser decode the first frame (loadeddata), which Pass waits for.
      video.preload = 'auto';
      if (!video.errWatch) {
        video.errWatch = true;
        video.addEventListener('error', function () {
          msg.className = 'msg err';
          msg.textContent = 'This browser could not play the recording (' + ((video.error && video.error.code) || '?') + '). Try Chrome or Edge, or fail it with a note.';
        });
      }
      video.src = u; msg.textContent = '';
    }).catch(function (e) {
      msg.className = 'msg err'; msg.textContent = 'Could not load the flight: ' + e.message;
      if (e.status !== 404 && e.status !== 410) {   // gone stays gone; anything else (a slow link, a timeout) can be retried
        var again = document.createElement('button'); again.type = 'button'; again.textContent = 'Try again';
        again.onclick = function (ev) { ev.stopPropagation(); loadFlightInto(video, msg, it, bucket); };
        msg.appendChild(again);
      }
    });
  }
  // What the mentor judges against: the badge's own words from flightschool/badges.js,
  // read defensively (do, then standard, then the requirement boxes, then the rule).
  function standardEl(bd) {
    if (!bd) return null;
    var d = document.createElement('div'); d.className = 'std small';
    if (bd.do) { var p = document.createElement('div'); p.textContent = bd.do; d.appendChild(p); }
    if (bd.standard) { var sd = document.createElement('div'); sd.textContent = 'Standard: ' + bd.standard; d.appendChild(sd); }
    var reqs = (Array.isArray(bd.reqs) ? bd.reqs : []).map(function (r) { return typeof r === 'string' ? r : (r && r.t) || ''; }).filter(Boolean);
    if (reqs.length) {
      var ul = document.createElement('ul');
      reqs.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      d.appendChild(ul);
    }
    if (bd.rule) { var ru = document.createElement('div'); ru.className = 'muted'; ru.textContent = bd.rule; d.appendChild(ru); }
    return d.childNodes.length ? d : null;
  }
  // The review card's flight: what was recorded, the standard, and the player.
  // Nothing is fetched until the card is on stage (card.rvLoad, called by rvFocus).
  function flightBox(card, it, bd) {
    var f = it.flight || {}, box = document.createElement('div'); box.className = 'flight';
    var line = document.createElement('div'), t = document.createElement('b');
    t.textContent = 'Recorded flight'; line.appendChild(t);
    var bits = [f.simName || f.sim || 'sim', f.machine, (f.secs || Math.round((f.durationMs || 0) / 1000)) + ' s', mb(f.bytes),
                f.recordedAt ? new Date(f.recordedAt).toLocaleString() : ''].filter(function (x) { return !!x; });
    line.appendChild(document.createTextNode(' · ' + bits.join(' · ') + (f.simHours != null ? ' · ' + f.simHours + ' h in the sims' : '')));
    box.appendChild(line);
    var std = standardEl(bd || FS.BADGES.filter(function (x) { return x.id === 'proficient-flight'; })[0]);
    if (std) box.appendChild(std);
    var video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.setAttribute('playsinline', '');
    var msg = document.createElement('span'); msg.className = 'msg';
    box.appendChild(video); box.appendChild(msg);
    var loaded = false;
    card.rvLoad = function () { if (!loaded) { loaded = true; loadFlightInto(video, msg, it); } };
    card.rvVideo = video;
    return box;
  }
  // Pilots tab, a badge's "+ N" list: the flight's summary and a Play button (no autoload).
  function flightInto(box, it) {
    var f = it.flight || {};
    box.textContent = ''; box.classList.add('fl');
    var t = document.createElement('div'); t.textContent = 'Recorded flight · ' + (f.simName || f.sim || 'sim') + ' · ' + (f.secs || '?') + ' s';
    var play = document.createElement('button'); play.type = 'button'; play.className = 'pplay'; play.textContent = 'Play';
    play.onclick = function (e) {
      e.stopPropagation();
      var video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.setAttribute('playsinline', '');
      video.addEventListener('click', function (ev) { ev.stopPropagation(); });
      var msg = document.createElement('span'); msg.className = 'msg';
      box.textContent = ''; box.classList.add('full'); box.appendChild(video); box.appendChild(msg);
      loadFlightInto(video, msg, it, PP_FLIGHT_URLS);
    };
    box.appendChild(t); box.appendChild(play);
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
    if (RV.stage && RV.stage.rvVideo) RV.stage.rvVideo.pause();
    RV.stage = card; el('rvStage').textContent = ''; el('rvStage').appendChild(card);
    var list = el('rvList'); list.textContent = '';
    RV.cards.forEach(function (c) { c.classList.toggle('on', c === card); if (c !== card) list.appendChild(c); c.rvZoom(1); });   // every switch resets zoom
    if (card.rvLoad) card.rvLoad();   // 2026-11-25: a recorded flight (~10 MB) is fetched only once it is on stage
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
    revokeAll(FLIGHT_URLS);
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
      if (it.flight) extra = flightBox(card, it, bd);   // 2026-11-25: a Sim Flight recording from a kiosk
      if (it.drone) {
        extra = document.createElement('div'); extra.className = 'drone';
        var dn = document.createElement('b'); dn.textContent = it.drone.name || 'drone';
        var ds = document.createElement('span'); ds.textContent = it.drone.specs ? ' · ' + it.drone.specs : '';
        extra.appendChild(dn); extra.appendChild(ds);
        driveRow(extra, it.drone.video, 'Open the flight video ↗', 'flight video');
      }
      var isDrone = !!(bd && bd.kind === 'drone'), isFlight = !!it.flight;
      var rule = checkRules(it.pilot, bd), warn = null;
      if (rule) { warn = document.createElement('div'); warn.className = 'warn'; warn.textContent = rule.stop || rule.ask.replace(/ Approve it anyway\? It will count\.$/, ''); }
      var note = document.createElement('input'); note.placeholder = isFlight ? 'Note to the pilot (required if it fails)' : 'Note to the pilot (say why, if it fails)'; note.maxLength = 300;
      var noteWarn = document.createElement('div'); noteWarn.className = 'warn'; noteWarn.hidden = true;   // a failed flight needs a reason
      note.addEventListener('input', function () { noteWarn.hidden = true; });
      var row = document.createElement('div'); row.className = 'row';
      var pass = document.createElement('button'); pass.className = 'primary'; pass.textContent = 'Pass';
      var fail = document.createElement('button'); fail.className = 'danger'; fail.textContent = 'Fail';
      row.appendChild(pass); row.appendChild(fail);
      // 2026-11-25: a recorded flight can only be passed once its video has
      // actually loaded (loadeddata = a frame is decoded), so nobody passes a
      // flight they could not watch. Fail stays available (gone, unplayable).
      var watched = !isFlight, gate = null;
      function live() { fail.disabled = false; pass.disabled = !watched; }
      if (isFlight) {
        pass.disabled = true; pass.title = 'Pass unlocks once the flight video has loaded';
        gate = document.createElement('span'); gate.className = 'muted small gate'; gate.textContent = 'Pass unlocks once the video loads.';
        row.appendChild(gate);
        card.rvVideo.addEventListener('loadeddata', function () {
          watched = true; pass.title = ''; if (gate) { gate.remove(); gate = null; }
          if (!card.classList.contains('decided') && fail.disabled === false) pass.disabled = false;
        });
      }
      [frame, who, meta].concat(extra ? [extra] : []).concat(warn ? [warn] : []).concat([note, noteWarn, row]).forEach(function (n) { card.appendChild(n); });
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
        if (result === 'pass' && !watched) return;                  // 2026-11-25: not before the video loaded
        if (result === 'fail' && isFlight && !note.value.trim()) {   // 2026-11-25: the pilot is told why
          noteWarn.textContent = 'Write why it failed - the pilot sees this'; noteWarn.hidden = false; note.focus();
          live(); return;
        }
        pass.disabled = fail.disabled = true;
        var first = Promise.resolve();
        if (result === 'pass' && isDrone) {   // 2026-10-20: an approved drone = the Drone Portfolio badge on file (the kiosk catalogue has it)
          first = fileAward(it.pilot, 'drone-portfolio', 'earned', 'drone approved: ' + ((it.drone && it.drone.name) || 'drone') + (note.value.trim() ? ' - ' + note.value.trim() : ''), ['photo:' + it.id]);
        } else if (result === 'pass') {
          var r = checkRules(it.pilot, bd);
          if (r && r.stop) { window.alert(r.stop.replace(/ Not filed\.$/, ' Fail it with a note, or wait.')); live(); return; }
          if (r && r.ask && !window.confirm(r.ask)) { live(); return; }
          first = quizAsk(it.pilot, bd).then(function (ask) {
            if (ask && !window.confirm(ask)) throw Object.assign(new Error('not filed'), { quiet: true });
          }).then(function () {
            return fileAward(it.pilot, it.badge, 'earned', (isFlight ? 'flight review' : 'photo review') + (note.value.trim() ? ': ' + note.value.trim() : ''), [(isFlight ? 'flight:' : 'photo:') + it.id]);
          });
        }
        first.then(function () {
          return api('POST', '/api/submission', { action: 'review', pilot: it.pilot, id: it.id, result: result, note: note.value.trim() }, reviewHeaders());
        }).then(function () {
          var d = document.createElement('div'); d.className = 'done ' + result;
          d.textContent = result === 'pass' ? (isDrone ? 'Approved - the drone is in the pilot\'s portfolio and the Drone Portfolio badge is on file.'
                                              : isFlight ? 'Passed - ' + (bd ? bd.name : 'the badge') + ' is on file; the kiosks pick it up on their next sync.'
                                              : 'Passed - the badge is on file; the kiosks pick it up on their next sync.')
                                           : (isDrone ? 'Not approved - the pilot sees your note and can add the drone again.'
                                              : isFlight ? 'Failed - the pilot sees your note and can record again another day.'
                                              : (it.video ? 'Failed - the pilot sees your note and can send a new link.' : 'Failed - the pilot sees your note and can send a new photo.'));
          row.replaceWith(d); note.disabled = true; noteWarn.hidden = true; card.classList.add('decided');
          if (card.rvVideo) card.rvVideo.pause();
          setTimeout(function () { if (RV.stage === card) rvNext(card); }, 1500);
          var n = +(el('rvCount').textContent || 0) - 1; el('rvCount').textContent = n > 0 ? String(n) : '';
          if (result === 'pass') { KSNAP = null; SNAP_P = null; loadSnap(); }
        }).catch(function (e) {
          live();
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
  // ---------------------------------------------------------------- roster (2026-11-26)
  // RS.list = every roster entry from GET /api/roster with the review key
  // ({slug, name, pids, aliases, status, at, by, mergedInto?}); null when the
  // API has no roster yet (404) or refused the key, and then RS.off says why in
  // one line and the list falls back to the kiosk snapshot. Every write is a
  // POST /api/roster {action,...} with the review key, behind passwordChecked()
  // like approvals. Names only ever reach the page through textContent.
  var RS = { list: null, off: '', sel: null, mode: null, other: '', keep: '', showRemoved: false, armed: false };
  // 2026-11-26: login tools. GET /api/auth/config says the mode; with it off (or
  // no auth route at all) PIN code and Link account never appear. A PIN code is
  // shown once and kept only in this variable, never in storage.
  var AU = { mode: 'off', off: '', code: null };
  var USER_RE = /^[a-z0-9][a-z0-9._-]{1,39}$/;
  var SNAP_P = null, NEW_MS = 7 * 86400000;
  var BY = { web: 'web', seed: 'seed', mentor: 'mentor' };
  function snapRows() { return (KSNAP && KSNAP.pilots) || []; }
  function loadSnap() {
    if (KSNAP) return Promise.resolve(KSNAP);
    if (!SNAP_P) SNAP_P = fetch('../data.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { KSNAP = window.mergePilots ? window.mergePilots(d) : d; return KSNAP; }, function (e) { SNAP_P = null; throw e; });
    return SNAP_P;
  }
  function keysOf(p) { return [p.slug].concat(p.aliases || []); }
  function kioskRows(p) { var ks = keysOf(p); return snapRows().filter(function (r) { return ks.indexOf(FS.slug(r.name)) >= 0; }); }
  function entryFor(s) {   // an active entry wins over a removed one holding the same key
    var hits = (RS.list || []).filter(function (p) { return keysOf(p).indexOf(s) >= 0; });
    return hits.filter(function (p) { return p.status !== 'removed'; })[0] || hits[0] || null;
  }
  function foldRows(rows) {
    var out = { name: rows[0].name, totalMs: 0, badges: [], tier: null };
    rows.forEach(function (r) {
      out.totalMs += r.totalMs || 0;
      (r.badges || []).forEach(function (b) { if (out.badges.indexOf(b) < 0) out.badges.push(b); });
      if (r.tier != null && (out.tier == null || r.tier > out.tier)) out.tier = r.tier;
    });
    return out;
  }
  function bySlug(s) { return (RS.list || []).filter(function (p) { return p.slug === s; })[0] || null; }
  // The kiosk's own name rule (Format-PilotName / cleanPilot), checked here so a
  // typo gets a plain answer before anything is sent; the API checks it again.
  function nameProblem(n) {
    if (n.length < 2 || n.length > 28) return 'Names are 2 to 28 characters.';
    if (/["'<>&\u0000-\u001f\u007f]/.test(n)) return 'Names cannot have quotes or < > &.';
    if ((n.match(/[A-Za-z0-9]/g) || []).length < 2) return 'A name needs at least 2 letters or digits.';
    return '';
  }
  function rosterError(e) {
    var p = e.body && e.body.pilot;
    switch (e.code) {
      case 'slug-change': return 'That is a different name. Have them join under the new name, then use Same person as.';
      case 'taken': return 'Already on the roster' + (p && p.name ? ' as ' + p.name : '') + '.';
      case 'removed': return 'A removed pilot has that name. Show removed and restore them instead.';
      case 'bad-name': return 'That name will not work: 2 to 28 characters, no quotes or < > &.';
      case 'full': return 'The roster is full (200 pilots). Remove someone first.';
    }
    if (e.status === 404) return 'This club API cannot do that yet.';
    return e.message;
  }
  function rosterPost(body) {
    return passwordChecked().then(function () { return api('POST', '/api/roster', body, reviewHeaders()); });
  }
  function fetchRoster() {
    if (!S.keyHex) { RS.list = null; RS.off = ''; return Promise.resolve(); }
    return api('GET', '/api/roster', null, reviewHeaders()).then(function (j) {
      var ps = j.pilots || [];
      if (ps.length && ps[0].status === undefined) { RS.list = null; RS.off = 'Roster tools are off: the club API sent only the public roster (review key not accepted).'; return; }
      RS.list = ps; RS.off = '';
    }, function (e) {
      RS.list = null;
      RS.off = e.status === 404 ? 'Roster tools are off: this club API has no roster yet. Showing the kiosk snapshot.'
        : (e.status === 401 || e.status === 403) ? 'Roster tools are off: the club API refused the review key.'
        : 'Roster tools are off: could not load the roster (' + e.message + ').';
    });
  }
  function fetchAuth() {
    return api('GET', '/api/auth/config').then(function (j) {
      AU.mode = j.mode === 'optional' || j.mode === 'required' ? j.mode : 'off'; AU.off = '';
    }, function (e) {
      AU.mode = 'off';
      AU.off = e.status === 404 ? 'Login tools are off: this club API has no sign-in yet.' : '';
    });
  }
  function authOn() { return AU.mode !== 'off'; }
  function dot(t) { return t.replace(/\.\.$/, '.'); }   // "Ava P." + "." reads once
  function loadRoster() {
    return Promise.all([loadSnap().catch(function () { return null; }), fetchRoster(), fetchAuth()]).then(drawRoster);
  }
  function authPost(route, body) {
    return passwordChecked().then(function () { return api('POST', '/api/auth/' + route, body, reviewHeaders()); });
  }
  function authError(e) {
    switch (e.code) {
      case 'login-off': return 'Sign-in is off on the club API.';
      case 'bad-user': return 'A username is 2 to 40 letters, digits, dots, dashes or underscores.';
      case 'busy': return 'The API was busy. Try again.';
    }
    if (e.status === 404) return 'This club API cannot do that yet.';
    return rosterError(e);
  }
  function aliasError(e) {
    switch (e.code) {
      case 'is-entry': return 'That name is its own roster entry. Use Same person as instead.';
      case 'bad-alias': return 'An alias is a name like sawyer-murphy.';
      case 'merged': return 'That name was merged in, so it stays.';
    }
    return rosterError(e);
  }
  function hoursOf(rows) { return rows.reduce(function (t, r) { return t + (r.totalMs || 0); }, 0) / 3600000; }
  function tag(cls, text) { var t = document.createElement('span'); t.className = 'rtag ' + cls; t.textContent = text; return t; }
  function pickName(name) { el('apPilot').value = name; pickPilot(); }
  function drawRoster() {
    var box = el('rsList'), q = FS.slug(el('rsFilter').value), now = Date.now();
    box.textContent = '';
    el('rsOff').textContent = RS.off; el('rsOff').hidden = !RS.off;
    el('rsAuthOff').textContent = RS.list ? AU.off : ''; el('rsAuthOff').hidden = !RS.list || !AU.off;
    el('rsAdd').hidden = el('rsRemovedL').hidden = !RS.list;
    // the Approve form's name list: roster names first, then kiosk names
    var dl = el('apPilots'), seen = {}; dl.textContent = '';
    (RS.list || []).filter(function (p) { return p.status !== 'removed'; }).map(function (p) { return p.name; })
      .concat(snapRows().map(function (r) { return r.name; })).forEach(function (n) {
        if (seen[FS.slug(n)]) return; seen[FS.slug(n)] = 1;
        var o = document.createElement('option'); o.value = n; dl.appendChild(o);
      });
    if (!RS.list) { drawSnapOnly(box, q); return; }
    var active = RS.list.filter(function (p) { return p.status !== 'removed'; });
    var gone = RS.list.length - active.length;
    var fresh = active.filter(function (p) { return now - (p.at || 0) < NEW_MS; }).length;
    el('rsCount').textContent = active.length + (fresh ? ' · ' + fresh + ' new this week' : '');
    el('rsRemovedL').lastChild.textContent = ' Show removed' + (gone ? ' (' + gone + ')' : '');
    var shown = RS.list.filter(function (p) {
      if (p.status === 'removed' && !RS.showRemoved && p.slug !== RS.sel) return false;   // a just-removed pilot stays in view, with Restore
      return !q || keysOf(p).some(function (k) { return k.indexOf(q) >= 0; });
    }).sort(function (a, b) { return (b.at || 0) - (a.at || 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
    if (!shown.length) { var none = document.createElement('div'); none.className = 'muted small rnone'; none.textContent = q ? 'No pilot matches.' : 'Nobody on the roster yet.'; box.appendChild(none); }
    shown.forEach(function (p) {
      var rows = kioskRows(p), k = rows.length ? foldRows(rows) : null;
      var r = document.createElement('div'); r.className = 'rrow' + (p.status === 'removed' ? ' gone' : '') + (RS.sel === p.slug ? ' on' : '');
      var head = document.createElement('button'); head.type = 'button'; head.className = 'rhead';
      var nm = document.createElement('b'); nm.textContent = p.name; head.appendChild(nm);
      if (now - (p.at || 0) < NEW_MS && p.status !== 'removed') head.appendChild(tag('new', 'new'));
      if (BY[p.by]) head.appendChild(tag('by', BY[p.by]));
      if (p.status === 'removed') head.appendChild(tag('bad', p.mergedInto ? 'merged' : 'removed'));
      var stat = document.createElement('span'); stat.className = 'rstat';
      stat.textContent = k ? (k.tier != null ? 'T' + k.tier + ' · ' : '') + hoursOf(rows).toFixed(1) + ' h · ' + k.badges.length + ' badge' + (k.badges.length === 1 ? '' : 's') : 'not on a kiosk yet';
      head.appendChild(stat);
      head.onclick = function () {
        var open = RS.sel !== p.slug;
        RS.sel = open ? p.slug : null; RS.mode = null; RS.armed = false; RS.other = ''; RS.keep = ''; AU.code = null; el('rsNote').textContent = '';
        drawRoster();
        if (open) pickName(p.name);
      };
      r.appendChild(head);
      var flash = RS.sel === p.slug && RS.flash;
      if (RS.sel === p.slug) r.appendChild(rosterPanel(p));
      box.appendChild(r);
      if (flash) setTimeout(function () { r.scrollIntoView({ block: 'nearest' }); }, 0);   // after a change, keep its row in view
    });
    // kiosk names that no roster entry claims (before seeding, or a typo on a sim)
    var claimed = {};
    RS.list.forEach(function (p) { keysOf(p).forEach(function (k) { claimed[k] = 1; }); });
    var loose = snapRows().filter(function (r) { return !claimed[FS.slug(r.name)]; });
    var lz = el('rsLoose'); lz.textContent = '';
    if (loose.length) {
      lz.appendChild(document.createTextNode('On a kiosk, not on the roster: '));
      loose.forEach(function (r, i) {
        var a = document.createElement('button'); a.type = 'button'; a.className = 'linkish'; a.textContent = r.name;
        a.onclick = function () { pickName(r.name); el('pp').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        if (i) lz.appendChild(document.createTextNode(', '));
        lz.appendChild(a);
      });
    }
  }
  // Older API (or no key): the old "who holds what" list from the kiosk snapshot.
  function drawSnapOnly(box, q) {
    var rows = snapRows().filter(function (r) { return !q || FS.slug(r.name).indexOf(q) >= 0; });
    el('rsCount').textContent = snapRows().length ? snapRows().length + ' on the kiosks' : '';
    el('rsLoose').textContent = KSNAP ? 'Kiosk snapshot from ' + (KSNAP.generatedIso || '').slice(0, 16).replace('T', ' ') + '.' : 'Could not load data.json.';
    rows.forEach(function (p) {
      var r = document.createElement('div'); r.className = 'rrow';
      var head = document.createElement('button'); head.type = 'button'; head.className = 'rhead';
      var nm = document.createElement('b'); nm.textContent = p.name; head.appendChild(nm);
      var stat = document.createElement('span'); stat.className = 'rstat';
      stat.textContent = (p.tier != null ? 'T' + p.tier + ' · ' : '') + ((p.totalMs || 0) / 3600000).toFixed(1) + ' h · ' + (p.badges || []).length + ' badges';
      head.appendChild(stat);
      head.onclick = function () { pickName(p.name); el('pp').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      r.appendChild(head); box.appendChild(r);
    });
  }
  function btn(text, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (cls) b.className = cls; b.onclick = fn; return b; }
  function rosterPanel(p) {
    var pan = document.createElement('div'); pan.className = 'rpanel';
    var bar = document.createElement('div'); bar.className = 'row wrapline';
    var msg = document.createElement('div'); msg.className = 'small rmsg';
    function mode(m) { return function () { RS.mode = RS.mode === m ? null : m; RS.armed = false; RS.focus = true; AU.code = null; drawRoster(); }; }
    function busy(on) { pan.querySelectorAll('button,input,select').forEach(function (x) { x.disabled = on; }); }
    function run(body, keepSel, okText) {
      msg.className = 'small rmsg'; msg.textContent = 'Saving…';
      pan.querySelectorAll('button,input,select').forEach(function (x) { x.disabled = true; });
      return rosterPost(body).then(function () {
        RS.sel = keepSel; RS.mode = null; RS.armed = false; RS.flash = okText;
        return fetchRoster().then(drawRoster);
      }).catch(function (e) {
        pan.querySelectorAll('button,input,select').forEach(function (x) { x.disabled = false; });
        msg.className = 'small rmsg bad'; msg.textContent = rosterError(e);
      });
    }
    bar.appendChild(btn('Show path', '', function () { pickName(p.name); el('pp').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    if (p.status === 'removed') {
      var into = p.mergedInto && bySlug(p.mergedInto);
      if (p.mergedInto) {
        var m = document.createElement('span'); m.className = 'muted small';
        m.textContent = 'Same person as ' + (into ? into.name : p.mergedInto) + '. Their hours count there.';
        bar.appendChild(m);
      } else bar.appendChild(btn('Restore', 'primary flush', function () { run({ action: 'restore', slug: p.slug }, p.slug, p.name + ' is back on the sims.'); }));
    } else {
      bar.appendChild(btn('Rename', RS.mode === 'rename' ? 'on' : '', mode('rename')));
      bar.appendChild(btn('Same person as…', RS.mode === 'merge' ? 'on' : '', mode('merge')));
      bar.appendChild(btn('Aliases', RS.mode === 'alias' ? 'on' : '', mode('alias')));
      if (authOn()) {
        bar.appendChild(btn('PIN code', RS.mode === 'code' ? 'on' : '', function () {
          if (RS.mode === 'code') { mode('code')(); return; }
          RS.mode = 'code'; AU.code = null; drawRoster();
          var m2 = el('rsList').querySelector('.rrow.on .rmsg');
          if (m2) { m2.className = 'small rmsg'; m2.textContent = 'Making a code…'; }
          authPost('code', { slug: p.slug }).then(function (j) {
            if (RS.sel !== p.slug || RS.mode !== 'code') return;
            AU.code = { slug: p.slug, code: String(j.code || ''), exp: +j.exp || 0 }; drawRoster();
          }).catch(function (e) {
            var m3 = el('rsList').querySelector('.rrow.on .rmsg');
            if (m3) { m3.className = 'small rmsg bad'; m3.textContent = authError(e); }
          });
        }));
        bar.appendChild(btn('Link account', RS.mode === 'link' ? 'on' : '', mode('link')));
      }
      bar.appendChild(btn('Hours', RS.mode === 'hours' ? 'on' : '', mode('hours')));
      bar.appendChild(btn('Reset hours', 'danger' + (RS.mode === 'reset' ? ' on' : ''), mode('reset')));
      bar.appendChild(btn('Remove', 'danger' + (RS.mode === 'remove' ? ' on' : ''), mode('remove')));
    }
    var info = document.createElement('span'); info.className = 'muted small rinfo';
    info.textContent = [(p.pids || []).length > 1 ? (p.pids.length + ' kiosk profiles') : '', (p.aliases || []).length ? 'also ' + p.aliases.join(', ') : '',
      p.at ? 'since ' + new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ');
    bar.appendChild(info);
    pan.appendChild(bar);

    var sub = document.createElement('div'); sub.className = 'row wrapline rsub';
    if (RS.mode === 'rename') {
      var inp = document.createElement('input'); inp.value = p.name; inp.maxLength = 28; inp.spellcheck = false; inp.autocomplete = 'off';
      var save = btn('Save name', 'primary flush', function () {
        var n = inp.value.trim().replace(/\s+/g, ' ');
        if (n === p.name) { msg.textContent = 'That is the same name.'; return; }
        var bad = nameProblem(n); if (bad) { msg.className = 'small rmsg bad'; msg.textContent = bad; return; }
        run({ action: 'rename', slug: p.slug, name: n }, p.slug, 'Renamed to ' + n + '.');
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save.click(); });
      var h = document.createElement('span'); h.className = 'muted small'; h.textContent = 'Case and punctuation only.';
      sub.appendChild(inp); sub.appendChild(save); sub.appendChild(h);
      if (RS.focus) { RS.focus = false; setTimeout(function () { inp.focus(); inp.select(); }, 0); }
    } else if (RS.mode === 'alias') {
      (p.aliases || []).forEach(function (a) {
        var chipA = document.createElement('span'); chipA.className = 'ralias';
        var t0 = document.createElement('span'); t0.textContent = a; chipA.appendChild(t0);
        var x = btn('×', 'rx', function () {
          busy(true); msg.className = 'small rmsg'; msg.textContent = 'Saving…';
          rosterPost({ action: 'unalias', slug: p.slug, alias: a }).then(function () {
            RS.flash = a + ' no longer counts as ' + p.name + '.'; return fetchRoster().then(drawRoster);
          }).catch(function (e) { busy(false); msg.className = 'small rmsg bad'; msg.textContent = aliasError(e); });
        });
        x.title = 'Unlink ' + a; x.setAttribute('aria-label', 'Unlink ' + a);
        chipA.appendChild(x); sub.appendChild(chipA);
      });
      var ai = document.createElement('input'); ai.placeholder = 'Old name, e.g. Sawyer M'; ai.maxLength = 48; ai.spellcheck = false; ai.autocomplete = 'off';
      var addA = btn('Add alias', 'primary flush', function () {
        var a = FS.slug(ai.value);
        if (a.length < 2) { msg.className = 'small rmsg bad'; msg.textContent = 'Type the old name.'; return; }
        busy(true); msg.className = 'small rmsg'; msg.textContent = 'Saving…';
        rosterPost({ action: 'alias', slug: p.slug, alias: a }).then(function () {
          RS.flash = a + ' now counts as ' + p.name + '.'; return fetchRoster().then(drawRoster);
        }).catch(function (e) { busy(false); msg.className = 'small rmsg bad'; msg.textContent = aliasError(e); });
      });
      ai.addEventListener('keydown', function (e) { if (e.key === 'Enter') addA.click(); });
      var ah = document.createElement('span'); ah.className = 'muted small rsay';
      ah.textContent = dot('An old name from a kiosk or award file. Its badges and hours count for ' + p.name + '.');
      sub.appendChild(ai); sub.appendChild(addA); sub.appendChild(ah);
      if (RS.focus) { RS.focus = false; setTimeout(function () { ai.focus(); }, 0); }
    } else if (RS.mode === 'code') {
      if (AU.code && AU.code.slug === p.slug) {
        var big = document.createElement('span'); big.className = 'pincode'; big.textContent = AU.code.code.replace(/^(\d{3})(\d{3})$/, '$1 $2');
        var ex = document.createElement('span'); ex.className = 'small rsay';
        ex.textContent = 'For ' + p.name + ', once, until ' + new Date(AU.code.exp).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) +
          '. They type it on the site with a username and PIN they pick.';
        sub.appendChild(big); sub.appendChild(ex);
      }
    } else if (RS.mode === 'link') {
      var ui = document.createElement('input'); ui.placeholder = 'School username'; ui.maxLength = 64; ui.spellcheck = false; ui.autocomplete = 'off';
      var link = btn('Link', 'primary flush', function () {
        var u = ui.value.trim().toLowerCase().replace(/@.*$/, '');
        if (!USER_RE.test(u)) { msg.className = 'small rmsg bad'; msg.textContent = 'A username is 2 to 40 letters, digits, dots, dashes or underscores.'; return; }
        busy(true); msg.className = 'small rmsg'; msg.textContent = 'Linking…';
        authPost('link', { slug: p.slug, username: u }).then(function () {
          busy(false); ui.value = ''; msg.className = 'small rmsg ok'; msg.textContent = dot(u + ' now signs in as ' + p.name + '.');
        }).catch(function (e) { busy(false); msg.className = 'small rmsg bad'; msg.textContent = authError(e); });
      });
      ui.addEventListener('keydown', function (e) { if (e.key === 'Enter') link.click(); });
      var lh = document.createElement('span'); lh.className = 'muted small'; lh.textContent = 'Moves it here if another pilot had it.';
      sub.appendChild(ui); sub.appendChild(link); sub.appendChild(lh);
      if (RS.focus) { RS.focus = false; setTimeout(function () { ui.focus(); }, 0); }
    } else if (RS.mode === 'hours') {
      hoursForm(p, sub, msg, busy);
    } else if (RS.mode === 'reset') {
      resetForm(p, sub, msg, busy);
    } else if (RS.mode === 'remove') {
      var t = document.createElement('span'); t.className = 'small';
      t.textContent = 'Hide ' + p.name + ' from the sims and pickers? Their hours are kept, and Restore brings them back.';
      sub.appendChild(t);
      sub.appendChild(btn('Remove ' + p.name, 'danger solid', function () { run({ action: 'remove', slug: p.slug }, p.slug, p.name + ' removed. Hours kept.'); }));
    } else if (RS.mode === 'merge') {
      var others = RS.list.filter(function (o) { return o.status !== 'removed' && o.slug !== p.slug; })
        .sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      var sel = document.createElement('select');
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Pick the other entry…'; sel.appendChild(o0);
      others.forEach(function (o) { var op = document.createElement('option'); op.value = o.slug; op.textContent = o.name + ' (' + o.slug + ')'; sel.appendChild(op); });
      sel.value = RS.other;
      sel.onchange = function () { RS.other = sel.value; RS.keep = ''; drawRoster(); };
      sub.appendChild(sel);
      var other = RS.other && bySlug(RS.other);
      if (other) {
        var pair = [p, other];
        var kl = document.createElement('span'); kl.className = 'small'; kl.textContent = 'Keep:'; sub.appendChild(kl);
        pair.forEach(function (x) {
          sub.appendChild(btn(x.name, RS.keep === x.slug ? 'on' : '', function () { RS.keep = x.slug; drawRoster(); }));
        });
        var keep = RS.keep && bySlug(RS.keep);
        if (keep) {
          var fold = keep === p ? other : p;
          var say = document.createElement('div'); say.className = 'small rsay';
          say.textContent = keep.name + ' stays and ' + fold.name + ' goes away. One pilot; their hours add up.';
          sub.appendChild(say);
          sub.appendChild(btn('Merge', 'primary flush', function () { run({ action: 'merge', slug: fold.slug, into: keep.slug }, keep.slug, fold.name + ' merged into ' + keep.name + '.'); }));
        }
      }
    }
    if (sub.childNodes.length) pan.appendChild(sub);
    if (RS.flash) { msg.className = 'small rmsg ok'; msg.textContent = RS.flash.replace(/\.\.$/, '.'); RS.flash = ''; }
    pan.appendChild(msg);
    return pan;
  }
  // ---------------------------------------------------------------- hours
  // 2026-11-27: hours corrections moved off the sim's password-protected editor.
  // The console files a signed hours.adjust / hours.reset command for ONE kiosk
  // through postCommand (same signature as every kiosk command); that kiosk's
  // sync agent hands it to its bridge, which applies it once through the sim
  // editor's own code path. Hours are kept per kiosk and summed through the
  // ledgers, so an adjust goes to the kiosk that should hold the time and a
  // reset goes to both. Only with a checked password, like approvals.
  // 2026-11-27 review fixes: a send that got no clear answer keeps its command id
  // (HC.pend / HC.rp, per pilot) so sending again files the SAME command: the API
  // answers already:true for a repeat and the kiosk applies an id once. Results
  // are written only on the card of the pilot they belong to; anywhere else they
  // go to that pilot's list and to #rsNote with the name in front.
  var PCS = [{ m: 'KIOSK-A', t: 'FPV Sim 1' }, { m: 'KIOSK-B', t: 'FPV Sim 2' }];
  var MAX_MIN = 720, NOTE_MAX = 80, HC_KEY = 'fpv.admin.hours.v1', ARM_MS = 700;
  var HC = { pc: PCS[0].m, sim: '', dir: 'add', sent: {}, pend: {}, rp: {}, rnote: {} };
  try { HC.sent = JSON.parse(sessionStorage.getItem(HC_KEY) || '{}') || {}; } catch (e) { HC.sent = {}; }
  function pcName(m) { var x = PCS.filter(function (c) { return c.m === m; })[0]; return x ? x.t : m; }
  function pcList(ms) { return ms.map(pcName).join(' and '); }
  function simList() { return ((KSNAP && KSNAP.sims) || []).filter(function (s) { return s && s.id; }); }
  function simName(id) { var x = simList().filter(function (s) { return s.id === id; })[0]; return x ? x.name : id; }
  function cleanNote(t) { return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX); }
  function fmtH(ms) { return ((ms || 0) / 3600000).toFixed(1) + ' h'; }
  function endDot(t) { t = String(t || '').trim(); return /[.!?]$/.test(t) ? t : t + '.'; }
  function remember(slug, rec) {
    (HC.sent[slug] = HC.sent[slug] || []).unshift(rec);
    HC.sent[slug] = HC.sent[slug].slice(0, 20);
    try { sessionStorage.setItem(HC_KEY, JSON.stringify(HC.sent)); } catch (e) { /* memory only */ }
  }
  // File one command under the id kept in rec.ids[m]. A 409 means that id is on
  // file for a different command, so this one was not filed: take a new id once.
  function postKept(rec, m, action, args) {
    return postCommand(m, action, args, rec.ids[m]).catch(function (e) {
      if (!e || e.status !== 409) throw e;
      rec.ids[m] = randId();
      return postCommand(m, action, args, rec.ids[m]);
    });
  }
  // Where a result for pilot p goes: that pilot's open card, else #rsNote with the name.
  function tell(p, text, ok) {
    var m = RS.sel === p.slug && el('rsList').querySelector('.rrow.on .rmsg');
    if (m) { m.className = 'small rmsg ' + (ok ? 'ok' : 'bad'); m.textContent = text; return; }
    var n = el('rsNote'); n.className = 'small rsnote ' + (ok ? 'ok' : 'bad'); n.textContent = p.name + ': ' + text;
  }
  function done(p, text) {   // success: flash on the pilot's own card, or the note above the list
    if (RS.sel === p.slug) { RS.flash = text; drawRoster(); return; }
    tell(p, text, true);
  }
  function commandError(e) {
    if (e && e.name === 'TypeError') return 'Could not reach the club API. Check the connection and send again.';
    var t = String((e && e.message) || '');
    if (/unknown action/.test(t)) return 'The club API does not take hours corrections yet. Nothing was sent.';
    if (/too old/.test(t)) return 'This computer\'s clock is more than 10 minutes off. Fix the clock, then send again.';
    if (e && e.status === 429) return 'The club API is busy. Wait a minute and send again.';
    if (e && e.status === 404) return 'This club API cannot do that yet.';
    return t || 'Something went wrong. Nothing was sent.';
  }
  // No answer, or a server error: the command may have been filed anyway.
  function unclear(e) { return !e || e.name === 'TypeError' || !e.status || e.status >= 500; }
  function notSent(e) { var t = String((e && e.message) || ''); return 'Not sent: ' + t.replace(/^not filed - /, '').replace(/ Nothing was filed\.$/, ''); }
  // This pilot's hours per simulator. data.json only has both sim PCs summed, so
  // the console cannot say which PC the time was flown on.
  function hoursLine(p) {
    var per = {}, rows = kioskRows(p), d = document.createElement('div'); d.className = 'small hrs';
    rows.forEach(function (r) { Object.keys(r.perSimMs || {}).forEach(function (k) { per[k] = (per[k] || 0) + (+r.perSimMs[k] || 0); }); });
    if (!KSNAP) { d.textContent = 'Could not load data.json, so hours and the simulator list are missing. Press Refresh.'; return d; }
    if (!rows.length) { d.textContent = 'No sim time yet.'; return d; }
    var tot = document.createElement('b'); tot.textContent = fmtH(hoursOf(rows) * 3600000); d.appendChild(tot);
    simList().forEach(function (s) {
      var c = document.createElement('span'); c.className = 'hsim' + ((per[s.id] || 0) >= 180000 ? '' : ' zero');
      c.textContent = s.name + ' ' + fmtH(per[s.id]); d.appendChild(c);
    });
    var asof = document.createElement('span'); asof.className = 'muted';
    asof.textContent = 'both sim PCs together, as of ' + (KSNAP.generatedIso || '').slice(0, 16).replace('T', ' ');
    d.appendChild(asof);
    return d;
  }
  function sentList(p) {
    var list = HC.sent[p.slug] || [], box = document.createElement('div'); box.className = 'hsent small';
    if (!list.length) return box;
    var h = document.createElement('div'); h.className = 'muted';
    h.textContent = 'Sent from this tab (the club API cannot list sent commands, so this list is kept for this tab only):';
    box.appendChild(h);
    list.forEach(function (r) {
      var li = document.createElement('div'); li.className = 'hitem' + (r.unclear ? ' bad' : '');
      var w = new Date(r.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      var what = r.kind === 'reset' ? 'reset to zero on ' + pcList(r.machines)
        : (r.deltaMs > 0 ? 'added ' : 'took away ') + Math.abs(r.deltaMs / 60000) + ' min of ' + simName(r.simId) + ' on ' + pcName(r.machines[0]);
      li.textContent = (r.unclear ? 'No clear answer ' : 'Sent ') + w + ': ' + what + ' · "' + r.note + '"' +
        (r.failed && r.failed.length ? ' · NOT sent to ' + pcList(r.failed) : '');
      box.appendChild(li);
    });
    return box;
  }
  function sel(opts, value, onch) {
    var s = document.createElement('select');
    opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
    if (value != null) s.value = value;
    s.onchange = function () { onch(s.value); };
    return s;
  }
  function hoursForm(p, sub, msg, busy) {
    sub.classList.add('hform');
    sub.appendChild(hoursLine(p));
    var sims = simList();
    if (!sims.length) { sub.appendChild(sentList(p)); return; }
    var pend = HC.pend[p.slug], dr = pend && pend.draft;
    if (dr) { HC.pc = dr.pc; HC.sim = dr.sim; HC.dir = dr.dir; }
    if (!HC.sim || !sims.some(function (s) { return s.id === HC.sim; })) HC.sim = sims[0].id;
    var mins = document.createElement('input'), note = document.createElement('input');
    // the kept command id holds only while the form says the same thing
    function values() { return { pc: HC.pc, sim: HC.sim, dir: HC.dir, mins: mins.value.trim(), note: cleanNote(note.value) }; }
    function changed() {
      var q = HC.pend[p.slug]; if (!q) return;
      var v = values(), d = q.draft;
      if (v.pc !== d.pc || v.sim !== d.sim || v.dir !== d.dir || v.mins !== d.mins || v.note !== d.note) delete HC.pend[p.slug];
    }
    var pc = sel(PCS.map(function (c) { return [c.m, c.t]; }), HC.pc, function (v) { HC.pc = v; changed(); });
    var sm = sel(sims.map(function (s) { return [s.id, s.name]; }), HC.sim, function (v) { HC.sim = v; changed(); });
    var dir = sel([['add', 'Add'], ['sub', 'Take away']], HC.dir, function (v) { HC.dir = v; changed(); });
    mins.type = 'number'; mins.min = '1'; mins.max = String(MAX_MIN); mins.step = '1';
    mins.placeholder = 'min'; mins.className = 'hmin'; mins.setAttribute('aria-label', 'Minutes');
    var ml = document.createElement('span'); ml.className = 'small muted'; ml.textContent = 'min';
    note.placeholder = 'Reason, e.g. timer ran while away'; note.maxLength = NOTE_MAX;
    note.className = 'hnote'; note.autocomplete = 'off'; note.setAttribute('aria-label', 'Reason');
    if (dr) { mins.value = dr.mins; note.value = dr.note; }
    mins.addEventListener('input', changed); note.addEventListener('input', changed);
    pc.setAttribute('aria-label', 'Sim PC'); sm.setAttribute('aria-label', 'Simulator'); dir.setAttribute('aria-label', 'Add or take away');
    var go = btn('Send', 'primary flush', function () {
      var v = values(), n = Number(v.mins), why = v.note;
      msg.className = 'small rmsg bad';
      if (!/^\d+$/.test(v.mins) || n < 1 || n > MAX_MIN) { msg.textContent = 'Minutes: a whole number from 1 to ' + MAX_MIN + '.'; mins.focus(); return; }
      if (why.length < 2) { msg.textContent = 'Write a short reason.'; note.focus(); return; }
      var deltaMs = (v.dir === 'sub' ? -1 : 1) * n * 60000;
      var args = { slug: p.slug, simId: v.sim, deltaMs: deltaMs, note: why }, m = v.pc, aj = JSON.stringify(args);
      var q = HC.pend[p.slug];
      if (!q || q.machine !== m || q.args !== aj) q = HC.pend[p.slug] = { machine: m, args: aj, ids: {}, draft: v };
      q.ids[m] = q.ids[m] || randId();
      busy(true); msg.className = 'small rmsg'; msg.textContent = 'Sending…';
      passwordChecked().then(function () {
        return postKept(q, m, 'hours.adjust', args).then(function (c) {
          if (HC.pend[p.slug] === q) delete HC.pend[p.slug];
          remember(p.slug, { at: c.issuedAt, kind: 'adjust', machines: [m], simId: args.simId, deltaMs: deltaMs, note: why, ids: [c.id] });
          done(p, 'Sent. The sim applies it within a couple of minutes while it is on.');
        }, function (e) {
          busy(false);
          if (!unclear(e)) { if (HC.pend[p.slug] === q) delete HC.pend[p.slug]; tell(p, commandError(e), false); return; }
          if (RS.sel !== p.slug) remember(p.slug, { at: Date.now(), kind: 'adjust', machines: [m], simId: args.simId, deltaMs: deltaMs, note: why, ids: [q.ids[m]], unclear: true });
          tell(p, endDot(commandError(e)) + ' Send again goes as the same command, so it cannot count twice.', false);
        });
      }, function (e) { busy(false); tell(p, notSent(e), false); });
    });
    note.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
    mins.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
    var line = document.createElement('div'); line.className = 'row wrapline hline';
    [pc, sm, dir, mins, ml, note, go].forEach(function (x) { line.appendChild(x); });
    sub.appendChild(line);
    var help = document.createElement('div'); help.className = 'muted small';
    help.textContent = '1 to ' + MAX_MIN + ' minutes, never below zero. Taking time away only removes time that was flown on that sim PC, and a correction lands within a couple of minutes while that PC is on.';
    sub.appendChild(help);
    if (pend) {
      var pn = document.createElement('div'); pn.className = 'small hwarn';
      pn.textContent = 'The last send got no clear answer. Send again goes as the same command, so it cannot count twice.';
      sub.appendChild(pn);
    }
    sub.appendChild(sentList(p));
    if (RS.focus) { RS.focus = false; setTimeout(function () { mins.focus(); }, 0); }
  }
  function resetForm(p, sub, msg, busy) {
    sub.classList.add('hform');
    sub.appendChild(hoursLine(p));
    var rp = HC.rp[p.slug], half = rp && rp.miss.length && rp.miss.length < PCS.length;
    var say = document.createElement('div'); say.className = 'small rsay hwarn';
    say.textContent = dot('Sets ' + p.name + '\'s simulator hours to zero on both sims (FPV Sim 1 and FPV Sim 2). Lessons, badges and the profile stay. This cannot be undone.') +
      ' A sim PC that stays off for a month never gets it.';
    sub.appendChild(say);
    var note = document.createElement('input'); note.placeholder = 'Reason'; note.maxLength = NOTE_MAX; note.className = 'hnote';
    note.autocomplete = 'off'; note.setAttribute('aria-label', 'Reason');
    note.value = half ? rp.note : (HC.rnote[p.slug] || '');
    note.addEventListener('input', function () { HC.rnote[p.slug] = note.value; });
    var line = document.createElement('div'); line.className = 'row wrapline hline';
    line.appendChild(note);
    // Send to the kiosks in rec.miss, one after the other, so a failure names the PC it missed.
    function fire(rec, again) {
      var args = { slug: p.slug, note: rec.note }, to = rec.miss.slice(), sent = [], ids = [], firstErr = null, at = Date.now();
      busy(true); msg.className = 'small rmsg'; msg.textContent = 'Sending…';
      passwordChecked().then(function () {
        return to.reduce(function (chain, m) {
          return chain.then(function () {
            return postKept(rec, m, 'hours.reset', args).then(function (r) {
              ids.push(r.id); sent.push(m); rec.miss = rec.miss.filter(function (x) { return x !== m; });
            }, function (e) { firstErr = firstErr || e; });
          });
        }, Promise.resolve()).then(function () {
          var failed = rec.miss.slice(), mine = RS.sel === p.slug;
          if (sent.length) remember(p.slug, { at: at, kind: 'reset', machines: sent, note: rec.note, ids: ids, failed: failed });
          else if (!mine && unclear(firstErr)) remember(p.slug, { at: at, kind: 'reset', machines: failed, note: rec.note, ids: failed.map(function (m) { return rec.ids[m]; }), failed: [], unclear: true });
          if (!failed.length) {
            if (HC.rp[p.slug] === rec) delete HC.rp[p.slug];
            delete HC.rnote[p.slug];
            if (mine) { RS.mode = 'reset'; RS.armed = false; }
            done(p, again ? 'Sent to ' + pcList(sent) + ' too, so both sims have been sent the reset.'
              : 'Sent to both sims. Each applies it within a couple of minutes while it is on.');
            return;
          }
          if (mine) { RS.armed = false; drawRoster(); }
          var held = PCS.map(function (c) { return c.m; }).filter(function (m) { return failed.indexOf(m) < 0; });
          tell(p, held.length
            ? 'Sent to ' + pcList(held) + ' only. ' + pcList(failed) + ' did not get it: ' + endDot(commandError(firstErr)) +
              ' Reset again sends it to ' + pcList(failed) + ' only, as the same command.'
            : unclear(firstErr) ? endDot(commandError(firstErr)) + ' Sending again goes as the same command, so it cannot count twice.'
              : 'Not sent: ' + commandError(firstErr), false);
        });
      }, function (e) { busy(false); tell(p, notSent(e), false); });
    }
    if (half) {
      note.readOnly = true;
      line.appendChild(btn('Reset again on ' + pcList(rp.miss) + ' only', 'danger solid', function (e) {
        if (e && e.detail > 1) return;
        fire(rp, true);
      }));
      sub.appendChild(line);
      var hs = document.createElement('div'); hs.className = 'row wrapline hline';
      var ht = document.createElement('span'); ht.className = 'small hwarn';
      ht.textContent = pcList(rp.miss) + ' did not get this reset. ' + pcList(PCS.map(function (c) { return c.m; }).filter(function (m) { return rp.miss.indexOf(m) < 0; })) + ' has been sent it.';
      hs.appendChild(ht);
      hs.appendChild(btn('Forget it', '', function () { delete HC.rp[p.slug]; drawRoster(); }));
      sub.appendChild(hs);
      sub.appendChild(sentList(p));
      return;
    }
    var first = btn('Reset ' + p.name + '\'s hours', 'danger' + (RS.armed ? ' on' : ''), function () {
      if (cleanNote(note.value).length < 2) { msg.className = 'small rmsg bad'; msg.textContent = 'Write a short reason.'; note.focus(); return; }
      RS.armed = true; RS.armedAt = Date.now(); drawRoster();
    });
    first.disabled = !!RS.armed;   // armed: the second click of a double click lands here and does nothing
    line.appendChild(first);
    sub.appendChild(line);
    if (RS.armed) {
      // The confirm row sits on its own line below, never where the first button was.
      var conf = document.createElement('div'); conf.className = 'row wrapline hline hconf';
      var sure = document.createElement('span'); sure.className = 'small hwarn';
      sure.textContent = 'Sure? Both sims, all of ' + p.name + '\'s time, for good.';
      conf.appendChild(sure);
      conf.appendChild(btn('Yes, reset on both sims', 'danger solid', function (e) {
        if (e && e.detail > 1) return;                        // part of a double click
        if (Date.now() - (RS.armedAt || 0) < ARM_MS) return;  // too soon after arming to be a decision
        var why = cleanNote(note.value);
        if (why.length < 2) { msg.className = 'small rmsg bad'; msg.textContent = 'Write a short reason.'; return; }
        var aj = JSON.stringify({ slug: p.slug, note: why }), rec = HC.rp[p.slug];
        if (!rec || rec.args !== aj) {
          rec = HC.rp[p.slug] = { args: aj, note: why, ids: {}, miss: PCS.map(function (c) { return c.m; }) };
          rec.miss.forEach(function (m) { rec.ids[m] = randId(); });
        }
        fire(rec, false);
      }));
      conf.appendChild(btn('Cancel', '', function () { RS.armed = false; drawRoster(); }));
      sub.appendChild(conf);
    }
    sub.appendChild(sentList(p));
  }
  function addPilot() {
    var n = el('rsAddName').value.trim().replace(/\s+/g, ' '), m = el('rsAddMsg');
    m.className = 'small'; m.textContent = '';
    var bad = nameProblem(n); if (bad) { m.className = 'small bad'; m.textContent = bad; return; }
    el('rsAddGo').disabled = true; m.textContent = 'Adding…';
    rosterPost({ action: 'add', name: n }).then(function (j) {
      el('rsAddName').value = '';
      var s = (j.pilot && j.pilot.slug) || FS.slug(n);
      m.className = 'small ok'; m.textContent = ((j.pilot && j.pilot.name) || n) + ' is on the sims.';
      RS.sel = s; RS.mode = null; el('rsFilter').value = '';
      return fetchRoster().then(drawRoster);
    }).catch(function (e) { m.className = 'small bad'; m.textContent = rosterError(e); })
      .then(function () { el('rsAddGo').disabled = false; });
  }
  function wireRoster() {
    el('rsFilter').addEventListener('input', drawRoster);
    el('rsRemoved').addEventListener('change', function () { RS.showRemoved = el('rsRemoved').checked; drawRoster(); });
    el('rsRefresh').onclick = function () { KSNAP = null; SNAP_P = null; loadRoster(); };
    el('rsAddGo').onclick = addPilot;
    el('rsAddName').addEventListener('keydown', function (e) { if (e.key === 'Enter') addPilot(); });
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
  wireRoster();
})();
