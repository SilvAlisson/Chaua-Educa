# Chauá Educa — V2, branch única de teste com avisos de texto opcionais

Branch: `teste-v2-performance-sem-avisos-texto`.

## Inclui
- Base da `otimizacao-para-a-v2` com as correções gráficas, físicas, de colisão e o coletor automático por partida.
- As quatro melhorias aprovadas do PR #84: clima sem cálculo redundante por gota, varredura única do SAT, menos objetos temporários nas placas e identificação de perfil reutilizável na telemetria.
- Diagnóstico do PR #85: contagem de avisos ativos nos stutters e spans de tempo para layout, pintura, acessibilidade e áudio quando o diagnóstico profundo está habilitado.
- Ajuste na regressão do PR #85: a saída antecipada para alertas livres agora ocorre no próprio laço de posicionamento. Alertas aglomerados percorrem o mesmo conjunto de candidatos do algoritmo anterior, sem uma varredura extra.
- Modo A/B: placas de texto de cobras/gaviões DESLIGADAS por padrão. Reative em **Ajustes → Mostrar placas de texto de ataques (teste A/B)**. O sinal sonoro e os avisos para leitores de tela continuam presentes, bem como as animações autorais.
- Histórico de até dez relatórios por partida, com modo de avisos de texto nas configurações, snapshots e stutters.
- `index.html` na raiz para o GitHub Pages, preservando parâmetros de consulta.

## Limites e evidências
A comparação anterior no Android mostrou cerca de 59 FPS em partidas de 33–74 s, versus 43,78 FPS em uma partida anterior. Como o clima, a progressão e a revisão do jogo eram diferentes, isso NÃO prova uma causalidade nem 60 FPS estáveis. Picos isolados de callback >30 ms requerem diagnóstico adicional.

A hipótese das mensagens é plausível, mas o custo de desenhar/posicionar a placa ainda não foi isolado na GPU do dispositivo. Não removemos HUD, perguntas educativas, pontuação, sons de segurança ou conteúdos acessíveis; somente a placa textual *sobre* a cena fica desativada por padrão, e pode ser restaurada com um clique.

## Procedimento no mesmo Android
1. Usar sempre a mesma qualidade e o mesmo clima, preferencialmente primeiro chuva e depois inverno.
2. Jogar 3 partidas com `Mostrar placas de texto de ataques` DESLIGADO e baixar o histórico JSON.
3. Ativar a opção; repetir 3 partidas comparáveis e baixar outro histórico JSON.
4. Comparar FPS médio, 1% low, P95/P99, quadros >22/33 ms, e os eventos registrados quando havia 0, 1, 2 ou 3 cobras. FPS não pode ser inferido do microbenchmark de posicionamento.
5. A versão registra `provenance.testBranch` e `settings.textWarningsShownAtEnd` para identificar o teste.

A `main` permanece intacta. Não concluir merge definitivo antes de QA e A/B no celular.
