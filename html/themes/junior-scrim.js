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
    // Overlay score/jamscore are already animated via ovlScorePulse / ovlJamScorePulse
    // in the overlay's own index.js (ScorePulse / JamPulse classes). Don't add a
    // second class here or the animation fires twice on every score change.
    // Jam number pop in the overlay clock bar
    { sel: '#sb .ClockBarTop .Clock.ShowInJam.Name',       cls: 'JsJamNumPop',  ms: 600  },
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
    checkClasses();
    checkClockUrgency();
  }

  // 3. Lead acquisition burst.
  //
  // Fires a one-shot JsLeadBurst / JsLeadFlare animation the moment the
  // 'Lead' or 'HasLead' class is added to a team element. We track the
  // previous class state in a WeakMap so the initial render (where lead is
  // already true before the page is interactive) doesn't trigger a burst.
  var classState = new WeakMap();

  var classWatches = [
    // Overlay: Lead class on the sbForeach team wrapper → burst on Indicator
    {
      sel:      '#sb .TeamBox.Wrapper > div',
      watchCls: 'Lead',
      onAdd: function (el) {
        var indicator = el.querySelector('.Indicator');
        if (indicator) flash(indicator, 'JsLeadBurst', 1400);
      },
    },
    // Standard view: HasLead on the .Jammer position div → flare on Name
    {
      sel:      '#scoreboard .Team>.Jammer',
      watchCls: 'HasLead',
      onAdd: function (el) {
        var name = el.querySelector('.Name');
        if (name) flash(name, 'JsLeadFlare', 1050);
      },
    },
  ];

  function checkClasses() {
    for (var i = 0; i < classWatches.length; i++) {
      var w = classWatches[i];
      var nodes = document.querySelectorAll(w.sel);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var has = el.classList.contains(w.watchCls);
        var state = classState.get(el);
        if (!state) { state = {}; classState.set(el, state); }
        if (w.watchCls in state && !state[w.watchCls] && has) {
          w.onAdd(el);
        }
        state[w.watchCls] = has;
      }
    }
  }

  // 4. Jam clock urgency: add JsClockLow to Time elements when ≤ 30 s remain.
  //
  // The jam clock text is "M:SS" (produced by sbToTime). We parse it each
  // mutation callback and toggle the class only on transition to avoid
  // redundant DOM writes.
  var urgentState = new WeakMap(); // el → boolean

  function checkClockUrgency() {
    // Overlay view jam clock (right side of bottom bar, only shown in jam).
    var overlayJam = document.querySelector(
      '#sb .ClockBarBottom .ShowInJam.Time.TextRight'
    );
    // Standard view jam clock (inside the big jam clock block).
    var mainJam = document.querySelector(
      '#scoreboard .ShowInJam.Clock.Jam.Large .Box.Time.sbClock'
    );

    [overlayJam, mainJam].forEach(function (el) {
      if (!el) return;
      var m = el.textContent.trim().match(/^(\d+):(\d+)$/);
      var isUrgent = false;
      if (m) {
        var secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        // Only urgent while clock is actually running (secs > 0) and ≤ 30.
        isUrgent = secs > 0 && secs <= 30;
      }
      var was = urgentState.get(el);
      if (isUrgent !== was) {
        el.classList.toggle('JsClockLow', isUrgent);
        urgentState.set(el, isUrgent);
      }
    });
  }

  function start() {
    // Prime all state maps (initial values are not animation triggers).
    check();
    var obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      // Also watch attribute changes so class additions (Lead, HasLead, etc.)
      // are caught by checkClasses() without a separate observer.
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ============================================================
 * Jammer Spotlight — arena / main scoreboard view.
 *
 * Activated only when the standard scoreboard pane (#scoreboard)
 * is present. Two card divs are injected into the body and styled
 * by the .JammerSpotlight rules in junior-scrim.css.
 *
 * On the stream overlay the spotlight is handled by overlay/index.js
 * so this block deliberately does nothing there.
 * ============================================================ */
(function () {
  if (!document.getElementById('scoreboard')) return;

  function makeCard(teamNum, side) {
    var div = document.createElement('div');
    div.className = 'JammerSpotlight ' + side;
    div.id = 'jammerSpotlightMain' + teamNum;
    div.innerHTML =
      '<img class="JSPhoto" src="" alt="" />' +
      '<div class="JSInfo">' +
        '<div class="JSBadge">JAMMER &#9733;</div>' +
        '<div class="JSNumber"></div>' +
        '<div class="JSName"></div>' +
      '</div>' +
      '<div class="JSTimer"></div>';
    document.body.appendChild(div);
  }
  makeCard(1, 'Team1');
  makeCard(2, 'Team2');

  var DISPLAY_DURATION = 6000;
  var _timers = { 1: null, 2: null };
  var _shown  = { 1: null, 2: null };

  function _update(teamNum) {
    if (!isTrue(WS.state['ScoreBoard.CurrentGame.InJam'])) {
      _hide(teamNum);
      return;
    }
    var base     = 'ScoreBoard.CurrentGame.Team(' + teamNum + ')';
    var starPass = isTrue(WS.state[base + '.StarPass']);
    var pos      = starPass ? 'Pivot' : 'Jammer';
    var number   = WS.state[base + '.Position(' + pos + ').RosterNumber'] || '';
    var name     = WS.state[base + '.Position(' + pos + ').Name']         || '';

    if (!number) { _hide(teamNum); return; }

    var key = number + '\x01' + name;
    if (_shown[teamNum] === key) return;
    _shown[teamNum] = key;

    var teamName  = WS.state[base + '.Name'] || '';
    var teamColor = WS.state[base + '.Color(overlay.bg)'] || '#555';
    var imgSrc    = '/images/player_photos/'
      + encodeURIComponent(teamName) + '/'
      + encodeURIComponent(number) + '.png';

    var $card = $('#jammerSpotlightMain' + teamNum);
    $card.css('border-top-color', teamColor);
    $card.find('.JSNumber').text(number);
    $card.find('.JSName').text(name);

    var $img = $card.find('.JSPhoto');
    $img.off('error load')
      .on('error', function () { $(this).hide(); })
      .on('load',  function () { $(this).show(); })
      .show().attr('src', imgSrc);

    $card.removeClass('Show');
    void $card[0].offsetWidth;
    $card.addClass('Show');

    if (_timers[teamNum]) clearTimeout(_timers[teamNum]);
    _timers[teamNum] = setTimeout(function () { _hide(teamNum); }, DISPLAY_DURATION);
  }

  function _hide(teamNum) {
    $('#jammerSpotlightMain' + teamNum).removeClass('Show');
    _shown[teamNum] = null;
    if (_timers[teamNum]) { clearTimeout(_timers[teamNum]); _timers[teamNum] = null; }
  }

  WS.Register([
    'ScoreBoard.CurrentGame.Team(1).Position(Jammer).RosterNumber',
    'ScoreBoard.CurrentGame.Team(1).Position(Pivot).RosterNumber',
    'ScoreBoard.CurrentGame.Team(1).StarPass',
    'ScoreBoard.CurrentGame.InJam'
  ], function () { _update(1); });

  WS.Register([
    'ScoreBoard.CurrentGame.Team(2).Position(Jammer).RosterNumber',
    'ScoreBoard.CurrentGame.Team(2).Position(Pivot).RosterNumber',
    'ScoreBoard.CurrentGame.Team(2).StarPass',
    'ScoreBoard.CurrentGame.InJam'
  ], function () { _update(2); });
}());
