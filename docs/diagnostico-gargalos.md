# Diagnóstico de gargalos do Canvas 2D (etapa de instrumentação)

Este incremento **não modifica a qualidade, os modelos, o controlador Automático ou as regras do jogo**. Ele adiciona um medidor para que a próxima otimização seja escolhida pelo custo observado, em vez de reduzir cegamente a resolução.

## Executar

Com Node 22 e dependências instaladas, iniciar `npm start` em um terminal. No segundo:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run benchmark:hotspots
```

`PERF_SECONDS=6` (padrão, aceita de 2 a 30) e `GAME_URL` são configuráveis. Resultado em JSON no terminal.

## O que mede

- Intervalos de `requestAnimationFrame`, FPS, p50/p95 e quadros acima de 33,3 e 50 ms.
- Custos de chamada (CPU/JS) dos métodos `Renderer.background`, `Renderer.game`, `Renderer.obstacle`, `Renderer.hawk`, `Renderer.pickup`, `Renderer.snake`, `Game.visual` e `FlightClock.advance`.
- Três cenas: floresta inicial; Mata fragmentada; Mata fragmentada com atores adicionados **apenas à representação visual** (tronco/cobra, predador, fruta e poder).
- Resolução efetiva do canvas e identificação do renderizador gráfico do navegador.

**Limites:** métodos aninhados são contabilizados também pelo método pai, portanto os tempos não devem ser somados como se fossem exclusivos. Medições `performance.now()` ao redor das chamadas JavaScript não capturam separadamente o trabalho assíncrono da GPU nem a apresentação final. Os atores da terceira cena não são encontros de física; servem para localizar custos de desenho. A sessão de treino protegida não substitui voos completos reais. Instrumentação adiciona overhead e os números não devem ser tomados como FPS de produção.

## Critério de escolha

O próximo incremento deverá atacar um custo relevante demonstrado por medição e confirmar equivalência visual (pixels e animação), testes funcionais, impacto no FPS/P95/P99 e ausência de novos stutters. Os PRs de céu estático (#27) e HUD (#28) devem ser avaliados na mesma integração antes de repetir uma correção. Não declarar ganho até comparar base e alteração sob as mesmas condições.

Rollback: remover o script e o atalho de pacote; nenhum dado de usuário é afetado.
