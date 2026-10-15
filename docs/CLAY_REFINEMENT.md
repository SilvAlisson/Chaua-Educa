# Refinamento de massinha — 15/10/2026

## Auditoria

A branch já desenhava o jogo com Phaser; `ForestScene3D.ts` era uma implementação não importada. Foram removidos esse arquivo, `three` e `@types/three`. A estrutura e as alterações do autor foram usadas como base.

Os problemas encontrados incluíam sprites com proporções distintas esticados ao mesmo retângulo; temporizador de asa que não acompanhava reinícios/pausas; fundo não contínuo repetido como tile; madeira visual muito mais larga que a colisão; retomada instantânea após leitura; e itens descritos incorretamente como sete frutos nativos.

## Direção visual

Preservamos o volume de massinha, cores verdes, testa vermelha, aro azul e bico alaranjado do personagem proposto pelo autor. As novas imagens foram geradas com IA a partir das referências existentes e empacotadas em WebP com alfa. São ilustrações estilizadas, não pranchas científicas.

- Quatro poses com âncoras individuais em `src/game/visuals.ts`; escala uniforme, sem deformação de largura/altura.
- Três variações de tronco. O núcleo visual tem 60 px e a colisão 54 px; plantas laterais são decorativas. Metadados em `src/game/assets/trunks.json` alinham o centro da madeira e não o centro da imagem decorada. Extensões de casca cobrem a região até a borda sem esticar o tronco inteiro.
- Sete itens de coleta com lado máximo de 42 px no mundo. O halo pulsa; o item permanece sobre seu centro lógico.
- Fundo com área central mais clara e enquadramento com sobra. Deslocamento sutil limitado evita emendas de panorama. Não há promessa de quatro camadas independentes: esta versão usa uma ilustração de fundo e partículas sobrepostas.
- A opção de movimento reduzido remove balanço do fundo, partículas, inclinação e ciclo de asas.

O script antigo de extração dependia de caminhos pessoais do Windows. Foi substituído pelo empacotador portátil:

```sh
npm run art:pack -- /caminho/poses.png /caminho/itens.png /caminho/troncos.png /caminho/floresta.png
```

O empacotador é específico aos layouts desta coleção (poses 2×2, itens 4×2 e troncos em três colunas de 512 px), preserva alfa e proporções e exporta para `public/assets/v3`. Os arquivos finais estão versionados e bastam para executar/editar o jogo; gerar outra folha exige revisar recortes, âncoras e metadados. Não é uma ferramenta genérica para qualquer spritesheet.

## Mecânicas

Os parâmetros ficam em `FLIGHT`, em `src/core/Simulation.ts`:

| Parâmetro                  | Aprender       | Desafio        |
| -------------------------- | -------------- | -------------- |
| Velocidade inicial → final | 220 → 265 px/s | 275 → 330 px/s |
| Abertura inicial → final   | 190 → 165 px   | 150 → 130 px   |
| Gravidade                  | 850 px/s²      | 960 px/s²      |
| Impulso por toque          | −300 px/s      | −330 px/s      |
| Intervalo entre pares      | 100 ticks      | 90 ticks       |

A progressão alcança o máximo após 18.000 px voados. As regras de pontos, vitória e resposta errada foram preservadas. A retomada congela o mundo por 1,5 segundo; entradas de voo durante a contagem são descartadas. Após quiz, a queda é limitada a 100 px/s para dar tempo de reação; pausa comum preserva a velocidade. Nenhum quiz acumula tempo de física.

## Limites da verificação

24 testes e build TypeScript/Vite passam. A equivalência entre 60/120/144/180/240 Hz foi verificada na simulação. Não houve sessão interativa em navegador nem teste em celular: aspecto da animação, áudio, toque e percepção de dificuldade ainda precisam dessa avaliação. As artes foram inspecionadas separadamente; isso não substitui uma partida.
