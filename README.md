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
- **Escudo de penas:** absorve um contato e concede 1,6 s para sair da colisão. Reposiciona o Chauá na passagem sem destruir troncos vivos; apenas o galho seco saliente pode se quebrar. Afasta animais sem destruí-los e protege dos limites superior e inferior. Contatos protegidos não dão pontos de passagem. Recolher mais escudos não acumula vidas. Não protege de resposta incorreta.
- **Pena dourada:** dobra os pontos por 10 s de voo. Outra pena renova o tempo; não aumenta o multiplicador. Pausas e perguntas congelam o relógio. O multiplicador da resposta é capturado quando o quiz abre e permanece garantido durante a leitura.
- **Aprendizado:** uma passagem vale 1 ponto; um fruto, 3; uma resposta correta, 2. Coletar prepara uma descoberta única. Após pelo menos 30 s de voo, novos encontros aguardam e a pergunta abre somente depois de a rota ficar livre e a ave estar longe dos limites, em velocidade vertical moderada. No Desafio, a resposta incorreta encerra o voo após a explicação; no Amigável, permite continuar. As oito perguntas restauradas da versão anterior incluem explicação e fonte e não se repetem até esgotar a lista. Com 200 pontos, há uma medalha; a vitória acontece ao chegar ao abrigo do bando.
- **Ranking:** Desafio e Amigável (identificadores internos `aventura` e `tranquilo`) têm classificações próprias em `db-chaua-floresta-v4` (jornada atual); as classificações `floresta-v2` e `floresta-v3` ficam no histórico. O ranking clássico continua intacto em `db-chaua` e pode ser consultado separadamente. Dados ficam no navegador; se o armazenamento estiver indisponível, os novos resultados ficam só na sessão.
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

As passagens da Aventura diminuem de 185 até 155 unidades; no Tranquilo, de 220 até 190. A cadência normal dos encontros começa em 2,15 s e chega a 1,65 s, com clareiras de 2,8 s. Os mergulhos são introduzidos após 55 s de voo para aparecerem antes de uma vitória no novo ritmo. Os quatro trechos avançam a cada 7.000 unidades percorridas.

Validação do ajuste: testes de sustentação com fôlego mínimo, recuperação ao pressionar durante queda, descida sem comando, equivalência de física por Hz e percurso automatizado até a vitória. A sensação de controle ainda depende de avaliação jogando no navegador.

### Movimento das telas e apoio do papagaio

A tela inicial revela título, formulário e ações em sequência. Botões têm resposta ao toque/foco e um reflexo suave nas ações principais. Fim de jogo anima o papagaio e apresenta as estatísticas em sequência; ranking anima a abertura, abas e linhas com atraso limitado a 315 ms. As ações continuam disponíveis durante as transições. `prefers-reduced-motion` desativa os movimentos.

O galho da arte inicial agora se prolonga até uma árvore lateral com casca, que atravessa a altura do cenário. A conexão usa as mesmas coordenadas e escala do papagaio; folhas cobrem a junção com a arte original em telas largas e estreitas. Validação: build SCSS, 33 testes existentes e diff sem erros; composição visual ainda requer conferência em navegador.

### Impactos e leitura dos poderes

Colisões fatais exibem uma explosão curta de penas durante 0,42 s antes do resultado. Durante esse intervalo, voo, obstáculos, pontuação e relógios dos poderes ficam congelados; só os efeitos avançam. O tronco atingido recebe um tremor amortecido de até 6 unidades por 0,3 s, sem mover sua colisão. O escudo é representado por nove penas orbitando o papagaio e também solta penas ao absorver o contato. A pena dourada mantém uma aura e um rastro enquanto o multiplicador estiver ativo.

Movimento reduzido mantém os indicadores estáticos, omite partículas/tremor e abre o resultado imediatamente. Erros no quiz não acionam animação de impacto. Os efeitos de penas não consomem a aleatoriedade dos obstáculos/perguntas. Validação: 37 testes e build; aparência final ainda requer avaliação em navegador.

### Imersão da floresta

- Camadas de árvores distantes/intermediárias com velocidades distintas, folhas próximas apenas nas bordas, cipós e folhagem com vento sincronizado. A rolagem usa distância integrada, sem saltos ao acelerar. Luz e tons fazem transições de quatro segundos; trechos ganham flores e bromélias decorativas.
- Vento e cantos sintetizados localmente, com sons de asas, coleta e poderes. O botão de som controla tudo. O contexto de áudio só é criado após interação com som habilitado; ambiente silencia em pausas, quiz, resultado e ao perder foco. Não há downloads de áudio nem timers permanentes.
- Coletas exibem partículas, pontos próximos ao papagaio, reação breve do personagem e do contador. Pontos dobrados usam dourado. As asas têm transição curta entre poses e a cauda tem movimento secundário discreto.
- Cobras movimentam a região da cabeça e mostram a língua ocasionalmente; o resto do tronco e a colisão permanecem estáticos. Gaviões alternam batidas e planeio.
- O galho seco atingido pelo escudo se desfaz em lascas; troncos vivos mantêm a geometria e reagem com tremor e partículas. A proteção temporária tem contorno azul tracejado, diferente das penas do escudo. A aura ×2 encolhe nos três segundos finais e termina com um anel e aviso sonoro suaves.
- Limite de 96 partículas e seis indicadores de pontos; efeitos cosméticos não consomem a aleatoriedade da partida. Pausas congelam relógios e efeitos; movimento reduzido remove animações decorativas e deslocamento dos pontos.

Validação: 43 testes automatizados, build SCSS e inspeção de imagens renderizadas com Canvas nativo/Skia usando os assets reais. Uma cena de 960 × 640 levou cerca de 1,4 ms por renderização neste ambiente (60 quadros); esse número não representa FPS do navegador ou de um notebook específico. Interface DOM, áudio audível e sensação ao jogar ainda precisam de avaliação no navegador.


### Etapa 1 — controle de voo confiável

- Comandos nos últimos 120 ms do intervalo entre batidas são aproveitados uma vez, mesmo após soltar. Toques muito antecipados não ficam acumulados.
- Segurar durante a contagem prepara uma subida imediata; soltar antes do fim cancela essa preparação.
- Teclado, toque e ativação acessível usam o mesmo controlador. Soltar uma entrada não interrompe outra ainda pressionada.
- Pausa, quiz, cancelamento do toque e saída limpam comandos pendentes. Uma perda de captura normal após soltar não apaga um toque válido.
- Gravidade, queda, inclinação e força de subida permanecem nas curvas já ajustadas. O fôlego suaviza a subida sustentada, sem tornar o controle ineficaz.
- Validação: 51 testes automatizados aprovados e build Sass concluído. O roteiro de navegador inclui segurar na contagem; sua execução depende de Chromium disponível e ainda precisa ser conferida em aparelho real.


### Etapa 2 — colisões e recuperação

O escudo também protege teto e chão, reposicionando a ave 36 unidades para dentro e corrigindo a velocidade. Durante os 1,6 s de proteção temporária, os limites continuam recuperando o voo sem consumir outro escudo. No contato com troncos, a ave retorna ao centro da passagem; a interpolação é sincronizada para não desenhá-la atravessando madeira. Cobras se afastam e a árvore permanece intacta. Somente a saliência seca da variante quebrada perde sua colisão quando atingida diretamente. Galhos, cavidades e margens tolerantes existentes foram preservados.

Contatos simultâneos não emitem derrotas ou consumos duplicados. Partículas de lasca e brilho agora têm desenho próprio. Validação: 57 testes aprovados e build concluído; a inspeção interativa em navegador e aparelho real permanece pendente.


### Etapa 3 — enquadramento e controles móveis

O mundo físico continua em 960 × 640. Em retrato estreito, a câmera mostra as coordenadas horizontais 80–800 (720 unidades), preservando a altura inteira e aumentando a escala em até 33% em relação ao ajuste pela largura anterior. Isso reduz o horizonte horizontal; mesmo na velocidade máxima, a borda direita mantém aproximadamente 1,66 s até o encontro com um gavião e 1,93 s para madeira. Avisos antecipados continuam fixados à borda visível. Paisagem e desktop mostram toda a largura.

Placar, poderes e controles ocupam faixas reservadas, com áreas seguras de tela; os avisos dos gaviões usam 11–12 pixels CSS, sem reduzir a fonte com o mundo. O botão de pausa tem 44 × 44 e o de voo pelo menos 104 × 48 pixels. Rotacionar durante voo ou contagem pausa, limpa entradas e exige retomada com contagem; não altera os tempos ou a física. Há sugestão discreta de paisagem, sem bloquear retrato.

Validação: 61 testes aprovados, build concluído e renderização Canvas nativa inspecionada em 390 × 844. Testes geométricos cobrem 320 × 568, 390 × 844, 768 × 1024, 844 × 390 e 1440 × 960. O roteiro de navegador inclui rotação e congelamento; DOM/CSS, toque e orientação ainda precisam de execução em navegador/aparelho real.


### Etapa 4 — descobertas com regras por modo

Desafio mantém a punição por erro; Amigável preserva os pontos da fruta e retoma após a explicação. Os rótulos e instruções mostram essa diferença antes de iniciar e dentro da pergunta. Os identificadores internos foram mantidos para preservar os registros anteriores.

A coleta não interrompe mais o voo nem acumula perguntas. O intervalo mínimo é 30 segundos de tempo ativo, contado novamente ao continuar cada descoberta. Ao vencer o intervalo, o gerador aguarda os encontros existentes saírem; o quiz exige ausência de madeira ou gaviões perigosos à frente, altura entre 120 e 520 e velocidade vertical de até 160 unidades/s em módulo. Depois da retomada, novos encontros aguardam pelo menos 1,5 s antes de nascer. Se uma descoberta já está vencida ao alcançar o trecho final, ela é resolvida antes de mostrar o abrigo; no Desafio, errá-la continua sendo derrota.

Temas errados ficam registrados localmente por nome e são priorizados entre as perguntas ainda não usadas. Acertar retira o tema da revisão. Não há repetição antes de esgotar o banco durante o mesmo voo; ampliação e formulações alternativas pertencem à etapa de conteúdo científico. Falha no armazenamento mantém o registro apenas em memória.

Validação: 67 testes aprovados e build concluído, incluindo as duas consequências do erro, agendamento seguro, ausência de fila de perguntas, multiplicador, revisão por jogador e percurso completo. A execução interativa no navegador permanece pendente.


### Etapa 5 — encontros e trajetórias

`js/encounters.mjs` reúne sete padrões: central, passagem ampla, subida, descida, curva de coleta, galho antecipado e coleta opcional próxima da borda. Cada padrão define desbloqueio, variação de altura, abertura, intervalo e posições dos frutos. Curvas e desvios opcionais recebem trilhas discretas; seguir pelo centro continua sendo uma alternativa sem exigir poder. São escolhas de trajetória dentro da passagem, não bifurcações com corredores fisicamente separados.

A seleção evita repetir o padrão imediatamente anterior. O deslocamento entre centros é limitado pelo tempo estimado para sair da madeira e corrigir o voo, com teto de 55 unidades. Frutos ficam pelo menos 48 unidades afastados das bordas superior e inferior da abertura. Clareiras e a drenagem de encontros para quiz continuam funcionando. Gaviões permanecem isolados da madeira nesta etapa: combinações simultâneas voltam a ser avaliadas na etapa de comportamentos dos animais.

A simulação tem uma semente por partida (`game.seed`) e histórico limitado aos últimos 12 encontros. `game.start(modo, temasDeRevisao, semente)` reproduz a geração; perguntas usam um fluxo aleatório separado, para que responder não mude o próximo obstáculo. Reproduzir a partida inteira também exige as mesmas entradas do jogador.

Validação: 71 testes aprovados, incluindo 80 rotas de três minutos nos dois modos sem frutas, poderes ou pausas de quiz, controladas por um piloto de teste; verificações de geometria em 11.200 planos; reprodução por semente e percurso completo até a vitória. Isso demonstra viabilidade para essas amostras, não garante conforto humano nem cobre todas as sementes. Curvas de coleta podem antecipar os 200 pontos; as subidas e descidas mantêm uma fruta para evitar excesso de recompensa. O equilíbrio fino de poderes e a duração da jornada serão tratados nas etapas 7 e 8. Teste interativo no navegador continua pendente.

### Etapa 6 — encontros com animais

`js/animals.mjs` centraliza as fases dos encontros. Gaviões aguardam o aviso sem deslocamento, atravessam pela reta anunciada e tornam-se inofensivos depois de ultrapassar a ave. O mergulho mantém os pontos inicial e final definidos no nascimento; não há perseguição nem mudança de alvo. O aviso mostra tipo de encontro e segundos restantes. Ao tocar o escudo, o gavião se afasta para a direita, com orientação visual correspondente, e sai da simulação em até dois segundos.

Cobras passam por observação, aviso de ocupação, proximidade, saída e afastamento. O aviso distingue galho e tronco, em fonte independente da escala do mundo. Elas não estendem a colisão nem atacam de surpresa: o perigo é o contato com a posição ocupada. O escudo mantém o afastamento sem pontos por atingir fauna. Gaviões continuam isolados da madeira para preservar uma rota livre.

Três borboletas pequenas e discretas compõem a camada distante. São decorativas, sem brilho de coleta, colisão ou sorteio que altere os encontros; ficam estáticas com movimento reduzido. As instruções distinguem essa fauna dos encontros interativos.

Validação: 75 testes aprovados e build concluído. Inclui correspondência entre aviso e trajetória, ausência de reposicionamento do alvo, saída/afastamento, colisões fixas das cobras, congelamento na pausa e as 80 simulações de três minutos da etapa anterior. A avaliação visual e de conforto no navegador permanece pendente.


### Etapa 7 — poderes e recompensa por trajetória

`js/powers.mjs` define a distribuição: intervalo mínimo de 9 s entre ofertas, nova oferta de escudo após 18–26 s e de pena após 20–26 s. São tempos mínimos desde a oferta anterior; oportunidades disponíveis podem ampliar o intervalo. Há no máximo um poder ainda não coletado no cenário. Um escudo equipado impede gerar outro; uma duplicata excepcional mantém a proteção e informa que não acumula cargas. A pena é oferecida antes de uma trilha com várias frutas, 125 unidades antes da primeira coleta e na mesma altura, quando restam no máximo dois segundos de uma pena anterior. Renovar redefine para dez segundos, sem somar duração ou multiplicadores.

Completar todas as frutas de uma trilha sem contato concede +2 pontos (ou +4 com a pena ativa na conclusão). A regra não exige velocidade nem aproximação perigosa de animais. Perder uma fruta não retira pontos já ganhos; contato com a madeira daquela trilha ou com um limite impede seu bônus, mesmo se protegido. Cada objeto só pode ser coletado uma vez e o bônus também é único. O resultado traz uma seção recolhida com os pontos de passagens, frutas, respostas e trilhas, já incluindo multiplicadores.

O balanceamento inaugura `floresta-v3` para não comparar esses recordes com pontuações anteriores. Os registros anteriores são apenas lidos na aba Histórico, sem migração destrutiva. Geração de poderes usa um fluxo aleatório separado dos obstáculos e perguntas. Contadores de trilhas são descartados ao saírem de cena.

Validação: 82 testes aprovados e build concluído, incluindo espaçamento das ofertas, posição da pena, duplicatas, bônus, colisões que invalidam a trilha, congelamento na pausa, contabilidade e preservação dos recordes. A avaliação de frequência percebida e apresentação no navegador permanece pendente.


### Etapa 8 — jornada até o abrigo

`js/journey.mjs` define 28.000 unidades de percurso, divididas em quatro trechos: Área de alimentação, Árvores antigas, Mata fragmentada e Refúgio do bando. A distância, e não a pontuação, controla a barra e as transições. Cada trecho favorece padrões diferentes de encontros e temas do banco de perguntas, preservando a prioridade de revisão dos erros. Árvores antigas favorecem cavidades; o trecho fragmentado amplia os intervalos e reduz gradualmente a densidade visual do fundo; o refúgio favorece passagens amplas e retoma o verde. A abertura continua limitada pelas regras de geração existentes.

Ao completar a distância, novos perigos deixam de nascer. Os perigos existentes precisam passar e perguntas já vencidas precisam ser resolvidas antes de o abrigo aparecer. O bando aguarda em um galho ligado a um tronco que alcança o chão. O jogador alinha a altura dentro de uma margem de 60 unidades; então uma aproximação suave de 1,6 s finaliza o pouso e dispara a vitória uma única vez. Essa aproximação pode ser pausada e retomada com contagem; movimento reduzido a conclui no próximo passo. Os poderes ficam congelados durante o pouso.

200 pontos passam a conceder uma medalha, sem encerrar o voo. Sem pausas, o deslocamento básico até 28.000 unidades leva aproximadamente 105 s no Desafio e 121 s no Amigável, acrescido de limpeza dos encontros e aproximação final. Perguntas e pausas não avançam o percurso. O resultado mostra o trecho/percentual alcançado ou a conclusão, além da pontuação. A nova regra grava `floresta-v4`, mantendo os rankings anteriores disponíveis no Histórico.

Validação: 88 testes aprovados, build concluído, 80 jornadas completas simuladas nos dois modos sem poderes nem pausas de quiz, cobertura de medalha, etapas, chegada, pausa, regra de erro por modo e reinício. Uma captura real do renderizador Canvas do abrigo foi inspecionada. Menus e a experiência jogada no navegador continuam pendentes de validação.
