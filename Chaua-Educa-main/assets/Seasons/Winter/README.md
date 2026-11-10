# Seasons / Winter — Troncos com neve progressiva

Esta pasta contém oito spritesheets WebP lossless RGBA (1024 × 1024), obtidas a partir das artes existentes em `assets/v7/trees-lower.webp` e `assets/v7/trees-upper.webp`, mantendo a grade original 2 × 2, as quatro variações de madeira e a posição dos quadros.

## Estágios
- `trees-lower-snow-01.webp` até `04.webp`: neve gradativa nos cortes superiores, folhas, galhos e cogumelos dos troncos de baixo.
- `trees-upper-snow-01.webp` até `04.webp`: neve gradativa **somente** sobre galhos, folhas e musgos expostos dos troncos suspensos. A extremidade ligada ao teto permanece sem neve.
- `trees-*-overlay-01.webp` até `04.webp`: somente a camada de neve, com transparência, para compor dinamicamente caso desejado.
- `trees-upper-shedding-00.webp` até `05.webp`: quadros com neve se soltando dos galhos superiores, opcionais, sem alterar hitboxes.

Cada etapa contém as **quatro árvores** do respectivo atlas, não uma árvore diferente por etapa.

Geração reproduzível: `python scripts/build_winter_sprites.py` (dependências: Pillow e NumPy).
O gerador não altera `assets/v7` nem substitui os sprites antigos.
Sprites gerados nesta branch devem ser revisados visualmente antes de integrar o renderizador.
