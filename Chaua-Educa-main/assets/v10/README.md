# Ambientações sazonais

**Artes reconstruídas de forma determinística com `scripts/rebuild_weather_atlases.py`, usando a floresta pintada original `assets/v3/forest.webp` e preservando as pétalas e troncos pintados da primeira versão desta branch (commit `8ac0815`) sem modificar os originais.** As quatro cenas reutilizam o mesmo enquadramento e os mesmos objetos da floresta original, mudando apenas o clima, a folhagem e detalhes discretos. O menu e o treino continuam usando a floresta original. As ambientações da jornada são uma interpretação artística, não uma representação do calendário climático da Mata Atlântica.

## Atlas

- `season-backgrounds.webp`: 1672 × 941 px, quatro cenas. Cada coluna mede 836 px. A primeira linha usa y=0..469; a segunda y=471..940; a linha central é excluída para evitar vazamento entre quadros. Ordem: primavera, verão, outono, floresta fria/nebulosa. Sem neve.
- `season-particles.webp`: 256 × 256 px RGBA, quatro células de 128 × 128. Ordem: pétala rosa, pétala clara, folha vermelha, folha dourada.

As células de fundo são estados visuais, não poses sequenciais. O código faz a transição de opacidade. As partículas usam rotação e deslocamento contínuos com o relógio da simulação. Não participam de colisões. Movimento reduzido mantém os fundos e desativa partículas.

## Integração e orçamento

`js/seasons.mjs` guarda no máximo dois fundos já dimensionados para a tela e libera os anteriores ao mudar tamanho, resolução ou estação. Fundo opaco substitui o passe original durante a jornada; não há filtro de cor por pixel a cada quadro. Partículas limitadas a 18 por ambiente (7 em detalhe baixo); na transição final coexistem folhas e pétalas, com opacidades complementares. A resolução das artes é independente da física.

A jornada percorre primavera, verão, ambiente frio com chuva, outono com vento e retorno à primavera no abrigo. Transições duram 1800 unidades de distância; não dependem de FPS. Os efeitos de chuva, trovão e vento existentes continuam ativos.

## Direção de arte usada na geração

Fontes exatas: floresta original processada com Pillow e elementos pintados originais da própria branch. A regeneração consulta o commit `8ac0815` no histórico Git. Sprites incompatíveis em pixel art ou máscaras de debug não são utilizados. Fundo: atlas 2×2, repetir o enquadramento da floresta de referência; manter árvores laterais, montanhas, área central de voo e iluminação; modificar somente cores da folhagem, flores discretas e neblina. Primavera com flores rosas/creme; verão verde; outono com tons ferrugem, vermelho e dourado mantendo parte verde; frio com tons azul-esverdeados e neblina, sem neve. Sem personagens, UI ou partículas incorporadas.

Partículas: atlas transparente 2×2, um objeto centralizado por célula com margem; pétala rosa, pétala creme, folha tropical oval vermelha e folha tropical dourada; pintura 2.5D, iluminação suave superior esquerda, sem contornos grossos, rótulos, grade ou sombra de chão. Conversão técnica para WebP e redução do atlas de partículas preservam transparência.

## Verificação

`tests/seasons.test.mjs`: transições, movimento reduzido, reutilização e limite de superfícies.
`tests/browser-weather-trees.cjs`: cenas sazonais no desktop e celular, transição intermediária, pausa determinística, continuidade de árvores e erros JavaScript. As capturas são anexadas pelo CI.

## Regeneração e garantia de compatibilidade

`python -m pip install Pillow==11.3.0 && python scripts/rebuild_weather_atlases.py` reproduz as três WebP da branch. Árvore-base e vegetação preservam as artes originais da branch e do jogo, sem criar uma segunda família visual. As emendas da folha `tree-variants.webp` permanecem nas alturas originais por célula `[181, 180, 180, 182]`, com núcleo de 128 px e pivô na coluna de 256 px. Os fundos continuam 1672×941 e compartilham as mesmas coordenadas de elementos; partículas RGBA seguem 256×256. O script valida a altura das emendas e não altera os originais.

A chuva possui uma segunda camada sutil em primeiro plano, desenhada após os atores e antes dos avisos, preservando a legibilidade e a pausa determinística. O máximo de partículas de estação é compartilhado durante as transições (18 em qualidade alta; 7 na baixa). A floração e a coloração do outono são ambientações artísticas, não uma afirmação sobre as estações da Mata Atlântica.

`.github/workflows/rebuild-weather-art.yml` regenera as três folhas, verifica formato/transparência, executa testes, captura cenas em notebook/celular e só então envia os arquivos para essa branch. Não fazer merge na `main` antes de confirmar esse workflow.

### Continuidade dos troncos sem duplicação

A área da célula do atlas entre y=192 e y=255 contém uma textura de casca de 128×64 px, reconstruída a partir das cores pintadas do próprio tronco, sem nós, folhas, fungos ou vazios repetidos. Somente a extremidade pintada (y=8 até a emenda original) contém esses detalhes únicos. O renderizador espelha pequenas faixas de casca com continuidade de cor, sem esticar um único pixel verticalmente nem duplicar estruturas anatômicas.
