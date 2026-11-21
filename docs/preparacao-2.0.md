# Preparação para a Versão 2.0

Branch de trabalho: `preparacao-para-a-versao-2.0`.

Os incrementos desta preparação começam em **1.0.1**, seguindo 1.0.2, 1.0.3 e seguintes. A identificação **2.0.0** fica reservada ao lançamento aprovado. O histórico técnico anterior é preservado no Git. Para atualizar pacote, lockfile e identificação visível conjuntamente, usar `node scripts/set-game-version.mjs NUMERO`.

## 1.0.7 — educação contextual e observação segura

- Revisados os 24 itens e suas fontes, mantendo IDs, respostas e registros existentes. Atualizados o endereço do Zoológico de Brasília, atribuições de bioma/fragmentação e a identificação do PAN Papagaios como ciclo finalizado. Perguntas sobre a pesquisa e a diversidade receberam formulações mais diretamente sustentadas pelas fontes. A revisão por item e os links consultados estão em [revisao-conteudo-1.0.7.md](revisao-conteudo-1.0.7.md).
- Cada pergunta tem capítulos preferidos explícitos. Erros anteriores continuam prioritários e as perguntas não se repetem até esgotar o banco. A primeira pausa educativa de cada capítulo oferece uma descoberta contextual expansível, com fonte e vínculo à Chauapédia; não cria uma pausa adicional durante o voo.
- Observação opcional de uma fotografia real já creditada na Chauapédia. Marcadores de toque e botões equivalentes de teclado exploram testa/face, plumagem e foto versus desenho. A imagem identifica uma ave em cativeiro e mantém créditos/licença, sem substituir sprites ou sugerir um registro local de fauna.
- A atividade abre somente na pausa de pergunta, após a mesma verificação de rota livre, altura e velocidade. Voo, clima, poderes e avisos permanecem congelados. Não altera pontos ou penalidades, nem permite responder escondido à pergunta. Voltar/Escape restaura a pergunta, seu bônus e o foco do botão de origem. Não é possível abrir depois de responder para evitar a consequência do Desafio.
- A foto só recebe endereço de carregamento ao abrir a atividade; não amplia a lista de recursos obrigatórios do voo. Uma falha da imagem mantém as descrições e a saída utilizáveis. Novos voos/retomadas limpam o estado transitório; as descobertas registradas continuam preservadas.
- Pontuação e regras v14 permanecem, assim como missões, retomada, artes e máscaras. A observação contribui para o resumo educativo do voo sem gerar pontuação ou conquistas por colisão com animais.

Verificação local: **347 testes de lógica aprovados**, build Sass reproduzível e nove spritesheets íntegras. As novas regressões cobrem contexto dos quatro capítulos, segurança, tempos congelados, bônus preservado, repetição/erros, identificação de fontes e reset. O teste `browser-learning-107.cjs` exercita toque equivalente, teclado, Escape, foco, retorno à mesma pergunta, erro de imagem, fontes e revisão em desktop/retrato/paisagem nos três navegadores. Capturas em `extended-browser-qa/learning-107`.

**Compreensão com jogadores e educadores continua pendente**, assim como a validação nos aparelhos físicos da matriz. Essa parte do critério não é concluída por testes automatizados; o roteiro da beta inclui perguntas de verificação descritas na revisão de conteúdo.

## 1.0.6 — variedade, trilhas opcionais e retomada no Amigável

- O planejador reduz ciclos curtos de padrões quando há vocabulário suficiente disponível; pesos por capítulo e limites de deslocamento/tempo continuam ativos. Clareiras, isolamento dos gaviões e passagem ampla após eles permanecem. Os três primeiros ataques de cada animal mantêm a ordem de apresentação; depois, grupos completos de três têm ordem variável por semente, sem repetir imediatamente na fronteira entre grupos. Perguntas e efeitos não alteram essa escolha.
- Nova trilha opcional curva, superior ou inferior, com três alimentos e uma passagem mais ampla. A trilha dourada dá **4 pontos de bônus** se completada sem contato; trilhas comuns continuam em 2. Os alimentos, multiplicadores e cancelamento do bônus após contato mantêm seus contratos. Há uma orientação curta na primeira oferta, a marcação dourada existente e explicação no guia; o jogador pode continuar pelo centro sem seguir os alimentos.
- Orientação após contato com cobra diferencia frontal, bote alto e varredura. O guia descreve a antecipação de subida no alto e a faixa baixa na varredura. Tempos, trajetórias travadas, sprites e máscaras dos ataques continuam os atuais.
- Amigável salva o início do último capítulo alcançado (trechos 2–4), por nome, neste navegador. A retomada aparece no menu ao selecionar o mesmo nome/modo e no resultado após derrota. Recarregar a página conserva o ponto; armazenamento indisponível usa apenas memória da sessão. Dados incompletos/versões incompatíveis são ignorados. O Desafio e o treino não oferecem essa retomada.
- Retomar inicia contagem, centraliza o jogador, limpa ameaças, comandos, efeitos e poderes anteriores e garante a primeira passagem ampla, sem cobra/gavião, inclusive quando a sequência estava numa clareira ou investida. O próximo quiz só fica elegível após mais 30 segundos ativos. O percurso/relógio sazonal começa no capítulo salvo; superfícies molhadas/nevadas se formam novamente nesta tentativa.
- Os pontos da retomada começam em zero e ficam fora do ranking de voos desde o início. A interface explica essa diferença. Coleção, perguntas e missões cumulativas continuam válidas; capítulos anteriores não são reemitidos como conquistas da nova tentativa. Um voo novo pelo botão normal começa do início; o ponto anterior permanece disponível até atingir outro capítulo ou concluir a jornada. Chegar ao bando remove o ponto daquele nome.
- Regras **floresta-v14** separam os novos percursos/bônus dos recordes v13, mantidos no Histórico. Descobertas, missões, fontes, spritesheets e máscaras aprovadas são preservados.

Verificação local: **340 testes de lógica aprovados**, build Sass reproduzível e nove spritesheets atuais íntegras. Permanecem 80 percursos completos sem poderes e 24 com reação de 120 ms/decisões a 30 Hz; mais nove percursos partem dos capítulos salvos. Há regressões de variedade determinística, bônus único, dados corrompidos, isolamento por nome, recarga, falha de armazenamento e saída segura. O novo `browser-gameplay-106.cjs` verifica o fluxo real de menu/resultado, ranking preservado e remoção do ponto após vitória em quatro viewports, nos três navegadores; capturas em `extended-browser-qa/gameplay-106`.

A avaliação de diversão, compreensão das rotas e conforto da retomada com jogadores continua pendente. Pilotos e navegadores automatizados não certificam essa experiência em aparelhos físicos.

## 1.0.5 — avisos legíveis e continuidade do clima

- Avisos consideram regiões protegidas do chauá, do gavião visível e da célula inteira da cobra na pose atual (incluindo corpo e boca). A posição pode mudar horizontalmente e verticalmente para evitar esses atores e outros avisos, respeitando câmera e viewport. Se uma tela excepcionalmente pequena não comportar todos os elementos, o resolvedor minimiza a área coberta; não promete encaixe impossível. O cartão tem fundo opaco para manter o contraste em fundos claros, chuva e neve.
- Chuva, neve e rajadas compartilham deslocamentos de vento integrados no tempo ativo da cena. A mudança de vento, tempestade ou velocidade não reaplica a velocidade nova a todo o tempo anterior do voo. Pausa conserva os deslocamentos; reinício, treino/voo e busca temporal descontínua reinicializam o estado. O estado é pequeno e pertence a cada renderizador, sem partículas ou superfícies adicionais.
- As cabeças das gotas agora terminam no mesmo ponto da curva inclinada; antes, eram desenhadas ao lado da ponta.
- Spritesheets, anatomia, máscaras de colisão, física, pontuação, dificuldade e persistência mantêm as referências aprovadas. Não há importação do experimento da branch `Fracasso`. A neve progressiva e a proteção do tronco superior continuam nas verificações existentes.

Verificação local: 329 testes de lógica aprovados, build Sass reproduzível e nove spritesheets oficiais íntegras. Verificações novas: 135 combinações de viewport/câmera/ataque/fase para avisos; integração climática a 30/144 Hz, pausa, reinício, busca temporal e encaixe das gotas. O teste `browser-visual-polish.cjs` exercita o renderizador real em 1366×768, 844×390 e 390×844; verão, chuva e inverno; perfis detalhado/econômico e movimento reduzido. Confere os cartões efetivamente desenhados, regiões protegidas, pixels idênticos com o relógio parado e ausência de deslocamento climático ao mudar a velocidade em pausa. Gera 27 cenas por navegador e relatórios em `extended-browser-qa/visual-polish`. Os testes de ataques, estações, superfícies, sprites e colisões continuam ativos.

O resultado automatizado não substitui a avaliação estética e de conforto em aparelhos físicos. A entrega é revisável na branch; a aprovação visual do jogador e a matriz física continuam pendentes até a 2.0.0.

## 1.0.4 — fontes e ciclo de vida dos caches

- Baloo 2 e Nunito convertidas integralmente para WOFF2: 960.132 → 280.912 bytes (redução de 70,7%). Mantidos os 1.601/1.103 glifos, os 856/938 pontos de código, métricas, contornos e tabelas de variação/posicionamento conferidos com FontTools. Sem recorte de caracteres. Licenças OFL mantidas; os TTF substituídos foram removidos da pasta publicada.
- O menu não aloca mais antecipadamente uma superfície de estação que só será usada no voo. A primeira estação continua preparada durante a contagem, e a preparação gradual das próximas estações permanece.
- A troca entre floresta de menu/treino e fundo sazonal libera explicitamente as superfícies incompatíveis. O mesmo tipo de fundo conserva seus caches durante o uso, sem recriação a cada quadro.
- Redimensionamento libera imediatamente as superfícies sazonais prontas e parciais. Uma chamada de resize sem mudança efetiva preserva o cache. Superfícies descartadas têm largura e altura zeradas.
- Imagens, spritesheets, efeitos, física e placares preservados; os recursos obrigatórios continuam carregados antes de liberar o voo. Não foi adicionado carregamento tardio de ataques.

Verificação local: 322 testes de lógica aprovados e build Sass reproduzível. O CI executa um comparativo contra a revisão 1.0.3 `f32ee40`, no mesmo runner e navegador, alternando a ordem das amostras. São três carregamentos frios e três recargas por revisão em cada viewport (1366 × 768 e 390 × 844), com rede emulada de 20 Mbps/50 ms. A prontidão observada inclui artes obrigatórias e fontes carregadas.

O comparativo também acompanha três ciclos de floresta/voo, redimensionamento e hashes dos pixels desenhados. A estimativa de caches é largura × altura × quatro bytes: não mede a RAM real do aparelho nem residência de texturas na GPU. O relatório fica no artefato `auto-visual-captures`, pasta `startup-memory/report.json`, e os resultados consolidados no PR de preparação. Taxas de quadros e efeitos continuam cobertos pelas verificações existentes; não há certificação nova de 60 FPS em hardware físico nesta etapa.

## 1.0.3 — treino seguro e descobertas de cada voo

- O treino opcional passa a ter seis etapas: toque, sustentação, soltura, abertura entre troncos, três investidas do gavião e três botes da cobra. As práticas usam a física, os avisos e as funções de colisão atuais. Contatos reiniciam somente a tentativa, com orientação; não há Game Over, pontuação, perguntas, desbloqueios ou avanço de missões no treino.
- Pausar congela a prática, os avisos e a espera para tentar novamente. Iniciar uma partida normal remove o estado do treino. Os registros anteriores de treino concluído continuam válidos; repetir permanece opcional.
- A tela de resultado oferece um resumo recolhido dos temas, alimentos diferentes, perguntas respondidas e trechos daquele voo. Respostas erradas também contam como contato com o conteúdo. O resumo é reiniciado na próxima partida e não grava dados a cada frame.
- As fichas vistas no voo podem ser abertas diretamente na Chauapédia a partir do resultado, mantendo as fontes existentes. Fechar a leitura devolve o resultado e o foco ao botão de origem. Nada é aberto automaticamente durante o voo.
- Duas missões opcionais adicionais: registrar os 12 alimentos atuais e responder a 12 perguntas diferentes. Os seis selos anteriores mantêm IDs e critérios; o título já obtido permanece. O novo título final é “Guardião de descobertas”. Milho e Coquinho históricos não substituem alimentos do catálogo atual para o novo selo.
- As artes e as colisões da 1.0.2 são preservadas. As regras de pontuação continuam `floresta-v13`; não há nova migração de ranking nesta etapa.

Verificação local: 318 testes aprovados, incluindo práticas reais dos seis ataques sem pontuação, nova tentativa após contato, pausa, preservação dos selos e resumo sem duplicações. A regressão dos 80 percursos e dos 24 voos com reação simulada continua ativa. O CI exercita a leitura a partir do resultado, retorno de foco, limpeza do resumo no reinício e apresentação em desktop e retrato nos três navegadores. Esses testes não substituem sessões com jogadores e aparelhos físicos.

## 1.0.2 — botes e geometria atual de contato

- Recuperação frontal com 11 poses intactas; bote alto e varredura com sete. O recolhimento percorre os quadros de preparação em ordem inversa e termina na mesma pose de repouso, substituindo o salto de apenas dois quadros. Nenhuma cabeça, asa ou corpo adicional é sobreposto; as artes aprovadas permanecem intactas.
- Aviso do bote termina numa postura compatível com o começo de cada ataque. Tempos de preparação, ataque e recuperação permanecem próprios de cada um dos três botes.
- Cabeça do chauá reposicionada sobre a cabeça da spritesheet atual; o antigo núcleo estava no pescoço. O núcleo do corpo e os perfis de voo/mergulho do gavião foram conferidos contra a transparência das artes atuais.
- Colisão e desenho compartilham inclinação, deslocamento das batidas de asas e oscilação. O voo com movimento reduzido usa uma pose estática da mesma spritesheet do chauá.
- Coleta por máscaras offline dos 48 quadros de alimentos e das penas de proteção/pontuação, acompanhando flutuação e pulsação. A pimenta desenhada por código tem um núcleo próprio que acompanha sua rotação. A antiga caixa genérica de coleta e o getter retangular do jogador foram removidos.
- Copa e chão consideram a extensão do corpo atual. Troncos mantêm o núcleo compartilhado de 110 unidades; galhos vivos, galhos secos e lados quebrados conservam seus estados físicos. Neve, folhas, brilho, asas, cauda e efeitos climáticos decorativos não ampliam a colisão dos pássaros/troncos.
- Reserva de transição do Desafio passa de 230 para 260 unidades para acomodar a cabeça real, mais adiantada. A progressão, os limites de velocidade e os três tipos de ataque permanecem; a segurança é exercitada por percursos completos, incluindo decisões a 30 Hz e reação de 120 ms.
- Regras `floresta-v13` arquivam os placares v12; missões e descobertas continuam preservadas.

### Proteção contra hitboxes desatualizadas

| Elemento | Referência verificada |
|---|---|
| Chauá | Oito poses de voo e pose estática de movimento reduzido; corpo/cabeça internos à arte |
| Gavião | Oito poses da ação e três poses ativas da arte de mergulho/voo reduzido; transformações compartilhadas |
| Cobra | Cinco atlas, 40 máscaras por quadro, escala e espelhamento do mesmo resolvedor usado no desenho |
| Troncos/galhos | Núcleo geométrico compartilhado com a renderização; integridade dos atlas base |
| Alimentos | 12 alimentos × quatro quadros; 16 × 16 células por quadro |
| Penas/pimenta | Máscaras das duas artes atuais e núcleo próprio do desenho vetorial |
| Chão/copa | Limites aplicados aos polígonos atuais do chauá |

`scripts/generate-collision-art.py --check` verifica assinaturas, núcleos dos pássaros e máscaras de coleta; `scripts/generate-snake-a2-masks.py --check` verifica as máscaras da cobra. O teste de navegador compara os núcleos com pixels efetivamente desenhados em 48 poses/configurações e as 12.800 células dos coletáveis com a transparência dos arquivos servidos. O teste existente da cobra continua comparando as 40.960 células de seus cinco atlas.

As máscaras são discretas: os alimentos têm células de aproximadamente quatro unidades de jogo e a cobra conserva as células conservadoras atuais (até aproximadamente 7,3 unidades no atlas de maior escala). Não se trata de colisão por pixel a cada frame. Não há leitura de pixels durante o voo. A avaliação com pessoas e em aparelhos físicos permanece pendente para o lançamento 2.0.

## 1.0.1 — campanha e identificação da preparação

- Rotas de 140.000 unidades no Desafio e 84.000 no Amigável, proporcionais às velocidades dos modos, com alvo de cerca de seis minutos de voo ativo.
- A curva de pressão do Desafio atinge sua fase final dentro da nova duração de campanha, mantendo seus limites seguros.
- Os quatro capítulos avançam pelo percurso. A barra mostra caminho percorrido, independentemente dos pontos.
- Concluir o percurso libera o abrigo, após limpar ameaças e responder eventual pergunta pendente. O pouso continua exigindo alinhamento com o bando.
- Os 1.000 pontos passam a valer uma medalha opcional; não antecipam nem bloqueiam a chegada.
- Depois de uma investida do gavião, há uma passagem central ampla antes de voltar aos encontros estreitos, permitindo recuperar a trajetória.
- As estações continuam graduais e baseadas no tempo de voo, com referência planejada de seis minutos. Pausas e perguntas congelam esse relógio; a cobertura de neve continua progressiva.
- Movimento reduzido suprime também o clarão em tela inteira durante tempestades.
- A tela Sobre o projeto identifica a versão da preparação.
- O planejamento de transições reserva 230 unidades de afastamento no Desafio; os percursos completos incluem verificações sem poderes e com reação programada de 120 ms.
- Regras de ranking `floresta-v12`. Registros v11 e anteriores permanecem no Histórico; missões e descobertas mantêm suas identidades.

A meta de duração vem do modelo físico e de pilotos automatizados. A avaliação com pessoas e a medição de desempenho em aparelhos físicos ainda fazem parte da preparação; esta versão não certifica a 2.0 pública.

## Verificação da 1.0.1

307 testes de lógica aprovados localmente, incluindo 80 percursos completos sem poderes e 24 trajetos com reação programada de 120 ms. As oito sementes de calibração completaram a nova campanha em aproximadamente 339–355 segundos de voo ativo, com pontuações abaixo de 1.000, comprovando que a medalha não bloqueia o pouso. Esses são pilotos automatizados, não taxas de vitória ou durações medidas com pessoas. Build Sass e integridade dos atlas também são verificados. Os resultados de navegador estão no CI do PR de preparação.

## Roteiro até a 2.0.0

Cada incremento tem entrega verificável e remove seus consumidores/arquivos descartados na mesma alteração. Fontes necessárias à reprodução da arte ativa permanecem; backups de artes substituídas não entram na pasta publicada. A numeração pode avançar por 1.0.12 e seguintes; a aprovação dos resultados determina o lançamento.

| Versão | Entrega | Critério |
|---|---|---|
| 1.0.1–1.0.3 | Campanha, colisões, recuperação dos botes, treino seguro e descobertas por voo | Entregas registradas acima; validação física pendente |
| 1.0.4 | Carregamento, fontes e ciclo de vida dos caches | A/B reproduzível, melhoria comprovada e qualidade preservada |
| 1.0.5 | Polimento visual, animações e clima | Revisão das artes intactas, avisos e transições; efeitos legíveis em econômico/celular; avaliação física pendente |
| 1.0.6 | Variedade, rotas opcionais, respostas aos ataques e retomada por capítulo no Amigável | Encontros com saída viável, progressão e recuperação compreensíveis |
| 1.0.7 | Perguntas/fontes, descobertas por capítulo e observação em local seguro | Conteúdo correto e compreensão observada em jogadores |
| 1.0.8 | Toque, teclado, acessibilidade, áudio, orientação, pausa e retorno ao aplicativo | Fluxos completos, controles acessíveis e ausência de rolagem durante o voo |
| 1.0.9 | Código/arquivos ativos, persistência, créditos, links, falhas e publicação | Recursos obrigatórios presentes e progresso preservado nos cenários testados |
| 1.0.10 | Beta com iniciantes, jogadores habituais e educadores em Android, iPhone e notebook | Problemas identificados e classificados, com medições reais |
| 1.0.11 | Candidata ao lançamento, funcionalidades congeladas e regressão completa | Nenhuma falha bloqueante ou grave conhecida; requisitos/limitações documentados |
| 1.0.12 e seguintes | Correções encontradas na candidata | Repetir as verificações afetadas na revisão corrigida |
| 2.0.0 | Publicação final, notas, créditos e canal de relatos | Versão correta servida no endereço definitivo e progresso esperado preservado |

O lançamento público é **2.0.0**, sem uma etapa 1.1.0 substituindo esse objetivo. Testes automatizados não concluem os critérios que exigem jogadores e aparelhos físicos. Não será declarado lançamento apenas por esgotar os números do roteiro.

## Integração

A branch parte do commit `79190a4` do PR #77, conservando os três botes e as três investidas do predador. A main e o endereço público não são atualizados automaticamente durante os incrementos de preparação. O PR de preparação funciona como integração revisável até o lançamento.


## 1.0.8 — celular, teclado, pausa e áudio

- Ajustes oferecem lado esquerdo/direito do botão de voo, sons do jogo e avisos sonoros de ataques, preservados neste navegador; sem armazenamento, valem para a sessão. O botão de som também fica acessível dentro da pausa por Ajustes.
- Espaço mantém o botão nativo de pausa utilizável por teclado. O botão Voar recebe foco ao iniciar/retomar e mantém espaço/↑ seguráveis; Enter e ativação assistiva continuam disponíveis. Modificadores e composição de texto não acionam os atalhos do jogo. Seletores, resumos e elementos com tabindex recebem foco visível.
- Saída do aplicativo (blur, visibilitychange e pagehide), restauração do histórico e saída da tela cheia mantêm o voo pausado, comandos limpos e retorno explícito com contagem. Rotação durante o voo explica a pausa. Áudio suspenso/interrompido é recuperado por interação, com tons antigos cancelados ao ocultar a página.
- Contagem tem sinal curto e texto anunciado a cada número. Ataques oferecem sons distintos opcionais e anúncio textual, uma vez por encontro; os avisos visuais existentes continuam iguais com áudio desligado. Nenhum novo som antecipa as janelas de aviso existentes ou muda a dificuldade. Não há síntese de fala obrigatória.
- Pausa compacta em telas baixas mantém Continuar, Ajustes e Início visíveis sem rolagem, com alvos de pelo menos 44 px. Áreas seguras continuam reservadas em ambos os lados do controle; diálogos têm largura descontando recortes. Menu pequeno admite rolagem interna se necessário; durante o voo a página continua sem rolagem. Retrato continua utilizável quando o navegador nega rotação/tela cheia.

Verificação: novos testes de lógica de deduplicação de avisos, contagem, áudio oculto/silenciado, cancelamento de tons e dispositivo interrompido/indisponível. Fluxo de navegador cobre preferências após recarga, teclado em controles nativos, captura/cancelamento do ponteiro, foco entre pausa/ajustes/voo, congelamento dos poderes, retorno do aplicativo/histórico, rotação, tela cheia e margens seguras simuladas. Matriz automatizada: Chromium, Firefox e WebKit; 1366×768, 320×568, 568×320, 390×844 e 844×390, com movimento reduzido. Capturas em `accessibility-108`.

Limites: eventos de ciclo de vida e recortes são simulados onde indicado, não representam troca real de aplicativos ou recortes físicos. Android/iPhone, teclado virtual real, Bluetooth/áudio interrompido pelo SO, leitores de tela e conforto dos avisos com pessoas continuam pendentes. A interface acessível não transforma o voo visual em uma experiência integralmente jogável sem visão. A matriz de aparelhos da beta continua necessária.

### Complemento da 1.0.8 — painéis responsivos antes da 1.0.9

As perguntas, observação, resultado, ajustes, guia, treino, ranking, missões, créditos e Chauapédia passaram a separar a área de leitura das ações. As áreas longas têm uma única rolagem interna; o painel externo permanece dentro da janela e os botões principais de resposta, continuidade, retorno, reinício ou fechamento ficam fora da região rolável. A página ao fundo não rola com um diálogo aberto. Cabeçalhos, tipografia e margens usam uma escala menor; telas baixas reduzem decoração em vez de reduzir o alvo de toque.

Ajustes aproveitam colunas no PC; guias e missões usam painéis mais largos. Regras complementares do guia e ranking podem ser expandidas. A Chauapédia mantém foto, conteúdo, fontes e créditos, com imagens e blocos mais compactos; abrir uma ficha começa no topo e voltar restaura a posição da lista. Explicações de perguntas continuam completas, com fonte e ação de continuar acessível. Nenhum texto usa truncamento ou limite artificial de linhas.

A matriz de regressão verifica os dez painéis em Chromium, Firefox e WebKit, em 1366×768, 1280×575 (janela semelhante ao relato), 1024×576, 640×384 (espaço CSS equivalente a zoom alto), 320×568, 390×844, 844×390 e 568×320. Mede rolagem externa/horizontal, área útil para leitura, visibilidade e hit testing das ações antes/depois de rolar, pergunta longa, descoberta expandida, explicação, observação e retorno entre telas. Capturas em `responsive-panels`. Leitura longa ainda pode exigir rolagem interna, preservando tamanho legível e todo o conteúdo. Zoom real do navegador, escala do SO e aparelhos físicos permanecem parte da validação humana.


## 1.0.9 — confiabilidade e manutenção

- Auditoria offline do pacote servido: grafo estático e imports dinâmicos literais (incluindo diagnóstico opcional), caminhos com capitalização correta, imagens, fontes, referências de controles, entrada da raiz, versões alinhadas, créditos e licenças. Confere hashes dos nove atlases aprovados e dos cinco atlases de runtime. Falha em módulos ou recursos publicados sem referência. O inventário distingue documentação/SCSS/manifestos de arte dos recursos de execução; não apaga fontes ou documentação histórica. O README v6 agora identifica explicitamente a cobra antiga como retirada.
- Carregamento de imagens e decodificação com tempo limite de 20 segundos e caches publicados apenas por lote completo. Tentativas falhas não deixam quadros parciais, inclusive quando pedidos antigos terminam depois. O botão Tentar carregar novamente repete a preparação, sem recarregar a página ou zerar o progresso. Não há troca silenciosa das artes obrigatórias.
- Cache de persistência invalidado por eventos de outras abas para registros já salvos; avanços ainda não salvos por falha de armazenamento permanecem na sessão. Leituras bem-sucedidas ficam disponíveis se o armazenamento passar a falhar. Aviso no início explica essa limitação. Novos placares inválidos são recusados sem reescrever o histórico; nomes inválidos não interrompem missões e retomadas.
- Regras v14, identificadores das perguntas e coleções, dados clássicos e arquivos de arte preservados. Não há migração destrutiva ou reset obrigatório.

Auditoria, matriz de falhas, validação e procedimento para publicar no fork: [confiabilidade-1.0.9.md](confiabilidade-1.0.9.md). Continuam pendentes os ensaios com pessoas e aparelhos físicos da beta.

### Refino das três telas na 1.0.9 · interface 1.0.9-ui6

- Inicial de telefone em retrato com espaço próprio para o Chauá ao lado do título, usando a mesma arte e o mesmo desenho único do Canvas. Telas muito pequenas e o teclado mantêm o arranjo compacto anterior. Menu com agrupamento e foco mais claros.
- Pausa com prioridade para Continuar, seguida de Controles e som e Início. O aviso nativo do Chrome sobre sair da tela cheia pertence ao navegador. A entrada em tela cheia aguarda o tamanho se estabilizar antes da contagem, para evitar que a rotação de abertura seja tratada como rotação durante o voo. Mudanças de orientação em voo continuam pausando.
- Resultado mantém título e três estatísticas fora da região rolável; o resumo educativo e as explicações permanecem completos na leitura interna. Em telas horizontais baixas, reinício e ações secundárias compartilham uma linha; uma retomada disponível continua acessível.
- HTML identifica a revisão da interface. CSS e o grafo de módulos usam a mesma revisão no endereço, com import map anterior à entrada. Isso evita misturar arquivos novos com respostas antigas de cache ao abrir um HTML novo. A entrada da raiz e as artes permanecem nos endereços anteriores. A auditoria verifica a coerência; `node scripts/set-game-version.mjs VERSAO [REVISAO]` regenera os endereços e o mapa. HTML antigo ainda requer atualização da página/CDN; não há limpeza ou migração de progresso.

Regressão dedicada nos três motores: retrato semelhante às capturas (384×706 e 393×727), 320×480, 320×568, 844×390, 568×320 e PC 1280×575, 1366×638, 1280×600, 1024×600 e 768×600; abertura com rotação atrasada, rotação em voo, revisão coerente dos módulos e estatísticas visíveis após rolar o resumo. Capturas em `three-screen-refinement`.


### Polimento 1.0.9.1

- Controles explícitos de entrar/sair da tela cheia no início, voo, pausa e resultado. O rótulo acompanha o estado do navegador. Mudanças durante o voo pausam com segurança, sem retomar automaticamente. Negação ou ausência da API mantém o jogo utilizável.
- Removidos os dois assobios sintetizados periódicos: não eram gravação nem reprodução validada de vocalização do chauá. Permanecem vento, clima e sinais abstratos das ações.
- Inicial de telefone em retrato reorganizada: título central, personagem em área delimitada, cartão de início e navegação compacta. A árvore do personagem fica restrita à área de ilustração; o personagem é ocultado durante o teclado virtual e nos modos compactos sem área de ilustração. Mesmas artes, sem duplicação de sprite.
- Proteção temporária após colisão não permite ignorar madeira: contatos corrigem posição e interpolação para a passagem livre, não renovam a proteção nem consomem outro escudo e não dão ponto por passagem limpa.
- Identificação pública 1.0.9.1; pacote/runtime SemVer `1.0.9-1`, interface `1.0.9-1-ui2`. O gerador aceita sufixo numérico e a interface o apresenta com ponto. Sem alteração de regras do ranking, coleção ou progresso.
- Regressões de lógica cobrem contatos com madeira após recuperação no chão/copa e ausência de vocalizações sintetizadas no ambiente. Navegador cobre saída/reentrada da tela cheia, pausa preservada, resultado, API negada e teclado virtual simulado nos três motores. Sessões reais continuam na beta.

APK: pode ser planejado depois com um contêiner Android como Capacitor, empacotando os recursos locais. Não integra este polimento. É necessário validar armazenamento, áudio, orientação, ciclo de vida, assinatura e desempenho no aplicativo Android.


## 1.0.10 — beta preparada; coleta real pendente

A versão 1.0.10 disponibiliza **Participar da beta** em Sobre o projeto e nos Ajustes. A coleta é opcional e local; só começa por ação explícita. Relatórios incluem aparelho autodeclarado, intervalos de voo visível/com foco, trechos/perfis, tentativas e feedback de diversão, clareza, conforto, conteúdo e problemas classificados. Treino, pausas e menus não entram nos intervalos de voo. Não há upload, armazenamento do relatório ou exportação do nome do jogador. Sem coleta, o módulo nem é carregado no jogo comum.

Roteiro, matriz física planejada, interpretação das métricas, privacidade, gravidades e critérios: [beta-1.0.10.md](beta-1.0.10.md). Registro de problemas vazio e pronto para preenchimento: [beta-registro.csv](beta-registro.csv).

A 1.0.10 **não está concluída pela preparação da ferramenta**. Iniciantes, jogadores habituais e educadores em Android, iPhone e notebook ainda precisam realizar as sessões. Evidências geradas pelo CI são identificadas como simuladas. A 1.0.11 depende da revisão dos resultados, não da simples troca da versão.


## 1.0.10.1 — composição das árvores e pausa em tela cheia

Extensão da casca por faixas em cache, revisão da árvore podre e sua neve e proteção da ordem da pausa após tela cheia. Detalhes e limites em [arvores-1.0.10.1.md](arvores-1.0.10.1.md). A beta física da 1.0.10 continua pendente.

## 1.0.11 — candidata em validação

Funcionalidades congeladas; consolidação das correções de tela cheia, árvores e neve da 1.0.10.1. Corrigidas as oito falhas de manutenção identificadas na suíte anterior: simulações de Canvas, expectativas antigas de desenho dos troncos, assinatura de arte e inventário de workflows. As verificações de geometria, integridade e fluxo permanecem obrigatórias.

Pacote, interface e grafo de módulos alinhados em 1.0.11. Escopo, requisitos, limitações, critérios e referência de retorno em [candidata-1.0.11.md](candidata-1.0.11.md). A validação desta revisão depende do CI do PR #78; a beta física e a aprovação para 2.0.0 continuam pendentes.
