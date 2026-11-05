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
