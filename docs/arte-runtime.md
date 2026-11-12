# Fonte oficial de arte no runtime · Chauá Educa

Esta especificação substitui a documentação **experimental** sobre `?actionSprites=1` e os scripts de migração antigos. O jogo não possui um parâmetro para selecionar artes históricas.

## Chauá

- Voo e resposta ao escudo: `public/parrot/fly/flight.webp` e `public/parrot/animations/impact.webp` (spritesheets obrigatórias).
- Pouso, pousado/piscar, representação de movimento reduzido e surpresa: poses *deliberadamente* mantidas no `assets/v6/chaua-atlas.webp`, porque as folhas de ação atuais **não incluem todas essas poses**.
- Falha ao carregar folha de ação obrigatória **impede iniciar a partida**, com erro explícito. Não há substituição automática por atlas anterior.

## Gavião

- Voo normal e atordoamento após escudo: `public/hawk/fly/flight.webp` e `public/hawk/animations/stunned.webp` (obrigatórias).
- Mergulho inclinado, aviso e recuo sem atordoamento: poses próprias do `assets/v6/hawk-atlas.webp`; não são fallback de erro.
- `hawkUsesActionArt` e `hawkBodyParts` selecionam estados **exclusivamente com dados da simulação**, sem consultar disponibilidade de imagem. Assim, o tamanho da colisão não muda durante pré-carregamento, nem em testes sem navegador.

## Cobra A2

- Único renderer físico e visual; três atlases oficiais em `public/snake/{base,attack,reactions}`.
- Máscaras geradas deterministicamente por `scripts/generate-snake-a2-masks.py`, verificadas por SHA-256 e contra pixels reais no navegador.
- Aviso usa sempre a geometria A2, sem opção de reaparecer aviso da cobra antiga.

## Neve e fontes de arte

- Troncos completos de neve: `assets/Seasons/Winter/trees-{upper,lower}-snow-04.webp` (cópia oficial).
- Removidas as duplicatas idênticas de `assets/v10/trees-{upper,lower}-snow.webp`.
- Removidos geradores de v10 obsoletos, pois não reproduziam a arte final. Preservados os WebP oficiais, overlays e fontes de arte. Não regenerar as artes finais com código histórico.
- Variante de árvore nevada `assets/v10/tree-variants-snow.webp` continua ativa e deve ser preservada.

## Proteção contra regressões

`npm test`, `node scripts/verify-current-spritesheets.cjs`, `python scripts/generate-snake-a2-masks.py --check` e CI do Chromium verificam a integração. Não apagar o atlas v6 do Chauá ou do gavião enquanto estados específicos ainda dependerem dele. Não confundir fonte autoral com textura não carregada.

## Resíduos visuais removidos após análise de referências

- 11 texturas WebP v3 substituídas (a floresta e as sete frutas atuais permanecem).
- 8 texturas WebP v4 substituídas (pena dourada e escudo permanecem).
- 31 imagens antigas da interface e do antigo diário gráfico (o favicon atual permanece).
- 7 arquivos da fonte Pixelify Sans sem uso; Baloo 2, Nunito e suas licenças continuam.
- 3 áudios WAV históricos; o áudio atual usa Web Audio procedural.
- CSS/SCSS modal antigo e o gerador de quadros v4 do gavião, não utilizados.

**Total desta rodada: 63 arquivos, 9.760.508 bytes no checkout.** A exclusão não altera arquivos-fonte ativos das árvores v6/v7 nem a identidade artística atual. Arquivos históricos podem ser recuperados pelo Git; nenhum fallback foi acrescentado.

## Fontes históricas da cobra

O gerador v6 produz somente Chauá e gavião. O gerador v7 produz somente as árvores. Os atlas v6/v7/v8 da cobra foram removidos do diretório distribuído; as fontes autorais originais continuam preservadas como arquivos históricos, mas não entram no runtime ou nos dados gerados.

## Uma única linha do tempo climática

As estações, a neve, o sol e os cenários usam o estado atual de voo (tempo decorrido, modo e semente), via `climate-progress.mjs` e `climate-timeline.mjs`. A antiga sequência paralela de estações por distância foi removida do renderer e dos testes. A distância continua controlando **física, colisões, posições e dificuldade**, não a estação visual. O menu passa um estado explícito de tempo zero; não há mais valor numérico que reative o sistema climático histórico.
