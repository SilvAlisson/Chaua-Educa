# Chaua-Educa

"Chauá-educa" is a compelling game with a noble purpose – raising awareness and making an effort to save an endangered species known as the Chauá parrot. In this engaging gaming experience, you step into the wings of a delightful parrot named Chauá. Your mission goes beyond entertainment; it's about making a difference.

- **Creator:** [SilvAlisson](https://github.com/SilvAlisson)
- **Contributor:**  [CodeLPrime](https://github.com/CodeLPrime)

  Each contribution that CodelPrime made to the project:
  - Fixed fruit styles [#1](https://github.com/SilvAlisson/Chaua-Educa/pull/1)
  - Ensured keyboard controls are only registered once [#2](https://github.com/SilvAlisson/Chaua-Educa/pull/4)
  - Ensured question uniqueness during game and updated fruit locations [#3](https://github.com/SilvAlisson/Chaua-Educa/pull/7)
  - Refactored game loop and fixed ranking system [#4](https://github.com/SilvAlisson/Chaua-Educa/pull/8)
  - Refactored codes to support restarting the game without a browser reload [#5](https://github.com/SilvAlisson/Chaua-Educa/pull/11)
  - Fixed fruit sprites and credits screen [#6](https://github.com/SilvAlisson/Chaua-Educa/pull/14)
## Asas da floresta · regras v2

A nova aventura mantém o objetivo educativo do Chauá e acrescenta voo com planeio, arte arredondada com iluminação suave, obstáculos variados e dois poderes. Os animais são perigos fictícios da aventura, sem afirmar que uma espécie específica caça o chauá adulto.

- **Voo:** toque na área do jogo ou no botão Voar, ou use ↑/espaço. Um toque bate as asas; segurar repete em cadência e consome fôlego; soltar faz descer e recupera energia. A inclinação é limitada e suave. Colisões e os limites superior e inferior encerram o voo sem proteção de cenário.
- **Ritmo:** troncos, troncos ocos, galhos quebrados, cobras, gaviões em travessia e, depois, mergulhos. Avisos mostram as trajetórias dos gaviões. Os primeiros encontros são isolados; combinações mantêm a passagem livre. Clareiras dão intervalos para respirar.
- **Escudo de penas:** absorve um contato e concede 1,6 s para sair da colisão. Quebra madeira sem dar pontos de destruição ou afasta um animal sem destruí-lo. Recolher mais escudos não acumula vidas. Não protege dos limites do cenário nem de resposta incorreta.
- **Pena dourada:** dobra os pontos por 10 s de voo. Outra pena renova o tempo; não aumenta o multiplicador. Pausas e perguntas congelam o relógio. O bônus de uma resposta é definido na coleta que abriu o quiz.
- **Aprendizado:** uma passagem vale 1 ponto; um fruto, 3; uma resposta correta, 2. A cada dois frutos, aparece um quiz. A resposta incorreta é explicada: na Aventura encerra o voo; no Voo tranquilo permite continuar. As oito perguntas restauradas da versão anterior incluem explicação e fonte e não se repetem até esgotar a lista. Com 200 pontos, há uma celebração de vitória.
- **Ranking:** aventura e voo tranquilo têm classificações próprias em `db-chaua-floresta-v2`. O ranking clássico continua intacto em `db-chaua` e pode ser consultado separadamente. Dados ficam no navegador; se o armazenamento estiver indisponível, os novos resultados ficam só na sessão.
- **Acessibilidade:** botões e quizzes por teclado/toque, diálogos com foco contido, pausa ao sair da aba, controle de som e respeito a `prefers-reduced-motion`. O voo é um jogo visual; a navegação e os resultados têm rótulos para tecnologias assistivas.

### Desenvolver

O jogo roda sem dependências de produção, serviços externos ou segredos. Para servir os módulos JavaScript e os recursos locais:

```sh
python3 -m http.server 5501 --bind 127.0.0.1 --directory Chaua-Educa-main
```

Para as ferramentas de desenvolvimento, use Node.js 22+ e npm:

```sh
npm ci
npm start             # mesmo servidor HTTP, na porta 5501
npm run build         # SCSS → CSS versionado, sem source maps
npm test              # lógica e simulação, com node:test
npm run test:browser  # com o servidor ativo: teclado, toque, quizzes e interface
```

O teste de navegador utiliza o Chromium do sistema quando disponível. Em outra máquina, instale o navegador com `npx playwright install chromium`, ou defina `CHROMIUM_PATH`. `GAME_URL` permite mudar a origem do servidor. `SCREENSHOT_DIR` é opcional para salvar uma captura de tela da versão móvel.

`scss/style.scss` é a fonte dos estilos da nova interface e `css/style.css` é o arquivo gerado. `js/engine.mjs` contém a simulação em passos de 1/120 s; `render.mjs`, a arte desenhada no canvas; `script.js`, a interface, os controles e o áudio; `questions.mjs`, o material educativo; `database.js`, os recordes. Baloo 2 e Nunito são servidas localmente, com suas licenças SIL OFL em `Fonts/`. Os créditos e as referências originais continuam disponíveis na interface.

### Correções de continuidade

- Mundo lógico fixo de 960 × 640, ajustado com margens nas telas de outra proporção. Redimensionar não muda colisões, posições nem distância dos encontros.
- Simulação de 120 ticks/s e interpolação visual entre estados, incluindo voo e obstáculos.
- Retomada de 1,5 s após quiz e pausa, mantendo poderes e física congelados durante a contagem.
- Sete alimentos com as artes WebP anteriores e Chauapédia com descobertas persistentes.
- Ranking da versão anterior (`chaua-educa-v2`) consultável em aba separada; desbloqueios reaproveitados sem modificar esse arquivo de armazenamento.
- A implementação Canvas da branch foi preservada. Não houve migração de volta para Phaser/TypeScript.

Validação desta correção: 26 testes de lógica e regressão. O teste de navegador exige Chromium disponível no ambiente. `npm run dev` também inicia o servidor na porta 5501.

### Artes integradas ao Canvas

As artes WebP v3/v4 agora são carregadas por `js/assets.mjs` e desenhadas pelo renderizador atual: quatro poses de voo com âncoras estáveis, papagaio pousado no início/vitória e retrato no resultado de derrota, floresta com movimento suave, três troncos, cascas, tronco oco, cobras no tronco e no galho, dois quadros de gavião, escudo e pena dourada. As sete frutas também usam o carregamento centralizado. O botão de início só é liberado depois de todas as imagens carregarem; erros são apresentados na tela.

A madeira conserva seu núcleo de colisão; folhas são decorativas. Cobras agora ficam nos troncos inferiores, conforme a arte, com colisões específicas para suas cabeças e galhos. O buraco dos obstáculos superiores continua recortado tanto na imagem quanto na colisão. As artes são servidas localmente em `assets/v3` e `assets/v4`.

Validação da integração: 30 testes automatizados (incluindo presença dos WebP, quatro poses, chamadas do renderizador e colisões), build SCSS e verificação de diff. Testes de desenho usam contexto Canvas instrumentado; não substituem avaliação visual em navegador. Não foi executado Chromium neste ambiente.

### Ajuste de ritmo e resposta do voo

Aventura começa a 245 unidades/s (antes 140); Voo tranquilo começa a 205 (antes 119). A gravidade é 900 unidades/s² e a queda é limitada a 360 unidades/s. Tocar aplica impulso para cima; segurar repete a cada 0,22 s, sempre com sustentação suficiente para subir, mesmo com fôlego mínimo. Soltar permite uma descida mais rápida, mantendo a inclinação limitada do papagaio.

As passagens da Aventura diminuem de 185 até 155 unidades; no Tranquilo, de 220 até 190. A cadência normal dos encontros começa em 2,15 s e chega a 1,65 s, com clareiras de 2,8 s. Os mergulhos são introduzidos após 55 s de voo para aparecerem antes de uma vitória no novo ritmo. Os capítulos visuais avançam a cada 20 s.

Validação do ajuste: testes de sustentação com fôlego mínimo, recuperação ao pressionar durante queda, descida sem comando, equivalência de física por Hz e percurso automatizado até a vitória. A sensação de controle ainda depende de avaliação jogando no navegador.

### Movimento das telas e apoio do papagaio

A tela inicial revela título, formulário e ações em sequência. Botões têm resposta ao toque/foco e um reflexo suave nas ações principais. Fim de jogo anima o papagaio e apresenta as estatísticas em sequência; ranking anima a abertura, abas e linhas com atraso limitado a 315 ms. As ações continuam disponíveis durante as transições. `prefers-reduced-motion` desativa os movimentos.

O galho da arte inicial agora se prolonga até uma árvore lateral com casca, que atravessa a altura do cenário. A conexão usa as mesmas coordenadas e escala do papagaio; folhas cobrem a junção com a arte original em telas largas e estreitas. Validação: build SCSS, 33 testes existentes e diff sem erros; composição visual ainda requer conferência em navegador.

### Impactos e leitura dos poderes

Colisões fatais exibem uma explosão curta de penas durante 0,42 s antes do resultado. Durante esse intervalo, voo, obstáculos, pontuação e relógios dos poderes ficam congelados; só os efeitos avançam. O tronco atingido recebe um tremor amortecido de até 6 unidades por 0,3 s, sem mover sua colisão. O escudo é representado por nove penas orbitando o papagaio e também solta penas ao absorver o contato. A pena dourada mantém uma aura e um rastro enquanto o multiplicador estiver ativo.

Movimento reduzido mantém os indicadores estáticos, omite partículas/tremor e abre o resultado imediatamente. Erros no quiz não acionam animação de impacto. Os efeitos de penas não consomem a aleatoriedade dos obstáculos/perguntas. Validação: 37 testes e build; aparência final ainda requer avaliação em navegador.
