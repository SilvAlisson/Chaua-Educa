# Secondary character animation using authentic original art

This experiment never replaces `hawk-atlas.webp`, `snake-atlas.webp` or `snake-wrap.webp` and does not import the externally generated concept sheets.

* Tail: duplicate **only source pixels** from the end of the existing snake-wrap in a small, temporary cache. The rooted portion stays anchored and the last ~22 world units bend by at most ~1 px. 17 compact precomputed variations; no mesh raster each frame.
* Snake shield reaction: retains the original v7 snake head and adds a small damped rotation/translation only when `retreat && dazed`. Uses existing decorative star primitive.
* Hawk shield reaction: retains original authored v6 atlas and `CLIPS.hawk.recoil`, adding small damped translation/rotation and fading stars during existing retreat. All other flight and dive clips remain identical.
* Nothing changes collision shapes, simulation timings, item logic, or damage.
* Reduced-motion mode keeps the original tail drawing and removes secondary oscillations.

## QA
Compare normal, reduced, alert, striking and shield impact in `test:secondary-art` and run the main visual/continuity suites. Keep branch experimental until new visual test and 60 FPS diagnostics finish.
