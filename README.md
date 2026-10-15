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

- **Voo:** toque na área do jogo ou no botão Voar, ou use ↑/espaço. Um toque bate as asas; segurar repete em cadência e consome fôlego; soltar plana e recupera energia. A inclinação é limitada e suave. Colisões e os limites superior e inferior encerram o voo sem proteção de cenário.
- **Ritmo:** troncos, troncos ocos, galhos quebrados, cobras, gaviões em travessia e, depois, mergulhos. Avisos mostram as trajetórias dos gaviões. Os primeiros encontros são isolados; combinações mantêm a passagem livre. Clareiras dão intervalos para respirar.
- **Escudo de folhas:** absorve um contato e concede 1,6 s para sair da colisão. Quebra madeira sem dar pontos de destruição ou afasta um animal sem destruí-lo. Recolher mais escudos não acumula vidas. Não protege dos limites do cenário nem de resposta incorreta.
- **Pena dourada:** dobra os pontos por 10 s de voo. Outra pena renova o tempo; não aumenta o multiplicador. Pausas e perguntas congelam o relógio. O bônus de uma resposta é definido na coleta que abriu o quiz.
- **Aprendizado:** uma passagem vale 1 ponto; um fruto, 3; uma resposta correta, 2. A cada dois frutos, aparece um quiz. A resposta incorreta é explicada e encerra o voo. As 15 perguntas existentes não se repetem até esgotar a lista. Com 200 pontos, há uma celebração de vitória.
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
