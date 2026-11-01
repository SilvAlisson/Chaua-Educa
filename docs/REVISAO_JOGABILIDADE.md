# Revisão de jogabilidade e apresentação — 31/10/2026

Base revisada: `main` em `129f7fac` e as correções iniciais do PR #20. A primeira análise da conversa usou outro repositório, `ChauaEduca`, de 2023. Aquela lista não descreve integralmente esta implementação.

## O que já estava resolvido na versão atual

Quiz obrigatório com `dialog` e cancelamento por Esc impedido; entrada de toque; ranking com `textContent`; tratamento de armazenamento inválido; física em passo fixo; término idempotente com interrupção do processamento de perigos. As proteções adicionais do formulário no primeiro commit do PR são defensivas: o teste de repetição usa eventos de submit, e não demonstra que um jogador comum conseguia reiniciar o voo pressionando Enter na interface normal.

## Falhas confirmadas nesta revisão

| Área | Evidência anterior | Correção |
| --- | --- | --- |
| Visão no celular | Em 390×844, `worldWidth` dizia 960, mas `view.w/view.scale` era 295,73. Restavam cerca de 0,40 s entre a entrada visível de um predador e seu alcance, contra cerca de 2 s em 1440×960. | Enquadramento usa a largura efetivamente visível, mantém pelo menos 1,65 s no cenário de teste (350 unidades/s, margem de 50 unidades) e reserva espaço para controles. Fundo continua preenchendo a tela. |
| Área segura | O enquadramento especial só funcionava quando os insets eram exatamente 24 e 20, os valores usados no teste. | Mesma regra para quaisquer insets; testes também usam 0, 12, 23, 25 e 47. |
| Posição do jogador | `game.x` variava com `viewWidth`; mudar a janela podia deslocar o jogador dentro de encontros. | Âncora física fixa, inclusive em telas largas; movimento adicional só no pouso. |
| Árvores | Metadados usavam 180–185 pixels para o núcleo de imagens cujas regiões de madeira perto da abertura têm aproximadamente 600–620 pixels. A arte ficava muito mais larga que a colisão. | Escalas e âncoras recalibradas; continuação do tronco mantém 58 unidades, como o núcleo físico. Folhas e pequenos detalhes continuam decorativos. |
| Cobra | Para um tronco em x=400, a cabeça desenhada começava aproximadamente em x=360, enquanto o primeiro retângulo de colisão começava em x=451. | Recorte, escala e posição vêm da mesma geometria. Cabeça se apoia na borda do tronco; animação não estende a área perigosa. |
| Galhos | O padrão `branch` não definia `variant`; o gerador sorteava apenas plain/broken/hollow. A cobra de galho não surgia por esse caminho. | Variante e cobra de galho são realmente instanciadas e testadas. |
| Gavião | Aviso e linha desapareciam ao terminar a contagem, mesmo com o animal ainda fora da tela. Rotas quase sempre ignoravam um jogador no centro. | Aviso acompanha a aproximação. A rota é definida na geração, em relação à região do voo, e não persegue o jogador depois. Controle precisa desviar; não basta permanecer no centro. |
| Dificuldade | Dois modos usavam a mesma cadência base de encontros e avisos de gavião. Os testes anteriores não demonstravam uma separação consistente do ritmo. | Amigável tem aberturas maiores, encontros mais espaçados, menor aceleração máxima e introdução posterior dos animais. Avisos de 2,2 s versus 1,7 s. |
| Teste de percurso | Piloto anterior buscava apenas o centro das árvores, sem desviar dos gaviões. | Piloto considera trajetórias anunciadas; regressões incluem atraso de 120 ms e decisões a 30 Hz, sem poderes. |

## Polimento visual

Batida principal da asa do gavião usa articulação separada do torso, com ritmo diferente em mergulho. Corpo e cabeça permanecem na trajetória anunciada. As transições das poses continuam opacas. O Chauá mantém a resposta de toque/segurar, poses interpoladas, cauda secundária e impacto curto; pausas e movimento reduzido continuam respeitados.

Troncos se alinham à madeira sólida; folhas próximas têm forma pontuda, dobra iluminada e vento suave. A névoa distante, os cipós, a luz, a folhagem de copa e a camada de musgo dão profundidade. A linha do chão e a copa enquadram a área real de voo, sem adicionar perigos decorativos. O recuo da cobra mantém o tronco e o galho visíveis.

## Validação

- 132 testes automatizados de lógica/geometria/renderização instrumentada, incluindo nove novos testes de experiência, além das regressões anteriores.
- 80 percursos completos sem poderes nos testes existentes, agora desviando dos gaviões; mais 24 com atraso de reação de 120 ms, decisões a 30 Hz e visão limitada ao cenário visível.
- Dois percursos completos no Chromium, com eventos de teclado pela interface e relógio de renderização controlado: Desafio 105,76 s, 214 pontos; Amigável 119,18 s, 174 pontos. Ambos passaram pelos quatro trechos, cobras de tronco/galho, gaviões e mergulhos, com três perguntas respondidas. São comandos simulados, não uma avaliação humana de diversão ou de acessibilidade visual.
- Teste de interface com teclado, toque, cancelamento de toque, quiz obrigatório, pausa, derrota, vitória, reinício e persistência em cinco tamanhos de tela.
- Inspeção de capturas com as artes reais e checagem de continuidade das poses. Medidas locais de renderização são do ambiente de teste, não promessa de FPS em celulares físicos.

As mudanças de ritmo inauguram `floresta-v5`: resultados v4 ficam no Histórico, preservados. Pontos, coleção, missões e perguntas antigas não são apagados.

## Fechamento das falhas visuais identificadas depois da revisão

A inspeção quadro a quadro do PR encontrou pendências adicionais: surgimento do abrigo em x=800 dentro do campo visível, fragmentos nas artes alternativas do gavião, reescala do corpo do Chauá durante efeitos e estrelas de impacto encobrindo parte do bico. Essas pendências foram corrigidas na atualização seguinte:

- Abrigo gerado além da borda direita, com margem para a arte inteira, entrada por deslocamento contínuo e interpolação entre ticks. Pausa também congela sua entrada.
- Predador usa uma arte base registrada, sem os fragmentos das imagens alternativas. A asa é articulada com máscara completa e junta coberta pelo corpo; o olho de atordoamento é desenhado sobre essa mesma base. Travessia e mergulho mantêm a mesma escala do corpo.
- Chauá não recebe mais achatamento, alongamento ou pulsação de escala em queda, turbo, coleta, cansaço ou impacto. As poses foram normalizadas por uma referência do bico, e a pose no instante da colisão é preservada. Olhos de reação foram reduzidos à região da pupila e as estrelas de impacto ficam acima da face.
- Perigos usam duas formas elípticas por ave (corpo e cabeça), acompanhando a inclinação. Colisões são calculadas por polígonos convexos de 20 vértices por elipse; penas, bico e pés continuam intencionalmente tolerantes. Cabeça da cobra usa forma arredondada. Núcleos de madeira seguem suas áreas sólidas, sem tornar a folhagem perigosa. Isso melhora a correspondência sem adotar colisão por pixel de cada pena.
- Troncos se prolongam até as bordas do cenário, sem terminar no recorte da faixa de voo. A linha reta do chão foi retirada. Folhas ganharam sombreamento gradual e posições menos regulares; o enquadramento e o espaço de reação permanecem os mesmos.

Validação adicional: 138 testes automatizados de lógica/geometria; comparação de pixels em 60 quadros do Chauá (poses e efeitos), sem variação da posição ou das dimensões do bico no conjunto testado; 144 quadros do predador em travessia e mergulho, sem fragmentos visíveis da ave separados do corpo. Os traços brancos translúcidos de vento são efeitos intencionais e não entram nessa contagem. A inspeção inclui a sobreposição das formas reais de colisão às imagens. Os dois percursos completos no navegador continuam chegando ao abrigo; interfaces de teclado/toque, movimento reduzido e cinco tamanhos de tela também foram verificados. Esses resultados cobrem os cenários descritos, não constituem garantia de ausência de qualquer defeito visual em todo dispositivo.

## Novas spritesheets e integração — 01/11/2026

Esta etapa substitui as poses antigas e a asa articulada do predador por três spritesheets novas. O diagnóstico acima registra o histórico das revisões; a implementação atual é a descrita aqui.

- **48 poses completas**: 16 do Chauá (voo, pouso, repouso, piscar, impacto/recuperação), 16 do predador (voo, planar, mergulho, recuo) e 16 da cobra (repouso, alerta, recolher/aparecer). Atlases 1536×1536, células de 384 px, transparência e margens verificadas. Originais, metadados, briefing de geração e instruções de reprodução ficam em [assets/v6](../Chaua-Educa-main/assets/v6/README.md).
- O voo usa quadros autorais inteiros, sem sobrepor duas posições distantes das asas. Isso evita penas duplicadas translúcidas. Pouso e reações usam transições compostas; a referência comum do bico reduz saltos de escala/posição. O mergulho não recebe a inclinação da arte duas vezes. Movimento reduzido mantém poses estáveis.
- A cobra inteira se recolhe e desaparece. O suporte não contém um corpo de cobra pintado na madeira. Troncos contínuos têm luz, anéis e casca desenhados em Canvas, sem inversão vertical nem emendas entre texturas. Folhagem se move independentemente da madeira sólida.
- A cabeça da cobra é registrada por quadro e usa os mesmos metadados na colisão, com pequenas variações durante a animação. Corpo/cabeça das aves mantêm formas arredondadas conservadoras; não há promessa de hitbox perfeita ou colisão por pixel de penas.
- Aproximação e pouso usam poses intermediárias e o mesmo suporte do repouso final. A celebração continua animada depois da vitória. O estado de vitória é limpo no reinício, evitando interferência na próxima chegada.
- Avisos de cobra e predador compartilham posicionamento que evita sobreposição nos cenários cobertos; a cobra de galho recebe texto específico. Limites físicos de copa/chão têm indicação discreta. Indicadores de poderes têm contraste maior e não invadem placar/pausa em 480×320 e 568×320.
- O carregamento do Canvas não baixa mais as antigas imagens de personagens e troncos que foram substituídas. Elas permanecem no repositório como referências.

Validação: 142 testes de lógica/geometria/renderização instrumentada, build Sass, verificações de pixels em 48 células autorais, 60 quadros do Chauá e 144 do predador. O teste visual considera conectividade em oito direções, para não tratar uma borda diagonal como fragmento separado. Testes de interface cobrem cinco resoluções, teclado/toque, quiz obrigatório, pausa, derrota, vitória e reinício; dois percursos no navegador completam as quatro etapas, com cobras, galhos, travessias, mergulhos e três perguntas. Capturas reais do renderizador foram inspecionadas, inclusive com as colisões sobrepostas. A avaliação de desempenho é local; não representa teste em celulares físicos.
