# Ambientações sazonais

Artes geradas a partir da floresta original `assets/v3/forest.webp`, sem substituir esse arquivo. O menu e o treino continuam usando a floresta original. As ambientações da jornada são uma interpretação artística, não uma representação do calendário climático da Mata Atlântica.

## Atlas

- `season-backgrounds.webp`: 1672 × 941 px, quatro cenas. Cada coluna mede 836 px. A primeira linha usa y=0..469; a segunda y=471..940; a linha central é excluída para evitar vazamento entre quadros. Ordem: primavera, verão, outono, floresta fria/nebulosa. Sem neve.
- `season-particles.webp`: 256 × 256 px RGBA, quatro células de 128 × 128. Ordem: pétala rosa, pétala clara, folha vermelha, folha dourada.

As células de fundo são estados visuais, não poses sequenciais. O código faz a transição de opacidade. As partículas usam rotação e deslocamento contínuos com o relógio da simulação. Não participam de colisões. Movimento reduzido mantém os fundos e desativa partículas.

## Integração e orçamento

`js/seasons.mjs` guarda no máximo dois fundos já dimensionados para a tela e libera os anteriores ao mudar tamanho, resolução ou estação. Fundo opaco substitui o passe original durante a jornada; não há filtro de cor por pixel a cada quadro. Partículas limitadas a 18 por ambiente (7 em detalhe baixo); na transição final coexistem folhas e pétalas, com opacidades complementares. A resolução das artes é independente da física.

A jornada percorre primavera, verão, ambiente frio com chuva, outono com vento e retorno à primavera no abrigo. Transições duram 1800 unidades de distância; não dependem de FPS. Os efeitos de chuva, trovão e vento existentes continuam ativos.

## Direção de arte usada na geração

Ferramenta de geração de imagem integrada. Fundo: atlas 2×2, repetir o enquadramento da floresta de referência; manter árvores laterais, montanhas, área central de voo e iluminação; modificar somente cores da folhagem, flores discretas e neblina. Primavera com flores rosas/creme; verão verde; outono com tons ferrugem, vermelho e dourado mantendo parte verde; frio com tons azul-esverdeados e neblina, sem neve. Sem personagens, UI ou partículas incorporadas.

Partículas: atlas transparente 2×2, um objeto centralizado por célula com margem; pétala rosa, pétala creme, folha tropical oval vermelha e folha tropical dourada; pintura 2.5D, iluminação suave superior esquerda, sem contornos grossos, rótulos, grade ou sombra de chão. Conversão técnica para WebP e redução do atlas de partículas preservam transparência.

## Verificação

`tests/seasons.test.mjs`: transições, movimento reduzido, reutilização e limite de superfícies.
`tests/browser-weather-trees.cjs`: cenas sazonais no desktop e celular, transição intermediária, pausa determinística, continuidade de árvores e erros JavaScript. As capturas são anexadas pelo CI.
