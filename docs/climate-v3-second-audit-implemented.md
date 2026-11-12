# Chauá Educa — Segunda auditoria crítica do Climas V3

**Base:** PR #71 em draft, não mesclado na main. Este conjunto só contém
correções que passaram pela revisão técnica; não é uma autorização de merge.

## Decisões funcionais

### Prewarm real, preservando protótipos
`Game.visual(alpha)` cria uma view com `Object.create(game)`. Seu
`mode`, `seed` e `tutorial` são propriedades herdadas. A construção
anterior de `ahead={...view,elapsed:...}` descartava essas propriedades
e antecipava a estação errada. Agora `SeasonalBackdrop.prepare()`
transfere explicitamente esses campos antes de calcular `elapsed+10`.

### Vento físico não depende de escolhas visuais
`physicsWind(distance,mode,tutorial)` mantém exclusivamente a curva
numérica original de rajada e tempestade (Aventura), sem consultar
`weatherOverride`. `Game.speed` utiliza esta função, enquanto
`journeyWind` continua controlando apenas visual e áudio. Trocar
Verão/Chuva/Outono/Tempestade não muda a velocidade dos
troncos, gaviões nem a progressão dos encontros.

### Gavião: duas abordagens artísticas coerentes
Quando a faixa-alvo está na metade inferior da tela, o gavião vem de
cima como **mergulho** com spritesheet inclinada. Quando a faixa está na
metade superior, ele continua podendo chegar de baixo, mas com o
`hawk-flight` existente e aviso **SUBIDA**. As trajetórias e colisões
permanecem sincronizadas. Não se cruzam fades de corpos inteiros.

## Desempenho e gráficos
- Os limites reais da câmera (com zoom, deslocamento e margem de tremor)
  passam a orientar quantos mosaicos de casca são desenhados para
  `drawTreeVariant()`. O padrão completo de 1000 unidades fica para
  chamadas de teste sem câmera.
- `forest-life.mjs` mantém gradientes por **contexto + largura + altura**,
  cria cinco raios solares num único caminho e mantém neve/névoa.
- `weather.mjs` reaproveita gradientes de névoa/chuva, e desenha o raio
  com duas espessuras/cores em vez de `shadowBlur=18`. O ganho exato
  de tempo só poderá ser confirmado em benchmark.
- Os tints/raios dourados legados são desativados **somente** quando
  a imagem sazonal está ativa. Menu e treino preservam seu desenho.
- `shapesHitRect` aplica AABB conservador antes do SAT exato e reutiliza
  quatro vértices de scratch exclusivamente durante a verificação
  síncrona. Os 20 vértices de cada elipse de gavião continuam sendo
  construídos quando necessários; não se arrisca a fidelidade física.
- WebAudio é suspenso quando a aba fica oculta, recuperando-se no
  retorno à aba (sujeito à política de autoplay do navegador).
- O impacto fatal mantém 1,2 segundo e o quadro original de olhos em
  espiral, com microoscilação de poucos pixels/radianos na pose final,
  sem trocar anatomia ou encurtar arbitrariamente a animação.

## Testes
- `tests/climate-v3-approved-second-plan.test.mjs` cobre:
  1. Game.visual real e prewarm de modo/seed herdados;
  2. invariância da velocidade física a sete escolhas de clima;
  3. gavião ascendente e mergulho verdadeiro;
  4. culling de casca em troncos superiores e inferiores;
  5. equivalência em 1000 amostras SAT vs AABB+SAT;
  6. cache de gradientes e agrupamento de feixes;
  7. relâmpago sem blur;
  8. suspensão e retomada de áudio.
- `tests/browser-render-profile.cjs` continua comparando pixels e
  geometria nas resoluções High/Low. Não compara **frequência de
  criação** de gradientes, pois cache não é alteração de geometria.
- `Climate V3 targeted regression` é a validação curta inicial.
  CI completo e navegadores Firefox/WebKit ainda são necessários.

## O que foi deliberadamente preservado
- Referência de duração climática baseada em voos completos automatizados.
  Não há evidência suficiente para alterá-la para 150/195 segundos.
- `prefers-reduced-motion` e limitações de qualidade Low.
- Arquivos WebP existentes, as seis artes `upper-shedding` e os
  fallbacks das animações de cobra.
- O clima do menu e tutorial e o funcionamento do escudo, pontuação,
  vitória, hitboxes e coleta.

## Pendências artísticas e de validação
- Limpeza **cirúrgica** dos riscos flutuantes na fonte
  `assets/v10/tree-variants-snow.webp` e criação de pequenos depósitos
  de neve para o tronco superior liso devem ser aprovadas pixel a
  pixel contra a arte de origem. Estas spritesheets não foram
  redesenhadas nem substituídas por aproximações gerativas.
- O filtro CSS `backdrop-filter` de uma legenda do menu pode ser
  reavaliado com perfil de composição; seu custo ainda não foi
  demonstrado como gargalo crítico.
- P95, frames >33ms, variação de qualidade e 60 FPS consistentes devem
  ser medidos em navegador e hardware real, sem atribuir ganhos
  hipotéticos de 10× ao traço duplo do relâmpago.

**Política de integração:** manter o PR #71 em draft sem merge na main
enquanto existir check final vermelho ou pendência visual crítica.
