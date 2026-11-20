# Android V2 — neve, desenho e áudio ambiental

## Evidência extraída do arquivo `chaua-desempenho-ultimas-partidas (2).json`

As duas partidas novas da branch consolidada foram na qualidade Alta, sem placas de texto. Partida A: 35,37 s, tempestade, 60,01 FPS, 1% low 48,69 FPS, zero quadros >33 ms. Partida B: 191,07 s, 59,98 FPS, 1% low 46,16 FPS, três quadros >33 ms. Na segunda partida, houve transição tempestade → inverno por volta dos 65 s, neve 0,35–0,39 aos 109–111 s e neve completa após 162 s.

As duas travadas de 33,4 ms aos 109,81 e 111,38 s ocorreram na fase de acúmulo, mas o tempo de JS dos callbacks foi ~2–3 ms. O intervalo de 83,1 ms aos 181,44 s ocorreu com neve completa, um gavião e 45 partículas, com callback <3 ms. Seis callbacks lentos (21,8–38,1 ms) ocorreram na partida longa e foram dominados pelo desenho Canvas: por exemplo, aos 151,02 s, 37,8 de 38,1 ms. Isso NÃO estabelece gelo como principal causa.

## Hipótese testável

`tree-art.mjs:snowOverlay` recria a composição de neve em duas superfícies de 1024×1024 pixels quando muda a quantidade de cobertura (quantização de 1/256); isso é um custo concreto possível. Em vez de reduzir resolução ou degraus da transição, esta revisão adiciona um contador sem Canvas: `snowMask.rebuildsDuringFlight`, `stutters[].snowMaskRebuilds` e `longCallbacks.slowest[].snowMaskRebuilds`. Com isso, os próximos relatórios indicarão quando o desenho lento coincide com reconstrução do gelo.

## Bug confirmado de áudio

O código antigo incluía `menu` nos estados de ambiente de vento/chuva, mantinha um fade de 250 ms na pausa e parava trovões após 80 ms. A nova versão silencia a ambientação imediatamente ao pausar, abrir perguntas, finalizar ou voltar ao menu, e para trovões em execução/agendados no mesmo instante. Som da interface e retomada do jogo permanecem funcionando. A pausa é propagada ao áudio na mesma chamada do botão, sem aguardar um novo quadro.

## Como testar

Na mesma branch `teste-v2-performance-sem-avisos-texto`, verificar no Android: chuva/tempestade → Pausar → silêncio imediato → Continuar → áudio retorna; voltar ao Menu → silêncio; alternar para Inverno e jogar 60–120 s, então exportar o histórico JSON. A qualidade Alta e a semente fixa `?test-seed=1724079006` facilitam comparações controladas.
