// Starts the tip page's first request (who is being tipped) while the page code is still downloading, so a QR scan does not wait for it.
// Plain script, no build step: the page picks the response up from window.__tipPreload (see src/utils/tipPreload.ts).
// Cached for a year with the other files in /assets: when this changes, rename it (tip-preload-v2.js) and update index.html.
// Keep the API addresses in step with src/utils/config.ts (a test checks that).
(function () {
  try {
    var m = /^\/tip\/([A-Za-z0-9_-]{1,64})\/?$/.exec(window.location.pathname);
    if (!m) return;
    var host = window.location.hostname.toLowerCase();
    var base = host.indexOf('apptest.tipwave.live') !== -1
      ? 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev'
      : host.indexOf('app.tipwave.live') !== -1
        ? 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/prod'
        : null;
    if (!base) return; // anywhere else (local development) the page asks for itself
    var p = new URLSearchParams(window.location.search).get('p');
    var url = base + '/api/devices/' + m[1] + '/public' + (p ? '?performerId=' + encodeURIComponent(p) : '');
    window.__tipPreload = { url: url, at: Date.now(), promise: fetch(url) };
    window.__tipPreload.promise.catch(function () {});
  } catch (e) { /* the page then asks for itself */ }
})();
