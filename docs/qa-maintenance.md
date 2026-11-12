# Testes e workflows — política de manutenção

Esta página documenta o pipeline de qualidade atual. Experimentos anteriores continuam recuperáveis no histórico do Git, mas não devem executar a cada atualização.

## Os quatro workflows oficiais

| Arquivo | Gatilho | Cobertura |
| --- | --- | --- |
| `ci.yml` | Pull requests, push na `main`, manual | Testes unitários, Chromium, física/colisão A2, máscara-pixel, arte real, quatro estações, responsividade e jornadas |
| `qa-extended.yml` | Pull requests e manual | Firefox, WebKit, Chromium e spritesheets reais do Chauá e gavião |
| `qa-diagnostics.yml` | Somente manual | Renderização, voo longo, resolução/DPR, floresta, transições, culling e arte |
| `generate-winter-sprites.yml` | Somente manual | Geração experimental da neve em runner descartável; publica artefato, **nunca faz push** |

Os 26 workflows de experimentos ligados a branches históricas foram substituídos por ferramentas manuais reutilizáveis. Benchmarks válidos permanecem no diretório `scripts/`, não duplicados em dezenas de workflows.

## Como testar

- `npm ci` instala a versão fixada das dependências.
- `npm test` executa todos os testes `tests/*.test.mjs`, incluindo a auditoria do próprio pipeline.
- `node scripts/verify-current-spritesheets.cjs` verifica integridade das sete spritesheets obrigatórias.
- Para navegador, instale os browsers do Playwright, inicie `python3 -m http.server 5501 --bind 127.0.0.1 --directory Chaua-Educa-main` e rode as entradas da CI.
- Para medir desempenho, abra GitHub Actions → **Manual performance diagnostics** → **Run workflow**, escolha o cenário e consulte os artefatos.

## Princípios

1. Todo teste de navegador ativo deve ter uma entrada em CI, npm scripts ou QA manual; a auditoria automatizada verifica órfãos.
2. Não enfraquecer testes para conseguir CI verde. Corrigir causas-raiz e atualizar os critérios para a arquitetura oficial.
3. Uma spritesheet obrigatória ausente deve causar falha explícita, não voltar para uma arte antiga.
4. Não fazer `git push` a partir de workflow de geração experimental. Revisar manualmente artefatos antes de integrar.
5. Benchmarks em runner virtual são comparações de diagnóstico; não demonstram 60 FPS estáveis em hardware real.

## Resíduos e falhas encontrados nesta rodada

- `browser-season-parity.cjs` chamava `SeasonalBackdrop.draw` usando a distância numérica antiga. Agora usa o tempo de voo calibrado, incluindo transições e inverno estável.
- `tests/test-live-game-performance-and-animations.cjs` não tinha entrada de execução e dependia de navegador e diretórios particulares do Windows. Foi removido; testes modernos de desempenho permanecem.
- O antigo workflow de neve tinha permissões de escrita e criava commits automaticamente. Agora é manual, de leitura, e distribui apenas um artefato.
- A cobertura de navegador entre Chromium, Firefox e WebKit continua disponível fora dos experimentos ligados a branches antigas.

## Validação manual da branch antes do merge

**As entradas de `workflow_dispatch` só podem ser iniciadas na interface do GitHub quando o workflow estiver presente na branch padrão.** Enquanto este PR estiver pendente, as opções de diagnóstico continuam disponíveis como comandos locais depois de fazer checkout da branch de teste.

No computador de teste (Node.js 22+, Python 3, Chromium/Playwright):

```sh
npm ci
npm start
```

Abra `http://127.0.0.1:5501/`. Com esse servidor ligado, em outro terminal:

```sh
npm test
npm run test:browser
npm run test:reference-art
PERF_SECONDS=6 npm run benchmark:hotspots
npm run benchmark:render-parts
```

Capturas de referência verificadas pelo CI principal também são anexadas ao artifact `auto-visual-captures`, nas pastas `reference-art/`, `snake-strike/` e `render-parts/`. O CI estendido anexa comparações de Firefox/WebKit.

Antes de declarar 60 FPS constantes, executar sessões reais na resolução nativa do notebook e em celular, com clima e cenários ativos. Medir p95/p99, quadros acima de 33,3/50 ms e validar nitidez, responsividade e colisões. Benchmarks de máquinas virtuais são apenas diagnósticos.

Os auxiliares de captura que exigiam caminhos privados do Windows e geradores dependentes de arquivos externos não distribuídos foram aposentados. Substituí-los pelos testes e capturas acima, que utilizam as artes atuais e são reproduzíveis.
