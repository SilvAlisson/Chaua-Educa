# Reforma da formação de neve — V2 (experimento de clipping direto)

## Fundamentação: partida 19/11/2026

218,76 segundos em qualidade Alta, 59,73 FPS, 1% low 35,27 FPS. Com neve ainda crescendo, houve 343 reconstruções de máscaras (duas superfícies de 1024×1024 pixels). Os callbacks lentos de 30,5 ms aos 10,33 s e 27,9 ms aos 18,42 s coincidiram com 2 rebuilds; três outros callbacks lentos (24,7–36,4 ms) não tinham rebuilds. Depois da formação completa (~101 s), houve 7.136 quadros, nenhum maior que 33 ms. Isso torna os rebuilds um alvo válido, mas não prova que todo stutter venha deles.

## Solução selecionada

Antes: para cada novo nível quantizado em 1/256, apagar um atlas 1024×1024, montar quatro recortes de 32 faixas no Canvas offscreen, fazer quatro drawImage nesse atlas e depois copiar pixels para cada árvore. Repetir isso para baixo e cima.

Agora: carregar os *mesmos dois WebP originais* e aplicar o mesmo recorte de 32 colunas diretamente no Canvas do jogo, no espaço local da árvore. Não há framebuffer da máscara intermediária nem upload repetido do atlas inteiro. O Path2D já cacheado em `clipSnowReveal` é reutilizado; os mesmos passos de 1/256, fórmulas, geometria, cor e extensão do gelo são preservados. A parte presa ao teto continua sem neve. O desenho de árvores especiais, cristais de contato, flocos de fundo, atores e frutas permanece igual.

Nenhuma redução de pixels, textura, quantidade de flocos, taxa de quadros ou etapa temporal. No inverno totalmente acumulado, a arte original `trees-{upper,lower}-snow-04` continua sendo usada sem recorte.

## Alternativa rejeitada

Atualização incremental do atlas por faixas: no Chromium local produziu diferenças acumuladas de alpha e pixels ao longo de 256 estágios, chegando a valores errados em bordas. Não foi integrada. O novo clipping direto apresentou diferenças visuais muito menores, concentradas em antialiasing subpixel nos testes locais; a comparação automatizada usa cenas reais das oito variantes.

## Validação A/B

URL do experimento profundo para comparar motor antigo sem alterar branch:
- `?perf-test=1&perf-ab=legacy-snow-rebuild`: renderizador antigo de máscaras
- `?perf-test=1&perf-ab=baseline`: clipping direto, novo

O modo profundo não produz o mesmo histórico automático de partidas, portanto é para experimentos isolados. O histórico comum agora registra `snowMask.rebuildsDuringFlight` e `snowMask.directClipsDuringFlight` além de anotações nos quadros lentos. Esperado no caminho normal: 0 rebuilds e quantidade positiva de recortes diretos. É possível que o custo de clipping por árvore seja maior em algumas GPUs; somente testes de dispositivo real confirmarão ganho final.

Critério: testes Node, 8 árvores reais, 7 níveis de neve, cenas de alta qualidade, resposta a resize/mobilidade e depois partida longa no mesmo Android. Se houver regressão, ativar o experimento legado para diagnóstico e reverter o mecanismo, sem mexer nos dados visuais originais.

## Comparação no Android com o coletor normal de partidas

O modo de diagnóstico profundo `?perf-test=1` desliga o coletor automático; para realizar uma comparação legítima do FPS por partida **sem esse modo profundo**, foram adicionados parâmetros independentes:

- Mecanismo novo (padrão): `?clima=winter&test-seed=3333272785`
- Mecanismo antigo: `?clima=winter&test-seed=3333272785&snow-render=legacy`

Ambas as URLs mantêm o mesmo coletor automático; `snowMask.renderer` identifica a versão usada (`direct` ou `legacy`). Não é replay determinístico porque o controle do Chauá pode variar; jogar condições semelhantes e comparar no mesmo celular.
