import './style.css';
import { PROGRESS_KEY, PAINTS, CHALLENGES, MAX_CREDITS, parseProfile, usePaint, nextChallenge, RunProgress, type RunReward } from './game/progression';
import { SETTINGS_KEY, parseSettings, type GraphicsSettings, type GraphicsQuality } from './game/settings';
import { Simulation, FIXED_STEP, type HeldInput, type Mode, type Phase } from './game/simulation';
import { World } from './game/world';
import { GameAudio } from './game/audio';
import { SwipeSteering } from './game/swipe';
import { DrivingSchool, lessonCopy } from './game/training';
import { flightAssist } from './game/flight-assist';
import { trafficThreat, type TrafficThreat } from './game/traffic-warning';
import { GhostRecorder, GHOST_KEY, parseGhost, betterGhost, ghostAt, ghostDistance, ghostDuration, type GhostRun, type GhostPose } from './game/ghost';

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
    <div class="top-actions"><span class="build-badge">OPEN ROAD <span>v0.2</span></span><button id="sound" class="icon-button" aria-label="Mute sound" aria-pressed="false">${volumeIcon}</button><button id="settings-open" class="icon-button" aria-label="Graphics and effects settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#243739"/><circle cx="16" cy="17" r="3" fill="#243739"/></svg></button><button id="pause" class="icon-button" aria-label="Pause game" hidden>${pauseIcon}</button></div>
  </header>

  <main>
    <section id="welcome" class="welcome" aria-labelledby="hero-title">
      <div class="eyebrow"><span class="small-rule"></span> AN ARCADE HIGHWAY STUNT RUNNER</div>
      <h1 id="hero-title">Take the<br><em>high road.</em></h1>
      <p class="hero-description">A little speed. A little altitude.<br>Find your way through the traffic.</p>
      <div class="start-actions"><button id="start" class="primary-button">Start your run ${arrow}</button><button id="practice" class="text-button">Practice flight <span>↗</span></button></div>
      <button id="learn" class="learn-button"><span aria-hidden="true">◎</span><span id="learn-label">First drive? Learn the moves</span><span aria-hidden="true">↗</span></button>
      <div class="ghost-setting"><button data-ghost-toggle aria-pressed="true">Ghost on</button><span id="ghost-home-copy">Finish a run to save a distance ghost.</span></div>
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
      <div class="score-block"><span class="hud-label" id="run-label">CURRENT RUN</span><strong id="score">000000</strong><div class="score-meta"><span id="distance">0 M</span><span id="combo">1× COMBO</span></div><div id="challenge-hud" class="challenge-hud" hidden></div><div id="ghost-status" class="ghost-status" hidden></div><div id="traffic-warning" class="traffic-warning" role="status" hidden><span id="traffic-message"></span><span id="traffic-gap" aria-hidden="true"></span></div></div>
      <div class="speed-block"><span class="hud-label">GROUND SPEED</span><strong id="speed">0 <small>KM/H</small></strong><span id="flight-state" class="flight-state">ON THE ROAD</span><span id="flight-detail" class="flight-detail"></span><span id="fps-counter" class="fps-counter" hidden></span></div>
    </section>

    <div id="stunt-notice" class="stunt-notice" role="status" aria-live="polite"><strong></strong><span></span></div>

    <section id="lesson-panel" class="lesson-panel" aria-labelledby="lesson-title" hidden>
      <div class="lesson-copy" aria-live="polite"><span id="lesson-count" class="lesson-count"></span><h2 id="lesson-title"></h2><p id="lesson-detail"></p></div>
      <button id="lesson-skip" aria-label="Skip driving school and keep practising">Skip</button>
      <div id="lesson-progress" class="lesson-progress" role="progressbar" aria-label="Driving school progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
    </section>

    <section id="school-complete" class="modal-card school-complete" aria-labelledby="school-title" hidden><span class="eyebrow">DRIVING SCHOOL COMPLETE</span><h2 id="school-title">You've got the moves.</h2><p>You changed lanes, took flight, landed a stunt and used boost. Time to find a gap in the traffic.</p><div class="school-skills">✓ STEER &nbsp; ✓ FLY &nbsp; ✓ STUNT &nbsp; ✓ LAND &nbsp; ✓ BOOST</div><button id="school-race" class="primary-button">Hit the traffic ${arrow}</button><button id="school-practice" class="secondary-button">Keep practising</button><button id="school-home" class="text-button">Main menu</button></section>

    <div id="energy-panel" class="energy-panel" hidden><div class="energy-caption"><span><i></i> THRUSTER ENERGY</span><strong id="energy-number">100%</strong></div><div id="energy-meter" class="energy-track" role="progressbar" aria-label="Thruster energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><div id="energy-fill"></div></div><div class="energy-hint" id="energy-hint">Hold SPACE to fly · SHIFT to boost</div></div>

    <section id="pause-panel" class="modal-card" aria-labelledby="pause-title" hidden><span class="eyebrow">TAKE A BREATHER</span><h2 id="pause-title">Road's waiting.</h2><p>Your run is paused. Pick up right where you left off.</p><button id="resume" class="primary-button">Back to the road ${arrow}</button><button id="pause-restart" class="secondary-button">Restart run</button><button data-ghost-toggle class="secondary-button" aria-pressed="true">Ghost on</button><button id="pause-garage" class="secondary-button" data-garage-open>Garage & challenges</button><button id="pause-home" class="text-button">Main menu</button></section>

    <section id="results" class="modal-card results" aria-labelledby="results-title" hidden><span class="eyebrow" id="record-label">RUN COMPLETE</span><h2 id="results-title">One more run?</h2><p id="crash-reason"></p><div class="result-score"><span>FINAL SCORE</span><strong id="final-score">0</strong></div><div class="result-stats"><div><strong id="final-distance">0 m</strong><span>DISTANCE</span></div><div><strong id="final-combo">1×</strong><span>BEST COMBO</span></div><div><strong id="final-tricks">0</strong><span>LANDED TRICKS</span></div></div><p id="ghost-result" class="ghost-result" role="status"></p><div id="run-reward" class="run-reward" hidden><strong id="reward-total"></strong><p id="reward-breakdown"></p><p id="reward-challenge"></p><span id="reward-storage"></span></div><button id="retry" class="primary-button">Try again <span>R ${arrow}</span></button><button id="results-garage" class="secondary-button" data-garage-open>Visit garage</button><button id="results-home" class="text-button">Back to main menu</button></section>

    <dialog id="garage" class="help-dialog garage-dialog" aria-labelledby="garage-title">
      <div class="help-heading"><span class="eyebrow">YOUR COAST. YOUR COLOURS.</span><button id="garage-close" class="icon-button" aria-label="Close garage">×</button></div>
      <div class="garage-title-row"><h2 id="garage-title">Make it yours.</h2><strong id="garage-balance" aria-label="Credit balance">0 CR</strong></div>
      <section class="garage-challenge" aria-labelledby="challenge-title"><span id="challenge-count" class="eyebrow"></span><h3 id="challenge-title"></h3><p id="challenge-detail"></p><div class="challenge-track" id="challenge-meter" role="progressbar" aria-label="Current challenge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="challenge-summary"><span id="challenge-progress"></span><strong id="challenge-bonus"></strong></div></section>
      <p class="garage-rules">Earn credits in scored runs. Each run has one challenge; claim rewards when it ends in a crash. Practice and restarts earn nothing.</p>
      <div id="paint-grid" class="paint-grid">${PAINTS.map(paint => `<article class="paint-card" data-paint-card="${paint.id}" style="--paint:#${paint.color.toString(16).padStart(6, '0')}"><div class="paint-preview" aria-hidden="true"><svg viewBox="0 0 180 62" fill="none"><path d="M20 34 52 29 67 12h48l20 19 26 7v12H20Z" fill="var(--paint)"/><path d="m61 28 12-11h35l13 13Z" fill="#28494c"/><path d="M107 17v12M35 39h108" stroke="#d6ff78" stroke-width="3"/><path d="M148 32h18v4h-18Z" fill="#6b8583"/><circle cx="48" cy="49" r="11" fill="#102829"/><circle cx="134" cy="49" r="11" fill="#102829"/><circle cx="48" cy="49" r="5" fill="#90a6a3"/><circle cx="134" cy="49" r="5" fill="#90a6a3"/></svg></div><h3>${paint.name}</h3><button type="button" data-paint="${paint.id}" aria-label="Use ${paint.name}"></button></article>`).join('')}</div>
      <p class="paint-note">Colour only · identical handling and power</p><p id="garage-status" role="status" aria-live="polite"></p><button id="garage-done" class="primary-button">Back to the road ${arrow}</button>
    </dialog>

    <dialog id="settings" class="help-dialog settings-dialog" aria-labelledby="settings-title"><div class="help-heading"><span class="eyebrow">MAKE IT YOUR DRIVE</span><button id="settings-close" class="icon-button" aria-label="Close settings">×</button></div><h2 id="settings-title">Find your balance.</h2>
      <label class="settings-quality" for="graphics-quality">Graphics<select id="graphics-quality" aria-describedby="quality-description"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label>
      <p id="quality-description">Balanced detail for everyday play.</p>
      <label id="motion-setting" class="setting-check"><input id="reduced-effects" type="checkbox"><span>Reduce effects<small>Remove trails, bursts and boost camera widening.</small></span></label>
      <p id="system-motion" hidden>Your device's reduced-motion preference is active.</p>
      <label id="fps-setting" class="setting-check"><input id="show-fps" type="checkbox"><span>Show frame rate<small>See how smoothly the game is drawing.</small></span></label>
      <p id="settings-status" role="status">Changes apply immediately and save on this browser.</p><button id="settings-done" class="primary-button">Done ${arrow}</button>
    </dialog>

    <dialog id="help" class="help-dialog"><div class="help-heading"><span class="eyebrow">THE DRIVER'S GUIDE</span><button id="help-close" class="icon-button" aria-label="Close controls">×</button></div><h2>Learn your moves.</h2><dl><div><dt><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd></dt><dd>Change lane</dd></div><div><dt><kbd>SPACE</kbd></dt><dd>Jump · hold for upward thrust</dd></div><div><dt><kbd>SHIFT</kbd></dt><dd>Hold to boost forward</dd></div><div><dt><kbd>F</kbd></dt><dd>Front flip while airborne</dd></div><div><dt><kbd>Q</kbd> <kbd>E</kbd></dt><dd>Barrel roll left / right</dd></div><div><dt><kbd>↓</kbd> / <kbd>S</kbd></dt><dd>Slam downward</dd></div><div><dt><kbd>ESC</kbd> / <kbd>P</kbd></dt><dd>Pause / resume</dd></div><div><dt><kbd>R</kbd></dt><dd>Restart current mode</dd></div></dl><p>Land a completed trick to bank points. Energy refills on the road. Practice flight has an empty highway. The cyan ghost replays your longest finished run; you can drive through it. Ghosts are saved on this browser for runs up to 10 minutes. Toggle the ghost on the home or pause screen.</p><button id="help-done" class="primary-button">Got it ${arrow}</button></dialog>
  </main>

  <footer class="bottom-bar"><button id="garage-open" class="garage-open" data-garage-open>GARAGE <span id="garage-wallet">0 CR</span><span aria-hidden="true">↗</span></button><div class="control-strip"><span><kbd>← →</kbd> STEER</span><span><kbd>SPACE</kbd> FLY</span><span><kbd>F</kbd> FLIP</span><span><kbd>Q E</kbd> ROLL</span><span><kbd>SHIFT</kbd> BOOST</span></div><button id="footer-help" class="footer-help">CONTROLS <span>?</span></button></footer>
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
const school = new DrivingSchool();
const swipes = new SwipeSteering();
sim.start(); sim.phase = 'ready'; sim.speed = 0;
const audio = new GameAudio();
const heldKeys = new Set<string>();
const touchPointers = new Map<number, string>();
const touchDevice = matchMedia('(pointer: coarse)');
const touchActive = (action: string) => [...touchPointers.values()].includes(action);
const held: HeldInput = { thrust: false, boost: false, slam: false };
const help = $<HTMLDialogElement>('help');
const settingsDialog = $<HTMLDialogElement>('settings');
const garageDialog = $<HTMLDialogElement>('garage');
const progression = new RunProgress();
let profile = parseProfile(null);
let progressStored = true;
let resumeAfterGarage = false;
let lastReward: RunReward | null = null;
try { profile = parseProfile(localStorage.getItem(PROGRESS_KEY)); } catch { progressStored = false; }
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let graphics: GraphicsSettings = parseSettings(null);
try { graphics = parseSettings(localStorage.getItem(SETTINGS_KEY)); } catch { /* Defaults work without storage. */ }
let resumeAfterSettings = false;
help.querySelector('dl')!.classList.add('keyboard-guide');
help.querySelector('dl')!.insertAdjacentHTML('beforebegin', `<dl class="touch-guide">
  <div><dt>SWIPE / ← →</dt><dd>Swipe on the road or tap to change lane</dd></div>
  <div><dt>JUMP</dt><dd>Tap to jump · hold to fly</dd></div>
  <div><dt>BOOST</dt><dd>Hold for forward speed</dd></div>
  <div><dt>FLIP / ROLL</dt><dd>Tap in the air to start a stunt</dd></div>
  <div><dt>SLAM</dt><dd>Hold to drop fast</dd></div>
  <div><dt>Ⅱ PAUSE</dt><dd>Pause, restart or return home</dd></div>
</dl>`);
let lastThreat: TrafficThreat | null = null;
const recorder = new GhostRecorder();
let savedGhost: GhostRun | null = null;
let raceGhost: GhostRun | null = null;
let ghostPose: GhostPose | null = null;
let ghostEnabled = true;
let ghostStored = true;
try {
  savedGhost = parseGhost(localStorage.getItem(GHOST_KEY));
  ghostEnabled = localStorage.getItem('boostline.ghost.enabled') !== 'false';
} catch { ghostStored = false; }

let best = 0;
let storageAvailable = true;
let schoolSeen = false;
try {
  const stored = Number(localStorage.getItem('boostline.best.v1'));
  best = Number.isFinite(stored) ? Math.max(0, stored) : 0;
  audio.muted = localStorage.getItem('boostline.muted') === 'true';
  schoolSeen = localStorage.getItem('boostline.school.v1') === 'complete';
} catch { storageAvailable = false; }
const number = (n: number) => Math.floor(n).toLocaleString('en-US');
$('home-best').textContent = best ? number(best) : 'SET YOUR FIRST RECORD';
$('learn-label').textContent = schoolSeen ? 'Replay driving school' : 'First drive? Learn the moves';

function syncGhostSettings() {
  document.querySelectorAll<HTMLButtonElement>('[data-ghost-toggle]').forEach(button => {
    button.textContent = `Ghost ${ghostEnabled ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(ghostEnabled));
    button.setAttribute('aria-label', 'Show best distance ghost');
  });
  $('ghost-home-copy').textContent = savedGhost
    ? `Best distance ${number(ghostDistance(savedGhost))} m · ${ghostStored ? 'saved here' : 'this session'}`
    : 'Finish a run to save a distance ghost.';
}
document.querySelectorAll('[data-ghost-toggle]').forEach(button => button.addEventListener('click', () => {
  ghostEnabled = !ghostEnabled; syncGhostSettings();
  try { localStorage.setItem('boostline.ghost.enabled', String(ghostEnabled)); } catch { /* Keep the choice for this session. */ }
}));
syncGhostSettings();

function clearInput() {
  heldKeys.clear(); touchPointers.clear(); held.thrust = held.boost = held.slam = false;
  swipes.reset(); lastThreat = null; $('traffic-warning').hidden = true;
  document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('pressed'));
}

function focusRoad() { $('scene').querySelector('canvas')?.focus({ preventScroll: true }); }

function start(mode: Mode = 'run', guided = false) {
  clearInput(); sim.start(mode); noticeTime = 0;
  progression.begin(sim, profile); lastReward = null;
  recorder.start(sim); raceGhost = mode === 'run' ? savedGhost : null; ghostPose = null;
  if (guided) school.begin(sim); else school.end();
  world?.resetFeedback();
  $('stunt-notice').classList.remove('visible');
  void audio.start(); syncScreens();
  focusRoad();
}

function restart() { start(sim.mode, school.active); }

function syncScreens() {
  app.dataset.phase = sim.phase;
  app.dataset.school = school.active ? 'active' : 'off';
  $('welcome').hidden = sim.phase !== 'ready';
  $('briefing').hidden = sim.phase !== 'ready';
  $('hud').hidden = sim.phase === 'ready';
  $('energy-panel').hidden = sim.phase === 'ready';
  $('pause').hidden = sim.phase !== 'playing';
  $('pause-panel').hidden = sim.phase !== 'paused' || school.completed;
  $('school-complete').hidden = !school.completed;
  $('lesson-panel').hidden = !school.active || school.completed || sim.phase !== 'playing';
  $('results').hidden = sim.phase !== 'crashed';
  $('touch-controls').hidden = sim.phase !== 'playing';
  $('run-label').textContent = school.active ? 'DRIVING SCHOOL' : sim.mode === 'practice' ? 'PRACTICE · EMPTY HIGHWAY' : 'CURRENT RUN';
  syncLesson();
  if (sim.phase === 'paused') $(school.completed ? 'school-race' : 'resume').focus();
  if (sim.phase === 'crashed') $('retry').focus();
}

function togglePause() {
  if (school.completed) return;
  sim.pause(); clearInput(); syncScreens();
  if (sim.phase === 'paused') audio.silence();
  if (sim.phase === 'playing') { void audio.start(); focusRoad(); }
}

function home() {
  clearInput(); progression.cancel(); sim.start(); sim.phase = 'ready'; sim.speed = 0;
  school.end(); world?.resetFeedback(); ghostPose = null; raceGhost = null; syncGhostSettings();
  $('home-best').textContent = best ? number(best) : 'SET YOUR FIRST RECORD';
  $('stunt-notice').classList.remove('visible'); syncScreens();
  $('start').focus();
}

$('start').addEventListener('click', () => start());
$('practice').addEventListener('click', () => start('practice'));
$('learn').addEventListener('click', () => start('practice', true));
$('lesson-skip').addEventListener('click', () => { school.end(); clearInput(); syncScreens(); focusRoad(); });
$('school-race').addEventListener('click', () => start());
$('school-practice').addEventListener('click', () => start('practice'));
$('school-home').addEventListener('click', home);
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
help.addEventListener('close', () => { if (resumeAfterHelp && sim.phase === 'paused') togglePause(); resumeAfterHelp = false; });

function syncSound() {
  $('sound').setAttribute('aria-label', audio.muted ? 'Enable sound' : 'Mute sound');
  $('sound').setAttribute('aria-pressed', String(audio.muted));
  $('sound').classList.toggle('is-muted', audio.muted);
}
$('sound').addEventListener('click', () => {
  audio.muted = !audio.muted; syncSound();
  if (!audio.muted) void audio.start();
  try { localStorage.setItem('boostline.muted', String(audio.muted)); } catch { /* Settings remain in memory. */ }
});
syncSound();

const boundKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyS', 'KeyF', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyP', 'KeyR']);
window.addEventListener('keydown', event => {
  if (help.open || settingsDialog.open || garageDialog.open) return;
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

const road = $('scene');
road.addEventListener('pointerdown', event => {
  if (sim.phase !== 'playing' || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
  event.preventDefault();
  if (swipes.begin(event.pointerId, event.clientX, event.clientY, event.timeStamp)) road.setPointerCapture(event.pointerId);
});
road.addEventListener('pointermove', event => {
  if (sim.phase !== 'playing') return;
  const direction = swipes.move(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  if (direction !== null) sim.changeLane(direction);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) road.addEventListener(name, event => swipes.end(event.pointerId));
road.addEventListener('contextmenu', event => { if (sim.phase === 'playing') event.preventDefault(); });

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
try { world = new World($('scene'), graphics); }
catch {
  $('fatal-error').hidden = false;
  $('fatal-error').textContent = 'The 3D scene could not start. Try a current browser with graphics acceleration enabled, then reload.';
  $<HTMLButtonElement>('start').disabled = true;
  $<HTMLButtonElement>('practice').disabled = true;
  $<HTMLButtonElement>('learn').disabled = true;
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(profile)); progressStored = true; }
  catch { progressStored = false; }
}
function progressStorageCopy() { return progressStored ? 'Saved on this browser.' : 'Session only: this browser could not save your progress.'; }
function syncProgression(message = '') {
  $('garage-wallet').textContent = `${number(profile.credits)} CR`;
  $('garage-balance').textContent = `${number(profile.credits)} CR`;
  const live = (sim.phase === 'playing' || sim.phase === 'paused') && sim.mode === 'run';
  const status = live ? progression.status(sim) : nextChallenge(profile);
  $('challenge-count').textContent = status ? `CHALLENGE ${status.index + 1} / ${CHALLENGES.length}` : `${CHALLENGES.length} / ${CHALLENGES.length} COMPLETE`;
  $('challenge-title').textContent = status?.challenge.title ?? 'Coast mastered.';
  $('challenge-detail').textContent = status?.challenge.detail ?? 'All six challenges cleared. Keep driving to earn credits and beat your records.';
  const percent = status ? Math.floor(status.value / status.challenge.target * 100) : 100;
  $('challenge-meter').setAttribute('aria-valuenow', String(percent));
  $('challenge-meter').firstElementChild!.setAttribute('style', `transform:scaleX(${percent / 100})`);
  $('challenge-progress').textContent = status ? status.reached ? 'Reached · finish run to claim' : `${number(status.value)} / ${number(status.challenge.target)}${status.challenge.metric === 'distance' ? ' M' : ''} · one run` : 'All bonuses claimed';
  $('challenge-bonus').textContent = status ? `+${status.challenge.bonus} CR` : '✓';
  for (const paint of PAINTS) {
    const button = document.querySelector<HTMLButtonElement>(`[data-paint="${paint.id}"]`)!;
    const owned = profile.owned.includes(paint.id), equipped = profile.equipped === paint.id;
    button.textContent = equipped ? 'Equipped ✓' : owned ? 'Use colour' : `Unlock · ${paint.price} CR`;
    button.disabled = !owned && profile.credits < paint.price;
    button.setAttribute('aria-label', `${equipped ? 'Equipped' : owned ? 'Use' : 'Unlock'} ${paint.name}${owned ? '' : ` for ${paint.price} credits`}`);
    button.setAttribute('aria-pressed', String(equipped));
    button.closest<HTMLElement>('.paint-card')!.dataset.equipped = String(equipped);
  }
  $('garage-status').textContent = `${message ? message + ' ' : ''}${progressStorageCopy()}`;
  world?.setPaint(PAINTS.find(paint => paint.id === profile.equipped)!.color);
}
document.querySelectorAll('[data-garage-open]').forEach(button => button.addEventListener('click', () => {
  resumeAfterGarage = sim.phase === 'playing';
  if (resumeAfterGarage) togglePause();
  clearInput(); syncProgression(); garageDialog.showModal(); garageDialog.scrollTop = 0;
}));
for (const id of ['garage-close', 'garage-done']) $(id).addEventListener('click', () => garageDialog.close());
garageDialog.addEventListener('close', () => {
  if (resumeAfterGarage && sim.phase === 'paused' && !document.hidden) togglePause();
  resumeAfterGarage = false;
});
$('paint-grid').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-paint]');
  if (!button || button.disabled) return;
  const result = usePaint(profile, button.dataset.paint!);
  if (result.outcome === 'invalid' || result.outcome === 'insufficient') return;
  profile = result.profile; saveProgress();
  const name = PAINTS.find(paint => paint.id === profile.equipped)!.name;
  syncProgression(`${name} ${result.outcome === 'unlocked' ? 'unlocked and equipped.' : 'equipped.'}`);
});
syncProgression();

function syncGraphics() {
  $<HTMLSelectElement>('graphics-quality').value = graphics.quality;
  $<HTMLInputElement>('reduced-effects').checked = graphics.reducedEffects;
  $<HTMLInputElement>('show-fps').checked = graphics.showFps;
  $('system-motion').hidden = !systemMotion.matches;
  app.dataset.reducedEffects = String(graphics.reducedEffects || systemMotion.matches);
  $('quality-description').textContent = { performance: 'Lower resolution and fewer effects to ease the load on your phone.', balanced: 'Balanced detail for everyday play.', quality: 'Sharper resolution and fuller effects. Uses more graphics power.' }[graphics.quality];
  world?.applyGraphics(graphics);
}
$('settings-open').addEventListener('click', () => {
  resumeAfterSettings = sim.phase === 'playing';
  if (resumeAfterSettings) togglePause();
  clearInput(); settingsDialog.showModal();
});
for (const id of ['settings-close', 'settings-done']) $(id).addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('close', () => {
  if (resumeAfterSettings && sim.phase === 'paused' && !document.hidden) togglePause();
  resumeAfterSettings = false;
});
for (const id of ['graphics-quality', 'reduced-effects', 'show-fps']) $(id).addEventListener('change', () => {
  graphics = { quality: $<HTMLSelectElement>('graphics-quality').value as GraphicsQuality, reducedEffects: $<HTMLInputElement>('reduced-effects').checked, showFps: $<HTMLInputElement>('show-fps').checked };
  syncGraphics();
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(graphics)); $('settings-status').textContent = 'Settings saved on this browser.'; }
  catch { $('settings-status').textContent = 'Settings apply for this session. This browser could not save them.'; }
});
systemMotion.addEventListener('change', syncGraphics);
syncGraphics();

let lessonKey = '';
function syncLesson() {
  const key = `${school.active}:${school.completed}:${school.index}:${school.retry}:${touchDevice.matches}`;
  if (key === lessonKey) return;
  lessonKey = key;
  const copy = lessonCopy(school.lesson, touchDevice.matches);
  $('lesson-count').textContent = `DRIVING SCHOOL · ${school.index + 1} / 5`;
  $('lesson-title').textContent = copy.title;
  $('lesson-detail').textContent = school.retry ? `Let's try again. ${copy.detail}` : copy.detail;
  document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(button => {
    button.classList.toggle('suggested', school.active && !school.completed && copy.controls.includes(button.dataset.control!));
  });
}

function finishSchool() {
  sim.pause(); clearInput(); noticeTime = 0;
  $('stunt-notice').classList.remove('visible');
  try { localStorage.setItem('boostline.school.v1', 'complete'); } catch { /* Lessons remain usable without storage. */ }
  $('learn-label').textContent = 'Replay driving school';
  syncScreens();
}

function updateHud() {
  const target = progression.status(sim);
  $('challenge-hud').hidden = sim.mode !== 'run' || sim.phase !== 'playing';
  $('challenge-hud').textContent = target ? target.reached ? 'CHALLENGE ✓ · FINISH RUN TO CLAIM' : `${target.challenge.short} · ${number(target.value)} / ${number(target.challenge.target)}${target.challenge.metric === 'distance' ? ' M' : ''}` : 'ALL CHALLENGES COMPLETE';
  $('challenge-hud').dataset.reached = String(!!target?.reached);
  $('fps-counter').hidden = !graphics.showFps || sim.phase !== 'playing';
  $('fps-counter').textContent = fps ? `${fps} FPS` : 'MEASURING FPS';
  $('score').textContent = String(sim.score).padStart(6, '0');
  $('distance').textContent = `${number(sim.distance)} M`;
  $('combo').textContent = `${sim.combo}× COMBO`;
  $('speed').innerHTML = `${Math.round(sim.speed * 3.6)} <small>KM/H</small>`;
  const assist = flightAssist(sim, held.slam);
  $('flight-state').textContent = sim.airborne ? assist.label : sim.boostActive ? 'BOOST ENGAGED' : 'ON THE ROAD';
  $('flight-state').dataset.tone = sim.airborne ? assist.tone : 'grounded';
  $('flight-detail').textContent = sim.airborne ? `${sim.height.toFixed(1)} M ABOVE ROAD` : '';
  $('energy-number').textContent = `${Math.round(sim.energy)}%`;
  $('energy-fill').style.transform = `scaleX(${sim.energy / 100})`;
  $('energy-meter').setAttribute('aria-valuenow', String(Math.round(sim.energy)));
  $('energy-panel').classList.toggle('low-energy', sim.energy < 20);
  $('energy-hint').textContent = sim.energy < 15 ? 'Low energy · land to recharge' : touchDevice.matches
    ? sim.airborne ? assist.hint : 'Hold JUMP to fly · land to recharge'
    : sim.airborne ? assist.hint : 'Hold SPACE to fly · SHIFT to boost';
  lastThreat = trafficThreat(sim, held);
  const warning = $('traffic-warning');
  warning.hidden = !lastThreat;
  if (lastThreat) {
    warning.classList.toggle('urgent', lastThreat.urgent);
    const message = lastThreat.urgent ? 'CHOOSE A GAP' : 'TRAFFIC AHEAD';
    if ($('traffic-message').textContent !== message) $('traffic-message').textContent = message;
    $('traffic-gap').textContent = `${Math.round(lastThreat.gap)} M`;
  }
  const ghostStatus = $('ghost-status');
  ghostStatus.hidden = !ghostEnabled || sim.mode !== 'run' || sim.phase !== 'playing';
  if (!ghostStatus.hidden) {
    const pose = ghostAt(raceGhost, sim.elapsed);
    const gap = pose ? Math.round(sim.distance - pose.distance) : 0;
    ghostStatus.dataset.tone = gap > 0 ? 'ahead' : 'neutral';
    ghostStatus.textContent = !raceGhost ? 'GHOST · RECORDING YOUR FIRST RUN'
      : !pose ? sim.distance > ghostDistance(raceGhost) ? 'GHOST · DISTANCE RECORD PASSED' : `GHOST FINISHED · ${Math.ceil(ghostDistance(raceGhost) - sim.distance)} M TO BEAT`
      : Math.abs(gap) < 2 ? 'GHOST · SIDE BY SIDE' : `YOU · ${Math.abs(gap)} M ${gap > 0 ? 'AHEAD OF' : 'BEHIND'} GHOST`;
  }
  syncLesson();
  if (school.active) {
    const progress = Math.round((school.index + school.progress) / 5 * 100);
    $('lesson-progress').setAttribute('aria-valuenow', String(progress));
    $('lesson-progress').firstElementChild!.setAttribute('style', `transform:scaleX(${progress / 100})`);
  }
}

function finishRun() {
  lastReward = progression.settle(profile, sim);
  if (lastReward) { profile = lastReward.profile; saveProgress(); }
  syncProgression();
  $('run-reward').hidden = !lastReward;
  if (lastReward) {
    $('reward-total').textContent = `+${number(lastReward.earned)} CR EARNED`;
    $('reward-breakdown').textContent = `${lastReward.distance} distance · ${lastReward.stunts} stunts · ${lastReward.closeCalls} close calls${lastReward.bonus ? ` · ${lastReward.bonus} challenge` : ''}`;
    const next = nextChallenge(profile);
    $('reward-challenge').textContent = lastReward.challenge ? `✓ ${lastReward.challenge.title} complete! ${next ? 'Next: ' + next.challenge.title + '.' : 'All six challenges complete.'}` : next ? `Next run: ${next.challenge.detail}` : 'All six challenges complete. Keep chasing your record.';
    $('reward-storage').textContent = `${progressStorageCopy()}${profile.credits === MAX_CREDITS ? ' Credit balance limit reached.' : ''}`;
  }
  const candidate = recorder.finish(sim);
  let ghostMessage = '';
  if (sim.mode === 'run') {
    if (betterGhost(candidate, savedGhost)) {
      savedGhost = candidate;
      try { localStorage.setItem(GHOST_KEY, JSON.stringify(savedGhost)); ghostStored = true; } catch { ghostStored = false; }
      ghostMessage = `New distance ghost · ${number(ghostDistance(savedGhost))} m. ${ghostStored ? 'Saved for your next run.' : 'Available this session; browser storage is full or unavailable.'}`;
    } else if (recorder.overflow) ghostMessage = `Ghost recording limit reached (10 minutes). ${savedGhost ? 'Your previous ghost is kept.' : 'No ghost was saved.'}`;
    else if (savedGhost) ghostMessage = `Distance ghost to beat: ${number(ghostDistance(savedGhost))} m.`;
    else ghostMessage = 'Finish a run lasting at least a second to save a ghost.';
  }
  $('ghost-result').textContent = ghostMessage;
  $('ghost-result').hidden = !ghostMessage;
  syncGhostSettings();
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

let previous = performance.now();
let accumulator = 0;
let hudTime = 0;
let fpsStart = performance.now(), fpsFrames = 0, fps = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - previous) / 1000); previous = now;
  fpsFrames++;
  if (now - fpsStart >= 1000) { fps = Math.round(fpsFrames * 1000 / (now - fpsStart)); fpsFrames = 0; fpsStart = now; }
  held.thrust = heldKeys.has('Space') || heldKeys.has('ArrowUp') || touchActive('jump');
  held.boost = heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || touchActive('boost');
  held.slam = heldKeys.has('ArrowDown') || heldKeys.has('KeyS') || touchActive('slam');
  if (sim.phase === 'playing') {
    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      sim.step(FIXED_STEP, held);
      recorder.capture(sim);
      const alreadyComplete = school.completed;
      school.update(sim, FIXED_STEP);
      if (school.completed && !alreadyComplete) finishSchool();
      accumulator -= FIXED_STEP;
    }
  } else accumulator = 0;
  for (const event of sim.takeEvents()) {
    progression.onEvent(event);
    audio.cue(event);
    world?.onEvent(event, sim);
    if (event.title && event.kind !== 'crash') {
      const notice = $('stunt-notice');
      notice.querySelector('strong')!.textContent = event.title;
      notice.querySelector('span')!.textContent = event.detail;
      notice.classList.add('visible'); noticeTime = 2.1;
    }
  }
  if (lastPhase !== sim.phase) {
    if (sim.phase === 'crashed') finishRun();
    lastPhase = sim.phase;
  }
  if (noticeTime > 0 && sim.phase === 'playing') {
    noticeTime -= dt; if (noticeTime <= 0) $('stunt-notice').classList.remove('visible');
  }
  if (sim.phase === 'crashed' || sim.phase === 'ready') $('stunt-notice').classList.remove('visible');
  hudTime += dt; if (hudTime >= 0.05) { updateHud(); hudTime = 0; }
  ghostPose = ghostEnabled && sim.mode === 'run' && (sim.phase === 'playing' || sim.phase === 'paused') ? ghostAt(raceGhost, sim.elapsed) : null;
  audio.update(sim); world?.render(sim, dt, now / 1000, held.slam, lastThreat, ghostPose);
  requestAnimationFrame(frame);
}
syncScreens(); requestAnimationFrame(frame);

// Read-only inspection is available only in local development for browser checks.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.defineProperty(window, '__boostline', { value: {
    snapshot: () => ({ phase: sim.phase, mode: sim.mode, x: sim.x, lane: sim.lane, height: sim.height,
      energy: sim.energy, distance: sim.distance, score: sim.score, tricksLanded: sim.tricksLanded,
      pendingTricks: sim.pendingTricks, trafficCount: sim.traffic.length, pitch: sim.pitch, roll: sim.roll,
      lesson: school.active ? school.lesson : null, lessonComplete: school.completed, lessonProgress: school.progress,
      flightTone: sim.airborne ? flightAssist(sim, held.slam).tone : 'grounded', landingMarker: world?.markerVisible,
      thrustActive: sim.thrustActive, boostActive: sim.boostActive, slamHeld: held.slam,
      trafficWarning: lastThreat, trafficHighlight: world?.highlightVisible,
      elapsed: sim.elapsed, ghostEnabled, ghostAvailable: !!savedGhost, ghostVisible: world?.ghostVisible,
      ghostPose, ghostDuration: raceGhost ? ghostDuration(raceGhost) : null,
      activePointers: touchPointers.size, pixelRatio: world?.renderer.getPixelRatio(), carBounds: world?.inspectCarBounds(),
      profile: { ...profile, owned: [...profile.owned] }, challenge: progression.status(sim), lastReward, progressStored, paintColor: world?.paintColor,
      graphics, effects: world?.inspectEffects(), audio: audio.inspect(), fps,
      renderCalls: world?.renderer.info.render.calls, geometries: world?.renderer.info.memory.geometries }),
  } });
}
