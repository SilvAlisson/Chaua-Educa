# Chauá Educa — Artes 01

Abra **review/avaliar-artes.html** no navegador. A página é autossuficiente, funciona sem internet e reúne o voo animado, cenário com parallax, coletas e vegetação. Use o botão para pausar e o controle de velocidade para observar as oito poses. Ela é uma prévia visual, não uma partida.

Também estão disponíveis:

- `review/Chaua-Educa-Prancha.png`: prancha geral de avaliação.
- `review/Chaua-Voo.gif`: prévia rápida do ciclo de voo.
- `svg/`: 28 fontes vetoriais editáveis.
- `png/`: 29 exportações rasterizadas, com transparência nos elementos isolados.
- `chaua-flight-atlas.json` e `chaua-flight-atlas@2x.json`: dados de recorte para o Phaser.
- `manifest.json`: especificações do conjunto.

## Conteúdo

| Grupo | Conteúdo |
| --- | --- |
| Personagem | 8 poses de voo, ilustração hero e spritesheet 4 × 2 |
| Coletas | Goiaba, semente, manga, mamão, coquinho, banana e milho |
| Obstáculos | 3 troncos com musgo, bromélias e detalhes de casca |
| Vegetação | 2 cipós decorativos, uma bromélia e uma samambaia isoladas |
| Floresta | Atmosfera distante, árvores ao fundo, troncos/copas intermediárias e vegetação próxima |

## Direção visual

Ilustração vetorial com curvas orgânicas, sombras discretas e paleta comum. O chauá é uma interpretação estilizada de *Amazona rhodocorytha*: coroa vermelha, face azulada, plumagem verde, bico cinza e cauda curta. Referência de identificação: [World Parrot Trust](https://parrots.org/encyclopedia/red-browed-amazon/). A arte não se apresenta como prancha científica.

Os desenhos foram construídos como SVG nativo, com fontes editáveis e geração determinística por código, conforme a direção vetorial escolhida. Não são bitmaps de IA convertidos em SVG. A qualidade infinita aplica-se ao desenho vetorial; as exportações PNG possuem dimensões definidas.

## Dimensões e integração

- Poses: 320 × 320 px, sem cortes, com corpo em posição fixa.
- Spritesheet 1×: 1280 × 640 px (4 colunas × 2 linhas).
- Spritesheet 2×: 2560 × 1280 px (células de 640 × 640 px).
- Cadência sugerida: 12 quadros/s; ajustar após avaliação em jogo.
- Origem sugerida: `(0.55, 0.54)`, próxima ao corpo. A hitbox precisa ser definida no estado lógico, independentemente da asa animada.
- Coletas: 256 × 256 px. Uniformizar o tamanho visual pela área ocupada, não apenas pelo tamanho do arquivo.
- Troncos: 240 × 540 px, com decorações transparentes. Ajustar a hitbox ao núcleo do tronco; bromélias e folhas são decorativas.
- Floresta: 1920 × 1080 px por camada. Atmosfera opaca e fixa; demais camadas com transparência real e composição periódica nas bordas para rolagem horizontal.
- Não esticar sprites quadrados para formatos retangulares. Adaptar escala e posição preservando as proporções.

Exemplo de carregamento (depois de colocar os arquivos no diretório público do jogo):

```ts
this.load.atlas('chaua-v2', 'art/png/chaua-flight-sheet.png', 'art/chaua-flight-atlas.json');
// Em create():
this.anims.create({
  key: 'chaua-v2-fly',
  frames: Array.from({ length: 8 }, (_, i) => ({
    key: 'chaua-v2', frame: `fly-${String(i).padStart(2, '0')}`,
  })),
  frameRate: 12,
  repeat: -1,
});
```

## O que avaliar

1. Aparência e personalidade do chauá.
2. Amplitude e ritmo das asas, especialmente nos extremos do movimento.
3. Distinção entre cenário, obstáculos e elementos coletáveis.
4. Cores, nível de detalhe e leitura em tamanho pequeno.
5. Adequação do conjunto ao público educativo.

Esta é a primeira direção de arte para avaliação. Os assets atuais do jogo não foram substituídos. Foram conferidos os PNGs, a transparência, os limites dos quadros e os recortes do atlas. A página HTML não foi testada em navegador nesta sessão; a animação e o parallax devem ser avaliados no seu navegador antes da integração definitiva.

## Reproduzir

As fontes e scripts ficam na branch de desenvolvimento do projeto. Para reconstruir o pacote no repositório:

```sh
npm ci
python3 -m pip install Pillow
npm run art:build
```

Os scripts usam Python, Sharp e Pillow para exportar e verificar desenhos nativos. Os recursos originais e seus créditos permanecem preservados no projeto.
