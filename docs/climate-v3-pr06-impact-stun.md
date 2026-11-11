# Chauá Educa — Climas V3 / Etapa 6: colisões e atordoamento

## Dois resultados distintos, uma única fonte de verdade

As durações estão centralizadas em `ACTION_TIMINGS` dentro de
`js/action-states.mjs`. **O escudo não é uma morte**, e o Game Over não
deve interromper a pose atordoada antes de sua conclusão.

### Colisão protegida
- O escudo é consumido uma única vez.
- O Chauá usa a spritesheet **original** `parrot-impact` para a reação
  curta de **0,30 s**, depois retoma o voo.
- A janela de invencibilidade física permanece a que já existia
  (`CONTACT.grace`), sem alterar pontuação, hitboxes ou o sistema de
  entrada.
- Cobra e gavião conservam as spritesheets existentes de atordoamento e
  recuam sem causar Game Over. Troncos mantêm as regras atuais.

### Colisão fatal
- O voo entra em `impact`, congelando distância, pontuação, posição e
  velocidade enquanto a animação termina.
- O movimento de contato e recuo dura **0,32 s**. A pose final da mesma
  spritesheet `parrot-impact` fica exibida por mais **0,88 s**.
- Pequenas estrelas já existentes continuam girando no entorno do
  personagem até a abertura da tela de Game Over, **sem desenhar
  uma segunda cabeça ou alterar a silhueta**.
- A transição `impact → ended` ocorre após **1,20 s**; o diálogo só abre
  em `ended`, conforme `js/script.js`. Não foi criado outro timer de UI.
- O evento de perda permanece único (emitido no contato); a tela é
  exibida no final do atordoamento.
- Acidentes com madeira, cobra, gavião e limites da área compartilham o
  mesmo fluxo. A derrota por erro no quiz continua imediata.
- Com a configuração de movimento reduzido, a derrota é imediata, sem
  impor espera desnecessária para acessibilidade.

## Escopo do PR
- `js/action-states.mjs`: `parrotImpact:1.2`,
  `parrotRecoil:.32` e `shieldRebound:.30`; pose final estável.
- `js/engine.mjs`: usa duração central, sem modificar colisões ou física.
- `js/render.mjs`: estrela visível também quando a arte nova de impacto
  está ativa, pose estabilizada após a reação inicial.
- `tests/impact.test.mjs`, `tests/engine.test.mjs` e
  `tests/action-states.test.mjs`: expectativas antigas atualizadas.
- `tests/impact-v3.test.mjs`: novos casos de madeira, limites,
  gavião, cobra, escudo e movimento reduzido.
- `tests/browser-impact-v3.cjs`: capturas de poses (contato, recuo,
  atordoamento, Game Over e recuperação) em desktop e mobile,
  **preparadas para execução na Etapa 7**.

## Regras de integração

Branch empilhada no PR #68 (baforadas) → PR #67 (inverno) →
PR #66 (chuva) → PR #65 (estações) → PR #64 (calibração).
O PR #62 tinha uma correção anterior de 1,2 s, que foi consolidada
nesta implementação; o PR #63 experimental permanece isolado.

**Não fazer merge isoladamente.** O proprietário solicitou adiar
revisão visual, testes manuais e auditoria consolidada para a
**Etapa 7**, quando todos os PRs forem integrados em uma branch de
pré-merge. Capturas, comparações de sprites, regressões e FPS
reais serão verificados nesse momento. A presença de testes escritos
não equivale a afirmar que já passaram.
