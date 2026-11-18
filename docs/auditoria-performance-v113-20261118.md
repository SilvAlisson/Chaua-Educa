# Auditoria estática e comparação de performance — v1.0.13 (18/11/2026)

**Escopo verificado:** varredura estática dos 68 módulos JavaScript de execução em `Chaua-Educa-main/js` (~450 KB) e inspeção detalhada dos dois commits de performance `d9fe22df` e `0d5be354` (23 arquivos alterados desde `147b6968`). Inspeção dos testes de engine, colisões, regressão visual e do workflow `ci.yml`. Isso **não** é uma medição de FPS de dispositivo físico nem uma certificação linha a linha de todos os scripts de testes/arte/estilos do repositório.

## Correção aplicada neste ramo
- **P0, resolvido em código:** `js/engine.mjs::Game.visual` limpava apenas algumas propriedades ao reutilizar o mesmo slot de entidade/cobra após troca de ID. Isso permitia vazar `fragileSide`, `decorKind`, `breakFx` e propriedades de ataque para outra entidade visual.
- O ramo restaura a limpeza integral **somente na mudança de ID** (como na referência anterior) mantendo o pooling e adiciona `tests/visual-pool-reuse-113.test.mjs`. A equivalência visual na execução real ainda depende do CI e de revisão de capturas.

## Evidência limitada dos benchmarks
Os resultados abaixo são de **execuções distintas** do GitHub Actions, não de A/B executado de forma alternada no mesmo processo e nem de celulares físicos.

| Medida (fragmented-forest-with-actors, 6 s) | `147b6968` | `d9fe22df` | `0d5be354` |
|---|---:|---:|---:|
| FPS médio | 60,003 | 59,174 | 57,509 |
| frames >33ms | 0 | 0 | 6 |
| `game` mean CPU, ms | 13,05 | 14,05 | 14,68 |
| `game` P95 CPU, ms | 14,4 | 16,4 | 17,0 |

Logs: [antes](https://github.com/SilvAlisson/Chaua-Educa/actions/runs/44119957236), [intermediário](https://github.com/SilvAlisson/Chaua-Educa/actions/runs/44194730835), [depois](https://github.com/SilvAlisson/Chaua-Educa/actions/runs/44206657952).

**Interpretação:** há evidências de deterioração na cena com atores, mas a variação de ambiente e os testes curtos impedem atribuir causalidade específica. Não divulgar melhoria definitiva ou regressão de FPS do aparelho até teste A/B controlado.

## Código listado para reavaliação posterior, SEM reescrita prematura
1. **P1 — `js/render.mjs` (`Renderer.game`, `Renderer.pickup` e composição de sprites).** O cenário de benchmark com atores está pior. Isolar `pickup`, `bird`, `hawk` e passes de fundo com rasterização GPU/LoAF e idênticos pixels. Comparar cache contra desenho direto; não reduzir arte.
2. **P1 — `scripts/benchmark-startup-memory.cjs` e `.github/workflows/ci.yml`.** O CI usa `baseline_sha=f32ee403b...` para o carregamento inicial; essa base fixa não representa a revisão imediatamente anterior à v1.0.13. Criar um teste A/B separado contra `147b6968` com amostragem alternada e seeds equivalentes, sem alterar a referência histórica de carregamento.
3. **P2 — `js/winter-vfx.mjs::clipSnowReveal`.** Até 192 `Path2D` com chave envolvendo intensidade, geometria e etapa de cobertura. Instrumentar hits/evictions; transição de neve pode provocar reconstruções no inverno. Não mexer sem medição.
4. **P2 — `js/animation.mjs::placeWarnings`.** Aloca `[...items].sort`, arrays de bloqueadores, `flatMap`, `new Set` e objetos candidatos em quadros com avisos. Medir quando cobra e gavião aparecem juntos antes de considerar buffers/scratch; evitar labels sobre os animais.
5. **P2 — `js/forest-geometry.mjs::livingWoodRects` em modo `target`.** Reutiliza array, mas ainda executa `push({ ... })` para cada retângulo de colisão. Contradiz o objetivo literal de zero alocação. Só alterar com teste de equivalência de caixas, peças quebradas e hitboxes.
6. **P2 — `js/weather.mjs::renderRainBands`.** Desenha uma quantidade considerável de gotas e curvas por quadro; o scratch de coordenadas já evita parte da recomputação, mas a rasterização continua. Testar batching/atlas de chuva apenas com paridade visual.
7. **P3 — `js/engine.mjs::Game.visual` e `js/pickup-geometry.mjs::pickupPose`.** O pool e as structs scratch melhoram a pressão do GC, mas exigem testes de contaminação por troca de slots e compartilhamento de referências. Não reverter ganhos sem falha reproduzida.
8. **P3 — `js/seasons.mjs::SeasonalBackdrop.prepare`.** Pré-aquecimento incremental e cache de superfícies são decisões adequadas; apenas revisar picos no primeiro frame de cada estação em aparelhos de baixa memória.

## Código aprovado / manter
- `FlightClock` com passo fixo 1/120 e interpolação visual, sem necessidade demonstrada de reescrita.
- `collision.mjs`: broadphase AABB antes de SAT; preservar geometria autoral, tangências e testes.
- `render.mjs`: culling fora da tela e redução da criação de arrays de linha/aura.
- `forest-life.mjs`: gradientes já guardados em `WeakMap` por contexto/tamanho.
- `audio.mjs`: notas e clips estáticos (não reconstruídos a cada evento).
- `quality.mjs`: modo detalhado explícito não deve ser reduzido silenciosamente; modo automático não reage a uma única lacuna do agendador.
- `render.mjs`: `getImageData` de sincronização está condicionado a `transitionSyncEnabled`; manter desativado em uso normal.

## Critérios de aprovação futuros
- Testes unitários, capturas de render e browser QA concluídos, não cancelados.
- Prova de que arte, árvore, cobra, gavião, frutas, neve, chuva, hitboxes e estado do HUD não sofreram regressão.
- A/B alternado de bases idênticas (mesmo dispositivo, navegador, seed, resolução, qualidade detalhada), medindo FPS, P95/P99, 1% low, frames >33ms, tempo de rasterização e memória.
- Não mesclar na `main` somente porque o código tem menos alocações ou o teste unitário passou.
