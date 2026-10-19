/* Light / auto / dark (2026-10-18). Loaded in <head>, BEFORE the page's
   <style>, so the first paint is already the right scheme - no flash.

   The preference lives in localStorage under fpv.theme.v1 as 'light' or
   'dark'; no key means auto (follow the OS). What CSS sees is only the
   RESOLVED scheme, <html data-theme="light|dark">, so site.css needs one
   dark block and no prefers-color-scheme duplicates. The switch itself is
   appended to the page's <footer> once the DOM is in. */
(function () {
  var KEY = 'fpv.theme.v1';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var box = null;

  function pref() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function resolved(p) { return p === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : p; }
  function apply() {
    var p = pref();
    document.documentElement.setAttribute('data-theme', resolved(p));
    if (box) {
      var bs = box.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-checked', bs[i].getAttribute('data-v') === p ? 'true' : 'false');
    }
  }
  function set(v) {
    try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (e) {}
    apply();
  }

  apply();
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) apply(); });

  function draw() {
    var foot = document.querySelector('footer');
    if (!foot || box) return;
    box = document.createElement('div');
    box.className = 'themeswitch';
    box.setAttribute('role', 'radiogroup');
    box.setAttribute('aria-label', 'Colour scheme');
    box.innerHTML =
      '<span class="tk">Theme</span>' +
      '<button type="button" role="radio" data-v="light" aria-checked="false"><i aria-hidden="true">☀</i>Light</button>' +
      '<button type="button" role="radio" data-v="auto" aria-checked="false"><i aria-hidden="true">◐</i>Auto</button>' +
      '<button type="button" role="radio" data-v="dark" aria-checked="false"><i aria-hidden="true">☾</i>Dark</button>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-v]');
      if (b) set(b.getAttribute('data-v'));
    });
    foot.appendChild(box);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw); else draw();

  window.Theme = { get: pref, set: set, resolved: function () { return resolved(pref()); } };
})();
