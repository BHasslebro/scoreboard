/*
 * Junior Scrim theme — JS companion.
 *
 * The default theme system in /html/json/core.js loads a single asset from
 * the `?theme=` query parameter (CSS *or* JS). Using this file as the theme
 * (`?theme=/themes/junior-scrim.js`) gives us both:
 *
 *   1. The matching CSS gets injected automatically.
 *   2. We can attach behaviour the CSS-only theme can't express, namely
 *      pulse / pop animations triggered by the *content* of <div class=Score>
 *      and <div class=JamScore> changing — CSS has no selector for "text
 *      content just changed", so we use a MutationObserver and toggle a
 *      class that retriggers a one-shot keyframe animation.
 *
 * Scoping notes:
 *   - The standard scoreboard view roots score elements under `#scoreboard`.
 *   - The overlay view roots them under `#sb` and uses different classes.
 *   - Both are observed; selectors below match each view and are mutually
 *     exclusive, so no element gets the animation applied twice.
 */
(function () {
  // 1. Inject the matching CSS. Computing the URL relative to this script's
  //    src lets the theme work whether served from /themes/, a custom path,
  //    or a tarball under /custom/.
  var thisScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();
  var cssHref = (thisScript && thisScript.src ? thisScript.src : '/themes/junior-scrim.js')
    .replace(/\.js(\?.*)?$/, '.css$1');
  if (!document.querySelector('link[href="' + cssHref + '"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cssHref;
    document.head.appendChild(link);
  }

  // 2. Score / JamScore change pulses.
  //
  // We track each watched element's previous textContent in a WeakMap so we
  // don't fire on the *initial* render (when value goes from "" → "0", etc).
  // To retrigger a CSS animation we must remove the class, force a reflow,
  // then re-add it; otherwise a second change while the previous animation
  // is still running won't replay.
  var prev = new WeakMap();

  function flash(el, cls, ms) {
    el.classList.remove(cls);
    // Force a synchronous reflow so the next class addition starts a fresh
    // animation cycle instead of being coalesced with the removal.
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () {
      el.classList.remove(cls);
    }, ms);
  }

  // Selectors and the class+duration to flash on change. Durations match
  // the corresponding @keyframes in junior-scrim.css.
  var watches = [
    // Main scoreboard view
    { sel: '#scoreboard .Team>.Score',                     cls: 'JsScorePulse', ms: 1100 },
    { sel: '#scoreboard .Team>.JamScore',                  cls: 'JsJamPop',     ms: 700  },
    // Overlay view (same idea, scoped to its own DOM)
    { sel: '#sb .TeamBox .Team .Score',                    cls: 'JsScorePulse', ms: 1100 },
    { sel: '#sb .TeamBox .Team .Mini .JamScore',           cls: 'JsJamPop',     ms: 700  },
  ];

  function check() {
    for (var i = 0; i < watches.length; i++) {
      var w = watches[i];
      var nodes = document.querySelectorAll(w.sel);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var cur = el.textContent;
        if (prev.has(el)) {
          if (prev.get(el) !== cur) flash(el, w.cls, w.ms);
        }
        prev.set(el, cur);
      }
    }
  }

  function start() {
    // Prime the prev map (initial values aren't an animation trigger).
    check();
    var obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
