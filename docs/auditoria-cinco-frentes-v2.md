# Auditoria de desempenho V2 — cinco frentes independentes

Base comum: `d9ab79962a2f440005299886c91e04672b6979eb` (branch `otimizacao-para-a-v2`). As cinco propostas foram implementadas em branches isoladas e comparadas **somente depois** das alterações. Não foram executados cinco agentes autônomos: esta é uma divisão de cinco frentes técnicas, e não uma alegação de execução multiagente.

## 1. Renderização e composição — RETIDA PARA A/B

Branch: `experiment/v2-01-renderizacao`.

Proposta: substituir o blit completo de cada superfície sazonal por `drawImage` com retângulo de origem correspondente ao viewport. Esperado: menos pixels processados na borda de overscan; **incerto** porque navegadores normalmente já recortam a imagem destino. Riscos: mudança no caminho de amostragem da GPU, maior overhead das chamadas com nove parâmetros e diferenças em DPR fracionário. **Não integrada** sem teste de pixel exato e benchmark A/B na mesma GPU/dispositivo.

## 2. Chuva e clima — ACEITA COMO MICRO-OTIMIZAÇÃO

Branch: `experiment/v2-02-clima`.

Proposta: levantar para fora do loop de gotas os valores constantes de deslocamento de chuva, vento e velocidade. Mantém quantidade de gotas, cores, duas pinceladas, geometria e cálculos originais. Ganho esperado: menos leitura de propriedades e aritmética repetida por partícula; sem promessa de aumento de FPS em cena completa.

## 3. Colisão e física — ACEITA COM TESTE DE SAT

Branch: `experiment/v2-03-colisoes`.

Proposta: `shapesHitRect` percorre cada polígono uma única vez antes do SAT, eliminando a segunda varredura de AABB nos contatos próximos. Mantém as máscaras autorais, os mesmos limiares `<=` e `>=`, a ordem dos polígonos e o SAT. Teste de paridade: diversas rotações, posições e larguras do retângulo.

## 4. UI, memória e alertas — ACEITA COM PARIDADE DE POSIÇÃO

Branch: `experiment/v2-04-memoria-ui`.

Proposta: preservar exatamente o posicionamento de alertas, eliminando `flatMap`, `reduce` e a criação de um retângulo candidato por ponto. Teste de paridade: 420 configurações determinísticas em três tipos de viewport, incluindo múltiplos avisos e regiões protegidas. Ganho limitado aos quadros com avisos.

## 5. Coleta de desempenho — ACEITA COM TESTE DE HISTÓRICO

Branch: `experiment/v2-05-telemetria`.

Proposta: atualizar a string `quality-mode/level/resolution/decoration` apenas quando os quatro campos realmente mudam. Mantém FPS, quadros lentos, janelas de dez segundos, perfis registrados e o formato JSON; reduz a carga do próprio observador. Teste específico valida mudanças de perfil e segmentação temporal.

## Discussão crítica de trade-offs

- **Preservação visual ganha do microbenchmark**: rejeitada a cópia recortada da floresta até comprovar equivalência no Canvas e ganho repetível no celular.
- **Colisão só pode ser otimizada com equivalência matemática**: qualquer diferença nas máscaras ou no SAT é um bloqueador de merge.
- **Coleta não deve alterar o medido**: reduzir seu overhead ajuda, mas não resolverá stutters de GPU.
- **Essas quatro mudanças não são suficientes para afirmar 60 FPS**: as quedas de FPS de um dispositivo real exigem relatórios por partida e A/B controlado com as mesmas condições.
- **Não mexer em pixels autorais ou densidade de efeitos**: não alteramos resolução de spritesheets, chuva, neve, texturas, transparências ou animações.

## Critério de integração

Testes Node e Playwright aprovados, capturas sem diferenças relevantes, build/auditoria de release íntegros, e medição real comparativa de P95/P99, 1% low, quadros acima de 33 ms, consumo de memória e versão de jogo. Caso apareça regressão, reverter apenas o experimento responsável, sem reescrever outras partes.
