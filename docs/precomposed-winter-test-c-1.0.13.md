# Chauá Educa 1.0.13 — neve pré-composta, Teste C

**Branch:** `preparacao-para-a-versao-2.0` — a `main` não foi alterada.

## Artes fiéis à versão original

- `assets/Seasons/Winter/Precomposed/` contém 16 estados por família: árvores inferiores, superiores e quatro variantes especiais.
- 48 arquivos WebP gerados exclusivamente das spritesheets originais; nenhuma árvore foi redesenhada.
- Estado 00 idêntico em bytes ao arquivo original; estágio 15 das árvores comuns idêntico em bytes à arte de neve final já aprovada.
- `manifest.json` registra os caminhos e SHA-256. Gerador: `scripts/build_precomposed_winter_art.py`.
- Preserva a regra: a parte superior colada ao teto não ganha cobertura de neve.

## Como testar

- **Teste C** (madeira com neve pré-composta): `?clima=winter&perf-ab=precomposed-snow&test-seed=3169729328`.
- **Controle B** (legado): `?clima=winter&perf-test=1&perf-ab=baseline&test-seed=3169729328`.
- **Controle A** (neve desligada): `?clima=winter&perf-test=1&perf-ab=snow-mask-off&test-seed=3169729328`.
- O Teste C não exige `perf-test=1`. Para usar o perfilador manual, pode acrescentá-lo.

## Comportamento

- Em C, `precomposed-winter.mjs` quantiza a cobertura em 16 estágios (0–15), sem interpolação alfa por quadro.
- `assets.mjs` carrega os 43 novos WebPs somente no teste C; as pontas 0 e 15 das árvores comuns reaproveitam assets existentes.
- `tree-art.mjs` faz uma única chamada de desenho da cap por árvore, com a neve já composta; **não** reconstrói máscaras no voo.
- Texturas são pré-aquecidas no carregamento para evitar upload ao surgir um novo estágio.
- O jogo regular mantém seu comportamento anterior até o Teste C ter desempenho e fidelidade comprovados.

## Testes de aceitação

`node --test tests/precomposed-winter.test.mjs`; navegador: `node tests/browser-precomposed-winter.cjs` com servidor na porta 5501.

Comparar os primeiros 20–40 s de inverno forçado, mesma semente e configurações, nos cenários A, B e C. Registrar FPS, 1% low, stutters, `render.trees` e consumo de memória antes de decidir ativação geral. **Não afirmar 60 FPS antes de um teste em aparelho real.**
