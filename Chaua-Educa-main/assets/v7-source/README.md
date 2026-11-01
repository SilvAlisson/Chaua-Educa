# Artes de referência integradas — v7

Fontes WebP sem perdas, convertidas das folhas PNG geradas a partir das referências tree1–tree6 enviadas pelo usuário. A conversão preserva o alfa e todos os pixels visíveis. Os PNGs originais não são alterados.

- trees-lower.webp: quatro variantes inferiores.
- trees-upper.webp: quatro variantes superiores, com iluminação própria.
- snake-poses.webp: 16 poses de repouso, alerta, bote e recuperação.

Geração: ferramenta integrada de imagens. Prompt comum: cartoon 3D arredondado, madeira alaranjada quente, veios esculpidos, nós ovais, anéis claros e iluminação superior esquerda; fundo transparente, sem cenário ou legendas. Troncos em grade 2×2 com variações simples, folhas, cogumelos e galho integrado. Cobra bege com manchas marrons, olhos pretos, barriga creme e língua bifurcada, em grade 4×4, voltada à esquerda; madeira separada.

`python3 scripts/prepare_forest_v7.py` extrai os componentes conectados, remove apenas pixels isolados externos, registra os troncos pela largura da madeira e a cobra pela largura da parte enrolada/base, e produz os atlas de execução em `assets/v7` e os metadados `forest-art-data.mjs`. Não redesenha os personagens. O último quadro da cobra reutiliza exatamente o primeiro. O olho fechado utiliza landmarks adjacentes, evitando interpretar a narina como olho.

O renderizador preserva as proporções das ilustrações, prolonga apenas uma linha de casca para fora da área visível, e usa o ponto de contato medido no galho do abrigo. A cobra usa uma camada independente; esta integração usa o corpo enrolado sobre a madeira, sem adicionar uma volta de cauda colada na frente do tronco.
