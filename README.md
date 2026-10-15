# Chauá Educa 2.0

Jogo educativo de voo lateral sobre o papagaio-chauá e a Mata Atlântica. A remodelação usa **Phaser 3.90 + TypeScript + Vite**, com simulação independente do renderizador, a 60 passos por segundo. O Phaser 3.90 foi fixado para usar uma API estável e documentada; uma futura atualização de major deve ser validada separadamente.

## Executar

Requer Node.js 22.12+ (ou 24) e npm.

```sh
npm ci
npm run dev
```

Abra **http://localhost:5501**. O projeto agora usa Vite; não abra o HTML diretamente nem use o Live Server para servir TypeScript.

```sh
npm test
npm run build
npm run preview
```

O build estático fica em `dist/`. Pode ser servido em domínio ou subdiretório, mantendo toda a pasta. Não requer backend, conta ou serviço pago. Hospedagem não é alterada automaticamente por esta branch. Caso exista GitHub Pages apontando para a antiga pasta, sua publicação precisa passar a usar o build de `dist/`.

## Jogar

- Informe um nome/apelido de 3 a 24 caracteres e escolha **Aprender** ou **Desafio**.
- Use **Espaço**, **↑**, toque na floresta ou o botão de voo no celular.
- **Esc** pausa; retornar à aba nunca retoma a partida automaticamente.
- Atravessar um par de obstáculos: **+1**. Coletar: **+3**. Acertar o quiz: **+2**.
- Frutas perdidas não pontuam. A vitória ocorre ao alcançar **200 pontos**, inclusive por coleta ou resposta.
- Os quizzes congelam a simulação. Há no mínimo 15 segundos de voo simulado entre quizzes; não repetem perguntas até esgotar o banco.
- Em **Aprender**, uma resposta errada mostra a explicação e permite continuar. Em **Desafio**, mostra a explicação antes de encerrar. Colisões encerram ambos os modos.
- Na Chauapédia ficam a coleção de sete itens e as perguntas para revisar. A coleção é um recurso lúdico, não uma prescrição alimentar para aves.

## Arquitetura

```text
src/
  core/FixedStep.ts       Acumulador acionado pelo loop do Phaser
  core/Simulation.ts      Física, geração, colisões, quiz e pontuação sem DOM
  game/ForestScene.ts     Renderização 2D interpolada, recursos e efeitos sonoros
  data/content.ts         Perguntas, explicações, fontes e coleção
  data/storage.ts         Persistência validada e importação do ranking antigo
  main.ts                 Interface HTML acessível e integração de estados
  style.css               Interface responsiva
public/assets/            Imagens, fontes e sons originais
 tests/game.test.ts       Testes de regressão do motor e da persistência
```

O mundo lógico mede 960 × 540. A renderização interpola posições anteriores e atuais; colisões só usam o estado lógico. O enquadramento mantém a mesma área visível nos diferentes dispositivos. Não existe loop RAF concorrente nem física ligada ao DOM. O acumulador aceita no máximo seis passos de recuperação por frame; máquinas que não sustentem o processamento podem desacelerar, sem promessa de desempenho universal.

Movimento dos obstáculos e dificuldade aumentam gradualmente com a distância, sem saltos por bônus de quiz. Aprender começa em 220 px/s com abertura de 190 px; Desafio, em 275 px/s com abertura de 150 px. Pausas e quizzes retomam com 1,5 segundo de preparação. A geração limita a variação vertical entre aberturas; as coletas ficam no centro delas. As hitboxes do pássaro são menores que o sprite. Ajustes finais de dificuldade e de alinhamento visual requerem testes com jogadores.

## Artes de massinha (2D)

A cena usa exclusivamente Phaser. Three.js, seus tipos e a cena 3D experimental foram removidos. O volume vem das ilustrações, sem modelos ou renderizador 3D.

Os arquivos ativos ficam em `public/assets/v3`: quatro poses com âncoras de peito, sete itens proporcionais, três variações de troncos (samambaia, bromélia e cogumelos), extensões de casca e floresta em WebP. As poses seguem o tempo da simulação e congelam durante o quiz. A ilustração de fundo tem movimento limitado, evitando repetir uma imagem sem emenda. A coleção e a tela inicial usam a mesma direção de arte.

Veja [direção de arte e parâmetros](docs/CLAY_REFINEMENT.md). As artes anteriores e seus geradores permanecem disponíveis; `art:build` exporta a coleção vetorial anterior, não substitui as novas artes.

## Dados e compatibilidade

`db-chaua`, a chave antiga, permanece intacta. Na primeira abertura, os registros válidos são importados para a categoria **Clássico**. Os novos rankings são separados por modo e salvos com a coleção, preferências e perguntas para revisão em `chaua-educa-v2`. Dados indisponíveis/corrompidos não impedem o jogo; a interface avisa quando necessário.

**localStorage depende da origem:** a importação automática só alcança dados no mesmo protocolo, domínio e porta. Abrir Vite em outra porta/domínio não permite acessar o ranking da origem anterior. Não há sincronização entre dispositivos. A chave antiga não é apagada.

## Verificação

A suíte cobre reprodução equivalente em 60/120/144/180/240 Hz com entradas e aleatoriedade controladas, recuperação limitada, pausa, pontuação, quiz, colisão, vitória, reinício e migração. CI executa testes e build em push/PR.

Veja [validação e pendências](docs/VALIDATION.md) para os limites desta entrega. O banco foi reduzido a afirmações com referências institucionais; não se deve inverter a resposta da antiga questão 14, pois seu texto dizia que a expansão **não** causava impacto. A revisão pedagógica completa deve preceder uso institucional.

## Créditos preservados

- **Criador/desenvolvedor:** [SilvAlisson](https://github.com/SilvAlisson)
- **Contribuidor original:** [CodeLPrime](https://github.com/CodeLPrime)
- **Imagens e áudio:** Lívia Teodosio e Alisson Silva
- **Perguntas originais:** Marilia Teodosio Costa e Flávia Gomes Ramos Araújo
- **Instituição:** Instituto Federal de Alagoas — IFAL, Programa de Pós-Graduação em Tecnologias Ambientais — PPGTEC, Mestrado Profissional em Tecnologias Ambientais
- **Alunas:** Marilia Teodosio Costa e Flávia Gomes Ramos Araújo

As contribuições históricas incluem correções de frutas (#1, #14), controles (#4), perguntas (#7), ciclo de jogo/ranking (#8) e reinício (#11). Código e referências da versão original continuam disponíveis no histórico Git (base `b3ec74e`). Fontes mantêm sua licença OFL em `public/assets/Fonts/Pixelify_Sans/OFL.txt`.
