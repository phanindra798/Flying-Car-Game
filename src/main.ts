import './style.css';
import { Simulation, FIXED_STEP, type HeldInput, type Mode, type Phase } from './game/simulation';
import { World } from './game/world';
import { GameAudio } from './game/audio';

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const volumeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="scene"></div>
  <div class="scene-shade" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="#" aria-label="BOOSTLINE home"><span class="brand-mark">B<span>↗</span></span><span>BOOSTLINE<small>FIND YOUR LINE.</small></span></a>
    <div class="route-badge"><span class="live-dot"></span> PACIFIC COAST <span class="route-number">/ 01</span></div>
    <div class="top-actions"><span class="build-badge">OPEN ROAD <span>v0.1</span></span><button id="sound" class="icon-button" aria-label="Mute sound" aria-pressed="false">${volumeIcon}</button><button id="pause" class="icon-button" aria-label="Pause game" hidden>${pauseIcon}</button></div>
  </header>

  <main>
    <section id="welcome" class="welcome" aria-labelledby="hero-title">
      <div class="eyebrow"><span class="small-rule"></span> AN ARCADE HIGHWAY STUNT RUNNER</div>
      <h1 id="hero-title">Take the<br><em>high road.</em></h1>
      <p class="hero-description">A little speed. A little altitude.<br>Find your way through the traffic.</p>
      <div class="start-actions"><button id="start" class="primary-button">Start your run ${arrow}</button><button id="practice" class="text-button">Practice flight <span>↗</span></button></div>
      <div class="personal-best"><span class="best-icon">✧</span><div>YOUR PERSONAL BEST <strong id="home-best">—</strong></div><span class="best-note">Saved on this device</span></div>
    </section>

    <aside id="briefing" class="briefing" aria-label="How to play">
      <div class="briefing-label">YOUR NEXT MOVE <span>↗</span></div>
      <div class="briefing-step"><span class="step-number">01</span><div><strong>Find the gap.</strong><p>Pick your lane. Read the traffic.</p></div><span class="step-keys">← →</span></div>
      <div class="briefing-step"><span class="step-number">02</span><div><strong>Take it airborne.</strong><p>Jump, then hold to stay up.</p></div><span class="step-keys">SPACE</span></div>
      <div class="briefing-step"><span class="step-number">03</span><div><strong>Make the landing.</strong><p>Flip. Touch down. Bank the points.</p></div><span class="step-keys">F</span></div>
      <button id="help-open" class="briefing-footer">All controls <span>+</span></button>
    </aside>

    <section id="hud" class="hud" aria-label="Run statistics" hidden>
      <div class="score-block"><span class="hud-label" id="run-label">CURRENT RUN</span><strong id="score">000000</strong><div class="score-meta"><span id="distance">0 M</span><span id="combo">1× COMBO</span></div></div>
      <div class="speed-block"><span class="hud-label">GROUND SPEED</span><strong id="speed">0 <small>KM/H</small></strong><span id="flight-state" class="flight-state">ON THE ROAD</span></div>
    </section>

    <div id="stunt-notice" class="stunt-notice" role="status" aria-live="polite"><strong></strong><span></span></div>

    <div id="energy-panel" class="energy-panel" hidden><div class="energy-caption"><span><i></i> THRUSTER ENERGY</span><strong id="energy-number">100%</strong></div><div id="energy-meter" class="energy-track" role="progressbar" aria-label="Thruster energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div id="energy-fill"></div></div><div class="energy-hint" id="energy-hint">Hold SPACE to fly · SHIFT to boost</div></div>

    <section id="pause-panel" class="modal-card" aria-labelledby="pause-title" hidden><span class="eyebrow">TAKE A BREATHER</span><h2 id="pause-title">Road's waiting.</h2><p>Your run is paused. Pick up right where you left off.</p><button id="resume" class="primary-button">Back to the road ${arrow}</button><button id="pause-restart" class="secondary-button">Restart run</button><button id="pause-home" class="text-button">Main menu</button></section>

    <section id="results" class="modal-card results" aria-labelledby="results-title" hidden><span class="eyebrow" id="record-label">RUN COMPLETE</span><h2 id="results-title">One more run?</h2><p id="crash-reason"></p><div class="result-score"><span>FINAL SCORE</span><strong id="final-score">0</strong></div><div class="result-stats"><div><strong id="final-distance">0 m</strong><span>DISTANCE</span></div><div><strong id="final-combo">1×</strong><span>BEST COMBO</span></div><div><strong id="final-tricks">0</strong><span>LANDED TRICKS</span></div></div><button id="retry" class="primary-button">Try again <span>R ${arrow}</span></button><button id="results-home" class="text-button">Back to main menu</button></section>

    <dialog id="help" class="help-dialog"><div class="help-heading"><span class="eyebrow">THE DRIVER'S GUIDE</span><button id="help-close" class="icon-button" aria-label="Close controls">×</button></div><h2>Learn your moves.</h2><dl><div><dt><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd></dt><dd>Change lane</dd></div><div><dt><kbd>SPACE</kbd></dt><dd>Jump · hold for upward thrust</dd></div><div><dt><kbd>SHIFT</kbd></dt><dd>Hold to boost forward</dd></div><div><dt><kbd>F</kbd></dt><dd>Front flip while airborne</dd></div><div><dt><kbd>Q</kbd> <kbd>E</kbd></dt><dd>Barrel roll left / right</dd></div><div><dt><kbd>↓</kbd> / <kbd>S</kbd></dt><dd>Slam downward</dd></div><div><dt><kbd>ESC</kbd> / <kbd>P</kbd></dt><dd>Pause / resume</dd></div><div><dt><kbd>R</kbd></dt><dd>Restart current mode</dd></div></dl><p>Land a completed trick to bank points. Energy refills on the road. Practice flight has an empty highway.</p><button id="help-done" class="primary-button">Got it ${arrow}</button></dialog>
  </main>

  <footer class="bottom-bar"><span class="location-label"><span>↗</span> COASTLINE HIGHWAY <small>GOLDEN HOUR / NORTHBOUND</small></span><div class="control-strip"><span><kbd>← →</kbd> STEER</span><span><kbd>SPACE</kbd> FLY</span><span><kbd>F</kbd> FLIP</span><span><kbd>Q E</kbd> ROLL</span><span><kbd>SHIFT</kbd> BOOST</span></div><button id="footer-help" class="footer-help">CONTROLS <span>?</span></button></footer>
  <div id="touch-controls" class="touch-controls" role="group" aria-label="Touch driving controls" hidden>
    <button data-control="left" aria-label="Change lane left"><span>←</span><small>LANE</small></button>
    <button data-control="right" aria-label="Change lane right"><span>→</span><small>LANE</small></button>
    <button data-control="roll-left" aria-label="Barrel roll left"><span>↶</span><small>ROLL LEFT</small></button>
    <button data-control="flip" aria-label="Front flip"><span>↻</span><small>FLIP</small></button>
    <button data-control="roll-right" aria-label="Barrel roll right"><span>↷</span><small>ROLL RIGHT</small></button>
    <button data-control="slam" aria-label="Hold to slam downward"><span>↓</span><small>SLAM</small></button>
    <button data-control="boost" aria-label="Hold to boost"><span>BOOST</span><small>HOLD</small></button>
    <button data-control="jump" aria-label="Jump and hold to fly"><span>JUMP</span><small>HOLD TO FLY</small></button>
  </div>
  <div id="fatal-error" class="fatal-error" hidden></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const sim = new Simulation();
sim.start(); sim.phase = 'ready'; sim.speed = 0;
const audio = new GameAudio();
const heldKeys = new Set<string>();
const touchPointers = new Map<number, string>();
const touchDevice = matchMedia('(pointer: coarse)');
const touchActive = (action: string) => [...touchPointers.values()].includes(action);
const held: HeldInput = { thrust: false, boost: false, slam: false };
const help = $<HTMLDialogElement>('help');
help.querySelector('dl')!.classList.add('keyboard-guide');
help.querySelector('dl')!.insertAdjacentHTML('beforebegin', `<dl class="touch-guide">
  <div><dt>← / →</dt><dd>Tap to change lane</dd></div>
  <div><dt>JUMP</dt><dd>Tap to jump · hold to fly</dd></div>
  <div><dt>BOOST</dt><dd>Hold for forward speed</dd></div>
  <div><dt>FLIP / ROLL</dt><dd>Tap in the air to start a stunt</dd></div>
  <div><dt>SLAM</dt><dd>Hold to drop fast</dd></div>
  <div><dt>Ⅱ PAUSE</dt><dd>Pause, restart or return home</dd></div>
</dl>`);
document.querySelector('.control-strip')!.insertAdjacentHTML('afterend', '<span class="touch-guide touch-intro">TAP TO STEER. HOLD TO FLY.</span>');
let best = 0, storageAvailable = true;
try {
  const stored = Number(localStorage.getItem('boostline.best.v1'));
  best = Number.isFinite(stored) ? Math.max(0, stored) : 0;
  audio.muted = localStorage.getItem('boostline.muted') === 'true';
} catch { storageAvailable = false; }
const number = (n: number) => Math.floor(n).toLocaleString('en-US');
$('home-best').textContent = best ? number(best) : 'SET YOUR FIRST RECORD';

function clearInput() {
  heldKeys.clear(); touchPointers.clear(); held.thrust = held.boost = held.slam = false;
  document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('pressed'));
}
function focusRoad() { $('scene').querySelector('canvas')?.focus({ preventScroll: true }); }
function start(mode: Mode = 'run') {
  clearInput(); sim.start(mode); noticeTime = 0;
  $('stunt-notice').classList.remove('visible');
  void audio.start(); syncScreens(); focusRoad();
}
function restart() { start(sim.mode); }
function syncScreens() {
  app.dataset.phase = sim.phase;
  $('welcome').hidden = sim.phase !== 'ready';
  $('briefing').hidden = sim.phase !== 'ready';
  $('hud').hidden = sim.phase === 'ready';
  $('energy-panel').hidden = sim.phase === 'ready';
  $('pause').hidden = sim.phase !== 'playing';
  $('pause-panel').hidden = sim.phase !== 'paused';
  $('results').hidden = sim.phase !== 'crashed';
  $('touch-controls').hidden = sim.phase !== 'playing';
  $('run-label').textContent = sim.mode === 'practice' ? 'PRACTICE · EMPTY HIGHWAY' : 'CURRENT RUN';
  if (sim.phase === 'paused') $('resume').focus();
  if (sim.phase === 'crashed') $('retry').focus();
}
function togglePause() {
  sim.pause(); clearInput(); syncScreens();
  if (sim.phase === 'paused') audio.silence();
  if (sim.phase === 'playing') { void audio.start(); focusRoad(); }
}
function home() {
  clearInput(); sim.start(); sim.phase = 'ready'; sim.speed = 0;
  $('home-best').textContent = best ? number(best) : 'SET YOUR FIRST RECORD';
  $('stunt-notice').classList.remove('visible'); syncScreens(); $('start').focus();
}
$('start').addEventListener('click', () => start());
$('practice').addEventListener('click', () => start('practice'));
$('retry').addEventListener('click', () => start(sim.mode));
$('pause-restart').addEventListener('click', restart);
$('pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);
$('pause-home').addEventListener('click', home);
$('results-home').addEventListener('click', home);
document.querySelector('.brand')!.addEventListener('click', e => { e.preventDefault(); if (sim.phase === 'playing') togglePause(); else home(); });
let resumeAfterHelp = false;
function openHelp() {
  resumeAfterHelp = sim.phase === 'playing';
  if (resumeAfterHelp) togglePause();
  help.showModal();
}
for (const id of ['help-open', 'footer-help']) $(id).addEventListener('click', openHelp);
for (const id of ['help-close', 'help-done']) $(id).addEventListener('click', () => help.close());
help.addEventListener('close', () => { if (resumeAfterHelp && sim.phase === 'paused' && !document.hidden) togglePause(); resumeAfterHelp = false; });
function syncSound() {
  $('sound').setAttribute('aria-label', audio.muted ? 'Enable sound' : 'Mute sound');
  $('sound').setAttribute('aria-pressed', String(audio.muted));
  $('sound').classList.toggle('is-muted', audio.muted);
}
$('sound').addEventListener('click', () => {
  audio.muted = !audio.muted; syncSound();
  if (!audio.muted) void audio.start();
  try { localStorage.setItem('boostline.muted', String(audio.muted)); } catch { /* Keep the preference in memory. */ }
});
syncSound();

const boundKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyS', 'KeyF', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyP', 'KeyR']);
window.addEventListener('keydown', event => {
  if (help.open) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if ((event.code === 'Space' || event.code === 'Enter') && event.target instanceof Element && event.target.closest('button, a')) return;
  if (boundKeys.has(event.code)) event.preventDefault();
  if (event.repeat) return;
  if ((event.code === 'Space' || event.code === 'Enter') && (sim.phase === 'ready' || sim.phase === 'crashed')) { start(sim.phase === 'ready' ? 'run' : sim.mode); return; }
  if (event.code === 'Escape' || event.code === 'KeyP') { togglePause(); return; }
  if (event.code === 'KeyR' && sim.phase !== 'ready') { restart(); return; }
  if (sim.phase !== 'playing') return;
  heldKeys.add(event.code);
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') sim.changeLane(-1);
  if (event.code === 'ArrowRight' || event.code === 'KeyD') sim.changeLane(1);
  if (event.code === 'Space' || event.code === 'ArrowUp') sim.jump();
  if (event.code === 'KeyF') sim.trick('flip');
  if (event.code === 'KeyQ') sim.trick('roll-left');
  if (event.code === 'KeyE') sim.trick('roll-right');
});
window.addEventListener('keyup', event => { heldKeys.delete(event.code); });
window.addEventListener('blur', () => { audio.silence(); clearInput(); if (sim.phase === 'playing') { sim.pause(); syncScreens(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.silence(); if (document.hidden && sim.phase === 'playing') { sim.pause(); clearInput(); syncScreens(); } });
window.addEventListener('resize', clearInput);

document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
  const action = button.dataset.control!;
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('pointerdown', event => {
    if (sim.phase !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    touchPointers.set(event.pointerId, action); button.classList.add('pressed');
    if (action === 'left') sim.changeLane(-1);
    if (action === 'right') sim.changeLane(1);
    if (action === 'flip') sim.trick('flip');
    if (action === 'roll-left' || action === 'roll-right') sim.trick(action);
    if (action === 'jump') sim.jump();
  });
  const release = (event: PointerEvent) => {
    touchPointers.delete(event.pointerId);
    button.classList.toggle('pressed', touchActive(action));
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

let noticeTime = 0;
let lastPhase: Phase = sim.phase;
let world: World | null = null;
try { world = new World($('scene')); }
catch {
  $('fatal-error').hidden = false;
  $('fatal-error').textContent = 'The 3D scene could not start. Try a current browser with graphics acceleration enabled, then reload.';
  $<HTMLButtonElement>('start').disabled = true;
  $<HTMLButtonElement>('practice').disabled = true;
}
function updateHud() {
  $('score').textContent = String(sim.score).padStart(6, '0');
  $('distance').textContent = `${number(sim.distance)} M`;
  $('combo').textContent = `${sim.combo}× COMBO`;
  $('speed').innerHTML = `${Math.round(sim.speed * 3.6)} <small>KM/H</small>`;
  $('flight-state').textContent = sim.airborne ? 'AIRBORNE' : sim.boostActive ? 'BOOST ENGAGED' : 'ON THE ROAD';
  $('flight-state').classList.toggle('airborne', sim.airborne);
  $('energy-number').textContent = `${Math.round(sim.energy)}%`;
  $('energy-fill').style.transform = `scaleX(${sim.energy / 100})`;
  $('energy-meter').setAttribute('aria-valuenow', String(Math.round(sim.energy)));
  $('energy-panel').classList.toggle('low-energy', sim.energy < 20);
  $('energy-hint').textContent = sim.energy < 15 ? 'Low energy · land to recharge' : touchDevice.matches ? 'Hold JUMP to fly · land to recharge' : 'Hold SPACE to fly · SHIFT to boost';
}
function finishRun() {
  const record = sim.mode === 'run' && sim.score > best;
  if (record) {
    best = sim.score;
    try { localStorage.setItem('boostline.best.v1', String(best)); } catch { storageAvailable = false; }
  }
  $('record-label').textContent = sim.mode === 'practice' ? 'PRACTICE COMPLETE' : record ? 'A NEW PERSONAL BEST' : 'RUN COMPLETE';
  $('crash-reason').textContent = sim.crashReason + (!storageAvailable ? ' This browser could not save the record.' : '');
  $('final-score').textContent = number(sim.score);
  $('final-distance').textContent = `${number(sim.distance)} m`;
  $('final-combo').textContent = `${sim.maxCombo}×`;
  $('final-tricks').textContent = String(sim.tricksLanded);
  clearInput(); syncScreens();
}
let previous = performance.now(), accumulator = 0, hudTime = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - previous) / 1000); previous = now;
  held.thrust = heldKeys.has('Space') || heldKeys.has('ArrowUp') || touchActive('jump');
  held.boost = heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || touchActive('boost');
  held.slam = heldKeys.has('ArrowDown') || heldKeys.has('KeyS') || touchActive('slam');
  if (sim.phase === 'playing') {
    accumulator += dt;
    while (accumulator >= FIXED_STEP) { sim.step(FIXED_STEP, held); accumulator -= FIXED_STEP; }
  } else accumulator = 0;
  for (const event of sim.takeEvents()) {
    audio.cue(event);
    if (event.title && event.kind !== 'crash') {
      const notice = $('stunt-notice');
      notice.querySelector('strong')!.textContent = event.title;
      notice.querySelector('span')!.textContent = event.detail;
      notice.classList.add('visible'); noticeTime = 2.1;
    }
  }
  if (lastPhase !== sim.phase) { if (sim.phase === 'crashed') finishRun(); lastPhase = sim.phase; }
  if (noticeTime > 0 && sim.phase === 'playing') { noticeTime -= dt; if (noticeTime <= 0) $('stunt-notice').classList.remove('visible'); }
  if (sim.phase === 'crashed' || sim.phase === 'ready') $('stunt-notice').classList.remove('visible');
  hudTime += dt; if (hudTime >= 0.05) { updateHud(); hudTime = 0; }
  audio.update(sim); world?.render(sim, dt, now / 1000); requestAnimationFrame(frame);
}
syncScreens(); requestAnimationFrame(frame);
// Read-only local inspection for browser checks; removed from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.defineProperty(window, '__boostline', { value: {
    snapshot: () => ({ phase: sim.phase, mode: sim.mode, x: sim.x, lane: sim.lane, height: sim.height,
      energy: sim.energy, distance: sim.distance, score: sim.score, tricksLanded: sim.tricksLanded,
      pendingTricks: sim.pendingTricks, trafficCount: sim.traffic.length, pitch: sim.pitch, roll: sim.roll,
      thrustActive: sim.thrustActive, boostActive: sim.boostActive, slamHeld: held.slam,
      elapsed: sim.elapsed, activePointers: touchPointers.size, pixelRatio: world?.renderer.getPixelRatio(),
      carBounds: world?.inspectCarBounds(), renderCalls: world?.renderer.info.render.calls,
      geometries: world?.renderer.info.memory.geometries }),
  } });
}
