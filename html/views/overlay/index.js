WS.Register(
  [
    'ScoreBoard.CurrentGame.Clock(Timeout).Running',
    'ScoreBoard.CurrentGame.Clock(*).Name',
    'ScoreBoard.CurrentGame.TimeoutOwner',
    'ScoreBoard.CurrentGame.OfficialReview',
    'ScoreBoard.CurrentGame.Team(*).Timeouts',
    'ScoreBoard.CurrentGame.ClockDuringFinalScore'
  ],
  sbSetActiveTimeout
);

WS.Register(['ScoreBoard.Settings.Setting(Overlay.Interactive.ClockAfterTimeout)', 'ScoreBoard.CurrentGame.Clock(*).Running', 'ScoreBoard.CurrentGame.InJam'],
  function (k) { _sbClockSelect('ScoreBoard.CurrentGame', 'Overlay.Interactive.ClockAfterTimeout') });

WS.Register('ScoreBoard.CurrentGame.Rule(Penalties.NumberToFoulout)');

WS.AfterLoad(function () {
  $('body').removeClass('preload');
});

function _ovlToggleSetting(s) {
  WS.Set(
    'ScoreBoard.Settings.Setting(Overlay.Interactive.' + s + ')',
    !isTrue(WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.' + s + ')'])
  );
}

function _ovlTogglePanel(p) {
  WS.Set(
    'ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)',
    WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)'] === p ? '' : p
  );
}

function ovlHandleKey(k, v, elem, e) {
  switch (e.which) {
    case 74: // j
      _ovlToggleSetting('ShowJammers');
      break;
    case 76: // l
      _ovlToggleSetting('ShowLineups');
      break;
    case 78: // n
      _ovlToggleSetting('ShowAllNames');
      break;
    case 80: // p
      _ovlToggleSetting('ShowPenaltyClocks');
      break;
    case 67: // c
      _ovlToggleSetting('Clock');
      break;
    case 83: // s
      _ovlToggleSetting('Score');
      break;
    case 48: // 0
      _ovlTogglePanel('PPJBox');
      break;
    case 49: // 1
      _ovlTogglePanel('RosterTeam1');
      break;
    case 50: // 2
      _ovlTogglePanel('RosterTeam2');
      break;
    case 51: // 3
      _ovlTogglePanel('PenaltyTeam1');
      break;
    case 52: // 4
      _ovlTogglePanel('PenaltyTeam2');
      break;
    case 57: // 9
      _ovlTogglePanel('LowerThird');
      break;
    case 85: // u
      _ovlTogglePanel('Upcoming');
      break;
    case 70: // f
      _ovlTogglePanel('FinalScore');
      break;
    case 32: // space
      WS.Set('ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)', '');
      break;
  }
}

function ovlToBackground(k, v) {
  return v || 'transparent';
}

// Briefly toggle a class on the element so themes that define an animation
// for that class (e.g. broadcast.css) restart the animation on each change.
// Returns the unchanged value so the display text is still rendered.
function _ovlFlash(elem, cls, dataKey, v) {
  const prev = elem.data(dataKey);
  if (prev !== undefined && prev !== v) {
    elem.removeClass(cls);
    // Force reflow so the animation restarts reliably.
    if (elem[0]) {
      void elem[0].offsetWidth;
    }
    elem.addClass(cls);
  }
  elem.data(dataKey, v);
  return v;
}

function ovlScorePulse(k, v, elem) {
  return _ovlFlash(elem, 'ScorePulse', 'ovlScoreLast', v);
}

function ovlJamScorePulse(k, v, elem) {
  return _ovlFlash(elem, 'JamPulse', 'ovlJamLast', v);
}

/* ---------------- Final Score Reveal ---------------- */

// Winner helpers (used by sbClass on the FinalScore panel).
function _ovlFinalScores() {
  const a = parseInt(WS.state['ScoreBoard.CurrentGame.Team(1).Score'], 10) || 0;
  const b = parseInt(WS.state['ScoreBoard.CurrentGame.Team(2).Score'], 10) || 0;
  return [a, b];
}
function ovlFinalWinnerT1() { const [a, b] = _ovlFinalScores(); return a > b; }
function ovlFinalWinnerT2() { const [a, b] = _ovlFinalScores(); return b > a; }
function ovlFinalTie()      { const [a, b] = _ovlFinalScores(); return a === b; }

// Count-up animated score. When the panel is not visible, or the final value
// changes, snap to 0 and animate up to the target over ~1.8s with an easing
// curve that lands hard on the final number.
function ovlFinalScoreValue(k, v, elem) {
  // The modifier is bound to two paths (Score + Panel setting) so `v` may
  // be the panel string when that one fires. Always derive the score from
  // the element's own context path instead.
  const ctx = k.substring(0, k.lastIndexOf('.'));
  const target = parseInt(WS.state[ctx + '.Score'], 10) || 0;
  const panelShown = WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.Panel)'] === 'FinalScore';

  // Cancel any in-flight animation on this element.
  const prevRaf = elem.data('ovlFSRaf');
  if (prevRaf) { cancelAnimationFrame(prevRaf); elem.data('ovlFSRaf', null); }

  if (!panelShown) {
    // Keep the DOM in sync so the next reveal starts from a known state.
    elem.text(target);
    elem.data('ovlFSTarget', target);
    return;
  }

  elem.data('ovlFSTarget', target);

  // Delay start a touch so teams have slid in before numbers start rolling.
  const startDelay = 650;
  const duration = 1800;
  const start = performance.now() + startDelay;
  elem.text('0');
  elem.removeClass('FSScorePop');

  function ease(t) {
    // easeOutExpo: fast start, dramatic settle.
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function step(now) {
    if (elem.data('ovlFSTarget') !== target) return; // superseded
    if (now < start) {
      elem.data('ovlFSRaf', requestAnimationFrame(step));
      return;
    }
    const t = Math.min(1, (now - start) / duration);
    const val = Math.round(ease(t) * target);
    elem.text(val);
    if (t < 1) {
      elem.data('ovlFSRaf', requestAnimationFrame(step));
    } else {
      elem.data('ovlFSRaf', null);
      // Final pop on landing.
      elem.removeClass('FSScorePop');
      void elem[0].offsetWidth;
      elem.addClass('FSScorePop');
    }
  }
  elem.data('ovlFSRaf', requestAnimationFrame(step));
}

function ovlToIndicator(k, v) {
  var prefix = k.substring(0, k.lastIndexOf('.'));
  return isTrue(WS.state[prefix + '.StarPass'])
    ? 'SP'
    : isTrue(WS.state[prefix + '.Lost'])
      ? ''
      : isTrue(WS.state[prefix + '.Lead'])
        ? '★'
        : '';
}

function ovlIsJamming(k, v, elem) {
  return (isTrue(v) && elem.attr('Position') === 'Pivot') || (!isTrue(v) && elem.attr('Position') === 'Jammer');
}

function ovlToPpjColumnWidth(k, v, elem) {
  var ne1 = $('.PPJBox [Team="1"] .GraphBlock').length;
  const ne2 = $('.PPJBox [Team="2"] .GraphBlock').length;
  if (ne2 > ne1) {
    ne1 = ne2;
  }
  const wid = parseInt(elem.parent().parent().innerWidth());
  const newWidth = parseInt(wid / ne1) - 4;
  $('.ColumnWidth').css('width', newWidth);

  return newWidth;
}

function ovlToPpjMargin(k, v, elem) {
  if (k.TeamJam === '2') {
    return 0;
  }
  return parseInt(elem.parent().innerHeight()) - v * 4;
}

function ovlToLowerThirdColorFg() {
  return _ovlToLowerThirdColor('overlay.fg');
}

function ovlToLowerThirdColorBg() {
  return _ovlToLowerThirdColor('overlay.bg');
}

function _ovlToLowerThirdColor(type) {
  switch (WS.state['ScoreBoard.Settings.Setting(Overlay.Interactive.LowerThird.Style)']) {
    case 'ColourTeam1':
      return WS.state['ScoreBoard.CurrentGame.Team(1).Color(' + type + ')'];
    case 'ColourTeam2':
      return WS.state['ScoreBoard.CurrentGame.Team(2).Color(' + type + ')'];
    default:
      return '';
  }
}

function ovlToClockType() {
  var ret;
  const to = WS.state['ScoreBoard.CurrentGame.TimeoutOwner'];
  const or = WS.state['ScoreBoard.CurrentGame.OfficialReview'];
  const tc = WS.state['ScoreBoard.CurrentGame.Clock(Timeout).Running'];
  const lc = WS.state['ScoreBoard.CurrentGame.Clock(Lineup).Running'];
  const ic = WS.state['ScoreBoard.CurrentGame.Clock(Intermission).Running'];
  const jc = WS.state['ScoreBoard.CurrentGame.InJam'];

  if (jc) {
    ret = 'Jam';
    $('.ClockDescription').css('backgroundColor', '#888');
  } else if (lc) {
    ret = WS.state['ScoreBoard.CurrentGame.Clock(Lineup).Name'];
    $('.ClockDescription').css('backgroundColor', '#888');
  } else if (tc) {
    ret = WS.state['ScoreBoard.CurrentGame.Clock(Timeout).Name'];
    if (to !== '' && to !== 'O' && or) {
      ret = 'Official Review';
    }
    if (to !== '' && to !== 'O' && !or) {
      ret = 'Team Timeout';
    }
    if (to === 'O') {
      ret = 'Official Timeout';
    }
    $('.ClockDescription').css('backgroundColor', 'red');
  } else if (ic) {
    const num = WS.state['ScoreBoard.CurrentGame.Clock(Intermission).Number'];
    const max = WS.state['ScoreBoard.CurrentGame.Rule(Period.Number)'];
    const isOfficial = WS.state['ScoreBoard.CurrentGame.OfficialScore'];
    const showDuringOfficial = WS.state['ScoreBoard.CurrentGame.ClockDuringFinalScore'];
    if (isOfficial) {
      if (showDuringOfficial) {
        ret = WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Intermission.OfficialWithClock)'];
      } else {
        ret = WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Official)'];
      }
    } else if (num === 0) {
      ret = WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Intermission.PreGame)'];
    } else if (num != max) {
      ret = WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Intermission)'];
    } else if (!isOfficial) {
      ret = WS.state['ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Unofficial)'];
    }

    $('.ClockDescription').css('backgroundColor', 'blue');
  } else {
    ret = 'Coming Up';
    $('.ClockDescription').css('backgroundColor', 'blue');
  }

  return ret;
}
