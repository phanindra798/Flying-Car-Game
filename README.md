# BOOSTLINE

A mobile-first browser arcade highway stunt runner, with desktop keyboard support. Pick a lane, jump over traffic, spend thruster energy, complete a flip or barrel roll, and land to bank your points.

**Current version: v0.6.0 — Course selection and ring review.** Choose Coastline or the new Sky Switch route, keep separate per-car records for each, and review every ring after finishing or crashing.

This update follows v0.5.0 and preserves existing Coastline records and garage progress.

## Local development

Requirements: Node.js 22.18 or later and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. On Windows PowerShell, `npm.cmd` can be used in place of `npm`.

### Play on your phone while developing in VS Code

1. Connect the phone and this computer to the same Wi-Fi network.
2. In VS Code, open **Terminal → New Terminal** inside the project folder.
3. Run `npm.cmd run dev:mobile` (or `npm run dev:mobile` on other systems).
4. Open the **Network** URL printed in that terminal in the phone's browser. Use the computer's IP address shown there, not `localhost` on the phone.
5. Keep the terminal running. Press **Ctrl+C** when finished.

If Windows asks about Node.js network access, allow it on your private home network. If the URL cannot load, check both devices are on the same network, that a VPN or guest Wi-Fi is not isolating them, and that the firewall permits the development server on your private network. The game does not require a phone cable or an app installation.

Portrait and landscape layouts are supported. Browser emulation is used during development; physical Android Chrome and iPhone Safari playtests are still needed to judge frame rate, heat, sound and comfort on real devices.

```sh
npm test
npm run build
npm run preview
```

## Controls

On the start screen, tap **< / >** or use the keyboard left/right arrows to browse cars. Browsing an owned car selects and saves it immediately. Locked cars show their price and an **Unlock** button; Start, Practice and Stunt Route stay disabled until you unlock that car or return to an owned one. The driving lesson always uses the free starter.

On a phone, use the on-screen buttons. Swipe horizontally across the road or tap **← / →** to change lane. Each deliberate swipe changes one lane; swiping vertically does not steer. Tap **JUMP** to jump, then keep holding to fly. Hold **BOOST** for forward speed, tap **FLIP / ROLL LEFT / ROLL RIGHT** while airborne, and hold **SLAM** to descend quickly. You can hold JUMP with one finger while tapping a stunt with another. Release JUMP to fall naturally; energy refills after landing. Use the pause button to resume, restart or return home.

Desktop controls:

| Input | Action |
| --- | --- |
| A / D or left / right arrows | Change lane |
| Space or up arrow | Jump; hold to apply upward thrust |
| Shift | Hold for forward boost |
| F | Front flip while airborne |
| Q / E | Barrel roll left / right |
| S or down arrow | Slam downward |
| P or Escape | Pause / resume |
| R | Restart the current mode |

Practice flight offers an empty road; scored runs include traffic. Completed tricks are banked on a clean landing. Best scored runs are saved on the device when browser storage is available.

## Stunt Route

Choose a course on the home screen, then press **DRIVE COASTLINE** or **DRIVE SKY SWITCH** after selecting an owned car. Coastline is the original 1,200 m route. Sky Switch is 1,400 m, with higher rings, longer ramp-to-ring gaps and a different lane sequence. Both are traffic-free, with eight ramp/ring pairs across four lanes. Course selection is remembered on this browser. The HUD tells you the next lane (1 is leftmost), distance to the launch lip/ring, and how many rings you have banked. There is no countdown; faster finishes break equal-score ties in your car's personal record.

1. Line up before the ramp. Driving onto its deck carries the car upward and launches it automatically at the lip without using thruster energy. Driving off its side drops you back toward the road. Flying over it does not trigger another launch.
2. Aim the **centre of the car** through the diamond inside the ring. Higher rings need a short hold of JUMP/Space after launch. Continuous flight can take you above the ring. Boost changes your approach timing. Rings are non-solid: missing one does not crash the car.
3. Release flight and land cleanly to bank **150 points per ring × your landing combo**. Flips/rolls can add their usual landing points. A rough landing drops pending ring points; an unfinished rotation crashes this mode. Pending points also expire if you cross the finish while still airborne.
4. Reach the finish to claim **20 CR + 6 CR per banked ring** (up to 68 CR), once per completed attempt. Returning home, restarting or crashing before the finish awards no route credits. Highway challenges, highway best score and distance ghosts remain separate.

| Medal | Banked rings |
| --- | ---: |
| Finisher | 0–3 |
| Bronze | 4–5 |
| Silver | 6–7 |
| Gold | 8 |

Ring dots are outlined before crossing, cyan while awaiting a landing, lime after banking and orange after a miss or lost landing. The finish/interruption screen lists every ring as banked, missed, lost landing or not reached. Each car has a separate Coastline best-score record under `boostline.stunt-route.v1`, scoped to course `coast-rings-01`. Sky Switch uses its own `boostline.stunt-route.sky-switch-01.v1` key and course ID, so existing Coastline records remain compatible. Records include score, banked rings and finish time; higher scores win, with faster time breaking ties. Bad records are discarded. If storage fails, rewards and records work for the session with visible feedback. These are local personal records, not an online leaderboard.

## Driving school and landing guidance

Choose **First drive? Learn the moves** on the home screen for an optional five-step lesson on an empty highway. It advances after actual lane changes, held flight, a completed stunt, a clean landing and held boost. Skip continues ordinary practice, and restarting a lesson starts it from the beginning. Completion is remembered on this browser, and the lesson can always be replayed.

The airborne marker shows your position on the road below. The HUD shows height, unfinished-rotation warnings and points that can be banked on a clean landing. A hard descent turns the guidance orange. These cues describe altitude, rotation and impact risk; they do not forecast traffic collisions or guarantee a safe landing. Practice forgives an unfinished rotation but does not award stunt points for it.

## Race your distance ghost

Finish a scored run to record a cyan replay car for the next attempt. The ghost follows the actual positions and rotations from your longest completed run, independently of your highest score. It cannot collide with you or traffic. The HUD compares distance at the same elapsed race time; positive progress means you are ahead. When the replay ends, the HUD shows the distance still to beat or confirms that you have passed it.

Use **Ghost on / off** on the home or pause screen. The choice persists on this browser. Recording continues when the display is off; practice and abandoned runs never replace a saved ghost. Pausing also freezes the replay clock. A saved ghost is used from the start of the next scored run.

Recordings use 10 samples per second with interpolated positions and rotations, capped at ten minutes. Longer runs still score normally and keep the previous ghost. Data stays in localStorage on the current browser and origin; changing the address or port uses a different record store. If storage fails, a new ghost remains available for the current session. Invalid or incompatible recordings are ignored. These local replays are not verified competitive records.

## Effects, sound and phone graphics

Open the sliders button beside the sound control to change graphics. Opening settings during play pauses the run and releases held controls; closing returns to play. Opening from an already paused run keeps it paused.

| Graphics | Phone pixel-ratio cap | Maximum visual particles |
| --- | --- | --- |
| Performance | 1.0 | 24 |
| Balanced (default) | 1.25 | 48 |
| Quality | 1.75 | 80 |

The actual pixel ratio never exceeds the screen density. Desktop Balanced and Quality caps are 1.5 and 2.0. Quality changes resolution and cosmetic particle density, without changing physics, traffic, scoring or replay timing. It does not promise a particular frame rate or battery improvement.

Four cyan underbody jets fire downward when jumping or holding powered flight. A quick tap still produces a short launch burst. Two lime rear jets fire only during forward boost; holding both controls fires both banks. Nozzles and detached exhaust follow the car through flips, rolls and lane changes. The original angular Vector Pickup has a metal body, sloping cab, truck bed and full-width light bars. All seven cars use these jet controls.

Boost and powered flight leave brief exhaust trails. Clean landings, other landings and crashes produce distinct bursts using one pooled, instanced draw call. Effects freeze on pause, expire naturally and reset between runs. The **Reduce effects** switch removes particles, landing pulses and boost camera widening; the operating system's reduced-motion preference also enables this, including changes made while the page is open. Steady, shorter rear jet cues remain with reduced effects; essential traffic warnings, altitude guidance and car movement remain.

**Show frame rate** adds a small FPS counter during play, based on rendered animation frames over about a second. Use it for comparisons on your own phone; headless browser checks are not device performance measurements. Preferences save on this browser, with session-only fallback when storage is unavailable.

Sound now layers a motor, low engine tone and filtered thruster noise. Clean landings have a rising two-note cue; ordinary/hard landings use a thud, and crashes have a short impact sound. Sound uses one audio context with a bounded number of short-lived cue voices. Pause, mute and backgrounding silence the output. The game remains playable if audio cannot start. Real-device listening is needed to judge loudness and speaker quality.

## Challenges, run credits and garage

Open **GARAGE** on the home screen, or **Garage & challenges** while paused. Switch between **Cars** and **Paints**. The four original paint schemes are cosmetic: handling, flight, collisions and scoring stay identical. Coast Ivory is free; Sunset Ember costs 75 credits, Glacier Blue 160 and After Hours 260. Unlocking a colour equips it immediately, and switching owned colours is free. The cards preview the selected car in each colour; the chosen paint also appears on the actual player car. Traffic and the cyan replay ghost keep their own colours.

The Vector Pickup is the free starter and retains the original driving settings. Six unlockable models have distinct original shapes and performance trade-offs:

| Vehicle | Credits | Strength | Trade-off | Initial boost target | Powered lift budget |
| --- | ---: | --- | --- | ---: | ---: |
| Vector Pickup | Free | Balanced driving and flight | No specialist advantage | 137 km/h | 3.2 s |
| Rally X | 120 | Fast lane changes and rotations | Lower road speed | 130 km/h | 3.1 s |
| Retro Volt | 220 | Efficient boost and quick recharge | Slower steering and rotations | 137 km/h | 3.6 s |
| Dune Runner | 300 | Highest jump and strong lift | Lowest road speed | 122 km/h | 2.9 s |
| Apex GT | 400 | Fastest road speed | Low jump and short flight | 166 km/h | 2.5 s |
| Night V8 | 480 | Strong forward boost | Heavy steering and high boost drain | 162 km/h | 3.0 s |
| Aero Pulse | 600 | Longest powered flight and fastest flips | Modest road speed and slow recharge | 130 km/h | 4.7 s |

Speeds are boost targets at the start of a run; difficulty adds speed over time. Flight figures represent the energy available for lift after a jump from a full charge, with no simultaneous boost. They do not include the subsequent unpowered fall. All cars retain the same collision envelope, 9 m flight ceiling, controls, scoring and traffic rules. Prices and performance are initial tuning values for playtesting.

Unlocking a car selects it. Selecting an owned car is free. Selection during an active or paused run applies to the next run or restart, preserving the current car's physics and replay. Paint can change immediately. Driving school always uses the starter pickup; the selected garage car remains available for ordinary practice and scored runs. Purchases use the same earned wallet as paints.

New ghosts record the vehicle used and replay its matching silhouette. The longest completed distance record spans all cars, and its car name appears on the home screen; it is not a separate record per vehicle. Existing pickup ghosts remain readable because the starter's physics and the course rules are unchanged. Replay speed validation accommodates the faster cars.

Each scored run takes the next challenge at its start. Reach the target within that run, then finish the run in a crash to claim it. The small HUD line tracks the target; a completed target stays pending until the results screen. A run can finish at most one challenge, and each challenge bonus is claimed only once. Unfinished challenge progress resets on the next run. These are six sequential goals, not date-based challenges:

| Challenge | Target in one run | Bonus |
| --- | --- | --- |
| Stick the landing | Land 1 completed flip or roll cleanly | 60 CR |
| Coast explorer | Travel 400 m | 90 CR |
| Thread the traffic | Earn 3 close calls | 100 CR |
| Stunt collector | Land 3 completed stunts cleanly | 140 CR |
| Keep the rhythm | Reach a 4× combo | 180 CR |
| Kilometre club | Travel 1,000 m | 250 CR |

Every finished highway scored run earns **1 credit per full 20 metres**, **8 per cleanly landed stunt**, and **2 per close call**, plus its challenge bonus. The results screen breaks down these rewards. Base rewards continue after all six challenges. Credits are in-game points with no real-money purchases. The wallet is capped at 999,999 credits. Practice, driving school, returning to the menu and restarting an unfinished run award no credits or challenge bonuses.

The wallet, owned colours, equipped colour, owned vehicles, selected vehicle and completed challenges save together under `boostline.progress.v1` in localStorage. They belong to the current browser and origin; another address, port or device has its own progress. There is no account sync. The profile payload is now version 2; version 1 saves migrate with their credits, paints and completed challenges intact and the Vector Pickup selected. The storage key stays the same. Unknown or unowned car selections fall back to the starter. Bad or unsupported saved data is recovered safely. If browser storage is blocked or full, progress and purchases work for the current session, with a visible message; reloading may lose changes that could not be saved. These local saves are not tamper-proof competitive records.

## Current milestone

This is the v0.2.0 mobile prototype. It includes original procedural vehicles and scenery, a fixed-step simulation, limited flight, stunts, spaced traffic rows, rotation-aware swept collision checks, landing rewards, local records, pause/retry, optional synthesized audio and an accessible controls dialog.

The phone layout includes all eight driving/stunt controls, simultaneous touch input, an orientation-aware follow camera, safe-area spacing and a capped render pixel ratio. Backgrounding the page pauses the game and releases held controls. This milestone targets mobile browsers; native app packaging and offline installation are future decisions.

The collision model sweeps a rotating car-body box against traffic boxes. It checks continuous movement along separating axes and splits rotation into small steps with conservative padding to catch contact between frames. Cosmetic steering yaw is omitted. These remain simplified body boxes, not mesh-level collisions or a full vehicle-physics simulation.

After four introductory vehicles, seeded traffic arrives in rows of two vehicles with two adjacent lanes open. Neighbouring rows share at least one open lane and begin at least 118 metres apart. All traffic travels at the same speed, keeping these gaps from closing. These are spacing constraints rather than a complete future-route reachability solver.

An amber **TRAFFIC AHEAD** cue highlights an approaching vehicle in your current or selected lane within roughly three seconds of contact. It turns red and says **CHOOSE A GAP** below 1.25 seconds. The flight/descent estimate is advisory: it cannot guarantee a safe route or landing. Physical phone testing is still needed to assess performance and control comfort.

Online services, verified leaderboards, shareable replays and daily challenges are future milestones.

## Architecture

```mermaid
flowchart LR
    Input[Keyboard, touch and swipe] --> Sim[Fixed-step simulation]
    Cars[Vehicle catalogue and tuning] --> Sim
    Cars --> Garage
    Cars --> World
    Sim --> World[Three.js world, camera and effects]
    Sim --> Audio[Engine and event sounds]
    Sim --> HUD[HUD and menus]
    Sim --> School[Driving school]
    School --> HUD
    Sim --> Ghost[Distance ghost recording and replay]
    Ghost --> World
    Sim --> Career[Challenges and run rewards]
    Career --> HUD
    Garage[Garage purchases] --> Career
    Garage --> World
    Settings[Graphics and motion preferences] --> World
    Ghost --> Storage[Browser localStorage]
    Career --> Storage
    Settings --> Storage
```

The simulation runs independently of the renderer so movement, collisions, traffic and scoring can be tested without WebGL. Ghosts and visual effects do not affect collision results. Local saves are validated and have session-only fallbacks; there is no game backend.

## Verification

The v0.6.0 build passes **78 automated tests** across nine source files, plus TypeScript checking and the production build. New tests cover ramp climb/launch and edge exits, interpolated ring crossings, clean/rough/crash banking, pause/reset/finish rules, all seven cars completing all eight rings on both courses, one-time rewards, wallet caps, separate records and highway ghost isolation. Existing gameplay, traffic, tutorial, garage and rendering tests still pass.

A browser playthrough using actual touch inputs completed the 1.2 km course with 8/8 rings, a Gold finish and 68 credits, then verified persistence, no duplicate rewards, restart/home behavior, deferred car changes and separation from highway records. Four phone layouts (320×568, 390×844, 568×320 and 844×390), desktop keyboard entry/pause and a full completion with blocked storage were checked without page/console errors. Physical-phone performance, heat and comfort still need real-device playtesting.

## Structure

- `src/game/stunt-route.ts`: fixed course, ramp/ring state, medals and validated per-car records.
- `src/game/stunt-scenery.ts`: instanced ramps, rings, target markers and finish arch.
- `src/game/stunt-route.test.ts`: course physics, landing/reward/save boundaries and all-car reachability.
- `src/game/simulation.ts`: gameplay state and fixed-step rules, independent of graphics.
- `src/game/collision.ts`: rotating body boxes and swept collision checks.
- `src/game/traffic.ts`: seeded traffic rows and spacing.
- `src/game/traffic-warning.ts`: approaching-traffic advisory.
- `src/game/ghost.ts`: bounded replay recording, validation, interpolation and distance-record selection.
- `src/game/world.ts`: Three.js scene, camera and bounded player/ghost model caches.
- `src/game/car-showcase.ts`: on-demand 3D start-screen preview, lighting and bounded model cache.
- `src/game/garage-cars.ts`: seven vehicle definitions, prices, tuning and UI silhouettes.
- `src/game/player-vehicle.ts`: seven procedural 3D bodies, each batched by material.
- `src/game/thrusters.ts`: independent launch/lift and rear boost visuals.
- `src/game/garage-cars.test.ts`: migration, car purchases, run tuning, model bounds and replay compatibility.
- `src/game/thrusters.test.ts`: jet direction, launch pulse, pause/reset and particle limits.
- `src/game/audio.ts`: layered synthesized engine/thruster sound and landing/impact cues.
- `src/game/effects.ts`: fixed particle pool for exhaust trails and event bursts.
- `src/game/settings.ts`: validated graphics preferences and per-device render budgets.
- `src/game/progression.ts`: validated local career save, one-time run rewards, sequential challenges and cosmetic purchases.
- `src/game/progression.test.ts`: real-run rewards, claim boundaries, practice/retry exclusions, wallet bounds and purchase persistence.
- `src/game/feedback.test.ts`: settings recovery, effect lifecycle/bounds and audio-mix checks.
- `src/game/swipe.ts`: horizontal touch gesture recognition.
- `src/game/training.ts`: optional driving-school progress.
- `src/game/flight-assist.ts`: rotation and descent guidance.
- `src/main.ts`: interface, input, run lifecycle and browser integration.
- `src/game/simulation.test.ts`: tests for movement, scoring, resets and collision behaviour.
- `src/game/traffic.test.ts`: collision precision, traffic spacing and warning checks.
- `src/game/ghost.test.ts`: replay lifecycle, interpolation, validation and recording limits.
- `src/game/controls.test.ts`: swipe intent, tutorial integration and landing guidance checks.

## Data and assets

Models are generated in code. The start-screen showroom redraws only when the car, paint or size changes, caps pixel ratio at 1.5 and lazily caches up to seven models. It uses a second WebGL context and falls back to a static silhouette if that context cannot be created. No external game assets or reference-video footage are included. Barlow Condensed and DM Sans are bundled locally through Fontsource, with system-font fallbacks. Best score, distance ghost, ghost visibility, graphics preferences, sound preference, tutorial completion, per-car stunt-route records and career/garage progress use localStorage; no data is sent to a game backend.

The `.local/` directory is intentionally ignored by Git, blocked by the Vite development server and absent from the build output. It is reserved for personal notes and local verification artifacts. Do not force-add its contents or copy it into `public/`.

The v0.6 browser check additionally completed Sky Switch, verified its eight-ring result review and separate record without overwriting a Coastline fixture, and checked the course picker at all four phone sizes.
