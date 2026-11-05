# Original-art animation refinement — simplified snake mouth

**Base:** `chaua-educa-otimizado`. All registered snake, hawk, and parrot sprite atlases are unchanged.

## Requested change
- Removed **all procedural painted snake teeth, outer fangs, throat shadow and tongue flick**.
- Kept the mouth open animation by drawing the **authored open-mouth pose (frame 10 of snake-atlas.webp)**. No replacement/generated snake spritesheet is used.
- Kept the original source-pixel tail swing and the shield reactions, without changing collision shapes, fixed simulation tick, durations, score, audio or movement speeds.
- The new generated snake sheet from experimental PR #47 already includes mouth and teeth in its drawn frames, but it was **visually rejected** for inconsistent head/body connection. It is **not part of this change**.

## Cache and QA
- Reuse snake mesh across interpolated game views via stable wood host ID, at most 6 cached offscreen surfaces.
- Original 56-pose pixel-parity test now compares the complete original art, including open mouth, without any optional art flag.
- Browser QA checks unchanged output when age varies without changing the original mesh pose; the procedural tongue no longer introduces temporal pixel changes.
- Captures should be inspected on desktop/mobile, including snake bite and shield retreat.

**Do not merge into the optimized branch until workflow checks and visual review complete.**

## Original Chauá and hawk reaction polishing
- Fixed a real forwarding error: renderer.game already supplied `shieldHitAge` but `drawBird()` discarded it, so the intended parrot reaction never happened.
- Reused the **existing** Chauá atlas frames 14–15 for a brief shield contact (0–165 ms), then returned to the standard flight poses; no new character art or crossfade of distant wing shapes.
- The shielded hawk traverses all four **existing** recoil frames, banks during 0.68–0.98 s, then resumes the **existing** glide/flight atlas frames mirrored to face its retreat. The physical rightward retreat speed, harmless flag and 2-second exit remain unchanged.
- Normal flight/planing/dive states, reduced motion and fatal collision behavior stay on the original selection logic.
- `tests/original-shield-animation.test.mjs` verifies timing, original frame sets and no dual-wing blend; browser screenshots cover all four hawk phases and two parrot impact phases in desktop/mobile. No art generator or additional texture allocation introduced.

## Visual QA fix: preserve predator silhouette throughout the turn
The first browser preview showed an unacceptable paper-thin hawk at t=0.84 s: scaling the original atlas horizontally through 0 made it nearly disappear. That experiment was rejected. The full-width original artwork now banks gently (≤0.22 rad) and flips directly into the original glide at t=0.94 s. Unit tests require absolute scale=1 at all sample times. This corrects the artifact without any generated replacement frames or new textures.
