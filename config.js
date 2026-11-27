/* config.js - the one place the site's fixed addresses live (2026-11-26).
   Load it before roster.js, auth.js and site.js. site.js adds it by itself on
   a page that forgot, and groundschool/gs-web.js does the same in the course
   frame, so no page has to repeat the API address.

   Local testing only: on localhost / 127.0.0.1, localStorage['fpv.dev.api']
   points the site at another API (a mock, or `netlify dev`). It is ignored on
   the published site. */
(function () {
  var API = 'https://brophy-fpv-club-api.netlify.app';
  try {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      var dev = localStorage.getItem('fpv.dev.api');
      if (dev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(dev)) API = dev;
    }
  } catch (e) {}
  window.FPV = {
    API: API,
    SITE: 'https://elmagoct.github.io/brophy-fpv-club/',
    /* this exact address is in the QR on the sims */
    JOIN_URL: 'https://elmagoct.github.io/brophy-fpv-club/join/',
    post: post
  };
  /* Every pilot-side POST goes through here (progress, submissions, join), so
     a login token header (X-Pilot-Token, DESIGN.md section 2) can be added in
     this one place later. `path` is an API path such as '/api/progress'.
     Returns the fetch promise; callers keep their own error handling. */
  function post(path, body, opts) {
    var headers = { 'Content-Type': 'application/json' };
    var o = { method: 'POST', headers: headers, body: JSON.stringify(body) };
    if (opts && opts.keepalive) o.keepalive = true;
    return fetch(window.FPV.API + path, o);
  }
})();
