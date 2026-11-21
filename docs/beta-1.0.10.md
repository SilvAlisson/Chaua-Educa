# Beta 1.0.10 — roteiro e decisão

**Estado: preparada para coleta; sessões com pessoas e aparelhos físicos ainda pendentes.**

A aprovação dos testes automatizados verifica a ferramenta e as regressões. Não é evidência de diversão, aprendizagem, conforto ou 60 FPS em aparelhos reais. A 1.0.10 só termina após coletar, revisar e classificar os resultados da matriz abaixo. Não avançar automaticamente para a candidata 1.0.11.

## Como participar

1. Sincronize `preparacao-para-a-versao-2.0` no fork, aguarde o Pages e confira **1.0.10 · interface 1.0.10-beta1** em Sobre o projeto. A main permanece preservada.
2. Abra **Sobre o projeto → Participar da beta**. O mesmo painel está nos Ajustes, acessíveis pela pausa durante o voo. Um link terminado em `?beta=1` abre o painel, mas não inicia a coleta sozinho. Use apenas `?beta=1`, sem o diagnóstico `perf-test` ou comparações de bancada.
3. Informe perfil, família do aparelho, modelo/sistema, navegador/versão e se é aparelho físico ou emulação. Não informe nome, contato, idade ou dados de outras pessoas. Um participante por sessão. O ambiente é declarado pelo participante, não detectado.
4. Toque em **Iniciar sessão e voltar**. O painel se fecha. No início, escolha o nome de jogo normalmente. Se a coleta começou pela pausa, continue o voo quando estiver pronto; a tentativa será identificada como parcial.
5. Siga o roteiro. Volte pelos Ajustes ou por Sobre o projeto e registre o que testou, as três notas e o principal problema. Campos em branco e itens não marcados significam não avaliados, não aprovação nem falha.
6. Toque em **Encerrar e baixar relatório**. Confira o arquivo JSON no aparelho. O navegador recebe uma solicitação de download; a ferramenta não consegue garantir onde ele foi salvo. Se houver falha, os dados continuam na aba para tentar novamente. Compartilhe o arquivo e as capturas manualmente quando quiser.
7. Antes de recarregar ou fechar a aba, baixe a coleta: ela não é salva no armazenamento nem enviada a um servidor. Para testar recarga, baixe primeiro, confira o progresso após recarregar e abra uma nova sessão. Relacione os arquivos no registro da beta. Iniciar outra sessão substitui a coleta da aba e limpa as respostas anteriores.

## Matriz inicial planejada

Estas são **vagas de teste**, não sessões realizadas. Seis sessões são um mínimo operacional de cobertura, sem pretensão de representatividade estatística. Se não houver algum aparelho ou grupo, registrar a lacuna; não substituir por emulação e chamá-la de validação física.

| Vaga | Aparelho físico | Perfil | Situação |
|---|---|---|---|
| B01 | Android de entrada ou mais antigo disponível | Iniciante | Pendente |
| B02 | Outro Android | Jogador habitual | Pendente |
| B03 | iPhone | Iniciante | Pendente |
| B04 | iPhone | Educador | Pendente |
| B05 | Notebook | Jogador habitual | Pendente |
| B06 | Notebook | Educador | Pendente |

O mesmo aparelho pode ser usado por participantes diferentes, com sessões separadas. Registre modelo, sistema, navegador, orientação, qualidade, modo, revisão, energia/carregamento e outras condições que ajudem a repetir o ensaio. Compare correções no mesmo aparelho e com condições semelhantes. Não interprete uma sessão curta ou um teste no emulador como evidência suficiente de desempenho.

## Roteiro da sessão (cerca de 15–25 minutos, ajustável)

O observador registra dificuldades antes de orientar. Não conduza as respostas de compreensão. Interrompa ou encurte a sessão se houver desconforto.

| Passo | Ação do participante | O que observar e registrar |
|---|---|---|
| Entrada | Abrir, informar nome e escolher ritmo; testar teclado no celular | Entende o que fazer? Controles acessíveis sem rolagem da página? Tempo de espera e eventuais falhas de carregamento |
| Treino | Experimentar o treino seguro | Entende tocar/segurar/soltar? Reconhece os ataques e saídas? Precisa de ajuda? |
| Voo | Jogar Amigável; experimentar Desafio quando confortável | Variedade, escolhas, dificuldade, motivo das perdas, recuperação após erros e vontade de repetir |
| Descoberta | Responder uma pergunta e explorar a foto opcional em pausa segura | Distingue a ave real da ficção? Entende o conteúdo sem adivinhação pela interface? |
| Interrupções | Pausar, abrir Ajustes, silenciar, sair/voltar ao aplicativo, girar a tela e sair/entrar em tela cheia | Nada avança escondido? Comandos antigos foram limpos? Retomada e avisos compreensíveis? Testar teclado no notebook |
| Jornada longa | Um jogador confortável percorre os quatro trechos, com qualidade automática e depois econômica se houver problema | Travadas, leitura dos avisos e efeitos sazonais; perfis/tamanhos e trechos nos relatórios. Não forçar iniciantes a repetir até vencer |
| Progresso | Baixar coleta; recarregar; conferir coleção, missões, ajustes e retomada disponível | Informar exatamente o que estava salvo e o que retornou. Abrir nova coleta após recarga |
| Retorno | Dar notas, descrever um problema reproduzível e contar o que aprendeu | Diversão, clareza, conforto, compreensão e proposta de melhoria, sem exigir nota positiva |

Perguntas abertas sugeridas: “O que você faria para recuperar altura?”, “Como percebeu que havia um ataque?”, “O que mudou entre os ritmos?”, “Qual descoberta ficou deste voo?”, “O que na foto e no jogo é diferente?”. O educador confere correção da explicação, linguagem e interpretação; responder uma pergunta do jogo corretamente, sozinho, não comprova aprendizagem.

## Como interpretar o relatório

- Intervalos reais do `requestAnimationFrame`, entre quadros consecutivos de voo visível e com foco. Sem novo laço de animação, leitura de pixels ou observadores profundos. Menus, contagem, treino, perguntas e pausas ficam fora da amostra; o primeiro intervalo após uma interrupção é descartado. Intervalos longos durante o voo não são limitados ao passo da física.
- Média de FPS, 1% baixo, percentis p50/p95/p99, máximo e contagem acima de 22/33,33/50/100 ms, agregados por modo, trecho e perfil gráfico. Não são medidas de GPU ou RAM residente nem identificação da taxa física da tela. A classificação físico/emulado é autodeclarada.
- Primeiros 120.000 intervalos elegíveis, no máximo 30 tentativas/perfis e 120 transições. O relatório informa limites atingidos, intervalos não guardados e instrumentação adicional observada. Não combinar trechos de perfis diferentes como se fossem um único ensaio fixo.
- `navigation` indica tempos de DOM e evento de carga quando disponíveis, contados desde a navegação. Não mede prontidão das artes nem a duração da sessão. A sessão pode começar depois da carga.
- Sem nome do jogador, pontuações históricas, perguntas respondidas em texto, user agent completo, URL, contatos ou envio automático. O aparelho/navegador informados, semente/modo/resultado das tentativas, eventos contados e feedback manual entram no arquivo. Textos livres devem ser revisados antes de compartilhar.
- A medição termina ao solicitar o download; baixar outra cópia pode acrescentar feedback, sem alterar os quadros já medidos. Nova sessão limpa feedback e dados anteriores. Uma coleta sem quadros continua exportável para relatar uma falha de entrada.

A meta continua sendo 60 FPS estáveis. Para triagem, destaque p95 acima de 20 ms, quadros acima de 33,33 ms recorrentes (especialmente mais de 1%) e qualquer congelamento percebido. São sinais para investigar, não um selo automático: considere duração, aparelho, perfil, trechos, percepção do jogador e instrumentação. Repita um caso problemático; um pico isolado não revela sua causa. A aprovação final exige revisão humana dos voos representativos e da qualidade visual no aparelho.

## Registro e gravidade

Use `beta-registro.csv`, relacionando o `sessionId`, revisão, arquivo, captura e passos de reprodução. Um problema por linha; vários problemas podem usar a mesma sessão. Separe fatos observados, interpretação e hipótese de causa. Não marque como corrigido sem repetir o caso afetado na revisão nova.

| Gravidade | Definição para triagem | Encaminhamento |
|---|---|---|
| Bloqueante | Não abre/inicia/retoma o jogo, ou perda reproduzível de progresso obrigatório | Impede a candidata; reproduzir e corrigir primeiro |
| Grave | Controle/fluxo essencial inacessível, erro educativo relevante ou travamento recorrente que inviabiliza a experiência | Corrigir antes da candidata e repetir no aparelho |
| Moderado | Atrapalha diversão, compreensão ou conforto, com alternativa viável | Priorizar por frequência/impacto; documentar decisão |
| Leve | Detalhe visual, texto ou incômodo pequeno sem bloquear uso | Polir conforme prioridade e registrar decisão |
| Não classificado | Relato insuficiente para avaliar impacto | Pedir contexto; não considerar aprovado ou resolvido |

Categorias: diversão, compreensão, educação, controles/acessibilidade, desempenho, visual, áudio, progresso e outros. A classificação dada pelo participante é uma proposta; a triagem pode corrigi-la com justificativa.

## Critério para encerrar a 1.0.10

- Matriz física e perfis de participantes cobertos, com relatórios e observações reais identificados pela revisão. Lacunas e limitações explícitas, sem certificação por simulação.
- Problemas de diversão, compreensão, conforto e desempenho registrados e classificados; passos de reprodução e arquivos relacionados quando disponíveis.
- Conteúdo educativo e compreensão revistos com educadores e jogadores; notas, respostas abertas e ajuda necessária consideradas juntos.
- Medições representativas de Android, iPhone e notebook revisadas, incluindo trechos/climas e perfil econômico quando necessário.
- Pendências priorizadas para a 1.0.11, responsáveis/decisões registrados e critérios de repetição definidos. A beta pode revelar problemas; não é preciso fingir que todos já estão corrigidos para concluir sua identificação.

A candidata 1.0.11 tem outro critério: corrigir os problemas selecionados, congelar funcionalidades, repetir a regressão e não ter bloqueantes ou graves conhecidos. Main/publicação definitiva dependem de instrução específica, como nas etapas anteriores.
