# Changelog

## v0.9.0 — Live achievement goals — 2026-11-07

- Added a compact live goal and progress bar for the closest eligible unfinished badge.
- Kept preview progress separate from saved achievements, with completion reminders.
- Hid tracking in practice and when eligible badges are complete.
- Fixed partial recovery of malformed achievement saves; added regression coverage.

## v0.8.0 — Achievement board — 2026-11-06

- Added six cosmetic achievement badges with persistent progress cards in the garage.
- Added result-screen announcements for newly earned badges and per-attempt settlement guards.
- Counted completed highway attempts and finished stunt routes, excluding practice and abandoned attempts.
- Added validated saves, session-only feedback and four focused achievement tests.

## v0.7.0 — Fullscreen play — 2026-11-05

- Added synchronized fullscreen controls in Settings and the pause menu.
- Paused active gameplay and cleared held inputs when leaving fullscreen.
- Added unsupported/denied feedback and guarded repeated requests.
- Verified native browser entry/exit, gameplay resume and four phone layouts.

## v0.6.0 — Course selection and ring review — 2026-11-04

- Added Sky Switch: a 1.4 km course with higher rings and a different lane sequence.
- Added a saved home-screen course picker with separate per-car best scores for each route. Existing Coastline records remain compatible.
- Added a numbered eight-ring results review for banked, missed, lost and unreached rings.
- Kept course selection through pause/retry and preserved native keyboard selection controls.
- Extended reachability tests to both courses for all seven cars and added record-isolation coverage.

## v0.5.0 — Stunt Route — 2026-11-04

- Added a separate 1.2 km traffic-free route with eight ramp/ring pairs, a finish arch and the selected garage car.
- Added physical ramp climbing, automatic energy-free launches, edge exits and swept ring-centre detection.
- Banked ring bonuses only on clean landings; rough landings, crashes and airborne finishes discard pending bonuses.
- Added lane/distance guidance, ring status dots, completion medals and separate per-car personal records.
- Awarded 20 finish credits plus 6 per banked ring once per completed route; kept highway challenges, best score and ghosts separate.
- Added bounded instanced course rendering, ramp/ring/finish audio cues, mobile layouts and session-only storage fallback.
- Added ten focused tests, including all seven cars completing all eight rings; verified the course through browser touch inputs and four phone layouts.

## v0.4.0 — Start-screen collection and redesigned cars — 2026-10-29

- Added < / > car browsing before a run, with keyboard arrows, a lit 3D preview, performance summary and saved owned-car selection.
- Added explicit locked-car pricing and home-screen unlocking; blocked starting a locked preview with either buttons or keyboard shortcuts.
- Rebuilt all seven original models with different body profiles, real wheel openings, rounded tyres, detailed rims, glass, mirrors and model-specific lights. Added an open pickup bed, rally spoiler, retro chrome, buggy roll cage, supercar wing/intakes, muscle-car scoop/stripes and flight-car canopy/fins.
- Kept existing handling differences, directional jets, shared paints, career saves and ghost compatibility.
- Adapted the selector to portrait/landscape phones with 44px minimum arrow targets and scrollable compact layouts.
- Used an on-demand, bounded preview cache with a static fallback if an extra WebGL context is unavailable.
- Verified all 67 source tests, TypeScript/build and a six-group browser flow covering selection, purchases, persistence, mobile jets, keyboard controls, four phone sizes and blocked storage.

## v0.3.0 — Seven-car garage and directional jets — 2026-10-27

- Replaced the starter with an original angular metallic pickup and matching garage preview.
- Added four downward lift jets and two rear boost jets, a brief tap-jump pulse, rotating exhaust trails and steady reduced-effects cues.
- Added six unlockable original car models: Rally X, Retro Volt, Dune Runner, Apex GT, Night V8 and Aero Pulse.
- Added different road/boost speed, steering response, jump impulse, lift power, energy consumption/recharge and stunt rotation timing for each car.
- Added Cars/Paints garage categories with prices, performance comparisons and saved selection. Selecting another car mid-run takes effect on the next run.
- Migrated existing career saves while preserving credits, paints and challenges. The Vector Pickup remains the free starter with original handling.
- Recorded vehicle identity in new distance ghosts and replayed the matching car model; legacy pickup ghosts remain compatible.
- Kept the seven models in bounded lazy caches, maintained shared paint behaviour and adjusted flight advisories for each vehicle's lift power.
- Scoped test discovery to current source, excluding private old publication drafts. Added directional-thruster and vehicle/progression verification.


## v0.2.0 — Complete current prototype

The second published release consolidates the existing internal development milestones through v0.6 into one update. It follows v0.1.0 without rewriting its commit or tag. Future public releases continue with v0.3.0, v0.4.0 and onward.

- Added optional driving school, swipe steering, landing guidance and road markers.
- Improved traffic spacing and rotating-body collision checks; added approaching-traffic warnings.
- Added a local best-distance ghost with recording, playback and an ahead/behind display.
- Added pooled exhaust/landing/crash effects, layered sound, graphics quality options, reduced effects and an FPS display.
- Added six sequential challenges, earned run credits and a garage with four cosmetic paint schemes.
- Added validated browser saves and session-only fallbacks when storage is unavailable.
- Expanded mobile portrait/landscape layouts and automated verification across all systems.


## v0.1.0 — Playable foundation

First published snapshot, reconstructed from the first development milestone. The commit records its actual publication preparation time; no earlier Git history is claimed.

- Added mobile-first coastal highway gameplay, original procedural cars and scenery.
- Added lane steering, jump/limited flight, boost, front flips, barrel rolls and slam.
- Added seeded traffic, swept collisions, clean-landing scores, combos and close calls.
- Added empty-road practice, pause/retry, local personal best, basic audio and controls help.
- Added portrait/landscape touch controls, multi-touch input and mobile camera framing.
- Added automated simulation tests and TypeScript/production build checks.

This first release contains the playable foundation. Its original commit and v0.1.0 tag remain available.
