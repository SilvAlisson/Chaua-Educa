# Original-art polish on `chaua-educa-otimizado`

The generated sheets from PR #47 **are not approved** because they change character silhouettes and detach the snake from its original wrap. This revision instead keeps the registered 16-frame v6/v7 original atlases unchanged and adds only secondary motions made with their existing pixels.

Changes:
- Original snake mesh: the authored mouth/teeth/throat remain; the moving tongue is drawn **after** the static head mesh cache, so tongue timing does not trigger whole-mesh regeneration.
- Stable cache keyed by host wood.id, bounded to six 512px offscreen surfaces (nominal 6 MiB maximum for these caches). The visual interpolation clones snake objects, so per-clone cache ownership was not reliable.
- Snake tail: original `snake-wrap.webp` pixels only, 17 precomputed subtle variations; no new snake or duplicated trunk.
- Snake and hawk: minor, decaying motions when the shield hits, with original atlas silhouettes.
- Chauá: original flight atlas intact, small temporary shield recoil.
- Reduced motion: original static look without procedural oscillations.
- Physics geometry, tick rate, collision/score/timing have no changes.

Testing:
- `browser-snake-raster-parity` still compares 56 registered reference poses against the original source. It disables **only the intentional decorative additions** in both renderers and now expects 0 changed channels.
- `browser-original-art` tests independent tongue movement with unchanged pose and unchanged cached mesh, six-cache bound, and captures actual forest renders in desktop and portrait for manual approval.
- The deliberately added teeth/shading/tongue are not classified as errors by the reference-test baseline; visual regression tests continue to cover silhouettes, continuity and exact original undecorated art.
- Do not merge before full workflow QA and review of all scene screenshots. 
