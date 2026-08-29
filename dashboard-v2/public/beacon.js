/**
 * Career-Ops Personal Portfolio Telemetry Beacon
 * Embed this on your personal website (e.g. https://akashkaintura.is-a.dev)
 * 
 * Usage:
 *   <script src="https://careerops.dpdns.org/beacon.js" async></script>
 */
(function() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var params = new URLSearchParams(window.location.search);
    var slug = params.get('ref') || params.get('v') || params.get('trk') || params.get('source');
    if (!slug) return;

    var endpoint = 'https://careerops.dpdns.org/api/v/beacon';
    try {
      if (document.currentScript && document.currentScript.src) {
        var scriptOrigin = new URL(document.currentScript.src).origin;
        if (scriptOrigin && scriptOrigin.indexOf('http') === 0) {
          endpoint = scriptOrigin + '/api/v/beacon';
        }
      }
    } catch (_) {}

    var startTime = Date.now();
    var sentDwells = {};

    function sendPing(dwellSec) {
      if (dwellSec < 4 || sentDwells[dwellSec]) return;
      sentDwells[dwellSec] = true;

      var payload = JSON.stringify({
        slug: slug,
        dwellSeconds: dwellSec,
        referrer: document.referrer || ''
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function() {});
      }
    }

    // Incremental dwell thresholds (in seconds)
    var thresholds = [5, 15, 30, 60, 120, 300];
    thresholds.forEach(function(sec) {
      setTimeout(function() {
        var elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed >= sec) {
          sendPing(sec);
        }
      }, sec * 1000);
    });

    // Send final dwell time when tab is closed/hidden
    window.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        var total = Math.min(Math.round((Date.now() - startTime) / 1000), 7200);
        if (total >= 4) {
          sendPing(total);
        }
      }
    });
  } catch (e) {
    // Fail silently without disrupting personal site
  }
})();
