/* ===========================================================================
   FPV GROUND SCHOOL - THE CLUB'S OWN VIDEOS  (2026-11-25)
   ---------------------------------------------------------------------------
   One video per badge, hosted on Google Drive, plus one for the website
   itself. This file is the manifest AND the one player every page uses:

     the course app      groundschool/ here, groundschool.html on the kiosk
                         (the Watch tab of a badge quiz, the module sheets)
     Pilot Path          pilot-path/, on each badge card
     Flight Clearance    clearance/, Safe Flight and FAA TRUST
     the home page       the website how-to (site-howto) and, for a device
                         with no pilot picked, the club intro (home-intro)

   2026-11-26: an entry may instead point at a file this site hosts itself:
     src      'media/<id>.mp4', relative to the site root (media/ beside
              index.html). '' = not made yet. Set it and the entry is on: a
              native <video controls playsinline preload="none"> with
              poster 'media/<id>.jpg' and captions 'media/<id>.vtt' (a
              captions track, English, on by default).
   A drive entry and a src entry share everything else (len, title, slot,
   render, stop).

   Plain ES5 and no outside script, like the rest of the course files: the
   kiosk loads this same file. NOTHING is requested until somebody taps a
   poster - the poster is drawn here, no thumbnail fetch (the kiosk's rule).
   Tapped, the poster becomes Drive's /preview frame at 16:9, with an "Open
   in Drive" link under it for networks that block the frame.

   GS_VIDEOS[<badge id>] = { drive, len, title }
     drive  the Google Drive FILE id (drive.google.com/file/d/<id>/view),
            shared "Anyone with the link: Viewer". '' = not made yet: the
            player shows a quiet "Video coming soon" line, never a frame.
     len    "m:ss", shown on the poster; also how long a playing video keeps
            the kiosk from signing the pilot out (len + 1 min, 10 min if '').
     title  what the poster says.

   Helpers (non-enumerable, so Object.keys(GS_VIDEOS) is just the videos):
     GS_VIDEOS.get(id) / .ready(id)        the entry / whether it has a file
     GS_VIDEOS.player(el, id, opts)        draw the player into el; returns
                                           { stop(), play() }. opts.keepAlive: called
                                           every 4 s while a video plays
     GS_VIDEOS.slot(id)                    '<div data-gsv=id>' for templates
                                           ('' when the badge has no video)
     GS_VIDEOS.mount(root, opts)           turn every slot in root into a player
     GS_VIDEOS.render(box, html, opts)     box.innerHTML = html, but a video that
                                           is playing inside box keeps playing
                                           (pages that redraw every minute)
     GS_VIDEOS.stopIn(root) / .stopAll()   put playing videos back to posters
   =========================================================================== */
(function(){
  var V = {
    /* Flight Clearance */
    'safe-flight':           { drive:'', len:'', title:'Safe Flight' },
    'faa-trust':             { drive:'', len:'', title:'FAA TRUST' },
    /* Tier 1 path */
    'proficient-flight':     { drive:'', len:'', title:'Sim Flight' },
    // The embed was tested with a 4-second public clip (1TxBJJsF8wjyag7X0xcHmGENzfc9E2xAh).
    // Fill in the real Battery Care video id and length when it is uploaded.
    'battery-care':          { drive:'', len:'', title:'Battery Care' },
    'betaflight-intro':      { drive:'', len:'', title:'Betaflight Intro' },
    'line-of-sight':         { drive:'', len:'', title:'Line of Sight' },
    'tiny-whoop':            { drive:'', len:'', title:'Meteor 75 Pro Certification' },
    /* Tier 2 path */
    'electrical-components': { drive:'', len:'', title:'Electrical Components' },
    'radio-protocol':        { drive:'', len:'', title:'Radio Protocol' },
    'field-repair':          { drive:'', len:'', title:'Field Diagnostics' },
    'freestyle-flight':      { drive:'', len:'', title:'Freestyle Flight' },
    'pavo-flight':           { drive:'', len:'', title:'Pavo 20 Pro Flight' },
    /* Tier 3 path */
    'spotter':               { drive:'', len:'', title:'Spotter' },
    'event-ops':             { drive:'', len:'', title:'Event Ops' },
    'cinematography':        { drive:'', len:'', title:'Cinematography' },
    'indoor-proximity':      { drive:'', len:'', title:'Indoor Proximity' },
    'racing':                { drive:'', len:'', title:'Racing' },
    'faa-event-exam':        { drive:'', len:'', title:'FAA Event Exam' },
    'event-pilot':           { drive:'', len:'', title:'Event Pilot' },
    /* the website itself: the home page's "Using this site" button (hidden while '') */
    'site-howto':            { drive:'', len:'', title:'Using the club website' },
    /* 2026-11-26: the overviews, hosted on this site (media/). One line each to
       switch on: src:'media/<id>.mp4'. While src is '' the home intro is not
       shown at all and the other two show a quiet "Video soon" line. */
    'home-intro':      { src:'', poster:'media/home-intro.jpg',      captions:'media/home-intro.vtt',      len:'', title:'Who we are' },
    'flight-overview': { src:'', poster:'media/flight-overview.jpg', captions:'media/flight-overview.vtt', len:'', title:'Brophy flight overview' },
    'path-overview':   { src:'', poster:'media/path-overview.jpg',   captions:'media/path-overview.vtt',   len:'', title:'How badges work' }
  };
  window.GS_VIDEOS = V;

  function def(name, fn){
    try{ Object.defineProperty(V, name, { value:fn, enumerable:false }); }
    catch(e){ V[name] = fn; }
  }
  function get(id){ var v = V[id]; return (v && typeof v === 'object' && ('drive' in v || 'src' in v)) ? v : null; }
  function own(v){ return !!(v && v.src && /^[\w./-]+$/.test(v.src)); }
  function ready(id){ var v = get(id); return !!(v && (own(v) || /^[\w-]{10,}$/.test(v.drive || ''))); }
  /* the site root, from this file's own address (…/groundschool/gs-videos.js),
     so 'media/x.mp4' works from any page depth; '' (relative) elsewhere */
  var ROOT = '';
  try{ var me = document.currentScript && document.currentScript.src; if(me && /groundschool\/gs-videos\.js(\?.*)?$/.test(me)) ROOT = me.replace(/groundschool\/gs-videos\.js(\?.*)?$/, ''); }catch(e){}
  function media(p){ return p ? (/^(https?:)?\/\//.test(p) ? p : ROOT + p) : ''; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function secs(len){
    var p = String(len || '').split(':'), n = 0;
    for(var i = 0; i < p.length; i++){ var x = parseInt(p[i], 10); if(isNaN(x)) return 0; n = n * 60 + x; }
    return n;
  }
  function viewUrl(id){ return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; }
  function previewUrl(id){ return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview'; }

  /* ---- the look: a drafting sheet with registration marks, a hand-drawn play mark ---- */
  var CSS =
    '.gsv{margin:10px 0 2px}' +
    '.gsv-box{position:relative;width:100%;aspect-ratio:16/9;border:1.5px solid var(--line-hard,rgba(45,69,101,.42));' +
      'background-color:var(--glass-2,#fff);box-shadow:3px 3px 0 rgba(45,69,101,.10);overflow:hidden}' +
    '@supports not (aspect-ratio:16/9){.gsv-box{height:0;padding-top:56.25%}}' +
    '.gsv-box iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;background-color:#000}' +
    '.gsv-poster{position:absolute;top:0;left:0;width:100%;height:100%;margin:0;border:0;padding:12px 16px;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;' +
      'font-family:var(--font-body,"Barlow","Segoe UI",system-ui,sans-serif);color:var(--ink,#2d4565);cursor:pointer;' +
      'background-color:var(--glass-2,#fff);' +
      'background-image:radial-gradient(ellipse at 50% 44%,rgba(255,255,255,.92) 0%,rgba(255,255,255,0) 66%),' +
        'repeating-linear-gradient(0deg,rgba(45,69,101,.06) 0 1px,transparent 1px 14px),' +
        'repeating-linear-gradient(90deg,rgba(45,69,101,.06) 0 1px,transparent 1px 14px)}' +
    '.gsv-reg{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;color:var(--ink-soft,#62768e);opacity:.7}' +
    '.gsv-play{width:clamp(46px,16%,70px);height:auto;display:block;flex:none;transition:transform .15s ease}' +
    '.gsv-play .ring{fill:var(--glass-2,#fff);stroke:var(--rust,#b0532a)}' +
    '.gsv-play .tri{fill:var(--rust,#b0532a)}' +
    '.gsv-poster:hover .gsv-play,.gsv-poster:focus-visible .gsv-play{transform:scale(1.06)}' +
    '.gsv-poster:hover .gsv-play .ring{fill:var(--rust,#b0532a)}' +
    '.gsv-poster:hover .gsv-play .tri{fill:#fff}' +
    '.gsv-poster:focus-visible{outline:2px solid var(--rust,#b0532a);outline-offset:-4px}' +
    '.gsv-title{font-weight:600;font-size:clamp(16px,2.4vw,21px);line-height:1.2;max-width:30ch}' +
    '.gsv-meta{font-family:var(--font-mono,"Share Tech Mono",Consolas,monospace);font-size:13px;letter-spacing:.14em;' +
      'text-transform:uppercase;color:var(--ink-soft,#62768e)}' +
    '.gsv-open{display:inline-block;margin-top:6px;font-family:var(--font-mono,"Share Tech Mono",Consolas,monospace);' +
      'font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--rust,#b0532a);text-decoration:none}' +
    '.gsv-open:hover{text-decoration:underline;text-underline-offset:3px}' +
    /* 2026-11-26: quiet, one line, no box */
    '.gsv-soon{display:flex;align-items:center;gap:8px;padding:2px 0;font-family:var(--font-mono,"Share Tech Mono",Consolas,monospace);' +
      'font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft,#62768e);background-color:transparent}' +
    '.gsv-box video{position:absolute;top:0;left:0;width:100%;height:100%;display:block;background-color:#000;object-fit:contain}' +
    '.gsv-cap{display:flex;gap:10px;align-items:baseline;margin-top:6px;font-family:var(--font-mono,"Share Tech Mono",Consolas,monospace);' +
      'font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft,#62768e)}' +
    '.gsv-cap b,.gsv-soon .gsv-t{font-weight:400;color:var(--ink,#2d4565)}' +
    '.gsv-soon svg{width:20px;height:14px;flex:none;color:var(--ink-soft,#62768e)}' +
    '[data-theme=dark] .gsv-poster{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 14px),' +
        'repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 14px)}' +
    '[data-theme=dark] .gsv-poster:hover .gsv-play .tri{fill:var(--glass-2,#fff)}';
  function injectCss(){
    if(document.getElementById('gsv-css')) return;
    var s = document.createElement('style'); s.id = 'gsv-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  injectCss();

  /* corner registration marks, like a drawing sheet; scales with the box */
  var REG = '<svg class="gsv-reg" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.25" vector-effect="non-scaling-stroke" ' +
    'd="M5 10V5h5M150 5h5v5M155 80v5h-5M10 85H5v-5"/></svg>';
  /* the play mark: a slightly wobbly circle, the way a pen draws one */
  var PLAY = '<svg class="gsv-play" viewBox="0 0 74 74" aria-hidden="true">' +
    '<path class="ring" stroke-width="3" d="M37 4.5c18.2-.4 32.6 14.4 32.4 32.6-.2 18-14.6 32.5-32.6 32.4C19 69.3 4.4 55 4.6 36.8 4.8 19 18.9 4.9 37 4.5z"/>' +
    '<path class="ring" stroke-width="1" stroke-dasharray="3 4" opacity=".45" d="M37 10.5c14.8 0 26.4 11.8 26.4 26.5S51.6 63.5 37 63.5 10.6 51.7 10.6 37 22.3 10.5 37 10.5z"/>' +
    '<path class="tri" d="M30 23.5l23.5 13.6L30 50.6z"/></svg>';
  var SOON = '<svg viewBox="0 0 20 14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.3">' +
    '<rect x="1" y="1" width="18" height="12" rx="1.5" stroke-dasharray="2.5 2"/><path d="M8 4.5l5 2.5-5 2.5z"/></g></svg>';

  /* ---- one player ---- */
  function player(el, id, opts){
    opts = opts || {};
    if(!el) return null;
    if(el._gsv && el._gsv.stop) el._gsv.stop(true);
    var v = get(id);
    if(!v){ el.innerHTML = ''; el._gsv = null; return null; }
    el.className = (el.className.replace(/\bgsv(-\S+)?\b/g, '') + ' gsv').replace(/\s+/g, ' ').replace(/^ /, '');
    el.setAttribute('data-gsv', id);
    if(!ready(id)){
      el.className += ' gsv-soon';
      /* a site-hosted overview names itself: "How badges work · Video soon" */
      el.innerHTML = SOON + ('src' in v ? '<span><b class="gsv-t">' + esc(v.title) + '</b> &middot; Video soon</span>' : '<span>Video soon</span>');
      el._gsv = { stop:function(){}, live:false };
      return el._gsv;
    }
    var timer = 0, H = { live:false };
    function keep(){
      if(typeof opts.keepAlive !== 'function' || timer) return;
      var until = Date.now() + ((secs(v.len) || 600) + 60) * 1000;
      try{ opts.keepAlive(); }catch(e){}
      timer = setInterval(function(){
        if(Date.now() > until || !el.isConnected){ clearInterval(timer); timer = 0; return; }
        try{ opts.keepAlive(); }catch(e){}
      }, 4000);
    }
    /* 2026-11-26: a file this site hosts (src): the browser's own player */
    if(own(v)){
      el.innerHTML = '<div class="gsv-box"><video controls playsinline preload="none"' +
        (v.poster ? ' poster="' + esc(media(v.poster)) + '"' : '') + ' aria-label="' + esc(v.title + ' video') + '">' +
        '<source src="' + esc(media(v.src)) + '" type="video/mp4">' +
        (v.captions ? '<track kind="captions" src="' + esc(media(v.captions)) + '" srclang="en" label="English" default>' : '') +
        '</video></div>' +
        '<div class="gsv-cap"><b>' + esc(v.title) + '</b>' + (v.len ? '<span>' + esc(v.len) + '</span>' : '') + '</div>';
      var vid = el.querySelector('video');
      vid.addEventListener('play', function(){
        if(!H.live){ el.className += ' gsv-live'; H.live = true; if(typeof opts.onPlay === 'function'){ try{ opts.onPlay(id); }catch(e){} } }
        keep();
      });
      H.play = function(){ try{ var p = vid.play(); if(p && p.catch) p.catch(function(){}); }catch(e){} };
      H.stop = function(quiet){
        if(timer){ clearInterval(timer); timer = 0; }
        try{ vid.pause(); }catch(e){}
        if(!quiet) el.className = el.className.replace(/\s*gsv-live\b/, '');
        H.live = false;
      };
      el._gsv = H;
      return H;
    }
    function poster(){
      el.className = el.className.replace(/\s*gsv-live\b/, '');
      el.innerHTML = '<div class="gsv-box"><button type="button" class="gsv-poster" aria-label="' +
        esc('Play the ' + v.title + ' video' + (v.len ? ' (' + v.len + ')' : '')) + '">' + REG + PLAY +
        '<span class="gsv-title">' + esc(v.title) + '</span>' +
        '<span class="gsv-meta">' + (v.len ? esc(v.len) + ' &middot; ' : '') + 'Brophy FPV Club</span></button></div>' +
        '<a class="gsv-open" href="' + viewUrl(v.drive) + '" target="_blank" rel="noopener">Open in Drive &#8599;</a>';
      el.querySelector('.gsv-poster').onclick = function(e){ if(e && e.preventDefault) e.preventDefault(); play(); };
    }
    function play(){
      var box = el.querySelector('.gsv-box'); if(!box) return;
      var f = document.createElement('iframe');
      f.src = previewUrl(v.drive);
      f.setAttribute('allow', 'autoplay; fullscreen');
      f.setAttribute('allowfullscreen', '');
      f.title = v.title + ' video';
      box.innerHTML = ''; box.appendChild(f);
      el.className += ' gsv-live'; H.live = true;
      /* Clicks inside Drive's frame never reach this page, so a pilot
         watching without touching anything looks idle: the kiosk would sign
         them out after 2 minutes and the lesson clock would stop. Tell the
         page they are here, for the length of the video and a minute more. */
      keep();
      if(typeof opts.onPlay === 'function'){ try{ opts.onPlay(id); }catch(e){} }
    }
    H.stop = function(quiet){
      if(timer){ clearInterval(timer); timer = 0; }
      if(H.live && !quiet){ H.live = false; poster(); }
      H.live = false;
    };
    H.play = function(){ if(!H.live) play(); };
    el._gsv = H;
    poster();
    return H;
  }

  function slot(id){ return get(id) ? '<div class="gsv" data-gsv="' + esc(id) + '"></div>' : ''; }
  function mount(root, opts){
    var list = (root || document).querySelectorAll('[data-gsv]');
    for(var i = 0; i < list.length; i++) if(!list[i]._gsv) player(list[i], list[i].getAttribute('data-gsv'), opts);
  }
  function stopIn(root){
    var list = (root || document).querySelectorAll('.gsv-live');
    for(var i = 0; i < list.length; i++) if(list[i]._gsv) list[i]._gsv.stop();
  }

  /* innerHTML, except around a playing video. Moving an iframe in the DOM
     reloads it, so the live player is never moved: the new markup is laid in
     around it, node by node along the path down to it. If the new markup has
     no slot for that video in the same place, it is stopped and replaced. */
  function pathTo(root, node){
    var p = [];
    while(node && node !== root){
      var i = 0, s = node; while((s = s.previousSibling)) i++;
      p.unshift(i); node = node.parentNode;
    }
    return node === root ? p : null;
  }
  function at(root, p){ var n = root; for(var i = 0; n && i < p.length; i++) n = n.childNodes[p[i]]; return n || null; }
  function syncAttrs(o, n){
    var i, a;
    for(i = o.attributes.length - 1; i >= 0; i--){ a = o.attributes[i].name; if(!n.hasAttribute(a)) o.removeAttribute(a); }
    for(i = 0; i < n.attributes.length; i++){ a = n.attributes[i]; if(o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); }
  }
  function weave(o, n, lives){
    var oc = [].slice.call(o.childNodes), nc = [].slice.call(n.childNodes), i;
    for(i = 0; i < Math.max(oc.length, nc.length); i++){
      var a = oc[i], b = nc[i];
      if(a && lives.indexOf(a) >= 0) continue;                       /* the playing video: untouched */
      var holds = a && a.nodeType === 1 && lives.some(function(L){ return a.contains(L); });
      if(holds && b && b.nodeType === 1 && b.tagName === a.tagName){ syncAttrs(a, b); weave(a, b, lives); continue; }
      if(a && b) o.replaceChild(b, a);
      else if(b) o.appendChild(b);
      else if(a) o.removeChild(a);
    }
  }
  function render(box, html, opts){
    if(!box) return;
    var lives = [].slice.call(box.querySelectorAll('.gsv-live'));
    if(lives.length){
      var tmp = document.createElement(box.tagName); tmp.innerHTML = html;
      lives = lives.filter(function(L){
        var p = pathTo(box, L), n = p && at(tmp, p);
        var ok = !!(n && n.nodeType === 1 && n.getAttribute('data-gsv') === L.getAttribute('data-gsv'));
        if(!ok && L._gsv) L._gsv.stop(true);
        return ok;
      });
      if(lives.length){ weave(box, tmp, lives); mount(box, opts); return; }
    }
    box.innerHTML = html;
    mount(box, opts);
  }

  def('get', get);
  def('ready', ready);
  def('player', player);
  def('slot', slot);
  def('mount', mount);
  def('render', render);
  def('stopIn', stopIn);
  def('stopAll', function(){ stopIn(document); });
  def('viewUrl', viewUrl);
  def('media', media);
})();
