# Active tree authoring sheets

`trees-lower.webp` and `trees-upper.webp` are lossless sources for
`scripts/prepare_forest_v7.py`. The script reproduces the active registered
2×2 tree atlases and `forest-art-data.mjs`, preserving their original design.

The original integrated-image prompt requested rounded cartoon 3D wood,
warm orange bark, sculpted grooves, oval knots, pale rings and top-left soft
lighting, transparent background and four variants per sheet. Leaves,
mushrooms and a refuge branch remain part of the same authored trees.

Historical snake poses have been removed. The game exclusively uses the
three official A2 snake state sheets under `public/snake/`.

The 1.0.10.1 rotten-tree redesign and its snow reference are stored as
`rot-1101.png` and `rot-snow-1101.png`. `scripts/pack_tree_rot_1101.py`
registers the new first cell into both 512×512 WebP atlases while preserving
the other cells. The snowy variant retains the bare wood and uses only the
snow from the winter reference. Outputs go to `test-results/tree-art-packed`.
