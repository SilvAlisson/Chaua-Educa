# Mobile performance audit — etapa 1

## Evidência (17/11/2026)
O relatório Android/Chrome em qualidade Alta e inverno forçado registrou 49,01 FPS médios, 39,14 FPS na última janela e 354 quadros acima de 22 ms. Os dois arquivos recebidos tinham o mesmo hash. A causa dos atrasos entre RAFs não está provada: parte pode vir de apresentação gráfica, rasterização ou agendamento do navegador. O arquivo não identifica o SHA do commit.

## Correções e diagnósticos (sem redução da qualidade gráfica normal)
- Produção: `clipSnowReveal()` reutiliza até 192 caminhos `Path2D` por geometria/intensidade, evitando remontar as 32 colunas para troncos de mesma geometria. Fallback original para navegadores sem Path2D.
- Diagnóstico Leve: coleta RAF sem instrumentação forense e sem observadores de long frames, reduzindo a interferência da própria ferramenta.
- Diagnóstico Profundo: mede também `render.snowMaskRebuild` (máscara de 1024×1024) e coleta eventos, operações e frames longos.
- A seleção das 150 amostras de travamentos agora é distribuída ao longo do voo, preservando prioritariamente quadros acima de 50 ms; não descarta o trecho final.
- O JSON contém `provenance.gameVersion`, `provenance.assetVersion`, `provenance.host`, `provenance.path` e `provenance.gitCommit=null`. O commit exato não pode ser inferido de um Pages estático.

## A/B isolados: somente com ?perf-test=1
- `&perf-ab=baseline`: imagens, inverno e efeitos normais, com caminhos Path2D reutilizados.
- `&perf-ab=legacy-snow-clips`: recorte original não reutilizado; A/B da otimização mantendo a aparência.
- `&perf-ab=snow-mask-off`: oculta apenas máscaras progressivas de troncos no voo (mudança visual **apenas no teste**).
- `&perf-ab=snow-flakes-off`: oculta apenas os flocos caindo (mudança visual **apenas no teste**).
- `&perf-ab=static-season-bg`: mantém o fundo sazonal imóvel, sem reduzir sua resolução.

## Próximos testes no dispositivo
1. Publicar a mesma versão da branch de preparação no fork ou em um preview. No GitHub Pages do fork, a `main` e a branch de preparação não são intercambiáveis.
2. Selecionar **Alta**, **Inverno**, orientação horizontal, **Leve**, jogar 40–60 s por variante; anotar temperatura/estado de bateria, se possível.
3. Testar `baseline`, `legacy-snow-clips`, `snow-mask-off`, `snow-flakes-off`, `static-season-bg`. Fazer pelo menos 2 sessões por caso quando possível.
4. Nas variantes com maior diferença, repetir o teste em **Profundo** e comparar `render.snowMaskRebuild` e picos de renderização.
5. Medir rastros GPU/Canvas usando ferramentas de desenvolvimento Android antes de atribuir causalidade definitiva.

Meta preservada: 60 FPS no perfil Alto sem reduzir spritesheets, hitboxes, física, movimento normal ou riqueza visual.
