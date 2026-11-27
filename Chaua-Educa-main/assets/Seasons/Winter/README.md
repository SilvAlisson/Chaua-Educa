# Active progressive winter artwork

This directory contains two authored full-winter atlases (snow-04) and two
transparent transition overlays (overlay-04), registered to the original 2×2 tree cells.
The six intermediate overlays (01–03) are preserved in `art-source/winter/`.
Only exposed shelves receive snow; the ceiling-bound upper trunk stays bare.

The six original shedding times are cropped and packed in `assets/runtime/`,
with original cell coordinates retained in `js/runtime-art-data.mjs`.
Unused full intermediate snowy images are removed from this branch.

Active JPEG sources are `art-source/winter/`. Reproduce the official art with
`python scripts/build_approved_winter_art.py`, then rebuild runtime pages with
`python scripts/build_runtime_art.py`. The discarded procedural generator is
not part of the current production chain.
