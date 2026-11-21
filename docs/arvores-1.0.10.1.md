# Árvores e tela cheia — 1.0.10.1

Identificação pública: 1.0.10.1. Pacote/runtime: `1.0.10-1`.
Branch: `preparacao-para-a-versao-2.0`. Main e Pages não são publicados automaticamente.

## Troncos

A extensão das oito árvores vivas deixou de ampliar uma linha de pixels.
Agora repete faixas de 96 pixels da própria casca na escala da ponta original.
Cada par alterna a orientação vertical para que as bordas encontrem a mesma
linha da textura. A ponta, os galhos, o poleiro e as folhas conservam o recorte,
a posição e a escala anteriores.

As faixas e os padrões das oito árvores vivas e quatro variantes são preparados
no carregamento e compartilhados entre as instâncias. Cada extensão usa um
preenchimento com padrão; seu comprimento não aumenta o número de chamadas
de desenho. O padrão repete uma textura: não é uma árvore de arte única.

O tronco do teto usa sempre casca sem neve. A neve e a chuva continuam nos
recortes das pontas; nenhum trecho de casca nevada é repetido até o teto.

## Árvore podre

A primeira célula dos atlases `v9/tree-variants.webp` e
`v10/tree-variants-snow.webp` usa uma nova arte gerada a partir das referências:
madeira laranja quente, sulcos arredondados, rachadura legível e cogumelos.
As outras três células foram preservadas por comparação dos pixels decodificados.

As fontes estão em `art-source/trees/rot-1101.png` e
`art-source/trees/rot-snow-1101.png`. O empacotador
`scripts/pack_tree_rot_1101.py` registra a madeira no centro da célula existente.
A versão nevada reaproveita exatamente a madeira registrada e compõe apenas a
neve extraída da fonte gerada. A chuva é recortada pelo alfa da nova célula.
Os nove atlases dos animais não foram alterados.

A madeira usa o mesmo núcleo, ancoragem, regras de contato e tempo de quebra.
Rachaduras pintadas são madeira sólida; não são novas passagens. Não há
migração de placar, coleção ou progresso.

## Tela cheia

O evento nativo de entrada reapresenta a pausa acima da aplicação e foca
Continuar. Não retoma o voo automaticamente nem substitui outro painel aberto.
O teste nativo anterior não reproduziu o defeito do PC do usuário: esperava
um botão bloqueado e encontrou um botão acessível. A alteração é uma proteção
da ordem dos painéis; confirmação no aparelho físico continua necessária.

## Validação

`tests/browser-modular-trees-1101.cjs` verifica continuidade/alfa da extensão,
detalhe vertical da casca, limites do núcleo, padrões preparados uma vez,
estabilidade em pausa e capturas de árvores sem neve, com neve e quebrando,
em Chromium, Firefox e WebKit. A suíte geral também cobre as cenas do jogo,
climas, colisões, carregamento e jornadas completas.

O ensaio nativo de tela cheia verifica pausa acessível, simulação congelada,
retomada, saída e reentrada. Resultados do CI não certificam 60 FPS no PC
do usuário; a revisão visual e o teste físico continuam necessários.
