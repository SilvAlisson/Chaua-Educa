# Ensaio A/B: inverno sem neve acumulada nas árvores

**Branch exclusiva:** `test/inverno-sem-neve-arvores-forense-20261120`  
**Derivação:** `test/forense-causal-raf-v114-20261120`  
**Destinação:** apenas transferência para fork e experimento; não mesclar à `main` sem avaliar os resultados.

## Intervenção isolada

Nesta branch o padrão é `perf-ab=snow-mask-off`. O jogo continua calculando a neve e o clima normalmente, mas o desenho da camada de neve **aderida às árvores** é suprimido no `drawLivingTrunk` e `drawTreeVariant`, inclusive no estado de cobertura total (a imagem totalmente nevada não substitui o tronco comum).

Continuam ativos: clima de inverno, neve que cai, acúmulo climático global, fundo de estação, frio, respiração, animais, física, colisões, efeitos das copas e demais efeitos de mundo. O experimento altera **a aparência das árvores**, não os valores internos de `surfaceSnow(game)`.

**Importante:** o atlas de sprites de neve continua pré-carregado para que os custos de carregamento e alocação se mantenham próximos entre as duas condições. Este teste mede a diferença de **desenhar ou não a camada**; ele não remove toda a memória dos sprites de neve.

## Como testar no fork (em páginas construídas a partir desta branch)

- **A — Experimental (sem neve acumulada nas árvores):** `?test-seed=2448657347`
- **B — Controle (neve normal):** `?test-seed=2448657347&perf-ab=baseline`

O gravador forense agora está **ativo automaticamente nas duas condições**; ao encerrar cada partida, baixe o JSON por `Baixar última partida`. Não adicione `perf-test=1`, porque esse modo antigo desliga o gravador automático. Opcional: `&match-forensics=0` desativa apenas o registro forense para medir o custo da instrumentação.

O JSON inclui `provenance.testBranch`, `provenance.build`, `experiment.perfAbVariant`, `experiment.treeSnowAccumulationEnabled`, `experiment.fixedSeed`, `summary`, `byTenSecondWindow` e `forensics`. Para validar a condição A, `perfAbVariant` deve ser `snow-mask-off` e `treeSnowAccumulationEnabled` deve ser `false`. Para B, `baseline` e `true`.

Mantenha o mesmo dispositivo, navegador, qualidade alta, resolução e semente; execute preferencialmente três partidas de cada condição e compare em especial os intervalos 20–30 e 30–40 segundos. Se possível, intercale A/B para reduzir viés de temperatura/cache do aparelho.

## Escopo da conclusão

Se a remoção da camada diminuir sistematicamente o número de quadros acima de 22/33 ms e o custo de `render.trees`, teremos evidência causal de que **o caminho de desenho** da camada agrava a perda de desempenho. Isso não identifica por si só o mecanismo interno do Chrome/Skia/GPU; para afirmar rasterização, upload ou eviction é necessário rastreamento do navegador.

## Testes automáticos

`npm test` valida o seletor e as opções, `npm run test:tree-snow-ab` compara no Chromium a mesma árvore real em 0%, 50% e 100% de neve, nas duas condições, e `npm run test:match-forensics` verifica o JSON pós-partida. A CI canônica chama os testes novos durante a etapa browser. A branch original e a `main` não são alteradas.
