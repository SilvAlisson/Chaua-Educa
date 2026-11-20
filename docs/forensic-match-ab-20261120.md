# Chauá Educa — auditoria causal de engasgos (branch experimental)

Branch isolada: `test/forense-causal-raf-v114-20261120`. Ponto de partida: `b5f4171f539193dca65172008004e2b03ac293f7`. **Não altera a main.**

## Como obter o JSON sem iniciar um segundo teste

Em um **deploy desta branch** (não no GitHub Pages da `main`), abra o jogo com `?match-forensics=1&test-seed=2448657347`, faça a partida normalmente e use a opção já existente **Baixar última partida**. Não use `perf-test=1` junto: essa opção ativa outro gravador e desativa a coleta automática.

`match-forensics=1` instrumenta o RAF existente, habilita operações nomeadas do jogo, tenta observar os eventos *Long Animation Frame* e *longtask* oferecidos pelo navegador e acrescenta `forensics` e `experiment` ao JSON automático. Não faz leituras de pixels, não grava imagens e não cria um segundo `requestAnimationFrame`. O modo automático sem esse parâmetro continua leve.

## Cenários controlados

Execute **no mesmo celular, orientação e qualidade Alta**, com a semente acima, idealmente **três partidas por cenário**; compare a distribuição das quedas e os horários, não apenas FPS médio.

| Teste | Query complementar | O que varia |
|---|---|---|
| Controle | nenhuma | Neve `sprites`, pré-aquecimento antecipado das estações ligado, gavião com warmup antigo |
| Gavião com aquecimento visível | `&hawk-warmup=visible` | Desenha um quadradinho real de 8×8 pixels do quadro 10 do gavião no canto inferior durante a contagem, sem alterar o voo |
| Estação sem antecipação | `&season-prewarm=off` | Desabilita apenas o preparo especulativo de 18 segundos; testa se o trabalho antecipado explica a transição |
| Neve direta antiga | `&snow-render=direct` | Compara o recorte `clipSnowReveal` com o padrão `sprites` já implementado |

Para a comparação do gavião, mantenha todas as demais opções exatamente iguais. Para a comparação da estação, o teste sem prewarm é propositalmente potencialmente pior e deve permanecer apenas nesta branch. O quadradinho 8×8 é um artefato visual experimental durante a contagem; sua presença **não garante** upload de textura.

## Como interpretar o JSON

- `experiment`: confirma seed, renderizador de neve, pré-aquecimento do gavião e da estação. Nunca compare condições sem verificar esses valores.
- `summary.stutterThresholdMs`: 28 ms; o corte anterior de 33,33 ms ignorava quadros que perderam uma sincronização vertical.
- `stutters[].previousCallbackCpuMs` e `currentCallbackCpuMs`: diferenciam um callback de JS lento de um intervalo longo entre callbacks. Não medem GPU.
- `forensics.measuredOperations` e `correlatedStutters[].nearbyMeasuredOperations`: intervalos cronometrados do código, incluindo `render.seasonalPrepare`, `render.seasonalBlit`, `render.hawkArtwork` e gravações `storage.write`.
- `forensics.gameEvents`: `seasonal:surface-start`, `seasonal:surface-ready`, `seasonal-first-present`, `hawk-state`, `first-draw`, `hawk-warmup-visible`. Identifica **quando** cada evento ocorreu, não qual thread da GPU executou a operação.
- `forensics.capabilities`: `supportedEntryTypes` / `observerTypes` distinguem ausência de suporte do navegador de ausência de eventos; `jsHeapReadout` indica se o contador de heap está disponível.
- `forensics.correlatedStutters[].attributionStatus`: `measured-js-work-overlap`, `browser-long-animation-frame-observed`, `browser-long-task-observed` ou `unattributed`. São classificações da **evidência temporal**, não diagnósticos de causa raiz.

### Hipóteses testáveis

1. **Gavião:** se engasgos de ~50 ms próximos à entrada do gavião diminuírem consistentemente apenas no cenário de aquecimento visível, há evidência a favor de custo de primeira utilização/raster/upload. Não distingue por si só redecodificação WebP de upload, composições ou descarte de textura.
2. **Estação:** se o preparo antecipado eliminar picos em `seasonal-first-present` relativamente ao teste sem prewarm, o mecanismo é sensível à antecipação. Para acusar rasterização diferida, verificar se `render.seasonalBlit` ou Long Animation Frame aumenta no primeiro uso; mesmo isso não prova a thread exata.
3. **Neve:** compare `snowMask.renderer`, `directClipsDuringFlight`, `spriteDrawsDuringFlight`, p99, `framesOver22Ms` e os intervalos 10–40 s. `sprites` pode gastar mais memória que `direct`, portanto monitore `spriteEstimatedBytes` e instabilidade no aparelho.

**Limite central:** JavaScript e o arquivo JSON não têm acesso direto a eventos internos de *Skia ImageDecodeCache*, *GPU texture eviction* ou upload na *raster thread*. Para comprovar esses mecanismos, capture um trace de Chrome/Perfetto no Android durante o cenário reproduzível e procure eventos relevantes de rasterização, decode e GPU **quando expostos**. Sem isso, a interpretação final continua como correlação fortalecida ou refutada pelo A/B, não prova interna do navegador.
